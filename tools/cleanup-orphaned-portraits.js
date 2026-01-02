#!/usr/bin/env node

/**
 * Removes portrait entries from appearanceConfig.json when the image file no longer exists.
 *
 * Usage:
 *   node tools/cleanup-orphaned-portraits.js           # Dry run (shows what would be removed)
 *   node tools/cleanup-orphaned-portraits.js --apply   # Actually removes orphaned entries
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const CONFIG_PATH = join(__dirname, '../src/src/data/appearanceConfig.json');
const IMAGES_DIR = join(__dirname, '../src/public/images');

const applyChanges = process.argv.includes('--apply');

console.log('\nPortrait Cleanup Script');
console.log('=======================\n');

// Read config
const config = JSON.parse(readFileSync(CONFIG_PATH, 'utf8'));
const originalCount = config.portraits.length;

// Find orphaned portraits (image file doesn't exist)
const orphaned = [];
const valid = [];

for (const portrait of config.portraits) {
  const imagePath = join(IMAGES_DIR, portrait.image);

  if (existsSync(imagePath)) {
    valid.push(portrait);
  } else {
    orphaned.push(portrait);
  }
}

if (orphaned.length === 0) {
  console.log('No orphaned portraits found. All entries have valid image files.\n');
  process.exit(0);
}

console.log(`Found ${orphaned.length} orphaned portrait(s):\n`);

for (const p of orphaned) {
  console.log(`  - ${p.id}`);
  console.log(`    Image: ${p.image}`);
  console.log(`    Traits: ${p.sex} ${p.race} ${p.build} ${p.skinTone} ${p.hairColor}\n`);
}

if (applyChanges) {
  // Update config
  config.portraits = valid;

  // Write back with nice formatting
  writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2) + '\n');

  console.log(`\nRemoved ${orphaned.length} orphaned entries from appearanceConfig.json`);
  console.log(`Portraits: ${originalCount} → ${valid.length}\n`);
} else {
  console.log('─'.repeat(50));
  console.log('\nThis was a dry run. No changes were made.');
  console.log('Run with --apply to remove these entries:\n');
  console.log('  node tools/cleanup-orphaned-portraits.js --apply\n');
}
