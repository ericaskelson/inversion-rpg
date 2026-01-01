/**
 * Build script: Compiles all scenario folders into a single JSON bundle
 * Run with: node tools/build-scenarios.js
 */

const fs = require('fs');
const path = require('path');

const SCENARIOS_DIR = path.join(__dirname, '..', 'scenarios');
const OUTPUT_FILE = path.join(__dirname, '..', 'src', 'public', 'scenarios.json');

function buildScenarios() {
  const scenarios = {};
  const errors = [];

  // Get all scenario folders
  const folders = fs.readdirSync(SCENARIOS_DIR, { withFileTypes: true })
    .filter(dirent => dirent.isDirectory())
    .map(dirent => dirent.name);

  console.log(`Found ${folders.length} scenario folders`);

  for (const folder of folders) {
    const folderPath = path.join(SCENARIOS_DIR, folder);
    const configPath = path.join(folderPath, 'config.json');
    const contentPath = path.join(folderPath, 'content.md');

    // Check required files exist
    if (!fs.existsSync(configPath)) {
      errors.push(`${folder}: missing config.json`);
      continue;
    }
    if (!fs.existsSync(contentPath)) {
      errors.push(`${folder}: missing content.md`);
      continue;
    }

    try {
      const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
      const content = fs.readFileSync(contentPath, 'utf-8');

      // Validate config has required fields
      if (!config.id) {
        errors.push(`${folder}: config.json missing 'id' field`);
        continue;
      }

      scenarios[config.id] = {
        ...config,
        content: content
      };

      console.log(`  ✓ ${config.id}`);
    } catch (e) {
      errors.push(`${folder}: ${e.message}`);
    }
  }

  // Validate links
  console.log('\nValidating scenario links...');
  const allIds = new Set(Object.keys(scenarios));

  for (const [id, scenario] of Object.entries(scenarios)) {
    if (!scenario.choices) continue;

    for (const choice of scenario.choices) {
      if (!choice.outcomes) continue;

      for (const outcome of choice.outcomes) {
        if (outcome.next && !allIds.has(outcome.next)) {
          errors.push(`${id}: broken link to '${outcome.next}'`);
        }
      }
    }
  }

  // Find start scenario
  const startScenarios = Object.values(scenarios).filter(s => s.isStart);
  if (startScenarios.length === 0) {
    errors.push('No scenario marked with isStart: true');
  } else if (startScenarios.length > 1) {
    errors.push(`Multiple start scenarios: ${startScenarios.map(s => s.id).join(', ')}`);
  }

  // Report errors
  if (errors.length > 0) {
    console.log('\n⚠ Errors found:');
    errors.forEach(e => console.log(`  - ${e}`));
  }

  // Ensure output directory exists
  const outputDir = path.dirname(OUTPUT_FILE);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // Write output
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(scenarios, null, 2));
  console.log(`\n✓ Built ${Object.keys(scenarios).length} scenarios to ${OUTPUT_FILE}`);

  return errors.length === 0;
}

const success = buildScenarios();
process.exit(success ? 0 : 1);
