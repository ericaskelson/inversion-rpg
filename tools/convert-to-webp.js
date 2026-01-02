#!/usr/bin/env node

/**
 * Converts PNG/JPG images to WebP format for production builds.
 *
 * Features:
 * - Incremental: only converts files that don't have a corresponding .webp
 * - Preserves originals (used by editor workflow)
 * - Uses ffmpeg for conversion (must be in PATH)
 * - Configurable quality (default: 85)
 *
 * Usage:
 *   node tools/convert-to-webp.js [--quality=85] [--force]
 */

import { execSync } from 'child_process';
import { readdirSync, statSync, existsSync } from 'fs';
import { join, basename, extname } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Configuration
const QUALITY = parseInt(process.argv.find(a => a.startsWith('--quality='))?.split('=')[1] || '85', 10);
const FORCE = process.argv.includes('--force');

// Directories to process
const IMAGE_DIRS = [
  join(__dirname, '../src/public/images/portraits'),
  join(__dirname, '../src/public/images/options'),
];

function getWebpPath(imagePath) {
  const ext = extname(imagePath);
  return imagePath.slice(0, -ext.length) + '.webp';
}

function needsConversion(imagePath) {
  if (FORCE) return true;

  const webpPath = getWebpPath(imagePath);
  if (!existsSync(webpPath)) return true;

  // Check if source is newer than webp
  const sourceStat = statSync(imagePath);
  const webpStat = statSync(webpPath);
  return sourceStat.mtimeMs > webpStat.mtimeMs;
}

function convertToWebp(imagePath) {
  const webpPath = getWebpPath(imagePath);
  const cmd = `ffmpeg -y -i "${imagePath}" -c:v libwebp -quality ${QUALITY} -lossless 0 "${webpPath}"`;

  try {
    execSync(cmd, { stdio: 'pipe' });
    return true;
  } catch (error) {
    console.error(`  Failed to convert: ${error.message}`);
    return false;
  }
}

function processDirectory(dir) {
  if (!existsSync(dir)) {
    console.log(`  Directory not found: ${dir}`);
    return { converted: 0, skipped: 0, failed: 0 };
  }

  const files = readdirSync(dir);
  let converted = 0;
  let skipped = 0;
  let failed = 0;

  for (const file of files) {
    const ext = extname(file).toLowerCase();
    if (ext !== '.png' && ext !== '.jpg' && ext !== '.jpeg') continue;

    const imagePath = join(dir, file);

    // Skip if it's not a file
    if (!statSync(imagePath).isFile()) continue;

    if (needsConversion(imagePath)) {
      process.stdout.write(`  Converting ${file}...`);
      if (convertToWebp(imagePath)) {
        const webpPath = getWebpPath(imagePath);
        const originalSize = statSync(imagePath).size;
        const webpSize = statSync(webpPath).size;
        const savings = ((1 - webpSize / originalSize) * 100).toFixed(1);
        console.log(` done (${savings}% smaller)`);
        converted++;
      } else {
        failed++;
      }
    } else {
      skipped++;
    }
  }

  return { converted, skipped, failed };
}

function main() {
  console.log(`\nWebP Image Converter (quality: ${QUALITY}${FORCE ? ', force mode' : ''})\n`);

  let totalConverted = 0;
  let totalSkipped = 0;
  let totalFailed = 0;

  for (const dir of IMAGE_DIRS) {
    const dirName = basename(dirname(dir)) + '/' + basename(dir);
    console.log(`Processing ${dirName}...`);

    const { converted, skipped, failed } = processDirectory(dir);
    totalConverted += converted;
    totalSkipped += skipped;
    totalFailed += failed;

    if (converted === 0 && skipped > 0) {
      console.log(`  All ${skipped} images already converted`);
    }
  }

  console.log(`\nSummary:`);
  console.log(`  Converted: ${totalConverted}`);
  console.log(`  Skipped:   ${totalSkipped}`);
  if (totalFailed > 0) {
    console.log(`  Failed:    ${totalFailed}`);
  }
}

main();
