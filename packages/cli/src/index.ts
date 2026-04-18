#!/usr/bin/env node

/**
 * R1 CLI - Phase 4 Implementation
 * 
 * Automatically migrates Tauri apps to work with R1 Runtime
 */

import chalk from 'chalk';
import ora from 'ora';
import { detectProject } from './detect.js';
import { patchBuildRs } from './patch-build-rs.js';
import { patchCargo } from './patch-cargo.js';
import { patchVite } from './patch-vite.js';
import { patchPackage } from './patch-package.js';
import { rewriteRust } from './rewrite-rust.js';
import { patchSqlImports } from './patch-sql-imports.js';

async function main() {
  const root = process.cwd();

  console.log(chalk.bold('\n🚀 R1 TauriWeb Runtime — Sync\n'));

  // Step 1: Detect project
  const spinner = ora('Detecting project...').start();
  
  let project;
  try {
    project = await detectProject(root);
    spinner.succeed(`Detected: Tauri v${project.tauriVersion}, ${project.frontend}, ${project.commands.length} commands`);
  } catch (err) {
    spinner.fail((err as Error).message);
    process.exit(1);
  }

  // Step 2: Warn about special cases
  if (project.hasSqlite) {
    console.log(chalk.green('\n✓ SQLite detected. R1 includes @sqlite.org/sqlite-wasm with OPFS persistence.'));
    console.log(chalk.gray('  Your SQLite data will persist across page refreshes in the browser.\n'));
  }

  if (project.unsupportedApis.length > 0) {
    console.log(chalk.yellow(`\n⚠  Unsupported APIs found:`));
    project.unsupportedApis.forEach(api => console.log(chalk.yellow(`   - ${api}`)));
    console.log(chalk.yellow('   These will be stubbed — functionality may be limited.\n'));
  }

  // Step 3: Apply patches
  const steps = [
    { label: 'Patching build.rs', fn: () => patchBuildRs(root) },
    { label: 'Updating Cargo.toml', fn: () => patchCargo(root) },
    { label: 'Updating vite.config.ts', fn: () => patchVite(root) },
    { label: 'Updating package.json', fn: () => patchPackage(root) },
    { label: 'Patching SQL imports', fn: async () => {
      const count = await patchSqlImports(root);
      if (count > 0) {
        console.log(chalk.gray(`    Found and updated ${count} file(s) with SQL imports`));
      }
    }},
    { label: `Rewriting ${project.commands.length} Rust commands`, fn: () => rewriteRust(root) },
  ];

  for (const step of steps) {
    const s = ora(step.label).start();
    try {
      await step.fn();
      s.succeed();
    } catch (err) {
      s.fail(`${step.label}: ${(err as Error).message}`);
      console.error(chalk.red('\n' + (err as Error).stack));
      process.exit(1);
    }
  }

  // Step 4: Success message
  console.log(chalk.green('\n✓ Done! Your app is ready for R1.\n'));
  console.log('Next steps:');
  console.log(chalk.cyan('  npm install'));
  console.log(chalk.cyan('  npm run build'));
  console.log(chalk.cyan('  npx serve dist -l 3000'));
  console.log('\nThen open http://localhost:3000 and press Ctrl+F5.\n');
}

main().catch((err) => {
  console.error(chalk.red('Fatal error:'), err);
  process.exit(1);
});

