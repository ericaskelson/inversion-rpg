#!/usr/bin/env node

/**
 * Removes original PNG/JPG files from dist/images/ after production build.
 * Keeps only WebP versions to minimize deployment size.
 *
 * Run after vite build: node tools/cleanup-dist-images.js
 */

import { readdirSync, unlinkSync, statSync } from 'fs';
import { join, extname, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const DIST_IMAGES = join(__dirname, '../src/dist/images');

function cleanDirectory(dir) {
  let removed = 0;
  let kept = 0;
  let savedBytes = 0;

  const entries = readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = join(dir, entry.name);

    if (entry.isDirectory()) {
      const subResult = cleanDirectory(fullPath);
      removed += subResult.removed;
      kept += subResult.kept;
      savedBytes += subResult.savedBytes;
    } else if (entry.isFile()) {
      const ext = extname(entry.name).toLowerCase();

      if (ext === '.png' || ext === '.jpg' || ext === '.jpeg') {
        // Check if webp version exists
        const webpPath = fullPath.replace(/\.(png|jpe?g)$/i, '.webp');
        try {
          statSync(webpPath);
          // WebP exists, safe to remove original
          const size = statSync(fullPath).size;
          unlinkSync(fullPath);
          removed++;
          savedBytes += size;
        } catch {
          // No WebP version, keep original
          kept++;
          console.log(`  Keeping (no webp): ${entry.name}`);
        }
      }
    }
  }

  return { removed, kept, savedBytes };
}

console.log('\nCleaning dist/images/ (removing originals, keeping WebP)...\n');

try {
  const result = cleanDirectory(DIST_IMAGES);

  const savedMB = (result.savedBytes / 1024 / 1024).toFixed(1);

  console.log(`\nDone!`);
  console.log(`  Removed: ${result.removed} files (${savedMB} MB saved)`);
  if (result.kept > 0) {
    console.log(`  Kept: ${result.kept} files (no WebP version available)`);
  }
} catch (err) {
  if (err.code === 'ENOENT') {
    console.log('dist/images/ not found. Run "npm run build" first.');
  } else {
    console.error('Error:', err.message);
  }
  process.exit(1);
}
