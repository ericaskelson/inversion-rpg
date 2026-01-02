/**
 * Editor Server - Provides API for editing character creation data
 * Run with: npm run dev:edit (starts both Vite and this server)
 * Endpoints:
 *   GET  /api/character-creation - Returns characterCreation.json
 *   PUT  /api/character-creation - Writes to characterCreation.json
 *   GET  /api/appearance-config  - Returns appearanceConfig.json
 *   PUT  /api/appearance-config  - Writes to appearanceConfig.json
 *   POST /api/portraits/generate - Generate portraits for selected combinations
 *   GET  /api/portraits/pending  - Get list of pending portraits
 *   POST /api/portraits/accept/:id - Accept a pending portrait
 *   DELETE /api/portraits/pending/:id - Reject a pending portrait
 *   GET  /api/portraits/generation-status - Get current generation status
 *   GET  /api/portraits/rate-limits - Get rate limit info
 *
 * Batch API Endpoints:
 *   POST /api/portraits/batch - Create a batch job
 *   GET  /api/portraits/batch - List all batch jobs
 *   GET  /api/portraits/batch/:id/status - Check batch job status
 *   POST /api/portraits/batch/:id/import - Import completed batch results
 *   DELETE /api/portraits/batch/:id - Delete a batch job record
 */

import express from 'express';
import cors from 'cors';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import https from 'https';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// editor-server.js is in src/, data files are in src/src/data/
const DATA_DIR = path.join(__dirname, 'src', 'data');
const PUBLIC_DIR = path.join(__dirname, 'public');
const PORTRAITS_DIR = path.join(PUBLIC_DIR, 'images', 'portraits');
const PENDING_DIR = path.join(PORTRAITS_DIR, 'pending');
const PENDING_META_FILE = path.join(PENDING_DIR, 'pending.json');
const BATCH_JOBS_FILE = path.join(DATA_DIR, 'batchJobs.json');

// Option images paths
const OPTIONS_DIR = path.join(PUBLIC_DIR, 'images', 'options');
const OPTIONS_PENDING_DIR = path.join(OPTIONS_DIR, 'pending');
const OPTIONS_PENDING_META_FILE = path.join(OPTIONS_PENDING_DIR, 'pending.json');
const OPTIONS_BATCH_JOBS_FILE = path.join(DATA_DIR, 'optionBatchJobs.json');

// Gemini API base URL
const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta';

// Maximum inline batch size (responses over ~100 images can exceed JS string limits)
// Each image is ~3MB base64, so 100 images = ~300MB response which is near the limit
const MAX_INLINE_BATCH_SIZE = 100;

// Generation state
let generationQueue = [];
let isGenerating = false;
let generationProgress = { current: 0, total: 0, currentItem: null };

// Rate limit tracking (from API response headers)
let rateLimitInfo = {
  model: null,
  remaining: null,
  limit: null,
  reset: null,
  lastUpdated: null
};

// Available image generation models
// Note: Try both variants if one fails - Google's naming is inconsistent
const IMAGE_MODELS = {
  'nano-banana-pro': 'gemini-3-pro-image-preview',
  'nano-banana': 'gemini-2.5-flash-image'  // Official docs use this (not -preview-)
};

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Helper to read JSON file
async function readJsonFile(filename) {
  const filepath = path.join(DATA_DIR, filename);
  const content = await fs.readFile(filepath, 'utf-8');
  return JSON.parse(content);
}

// Helper to write JSON file (pretty-printed)
async function writeJsonFile(filename, data) {
  const filepath = path.join(DATA_DIR, filename);
  await fs.writeFile(filepath, JSON.stringify(data, null, 2) + '\n', 'utf-8');
}

// GET /api/character-creation
app.get('/api/character-creation', async (req, res) => {
  try {
    const data = await readJsonFile('characterCreation.json');
    res.json(data);
  } catch (err) {
    console.error('Error reading characterCreation.json:', err);
    res.status(500).json({ error: 'Failed to read character creation data' });
  }
});

// PUT /api/character-creation
app.put('/api/character-creation', async (req, res) => {
  try {
    await writeJsonFile('characterCreation.json', req.body);
    res.json({ success: true });
  } catch (err) {
    console.error('Error writing characterCreation.json:', err);
    res.status(500).json({ error: 'Failed to write character creation data' });
  }
});

// GET /api/appearance-config
app.get('/api/appearance-config', async (req, res) => {
  try {
    const data = await readJsonFile('appearanceConfig.json');
    res.json(data);
  } catch (err) {
    console.error('Error reading appearanceConfig.json:', err);
    res.status(500).json({ error: 'Failed to read appearance config' });
  }
});

// PUT /api/appearance-config
app.put('/api/appearance-config', async (req, res) => {
  try {
    await writeJsonFile('appearanceConfig.json', req.body);
    res.json({ success: true });
  } catch (err) {
    console.error('Error writing appearanceConfig.json:', err);
    res.status(500).json({ error: 'Failed to write appearance config' });
  }
});

// ============================================
// PORTRAIT GENERATION ENDPOINTS
// ============================================

// Ensure directories exist
async function ensurePortraitDirs() {
  await fs.mkdir(PORTRAITS_DIR, { recursive: true });
  await fs.mkdir(PENDING_DIR, { recursive: true });
}

// Read pending portraits metadata
async function readPendingMeta() {
  try {
    const content = await fs.readFile(PENDING_META_FILE, 'utf-8');
    return JSON.parse(content);
  } catch {
    return [];
  }
}

// Write pending portraits metadata
async function writePendingMeta(data) {
  await ensurePortraitDirs();
  await fs.writeFile(PENDING_META_FILE, JSON.stringify(data, null, 2), 'utf-8');
}

// Build the prompt for a portrait
function buildPrompt(config, params) {
  let prompt = config.basePrompt
    .replace('{sex}', params.sex)
    .replace('{race}', params.race)
    .replace('{build}', params.build)
    .replace('{skinTone}', params.skinTone)
    .replace('{hairColor}', params.hairColor);

  if (config.styleModifiers) {
    prompt += '. ' + config.styleModifiers;
  }

  return prompt;
}

// Generate a single portrait using Gemini API
async function generatePortrait(prompt, config) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY environment variable not set');
  }

  // Get model from config, default to nano-banana-pro
  const modelKey = config.model || 'nano-banana-pro';
  const model = IMAGE_MODELS[modelKey] || IMAGE_MODELS['nano-banana-pro'];
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

  console.log(`  Using model: ${model} (${modelKey})`);

  // Flash image doesn't support imageSize, only Pro does
  const imageConfig = { aspectRatio: config.aspectRatio || '3:4' };
  if (modelKey === 'nano-banana-pro' && config.imageSize) {
    imageConfig.imageSize = config.imageSize;
  }

  const requestBody = JSON.stringify({
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: {
      responseModalities: ['TEXT', 'IMAGE'],  // Must include TEXT for Flash model
      imageConfig
    }
  });

  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const options = {
      hostname: urlObj.hostname,
      path: urlObj.pathname + urlObj.search,
      method: 'POST',
      headers: {
        'x-goog-api-key': apiKey,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(requestBody)
      }
    };

    const req = https.request(options, (res) => {
      // Track rate limit headers
      const remaining = res.headers['x-ratelimit-remaining'];
      const limit = res.headers['x-ratelimit-limit'];
      const reset = res.headers['x-ratelimit-reset'];

      if (remaining !== undefined || limit !== undefined) {
        rateLimitInfo = {
          model: modelKey,
          remaining: remaining ? parseInt(remaining, 10) : null,
          limit: limit ? parseInt(limit, 10) : null,
          reset: reset || null,
          lastUpdated: new Date().toISOString()
        };
      }

      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (json.error) {
            console.error('  API error:', json.error.message);
            reject(new Error(json.error.message || 'API error'));
            return;
          }

          // Find the image part (might be TEXT + IMAGE in response)
          const parts = json.candidates?.[0]?.content?.parts || [];
          const imagePart = parts.find(p => p.inlineData?.data);

          if (!imagePart) {
            console.error('  No image in response. Parts:', parts.map(p => Object.keys(p)));
            reject(new Error('No image data in response'));
            return;
          }

          resolve(Buffer.from(imagePart.inlineData.data, 'base64'));
        } catch (e) {
          console.error('  Parse error:', e.message);
          reject(e);
        }
      });
    });

    req.on('error', reject);
    req.write(requestBody);
    req.end();
  });
}

// Process the generation queue
async function processGenerationQueue() {
  if (isGenerating || generationQueue.length === 0) return;

  isGenerating = true;
  const appearanceConfig = await readJsonFile('appearanceConfig.json');
  const config = appearanceConfig.portraitConfig || {
    basePrompt: 'Fantasy RPG character portrait. A {sex} {race} with a {build} build, {skinTone} skin, and {hairColor} hair.',
    styleModifiers: 'Dark fantasy art style, painterly, dramatic lighting',
    aspectRatio: '3:4',
    imageSize: '1K'
  };

  generationProgress.total = generationQueue.length;
  generationProgress.current = 0;

  while (generationQueue.length > 0) {
    const item = generationQueue.shift();
    generationProgress.current++;
    generationProgress.currentItem = item;

    try {
      const prompt = buildPrompt(config, item);
      console.log(`Generating (${generationProgress.current}/${generationProgress.total}): ${item.id}`);

      const imageBuffer = await generatePortrait(prompt, config);

      // Save to pending
      await ensurePortraitDirs();
      const filename = `${item.id}.png`;
      const filepath = path.join(PENDING_DIR, filename);
      await fs.writeFile(filepath, imageBuffer);

      // Update pending metadata
      const pending = await readPendingMeta();
      pending.push({
        id: item.id,
        tempPath: `portraits/pending/${filename}`,
        build: item.build,
        skinTone: item.skinTone,
        hairColor: item.hairColor,
        sex: item.sex,
        race: item.race,
        generatedAt: new Date().toISOString(),
        prompt: prompt
      });
      await writePendingMeta(pending);

      console.log(`  Saved: ${filename}`);

      // Small delay to avoid rate limiting
      await new Promise(r => setTimeout(r, 1000));
    } catch (err) {
      console.error(`  Failed to generate ${item.id}:`, err.message);
    }
  }

  isGenerating = false;
  generationProgress = { current: 0, total: 0, currentItem: null };
}

// POST /api/portraits/generate - Queue portrait generation
app.post('/api/portraits/generate', async (req, res) => {
  try {
    const { builds, skinTones, hairColors, sexes, races, count = 1 } = req.body;

    if (!builds?.length || !skinTones?.length || !hairColors?.length ||
        !sexes?.length || !races?.length) {
      return res.status(400).json({ error: 'Must select at least one option from each category' });
    }

    // Clamp count to reasonable limits
    const perCombo = Math.max(1, Math.min(10, count));

    // Generate all combinations with unique IDs (timestamp suffix allows multiple per combo)
    const combinations = [];
    const timestamp = Date.now();
    let counter = 0;
    for (const build of builds) {
      for (const skinTone of skinTones) {
        for (const hairColor of hairColors) {
          for (const sex of sexes) {
            for (const race of races) {
              // Generate 'count' portraits for each combination
              for (let i = 0; i < perCombo; i++) {
                // Use timestamp + counter for unique IDs, allowing multiple portraits per characteristic set
                const id = `${sex}-${race}-${build}-${skinTone}-${hairColor}-${timestamp}-${counter++}`;
                combinations.push({ id, build, skinTone, hairColor, sex, race });
              }
            }
          }
        }
      }
    }

    // Add to queue (skip duplicates)
    const existingIds = new Set(generationQueue.map(item => item.id));
    const newItems = combinations.filter(c => !existingIds.has(c.id));
    generationQueue.push(...newItems);

    // Start processing if not already
    processGenerationQueue();

    res.json({
      queued: newItems.length,
      total: generationQueue.length,
      message: `Queued ${newItems.length} portraits for generation`
    });
  } catch (err) {
    console.error('Error queuing portraits:', err);
    res.status(500).json({ error: 'Failed to queue portrait generation' });
  }
});

// GET /api/portraits/pending - Get pending portraits
app.get('/api/portraits/pending', async (req, res) => {
  try {
    await ensurePortraitDirs();
    const pending = await readPendingMeta();
    res.json(pending);
  } catch (err) {
    console.error('Error reading pending portraits:', err);
    res.status(500).json({ error: 'Failed to read pending portraits' });
  }
});

// GET /api/portraits/generation-status - Get generation progress
app.get('/api/portraits/generation-status', (req, res) => {
  res.json({
    isGenerating,
    progress: generationProgress,
    queueLength: generationQueue.length
  });
});

// GET /api/portraits/rate-limits - Get current rate limit info
app.get('/api/portraits/rate-limits', (req, res) => {
  res.json(rateLimitInfo);
});

// POST /api/portraits/accept/:id - Accept a pending portrait
app.post('/api/portraits/accept/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const pending = await readPendingMeta();
    const portrait = pending.find(p => p.id === id);

    if (!portrait) {
      return res.status(404).json({ error: 'Pending portrait not found' });
    }

    // Move file from pending to portraits (detect extension from tempPath)
    const ext = portrait.tempPath ? path.extname(portrait.tempPath) : '.png';
    const srcPath = path.join(PENDING_DIR, `${id}${ext}`);
    const destPath = path.join(PORTRAITS_DIR, `${id}${ext}`);
    await fs.rename(srcPath, destPath);

    // Add to appearance config
    const config = await readJsonFile('appearanceConfig.json');

    // Check if portrait already exists (shouldn't, but just in case)
    const existingIndex = config.portraits.findIndex(p => p.id === id);
    const newPortrait = {
      id: portrait.id,
      name: `${portrait.sex} ${portrait.race} (${portrait.build})`,
      image: `portraits/${id}${ext}`,
      build: portrait.build,
      skinTone: portrait.skinTone,
      hairColor: portrait.hairColor,
      sex: portrait.sex,
      race: portrait.race
    };

    if (existingIndex >= 0) {
      config.portraits[existingIndex] = newPortrait;
    } else {
      config.portraits.push(newPortrait);
    }
    await writeJsonFile('appearanceConfig.json', config);

    // Remove from pending
    const newPending = pending.filter(p => p.id !== id);
    await writePendingMeta(newPending);

    res.json({ success: true, portrait: newPortrait });
  } catch (err) {
    console.error('Error accepting portrait:', err);
    res.status(500).json({ error: 'Failed to accept portrait' });
  }
});

// DELETE /api/portraits/pending/:id - Reject a pending portrait
app.delete('/api/portraits/pending/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const pending = await readPendingMeta();
    const portrait = pending.find(p => p.id === id);

    if (!portrait) {
      return res.status(404).json({ error: 'Pending portrait not found' });
    }

    // Delete the image file (detect extension from tempPath)
    const ext = portrait.tempPath ? path.extname(portrait.tempPath) : '.png';
    const filepath = path.join(PENDING_DIR, `${id}${ext}`);
    try {
      await fs.unlink(filepath);
    } catch {
      // File might not exist, that's okay
    }

    // Remove from pending metadata
    const newPending = pending.filter(p => p.id !== id);
    await writePendingMeta(newPending);

    res.json({ success: true });
  } catch (err) {
    console.error('Error rejecting portrait:', err);
    res.status(500).json({ error: 'Failed to reject portrait' });
  }
});

// POST /api/portraits/accept-all - Accept all pending portraits
app.post('/api/portraits/accept-all', async (req, res) => {
  try {
    const pending = await readPendingMeta();
    if (pending.length === 0) {
      return res.json({ success: true, accepted: 0 });
    }

    const config = await readJsonFile('appearanceConfig.json');
    let accepted = 0;

    for (const portrait of pending) {
      try {
        // Move file (detect extension from tempPath)
        const ext = portrait.tempPath ? path.extname(portrait.tempPath) : '.png';
        const srcPath = path.join(PENDING_DIR, `${portrait.id}${ext}`);
        const destPath = path.join(PORTRAITS_DIR, `${portrait.id}${ext}`);
        await fs.rename(srcPath, destPath);

        // Add to config
        const newPortrait = {
          id: portrait.id,
          name: `${portrait.sex} ${portrait.race} (${portrait.build})`,
          image: `portraits/${portrait.id}${ext}`,
          build: portrait.build,
          skinTone: portrait.skinTone,
          hairColor: portrait.hairColor,
          sex: portrait.sex,
          race: portrait.race
        };

        const existingIndex = config.portraits.findIndex(p => p.id === portrait.id);
        if (existingIndex >= 0) {
          config.portraits[existingIndex] = newPortrait;
        } else {
          config.portraits.push(newPortrait);
        }
        accepted++;
      } catch (e) {
        console.error(`Failed to accept ${portrait.id}:`, e.message);
      }
    }

    await writeJsonFile('appearanceConfig.json', config);
    await writePendingMeta([]);

    res.json({ success: true, accepted });
  } catch (err) {
    console.error('Error accepting all portraits:', err);
    res.status(500).json({ error: 'Failed to accept portraits' });
  }
});

// DELETE /api/portraits/pending - Reject all pending portraits
app.delete('/api/portraits/pending', async (req, res) => {
  try {
    const pending = await readPendingMeta();

    // Delete all image files (detect extension from tempPath)
    for (const portrait of pending) {
      try {
        const ext = portrait.tempPath ? path.extname(portrait.tempPath) : '.png';
        const filepath = path.join(PENDING_DIR, `${portrait.id}${ext}`);
        await fs.unlink(filepath);
      } catch {
        // Ignore errors
      }
    }

    await writePendingMeta([]);
    res.json({ success: true, rejected: pending.length });
  } catch (err) {
    console.error('Error rejecting all portraits:', err);
    res.status(500).json({ error: 'Failed to reject portraits' });
  }
});

// ============================================
// BATCH API ENDPOINTS
// ============================================

// Read batch jobs from persistent storage
async function readBatchJobs() {
  try {
    const content = await fs.readFile(BATCH_JOBS_FILE, 'utf-8');
    return JSON.parse(content);
  } catch {
    return [];
  }
}

// Write batch jobs to persistent storage
async function writeBatchJobs(jobs) {
  await fs.writeFile(BATCH_JOBS_FILE, JSON.stringify(jobs, null, 2), 'utf-8');
}

// Make a request to Gemini API and return JSON response
// Cache for batch job responses (to avoid double-download on status then import)
const batchResponseCache = new Map();

// Temp directory for large response files
const TEMP_DIR = path.join(__dirname, 'temp');

function geminiRequest(method, endpoint, body = null) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return Promise.reject(new Error('GEMINI_API_KEY not set'));
  }

  const url = `${GEMINI_API_BASE}${endpoint}`;
  const urlObj = new URL(url);

  return new Promise((resolve, reject) => {
    const options = {
      hostname: urlObj.hostname,
      path: urlObj.pathname + urlObj.search + (urlObj.search ? '&' : '?') + `key=${apiKey}`,
      method: method,
      headers: {
        'Content-Type': 'application/json',
      }
    };

    const req = https.request(options, (res) => {
      // Use array of buffers to handle large responses without hitting string length limits
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => {
        try {
          const data = Buffer.concat(chunks).toString('utf-8');
          const json = JSON.parse(data);
          resolve(json);
        } catch (e) {
          const preview = Buffer.concat(chunks).toString('utf-8').substring(0, 200);
          reject(new Error(`Failed to parse response: ${preview}`));
        }
      });
    });

    req.on('error', reject);
    if (body) {
      const bodyStr = JSON.stringify(body);
      req.write(bodyStr);
    }
    req.end();
  });
}

// Stream large batch responses to a temp file, then process images incrementally
// Returns { done, response: { inlinedResponses: { inlinedResponses: [...] } } } structure
// but processes images directly from file without loading entire response into memory
async function fetchLargeBatchJob(jobId) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY not set');
  }

  const endpoint = `/${jobId}`;
  const url = `${GEMINI_API_BASE}${endpoint}`;
  const urlObj = new URL(url);

  // Ensure temp dir exists
  await fs.mkdir(TEMP_DIR, { recursive: true });
  const tempFile = path.join(TEMP_DIR, `batch-${Date.now()}.json`);

  return new Promise((resolve, reject) => {
    const options = {
      hostname: urlObj.hostname,
      path: urlObj.pathname + urlObj.search + `?key=${apiKey}`,
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      }
    };

    console.log(`  Streaming large batch response to temp file...`);

    const req = https.request(options, async (res) => {
      // Stream directly to file using sync fs to avoid import issues
      const fsSync = await import('fs');
      const fileStream = fsSync.createWriteStream(tempFile);
      let totalBytes = 0;

      res.on('data', chunk => {
        totalBytes += chunk.length;
        fileStream.write(chunk);
        // Log progress for large downloads
        if (totalBytes % (10 * 1024 * 1024) === 0) {
          console.log(`    Downloaded ${Math.round(totalBytes / 1024 / 1024)}MB...`);
        }
      });

      res.on('end', async () => {
        fileStream.end();
        const sizeMB = Math.round(totalBytes / 1024 / 1024);
        console.log(`  Downloaded ${sizeMB}MB to temp file`);

        // For very large files, we need to return the file path
        // and let the caller process it incrementally
        resolve({
          tempFile,
          sizeMB,
          cleanup: async () => {
            await fs.unlink(tempFile).catch(() => {});
          }
        });
      });

      res.on('error', async (err) => {
        fileStream.end();
        await fs.unlink(tempFile).catch(() => {});
        reject(err);
      });
    });

    req.on('error', async (err) => {
      await fs.unlink(tempFile).catch(() => {});
      reject(err);
    });
    req.end();
  });
}

// Parse batch job metadata from file (done status, etc) without loading images
// Note: The Gemini Batch API response structure varies:
//   - Sometimes has "done": true/false field
//   - Sometimes indicates completion via presence of "output" in metadata
async function parseBatchJobMetadata(tempFile) {
  const fd = await fs.open(tempFile, 'r');
  const stats = await fd.stat();
  const fileSize = stats.size;

  // Read first 8KB to check structure
  const startBuffer = Buffer.alloc(Math.min(8192, fileSize));
  await fd.read(startBuffer, 0, startBuffer.length, 0);
  const startText = startBuffer.toString('utf-8');

  // Method 1: Check for explicit "done" field
  let doneMatch = startText.match(/"done"\s*:\s*(true|false)/);

  // Method 2: Check for "output" in metadata (indicates job is complete)
  // Structure: { "metadata": { "output": { "inlinedResponses": ... } } }
  const hasOutput = startText.includes('"output"');

  // If no done field at start, check end of file
  if (!doneMatch && fileSize > 8192) {
    const endBuffer = Buffer.alloc(8192);
    const endPosition = Math.max(0, fileSize - 8192);
    await fd.read(endBuffer, 0, 8192, endPosition);
    const endText = endBuffer.toString('utf-8');
    doneMatch = endText.match(/"done"\s*:\s*(true|false)/);

    if (doneMatch) {
      console.log(`  Found "done" field at END of file (position ~${endPosition})`);
    }
  }

  await fd.close();

  // Job is done if: explicit done=true OR presence of output data
  const done = (doneMatch ? doneMatch[1] === 'true' : false) || hasOutput;
  console.log(`  Parsed metadata: done=${done} (doneField=${doneMatch?.[1] ?? 'none'}, hasOutput=${hasOutput}, fileSize=${Math.round(fileSize/1024/1024)}MB)`);

  return { done };
}

// Process images from large batch file incrementally using chunked reading
// Yields { key, imageBuffer, metadata } for each image found
// This avoids loading the entire file into memory by reading in chunks and
// extracting base64 image data as we find complete images
async function* extractImagesFromLargeFile(tempFile, requestMetadata) {
  const CHUNK_SIZE = 8 * 1024 * 1024;  // 8MB chunks
  const fileHandle = await fs.open(tempFile, 'r');
  const stats = await fileHandle.stat();
  const fileSize = stats.size;

  let buffer = '';
  let position = 0;
  let imageIndex = 0;
  const processedKeys = new Set();  // Track processed keys to avoid duplicates

  // Pattern to find image data - must be inside "inlineData" block
  // Structure: "inlineData": { "mimeType": "...", "data": "BASE64" }
  const inlineDataPattern = /"inlineData"\s*:\s*\{\s*"mimeType"\s*:\s*"[^"]+"\s*,\s*"data"\s*:\s*"/;
  const keyPattern = /"key"\s*:\s*"([^"]+)"/;

  console.log(`  Reading ${Math.round(fileSize / 1024 / 1024)}MB file in ${CHUNK_SIZE / 1024 / 1024}MB chunks...`);

  try {
    while (position < fileSize) {
      // Read next chunk
      const chunk = Buffer.alloc(Math.min(CHUNK_SIZE, fileSize - position));
      await fileHandle.read(chunk, 0, chunk.length, position);
      buffer += chunk.toString('utf-8');
      position += chunk.length;

      // Process complete images in buffer
      let searchStart = 0;
      while (true) {
        // Find "inlineData" block containing image
        const inlineMatch = buffer.slice(searchStart).match(inlineDataPattern);
        if (!inlineMatch) break;

        const dataStart = searchStart + inlineMatch.index + inlineMatch[0].length;

        // Find the end of the base64 string (closing quote)
        let dataEnd = -1;
        let escapeNext = false;
        for (let i = dataStart; i < buffer.length; i++) {
          if (escapeNext) {
            escapeNext = false;
            continue;
          }
          if (buffer[i] === '\\') {
            escapeNext = true;
            continue;
          }
          if (buffer[i] === '"') {
            dataEnd = i;
            break;
          }
        }

        // If we haven't found the end, we need more data
        if (dataEnd === -1) {
          if (position >= fileSize) {
            console.error(`  Failed to find end of base64 data at position ${dataStart}`);
            searchStart = buffer.length;
            break;
          }
          break;
        }

        // Extract the base64 data
        const base64Data = buffer.slice(dataStart, dataEnd);

        // Look forward after data ends for the key (metadata comes after response)
        // Need to look far enough to find the metadata block
        const followingText = buffer.slice(dataEnd, Math.min(buffer.length, dataEnd + 1000));
        const keyMatch = followingText.match(keyPattern);
        let key = keyMatch ? keyMatch[1] : null;

        // If no key found, use index-based matching
        let metadata;
        if (key) {
          metadata = requestMetadata.find(m => m.key === key);
        } else {
          // Use index-based matching, but skip already-processed indices
          metadata = requestMetadata[imageIndex];
          key = metadata?.key;
        }

        // Skip if we've already processed this key (avoid duplicates)
        if (key && processedKeys.has(key)) {
          searchStart = dataEnd + 1;
          continue;
        }

        if (metadata && key) {
          processedKeys.add(key);

          // Decode base64 to buffer
          try {
            const imageBuffer = Buffer.from(base64Data, 'base64');

            // Check for valid image data (PNG or JPEG headers)
            const isPNG = imageBuffer.length > 8 && imageBuffer[0] === 0x89 && imageBuffer[1] === 0x50;
            const isJPEG = imageBuffer.length > 2 && imageBuffer[0] === 0xFF && imageBuffer[1] === 0xD8;

            if (isPNG || isJPEG) {
              yield { key, imageBuffer, metadata, format: isPNG ? 'png' : 'jpg' };
              imageIndex++;
            } else {
              console.warn(`  Skipping invalid image data for ${key} (header: ${imageBuffer[0]?.toString(16)} ${imageBuffer[1]?.toString(16)})`);
            }
          } catch (e) {
            console.warn(`  Failed to decode base64 for ${key}: ${e.message}`);
          }
        }

        searchStart = dataEnd + 1;
      }

      // Keep unprocessed part of buffer
      if (searchStart > 1000) {
        buffer = buffer.slice(searchStart - 500);
      }

      // Progress logging
      const pct = Math.round((position / fileSize) * 100);
      if (pct % 20 === 0 && pct > 0) {
        console.log(`    ${pct}% processed (${imageIndex} images found)...`);
      }
    }
  } finally {
    await fileHandle.close();
  }

  console.log(`  Streaming extraction complete: ${imageIndex} images found`);
}

// Wrapper that caches batch job responses (for status -> import flow)
// Cache has no timeout - completed jobs don't change, and we don't want to re-download 1GB files
async function fetchBatchJobWithCache(jobId) {
  const cached = batchResponseCache.get(jobId);
  if (cached) {
    console.log(`  Using cached response for ${jobId}`);
    return cached.data;
  }

  // Fetch fresh
  const response = await geminiRequest('GET', `/${jobId}`);

  // Cache if job is done (completed jobs don't change)
  if (response.done) {
    batchResponseCache.set(jobId, { data: response });
    console.log(`  Cached response for ${jobId} (${Math.round(JSON.stringify(response).length / 1024)}KB)`);
  }

  return response;
}

// POST /api/portraits/batch - Create a new batch job
app.post('/api/portraits/batch', async (req, res) => {
  try {
    const { builds, skinTones, hairColors, sexes, races, count = 1 } = req.body;

    if (!builds?.length || !skinTones?.length || !hairColors?.length ||
        !sexes?.length || !races?.length) {
      return res.status(400).json({ error: 'Must select at least one option from each category' });
    }

    const appearanceConfig = await readJsonFile('appearanceConfig.json');
    const config = appearanceConfig.portraitConfig || {};
    const perCombo = Math.max(1, Math.min(10, count));

    // Build all portrait requests
    const requests = [];
    const timestamp = Date.now();
    let counter = 0;

    for (const build of builds) {
      for (const skinTone of skinTones) {
        for (const hairColor of hairColors) {
          for (const sex of sexes) {
            for (const race of races) {
              for (let i = 0; i < perCombo; i++) {
                const id = `${sex}-${race}-${build}-${skinTone}-${hairColor}-${timestamp}-${counter++}`;
                const prompt = buildPrompt(config, { sex, race, build, skinTone, hairColor });

                requests.push({
                  metadata: {
                    key: id,
                    sex, race, build, skinTone, hairColor
                  },
                  request: {
                    contents: [{ parts: [{ text: prompt }] }],
                    generationConfig: {
                      responseModalities: ['TEXT', 'IMAGE'],
                      imageConfig: {
                        aspectRatio: config.aspectRatio || '3:4',
                        imageSize: config.imageSize || '1K'
                      }
                    }
                  }
                });
              }
            }
          }
        }
      }
    }

    console.log(`Creating batch job with ${requests.length} requests...`);

    // Create batch job with inline requests
    const batchResponse = await geminiRequest('POST', '/models/gemini-3-pro-image-preview:batchGenerateContent', {
      batch: {
        displayName: `portraits-${timestamp}`,
        inputConfig: {
          requests: { requests }
        }
      }
    });

    console.log('Batch creation response:', JSON.stringify(batchResponse, null, 2));

    if (batchResponse.error) {
      console.error('Batch API error:', batchResponse.error);
      return res.status(500).json({ error: batchResponse.error.message || 'Batch creation failed' });
    }

    console.log('Batch job created:', batchResponse.name);

    // Save job to persistent storage
    const jobs = await readBatchJobs();
    const newJob = {
      id: batchResponse.name,  // e.g., "batches/123456789"
      displayName: `portraits-${timestamp}`,
      createdAt: new Date().toISOString(),
      requestCount: requests.length,
      state: batchResponse.state || 'JOB_STATE_PENDING',
      // Store metadata for each request to rebuild portraits later
      requestMetadata: requests.map(r => r.metadata)
    };
    jobs.push(newJob);
    await writeBatchJobs(jobs);

    res.json({
      success: true,
      jobId: batchResponse.name,
      requestCount: requests.length,
      state: batchResponse.state
    });
  } catch (err) {
    console.error('Error creating batch job:', err);
    res.status(500).json({ error: err.message || 'Failed to create batch job' });
  }
});

// GET /api/portraits/batch - List all batch jobs
app.get('/api/portraits/batch', async (req, res) => {
  try {
    const jobs = await readBatchJobs();
    res.json(jobs);
  } catch (err) {
    console.error('Error listing batch jobs:', err);
    res.status(500).json({ error: 'Failed to list batch jobs' });
  }
});

// GET /api/portraits/batch/:id/status - Check batch job status
app.get('/api/portraits/batch/:id(*)/status', async (req, res) => {
  try {
    const jobId = req.params.id;  // e.g., "batches/123456789"
    console.log(`Checking batch status for: ${jobId}`);

    // Check if this is a large batch that needs streaming
    const jobs = await readBatchJobs();
    const job = jobs.find(j => j.id === jobId);
    const isLargeBatch = job && job.requestCount > MAX_INLINE_BATCH_SIZE;

    let isDone = false;
    let responseCount = 0;
    let stats = null;

    if (isLargeBatch) {
      // For large batches, stream to temp file and just parse the "done" field
      console.log(`  Large batch (${job.requestCount} requests), using streaming status check...`);

      let tempFile = job.tempFile;
      let tempFileSizeMB = job.tempFileSizeMB;

      // Reuse existing temp file if available
      if (tempFile) {
        try {
          await fs.access(tempFile);
          console.log(`  Reusing cached temp file: ${tempFile} (${tempFileSizeMB}MB)`);
        } catch {
          console.log(`  Cached temp file not found, re-downloading...`);
          tempFile = null;
        }
      }

      // Download if no cached file
      if (!tempFile) {
        const result = await fetchLargeBatchJob(jobId);
        tempFile = result.tempFile;
        tempFileSizeMB = result.sizeMB;
      }

      // Parse just the metadata to get "done" status
      const metadata = await parseBatchJobMetadata(tempFile);
      isDone = metadata.done;

      // Always keep the temp file - don't delete it even if "not done"
      const jobIndex = jobs.findIndex(j => j.id === jobId);
      if (jobIndex >= 0) {
        jobs[jobIndex].tempFile = tempFile;
        jobs[jobIndex].tempFileSizeMB = tempFileSizeMB;
        await writeBatchJobs(jobs);
      }

      responseCount = job.requestCount; // Estimate, actual count only known after import
    } else {
      // For small batches, use the normal fetch with caching
      const statusResponse = await fetchBatchJobWithCache(jobId);

      if (statusResponse.error) {
        console.error('Batch status error:', statusResponse.error);
        return res.status(500).json({ error: statusResponse.error.message });
      }

      isDone = statusResponse.done === true;
      const responses = statusResponse.response?.inlinedResponses?.inlinedResponses || [];
      responseCount = responses.length;
      stats = statusResponse.batchStats || null;
    }

    const state = isDone ? 'JOB_STATE_SUCCEEDED' : 'JOB_STATE_PENDING';
    console.log(`Batch ${jobId}: done=${isDone}, state=${state}, responseCount=${responseCount}`);

    // Update local job record
    const jobIndex = jobs.findIndex(j => j.id === jobId);
    if (jobIndex >= 0) {
      jobs[jobIndex].state = state;
      jobs[jobIndex].lastChecked = new Date().toISOString();
      jobs[jobIndex].responseCount = responseCount;
      if (stats) {
        jobs[jobIndex].stats = stats;
      }
      await writeBatchJobs(jobs);
    }

    res.json({
      id: jobId,
      state: state,
      responseCount: responseCount,
      stats: stats,
      isLargeBatch: isLargeBatch,
      warning: isLargeBatch && isDone
        ? `Large batch (${job.requestCount} images) - import may take several minutes and use significant memory.`
        : undefined
    });
  } catch (err) {
    console.error('Error checking batch status:', err);
    res.status(500).json({ error: err.message || 'Failed to check batch status' });
  }
});

// POST /api/portraits/batch/:id/import - Import completed batch results
app.post('/api/portraits/batch/:id(*)/import', async (req, res) => {
  try {
    const jobId = req.params.id;
    console.log(`Importing batch results for: ${jobId}`);

    // Get our stored metadata
    const jobs = await readBatchJobs();
    const job = jobs.find(j => j.id === jobId);
    if (!job) {
      return res.status(404).json({ error: 'Job not found in local records' });
    }

    const isLargeBatch = job.requestCount > MAX_INLINE_BATCH_SIZE;

    // For large batches, use streaming import from temp file
    if (isLargeBatch) {
      return await importLargeBatch(jobId, job, jobs, res);
    }

    // For small batches, use the normal cached fetch
    const statusResponse = await fetchBatchJobWithCache(jobId);

    if (statusResponse.error) {
      return res.status(500).json({ error: statusResponse.error.message });
    }

    if (!statusResponse.done) {
      return res.status(400).json({ error: 'Job is not yet complete. Please wait and try again.' });
    }

    const responses = statusResponse.response?.inlinedResponses?.inlinedResponses || [];

    if (responses.length === 0) {
      return res.status(400).json({ error: 'No results found. Job may still be processing.' });
    }

    console.log(`Importing ${responses.length} results from batch job...`);

    await ensurePortraitDirs();
    const pending = await readPendingMeta();
    let imported = 0;
    let failed = 0;

    for (let i = 0; i < responses.length; i++) {
      const item = responses[i];
      try {
        let metadata = null;
        const itemKey = item.key || item.metadata?.key;

        if (itemKey) {
          metadata = job.requestMetadata.find(m => m.key === itemKey);
        }
        if (!metadata && job.requestMetadata[i]) {
          metadata = job.requestMetadata[i];
        }

        if (!metadata) {
          console.warn(`  No metadata for response ${i}`);
          failed++;
          continue;
        }

        const parts = item.response?.candidates?.[0]?.content?.parts || [];
        const imagePart = parts.find(p => p.inlineData?.data);

        if (!imagePart) {
          console.warn(`  No image in response ${i} (${metadata.key})`);
          failed++;
          continue;
        }

        const filename = `${metadata.key}.png`;
        const filepath = path.join(PENDING_DIR, filename);
        await fs.writeFile(filepath, Buffer.from(imagePart.inlineData.data, 'base64'));

        pending.push({
          id: metadata.key,
          tempPath: `portraits/pending/${filename}`,
          build: metadata.build,
          skinTone: metadata.skinTone,
          hairColor: metadata.hairColor,
          sex: metadata.sex,
          race: metadata.race,
          generatedAt: new Date().toISOString(),
          prompt: '(batch generated)',
          batchJobId: jobId
        });

        imported++;
      } catch (itemErr) {
        console.error(`  Error importing response ${i}:`, itemErr.message);
        failed++;
      }
    }

    await writePendingMeta(pending);

    const jobIndex = jobs.findIndex(j => j.id === jobId);
    if (jobIndex >= 0) {
      jobs[jobIndex].imported = true;
      jobs[jobIndex].importedAt = new Date().toISOString();
      jobs[jobIndex].importedCount = imported;
      jobs[jobIndex].failedCount = failed;
      await writeBatchJobs(jobs);
    }

    console.log(`Batch import complete: ${imported} imported, ${failed} failed`);

    res.json({
      success: true,
      imported,
      failed,
      total: responses.length
    });
  } catch (err) {
    console.error('Error importing batch results:', err);
    res.status(500).json({ error: err.message || 'Failed to import batch results' });
  }
});

// Import large batch using streaming file processing
async function importLargeBatch(jobId, job, jobs, res) {
  console.log(`Large batch import (${job.requestCount} images)...`);

  // Check for temp file from status check
  let tempFile = job.tempFile;
  let cleanup = async () => {};

  if (!tempFile) {
    // Need to download fresh
    console.log('  No cached temp file, downloading...');
    const result = await fetchLargeBatchJob(jobId);
    tempFile = result.tempFile;
    cleanup = result.cleanup;

    // Parse metadata to verify it's done
    const metadata = await parseBatchJobMetadata(tempFile);
    if (!metadata.done) {
      await cleanup();
      return res.status(400).json({ error: 'Job is not yet complete.' });
    }
  }

  try {
    // Process images from the temp file incrementally
    await ensurePortraitDirs();
    const pending = await readPendingMeta();
    let imported = 0;
    let failed = 0;

    console.log(`  Processing images from temp file...`);

    // Use the streaming extractor
    for await (const imageInfo of extractImagesFromLargeFile(tempFile, job.requestMetadata)) {
      try {
        const ext = imageInfo.format || 'png';
        const filename = `${imageInfo.key}.${ext}`;
        const filepath = path.join(PENDING_DIR, filename);
        await fs.writeFile(filepath, imageInfo.imageBuffer);

        pending.push({
          id: imageInfo.key,
          tempPath: `portraits/pending/${filename}`,
          build: imageInfo.metadata.build,
          skinTone: imageInfo.metadata.skinTone,
          hairColor: imageInfo.metadata.hairColor,
          sex: imageInfo.metadata.sex,
          race: imageInfo.metadata.race,
          generatedAt: new Date().toISOString(),
          prompt: '(batch generated)',
          batchJobId: jobId
        });

        imported++;
        if (imported % 10 === 0) {
          console.log(`    Imported ${imported} images...`);
        }
      } catch (err) {
        console.error(`  Error saving image ${imageInfo.key}:`, err.message);
        failed++;
      }
    }

    await writePendingMeta(pending);

    // Update job status
    const jobIndex = jobs.findIndex(j => j.id === jobId);
    if (jobIndex >= 0) {
      jobs[jobIndex].imported = true;
      jobs[jobIndex].importedAt = new Date().toISOString();
      jobs[jobIndex].importedCount = imported;
      jobs[jobIndex].failedCount = failed;
      delete jobs[jobIndex].tempFile;  // Clean up reference
      await writeBatchJobs(jobs);
    }

    console.log(`Large batch import complete: ${imported} imported, ${failed} failed`);

    res.json({
      success: true,
      imported,
      failed,
      total: job.requestCount
    });
  } finally {
    // Clean up temp file
    await cleanup();
    if (tempFile) {
      await fs.unlink(tempFile).catch(() => {});
    }
  }
}

// DELETE /api/portraits/batch/:id - Delete a batch job record (local only)
app.delete('/api/portraits/batch/:id(*)', async (req, res) => {
  try {
    const jobId = req.params.id;
    const jobs = await readBatchJobs();
    const newJobs = jobs.filter(j => j.id !== jobId);

    if (newJobs.length === jobs.length) {
      return res.status(404).json({ error: 'Job not found' });
    }

    await writeBatchJobs(newJobs);
    res.json({ success: true });
  } catch (err) {
    console.error('Error deleting batch job:', err);
    res.status(500).json({ error: 'Failed to delete batch job' });
  }
});

// ============================================
// OPTION IMAGE GENERATION ENDPOINTS
// ============================================

// Ensure option image directories exist
async function ensureOptionDirs() {
  await fs.mkdir(OPTIONS_DIR, { recursive: true });
  await fs.mkdir(OPTIONS_PENDING_DIR, { recursive: true });
}

// Read pending option images metadata
async function readOptionPendingMeta() {
  try {
    const content = await fs.readFile(OPTIONS_PENDING_META_FILE, 'utf-8');
    return JSON.parse(content);
  } catch {
    return [];
  }
}

// Write pending option images metadata
async function writeOptionPendingMeta(data) {
  await ensureOptionDirs();
  await fs.writeFile(OPTIONS_PENDING_META_FILE, JSON.stringify(data, null, 2), 'utf-8');
}

// Read option batch jobs
async function readOptionBatchJobs() {
  try {
    const content = await fs.readFile(OPTIONS_BATCH_JOBS_FILE, 'utf-8');
    return JSON.parse(content);
  } catch {
    return [];
  }
}

// Write option batch jobs
async function writeOptionBatchJobs(data) {
  await fs.writeFile(OPTIONS_BATCH_JOBS_FILE, JSON.stringify(data, null, 2), 'utf-8');
}

// Build prompt for an option image
function buildOptionPrompt(config, option) {
  // Provide full context to the reasoning model
  let prompt = config.basePrompt || `You are generating option card art for a dark fantasy RPG character creator.
These are selection cards shown during character creation - the image should be iconic and symbolic of the option.
Square 1:1 format, suitable for a card/button.`;

  prompt += `\n\nGenerate an image for this character option:
Category: ${option.category}
ID: ${option.id}
Name: ${option.name}
Description: ${option.description || 'No description'}`;

  if (option.traits && option.traits.length > 0) {
    prompt += `\nTraits granted: ${option.traits.join(', ')}`;
  }
  if (option.attributes && Object.keys(option.attributes).length > 0) {
    const attrs = Object.entries(option.attributes)
      .map(([k, v]) => `${k}: ${v > 0 ? '+' : ''}${v}`)
      .join(', ');
    prompt += `\nAttribute effects: ${attrs}`;
  }
  if (option.isDrawback) {
    prompt += `\nThis is a DRAWBACK option (negative/challenging choice)`;
  }
  if (option.subcategory) {
    prompt += `\nSubcategory: ${option.subcategory}`;
  }

  if (config.styleModifiers) {
    prompt += `\n\nStyle: ${config.styleModifiers}`;
  }

  return prompt;
}

// Generate a single option image
async function generateOptionImage(prompt, config) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY environment variable not set');
  }

  const modelKey = config.model || 'nano-banana-pro';
  const model = IMAGE_MODELS[modelKey] || IMAGE_MODELS['nano-banana-pro'];
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

  console.log(`  Using model: ${model} (${modelKey})`);

  // Options use 1:1 square format
  const imageConfig = { aspectRatio: config.aspectRatio || '1:1' };
  if (modelKey === 'nano-banana-pro' && config.imageSize) {
    imageConfig.imageSize = config.imageSize;
  }

  const requestBody = JSON.stringify({
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: {
      responseModalities: ['TEXT', 'IMAGE'],
      imageConfig
    }
  });

  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const options = {
      hostname: urlObj.hostname,
      path: urlObj.pathname + urlObj.search,
      method: 'POST',
      headers: {
        'x-goog-api-key': apiKey,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(requestBody)
      }
    };

    const req = https.request(options, (res) => {
      // Track rate limit headers
      const remaining = res.headers['x-ratelimit-remaining'];
      const limit = res.headers['x-ratelimit-limit'];
      const reset = res.headers['x-ratelimit-reset'];

      if (remaining !== undefined || limit !== undefined) {
        rateLimitInfo = {
          model: modelKey,
          remaining: remaining ? parseInt(remaining, 10) : null,
          limit: limit ? parseInt(limit, 10) : null,
          reset: reset || null,
          lastUpdated: new Date().toISOString()
        };
      }

      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (json.error) {
            console.error('  API error:', json.error.message);
            reject(new Error(json.error.message || 'API error'));
            return;
          }

          const parts = json.candidates?.[0]?.content?.parts || [];
          const imagePart = parts.find(p => p.inlineData?.data);

          if (!imagePart) {
            console.error('  No image in response. Parts:', parts.map(p => Object.keys(p)));
            reject(new Error('No image data in response'));
            return;
          }

          resolve(Buffer.from(imagePart.inlineData.data, 'base64'));
        } catch (e) {
          console.error('  Parse error:', e.message);
          reject(e);
        }
      });
    });

    req.on('error', reject);
    req.write(requestBody);
    req.end();
  });
}

// Option image generation queue
let optionGenerationQueue = [];
let isGeneratingOptions = false;
let optionGenerationProgress = { current: 0, total: 0, currentItem: null };

// Process option generation queue
async function processOptionGenerationQueue() {
  if (isGeneratingOptions || optionGenerationQueue.length === 0) return;

  isGeneratingOptions = true;
  const charData = await readJsonFile('characterCreation.json');
  const config = charData.optionImageConfig || {
    basePrompt: `You are generating option card art for a dark fantasy RPG character creator.
These are selection cards shown during character creation - the image should be iconic and symbolic of the option.
Square 1:1 format, suitable for a card/button.`,
    styleModifiers: 'Dark fantasy art style, painterly, dramatic lighting, striking color palette',
    aspectRatio: '1:1',
    imageSize: '1K',
    model: 'nano-banana-pro'
  };

  optionGenerationProgress.total = optionGenerationQueue.length;
  optionGenerationProgress.current = 0;

  while (optionGenerationQueue.length > 0) {
    const item = optionGenerationQueue.shift();
    optionGenerationProgress.current++;
    optionGenerationProgress.currentItem = item;

    try {
      const prompt = buildOptionPrompt(config, item);
      console.log(`Generating option (${optionGenerationProgress.current}/${optionGenerationProgress.total}): ${item.category}/${item.id}`);

      const imageBuffer = await generateOptionImage(prompt, config);

      // Save to pending
      await ensureOptionDirs();
      const filename = `${item.category}-${item.id}.png`;
      const filepath = path.join(OPTIONS_PENDING_DIR, filename);
      await fs.writeFile(filepath, imageBuffer);

      // Update pending metadata
      const pending = await readOptionPendingMeta();
      pending.push({
        id: `${item.category}-${item.id}`,
        optionId: item.id,
        category: item.category,
        name: item.name,
        tempPath: `options/pending/${filename}`,
        generatedAt: new Date().toISOString(),
        prompt: prompt
      });
      await writeOptionPendingMeta(pending);

      console.log(`  Saved: ${filename}`);
    } catch (err) {
      console.error(`  Error generating ${item.id}:`, err.message);
    }

    // Small delay between requests
    if (optionGenerationQueue.length > 0) {
      await new Promise(r => setTimeout(r, 500));
    }
  }

  optionGenerationProgress.currentItem = null;
  isGeneratingOptions = false;
}

// GET /api/options/image-config - Get option image generation config
app.get('/api/options/image-config', async (req, res) => {
  try {
    const charData = await readJsonFile('characterCreation.json');
    const config = charData.optionImageConfig || {
      basePrompt: `You are generating option card art for a dark fantasy RPG character creator.
These are selection cards shown during character creation - the image should be iconic and symbolic of the option.
Square 1:1 format, suitable for a card/button.`,
      styleModifiers: 'Dark fantasy art style, painterly, dramatic lighting, striking color palette',
      aspectRatio: '1:1',
      imageSize: '1K',
      model: 'nano-banana-pro'
    };
    res.json(config);
  } catch (err) {
    console.error('Error reading option image config:', err);
    res.status(500).json({ error: 'Failed to read config' });
  }
});

// PUT /api/options/image-config - Save option image generation config
app.put('/api/options/image-config', async (req, res) => {
  try {
    const charData = await readJsonFile('characterCreation.json');
    charData.optionImageConfig = req.body;
    await writeJsonFile('characterCreation.json', charData);
    res.json({ success: true });
  } catch (err) {
    console.error('Error saving option image config:', err);
    res.status(500).json({ error: 'Failed to save config' });
  }
});

// POST /api/options/generate - Queue option image generation
app.post('/api/options/generate', async (req, res) => {
  try {
    const { options } = req.body;  // Array of { category, id, name, description, traits, attributes, isDrawback, subcategory }

    if (!options || !Array.isArray(options) || options.length === 0) {
      return res.status(400).json({ error: 'Must provide options array' });
    }

    // Add to queue
    for (const opt of options) {
      optionGenerationQueue.push(opt);
    }

    // Start processing if not already running
    processOptionGenerationQueue();

    res.json({
      queued: options.length,
      total: optionGenerationQueue.length,
      message: `Queued ${options.length} options for generation`
    });
  } catch (err) {
    console.error('Error queueing option generation:', err);
    res.status(500).json({ error: 'Failed to queue generation' });
  }
});

// GET /api/options/pending - Get pending option images
app.get('/api/options/pending', async (req, res) => {
  try {
    const pending = await readOptionPendingMeta();
    res.json(pending);
  } catch (err) {
    console.error('Error reading pending options:', err);
    res.status(500).json({ error: 'Failed to read pending options' });
  }
});

// GET /api/options/generation-status - Get option generation status
app.get('/api/options/generation-status', async (req, res) => {
  res.json({
    isGenerating: isGeneratingOptions,
    progress: optionGenerationProgress,
    queueLength: optionGenerationQueue.length
  });
});

// POST /api/options/accept/:id - Accept a pending option image
app.post('/api/options/accept/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const pending = await readOptionPendingMeta();
    const item = pending.find(p => p.id === id);

    if (!item) {
      return res.status(404).json({ error: 'Pending image not found' });
    }

    // Move from pending to final location (detect extension from tempPath)
    const ext = item.tempPath ? path.extname(item.tempPath) : '.png';
    const srcPath = path.join(OPTIONS_PENDING_DIR, `${id}${ext}`);
    const destPath = path.join(OPTIONS_DIR, `${id}${ext}`);

    await fs.rename(srcPath, destPath);

    // Remove from pending metadata
    const newPending = pending.filter(p => p.id !== id);
    await writeOptionPendingMeta(newPending);

    // Update the option in characterCreation.json to reference the image
    const charData = await readJsonFile('characterCreation.json');
    for (const category of charData.categories) {
      const option = category.options.find(o => o.id === item.optionId);
      if (option) {
        option.image = `${id}${ext}`;
        break;
      }
    }
    await writeJsonFile('characterCreation.json', charData);

    res.json({ success: true, imagePath: `options/${id}${ext}` });
  } catch (err) {
    console.error('Error accepting option image:', err);
    res.status(500).json({ error: 'Failed to accept image' });
  }
});

// POST /api/options/accept-all - Accept all pending option images
app.post('/api/options/accept-all', async (req, res) => {
  try {
    const pending = await readOptionPendingMeta();
    if (pending.length === 0) {
      return res.json({ accepted: 0 });
    }

    const charData = await readJsonFile('characterCreation.json');
    let accepted = 0;

    for (const item of pending) {
      try {
        const ext = item.tempPath ? path.extname(item.tempPath) : '.png';
        const srcPath = path.join(OPTIONS_PENDING_DIR, `${item.id}${ext}`);
        const destPath = path.join(OPTIONS_DIR, `${item.id}${ext}`);
        await fs.rename(srcPath, destPath);

        // Update option image reference
        for (const category of charData.categories) {
          const option = category.options.find(o => o.id === item.optionId);
          if (option) {
            option.image = `${item.id}${ext}`;
            break;
          }
        }
        accepted++;
      } catch (err) {
        console.error(`Error accepting ${item.id}:`, err.message);
      }
    }

    await writeJsonFile('characterCreation.json', charData);
    await writeOptionPendingMeta([]);

    res.json({ accepted });
  } catch (err) {
    console.error('Error accepting all option images:', err);
    res.status(500).json({ error: 'Failed to accept all images' });
  }
});

// DELETE /api/options/pending/:id - Reject a pending option image
app.delete('/api/options/pending/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const pending = await readOptionPendingMeta();
    const item = pending.find(p => p.id === id);

    if (!item) {
      return res.status(404).json({ error: 'Pending image not found' });
    }

    // Delete the image file (detect extension from tempPath)
    const ext = item.tempPath ? path.extname(item.tempPath) : '.png';
    const filepath = path.join(OPTIONS_PENDING_DIR, `${id}${ext}`);
    await fs.unlink(filepath);

    // Remove from pending metadata
    const newPending = pending.filter(p => p.id !== id);
    await writeOptionPendingMeta(newPending);

    res.json({ success: true });
  } catch (err) {
    console.error('Error rejecting option image:', err);
    res.status(500).json({ error: 'Failed to reject image' });
  }
});

// DELETE /api/options/pending - Reject all pending option images
app.delete('/api/options/pending', async (req, res) => {
  try {
    const pending = await readOptionPendingMeta();
    let rejected = 0;

    for (const item of pending) {
      try {
        const ext = item.tempPath ? path.extname(item.tempPath) : '.png';
        const filepath = path.join(OPTIONS_PENDING_DIR, `${item.id}${ext}`);
        await fs.unlink(filepath);
        rejected++;
      } catch (err) {
        console.error(`Error deleting ${item.id}:`, err.message);
      }
    }

    await writeOptionPendingMeta([]);
    res.json({ rejected });
  } catch (err) {
    console.error('Error rejecting all option images:', err);
    res.status(500).json({ error: 'Failed to reject all images' });
  }
});

// POST /api/options/batch - Create a batch job for option images
app.post('/api/options/batch', async (req, res) => {
  try {
    const { options } = req.body;

    if (!options || !Array.isArray(options) || options.length === 0) {
      return res.status(400).json({ error: 'Must provide options array' });
    }

    const charData = await readJsonFile('characterCreation.json');
    const config = charData.optionImageConfig || {
      basePrompt: `You are generating option card art for a dark fantasy RPG character creator.
These are selection cards shown during character creation - the image should be iconic and symbolic of the option.
Square 1:1 format, suitable for a card/button.`,
      styleModifiers: 'Dark fantasy art style, painterly, dramatic lighting, striking color palette',
      aspectRatio: '1:1',
      imageSize: '1K'
    };

    // Build batch requests
    const requests = [];
    const timestamp = Date.now();

    for (const opt of options) {
      const id = `${opt.category}-${opt.id}`;
      const prompt = buildOptionPrompt(config, opt);

      requests.push({
        metadata: {
          key: id,
          optionId: opt.id,
          category: opt.category,
          name: opt.name
        },
        request: {
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            responseModalities: ['TEXT', 'IMAGE'],
            imageConfig: {
              aspectRatio: config.aspectRatio || '1:1',
              imageSize: config.imageSize || '1K'
            }
          }
        }
      });
    }

    console.log(`Creating option batch job with ${requests.length} requests...`);

    // Create batch job
    const batchResponse = await geminiRequest('POST', '/models/gemini-3-pro-image-preview:batchGenerateContent', {
      batch: {
        displayName: `options-${timestamp}`,
        inputConfig: {
          requests: { requests }
        }
      }
    });

    if (batchResponse.error) {
      console.error('Batch API error:', batchResponse.error);
      return res.status(500).json({ error: batchResponse.error.message || 'Batch creation failed' });
    }

    console.log('Option batch job created:', batchResponse.name);

    // Save job to persistent storage
    const jobs = await readOptionBatchJobs();
    const newJob = {
      id: batchResponse.name,
      displayName: `options-${timestamp}`,
      createdAt: new Date().toISOString(),
      requestCount: requests.length,
      state: batchResponse.state || 'JOB_STATE_PENDING',
      requestMetadata: requests.map(r => r.metadata)
    };
    jobs.push(newJob);
    await writeOptionBatchJobs(jobs);

    res.json({
      success: true,
      jobId: batchResponse.name,
      requestCount: requests.length,
      state: batchResponse.state
    });
  } catch (err) {
    console.error('Error creating option batch job:', err);
    res.status(500).json({ error: err.message || 'Failed to create batch job' });
  }
});

// GET /api/options/batch - List all option batch jobs
app.get('/api/options/batch', async (req, res) => {
  try {
    const jobs = await readOptionBatchJobs();
    res.json(jobs);
  } catch (err) {
    console.error('Error listing option batch jobs:', err);
    res.status(500).json({ error: 'Failed to list batch jobs' });
  }
});

// GET /api/options/batch/:id/status - Check option batch job status
app.get('/api/options/batch/:id(*)/status', async (req, res) => {
  try {
    const jobId = req.params.id;
    console.log(`Checking option batch status for: ${jobId}`);

    // Check if this is a large batch that needs streaming
    const jobs = await readOptionBatchJobs();
    const job = jobs.find(j => j.id === jobId);
    const isLargeBatch = job && job.requestCount > MAX_INLINE_BATCH_SIZE;

    let isDone = false;
    let responseCount = 0;

    if (isLargeBatch) {
      // For large batches, stream to temp file and just parse the "done" field
      console.log(`  Large option batch (${job.requestCount} requests), using streaming status check...`);

      let tempFile = job.tempFile;
      let tempFileSizeMB = job.tempFileSizeMB;

      // Reuse existing temp file if available
      if (tempFile) {
        try {
          await fs.access(tempFile);
          console.log(`  Reusing cached temp file: ${tempFile} (${tempFileSizeMB}MB)`);
        } catch {
          console.log(`  Cached temp file not found, re-downloading...`);
          tempFile = null;
        }
      }

      // Download if no cached file
      if (!tempFile) {
        const result = await fetchLargeBatchJob(jobId);
        tempFile = result.tempFile;
        tempFileSizeMB = result.sizeMB;
      }

      const metadata = await parseBatchJobMetadata(tempFile);
      isDone = metadata.done;

      // Always keep the temp file
      const jobIndex = jobs.findIndex(j => j.id === jobId);
      if (jobIndex >= 0) {
        jobs[jobIndex].tempFile = tempFile;
        jobs[jobIndex].tempFileSizeMB = tempFileSizeMB;
        await writeOptionBatchJobs(jobs);
      }
      responseCount = job.requestCount;
    } else {
      const statusResponse = await fetchBatchJobWithCache(jobId);

      if (statusResponse.error) {
        console.error('Batch status error:', statusResponse.error);
        return res.status(500).json({ error: statusResponse.error.message });
      }

      isDone = statusResponse.done === true;
      const responses = statusResponse.response?.inlinedResponses?.inlinedResponses || [];
      responseCount = responses.length;
    }

    const state = isDone ? 'JOB_STATE_SUCCEEDED' : 'JOB_STATE_PENDING';
    console.log(`Option batch ${jobId}: done=${isDone}, state=${state}, responses=${responseCount}`);

    // Update local job record
    const jobIndex = jobs.findIndex(j => j.id === jobId);
    if (jobIndex >= 0) {
      jobs[jobIndex].state = state;
      jobs[jobIndex].lastChecked = new Date().toISOString();
      jobs[jobIndex].responseCount = responseCount;
      await writeOptionBatchJobs(jobs);
    }

    res.json({
      id: jobId,
      state: state,
      responseCount: responseCount,
      isLargeBatch: isLargeBatch,
      warning: isLargeBatch && isDone
        ? `Large batch (${job.requestCount} images) - import may take several minutes.`
        : undefined
    });
  } catch (err) {
    console.error('Error checking option batch status:', err);
    res.status(500).json({ error: err.message || 'Failed to check batch status' });
  }
});

// POST /api/options/batch/:id/import - Import option batch results
app.post('/api/options/batch/:id(*)/import', async (req, res) => {
  try {
    const jobId = req.params.id;
    console.log(`Importing option batch results for: ${jobId}`);

    const jobs = await readOptionBatchJobs();
    const job = jobs.find(j => j.id === jobId);
    if (!job) {
      return res.status(404).json({ error: 'Job not found in local records' });
    }

    const isLargeBatch = job.requestCount > MAX_INLINE_BATCH_SIZE;

    // For large batches, use streaming import
    if (isLargeBatch) {
      return await importLargeOptionBatch(jobId, job, jobs, res);
    }

    // For small batches, use the normal cached fetch
    const statusResponse = await fetchBatchJobWithCache(jobId);

    if (statusResponse.error) {
      return res.status(500).json({ error: statusResponse.error.message });
    }

    if (!statusResponse.done) {
      return res.status(400).json({ error: 'Job is not yet complete. Please wait and try again.' });
    }

    const responses = statusResponse.response?.inlinedResponses?.inlinedResponses || [];

    if (responses.length === 0) {
      return res.status(400).json({ error: 'No results found.' });
    }

    console.log(`Importing ${responses.length} option images from batch job...`);

    await ensureOptionDirs();
    const pending = await readOptionPendingMeta();
    let imported = 0;
    let failed = 0;

    for (let i = 0; i < responses.length; i++) {
      const item = responses[i];
      try {
        let metadata = null;
        const itemKey = item.key || item.metadata?.key;

        if (itemKey) {
          metadata = job.requestMetadata.find(m => m.key === itemKey);
        }
        if (!metadata && job.requestMetadata[i]) {
          metadata = job.requestMetadata[i];
        }

        if (!metadata) {
          console.warn(`  No metadata for response ${i}`);
          failed++;
          continue;
        }

        const parts = item.response?.candidates?.[0]?.content?.parts || [];
        const imagePart = parts.find(p => p.inlineData?.data);

        if (!imagePart) {
          console.warn(`  No image in response ${i} (${metadata.key})`);
          failed++;
          continue;
        }

        const filename = `${metadata.key}.png`;
        const filepath = path.join(OPTIONS_PENDING_DIR, filename);
        await fs.writeFile(filepath, Buffer.from(imagePart.inlineData.data, 'base64'));

        pending.push({
          id: metadata.key,
          optionId: metadata.optionId,
          category: metadata.category,
          name: metadata.name,
          tempPath: `options/pending/${filename}`,
          generatedAt: new Date().toISOString(),
          prompt: '(batch generated)',
          batchJobId: jobId
        });

        imported++;
      } catch (itemErr) {
        console.error(`  Error importing response ${i}:`, itemErr.message);
        failed++;
      }
    }

    await writeOptionPendingMeta(pending);

    const jobIndex = jobs.findIndex(j => j.id === jobId);
    if (jobIndex >= 0) {
      jobs[jobIndex].imported = true;
      jobs[jobIndex].importedAt = new Date().toISOString();
      jobs[jobIndex].importedCount = imported;
      jobs[jobIndex].failedCount = failed;
      await writeOptionBatchJobs(jobs);
    }

    console.log(`Option batch import complete: ${imported} imported, ${failed} failed`);

    res.json({
      success: true,
      imported,
      failed,
      total: responses.length
    });
  } catch (err) {
    console.error('Error importing option batch results:', err);
    res.status(500).json({ error: err.message || 'Failed to import batch results' });
  }
});

// Import large option batch using streaming file processing
async function importLargeOptionBatch(jobId, job, jobs, res) {
  console.log(`Large option batch import (${job.requestCount} images)...`);

  let tempFile = job.tempFile;
  let cleanup = async () => {};

  if (!tempFile) {
    console.log('  No cached temp file, downloading...');
    const result = await fetchLargeBatchJob(jobId);
    tempFile = result.tempFile;
    cleanup = result.cleanup;

    const metadata = await parseBatchJobMetadata(tempFile);
    if (!metadata.done) {
      await cleanup();
      return res.status(400).json({ error: 'Job is not yet complete.' });
    }
  }

  try {
    await ensureOptionDirs();
    const pending = await readOptionPendingMeta();
    let imported = 0;
    let failed = 0;

    console.log(`  Processing images from temp file...`);

    for await (const imageInfo of extractImagesFromLargeFile(tempFile, job.requestMetadata)) {
      try {
        const ext = imageInfo.format || 'png';
        const filename = `${imageInfo.key}.${ext}`;
        const filepath = path.join(OPTIONS_PENDING_DIR, filename);
        await fs.writeFile(filepath, imageInfo.imageBuffer);

        pending.push({
          id: imageInfo.key,
          optionId: imageInfo.metadata.optionId,
          category: imageInfo.metadata.category,
          name: imageInfo.metadata.name,
          tempPath: `options/pending/${filename}`,
          generatedAt: new Date().toISOString(),
          prompt: '(batch generated)',
          batchJobId: jobId
        });

        imported++;
        if (imported % 10 === 0) {
          console.log(`    Imported ${imported} images...`);
        }
      } catch (err) {
        console.error(`  Error saving image ${imageInfo.key}:`, err.message);
        failed++;
      }
    }

    await writeOptionPendingMeta(pending);

    const jobIndex = jobs.findIndex(j => j.id === jobId);
    if (jobIndex >= 0) {
      jobs[jobIndex].imported = true;
      jobs[jobIndex].importedAt = new Date().toISOString();
      jobs[jobIndex].importedCount = imported;
      jobs[jobIndex].failedCount = failed;
      delete jobs[jobIndex].tempFile;
      await writeOptionBatchJobs(jobs);
    }

    console.log(`Large option batch import complete: ${imported} imported, ${failed} failed`);

    res.json({
      success: true,
      imported,
      failed,
      total: job.requestCount
    });
  } finally {
    await cleanup();
    if (tempFile) {
      await fs.unlink(tempFile).catch(() => {});
    }
  }
}

// DELETE /api/options/batch/:id - Delete option batch job record
app.delete('/api/options/batch/:id(*)', async (req, res) => {
  try {
    const jobId = req.params.id;
    const jobs = await readOptionBatchJobs();
    const newJobs = jobs.filter(j => j.id !== jobId);

    if (newJobs.length === jobs.length) {
      return res.status(404).json({ error: 'Job not found' });
    }

    await writeOptionBatchJobs(newJobs);
    res.json({ success: true });
  } catch (err) {
    console.error('Error deleting option batch job:', err);
    res.status(500).json({ error: 'Failed to delete batch job' });
  }
});

const PORT = 3001;
app.listen(PORT, () => {
  console.log(`Editor server running at http://localhost:${PORT}`);
  console.log('\nPortrait generation:');
  console.log('  POST    /api/portraits/generate');
  console.log('  GET     /api/portraits/pending');
  console.log('  POST    /api/portraits/batch - Create batch job');
  console.log('\nOption image generation:');
  console.log('  GET     /api/options/image-config');
  console.log('  PUT     /api/options/image-config');
  console.log('  POST    /api/options/generate');
  console.log('  GET     /api/options/pending');
  console.log('  POST    /api/options/batch - Create batch job');
  if (!process.env.GEMINI_API_KEY) {
    console.log('\nWARNING: GEMINI_API_KEY not set - image generation will fail');
  }
});
