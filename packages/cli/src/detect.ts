import path from 'path';
import { fileExists, readFile, findRustFiles } from './utils.js';
import TOML from '@iarna/toml';

export interface ProjectInfo {
  tauriVersion: 1 | 2;
  frontend: 'react' | 'svelte' | 'vue' | 'vanilla';
  hasBuildRs: boolean;
  hasLibRs: boolean;
  commands: string[];
  unsupportedApis: string[];
  hasSqlite: boolean;
}

/**
 * Detect Tauri project structure and configuration
 */
export async function detectProject(root: string): Promise<ProjectInfo> {
  const cargoTomlPath = path.join(root, 'src-tauri', 'Cargo.toml');
  const packageJsonPath = path.join(root, 'package.json');
  
  if (!fileExists(cargoTomlPath)) {
    throw new Error('No src-tauri/Cargo.toml found. Is this a Tauri project?');
  }
  
  // Detect Tauri version
  const cargoContent = readFile(cargoTomlPath);
  const cargo = TOML.parse(cargoContent) as any;
  
  let tauriVersion: 1 | 2 = 2;
  if (cargo.dependencies?.tauri) {
    const tauriDep = cargo.dependencies.tauri;
    const version = typeof tauriDep === 'string' ? tauriDep : tauriDep.version;
    tauriVersion = version.startsWith('1') ? 1 : 2;
  }
  
  // Detect frontend framework
  let frontend: 'react' | 'svelte' | 'vue' | 'vanilla' = 'vanilla';
  if (fileExists(packageJsonPath)) {
    const packageJson = JSON.parse(readFile(packageJsonPath));
    const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };
    
    if (deps['react'] || deps['@vitejs/plugin-react']) {
      frontend = 'react';
    } else if (deps['svelte'] || deps['@sveltejs/vite-plugin-svelte']) {
      frontend = 'svelte';
    } else if (deps['vue'] || deps['@vitejs/plugin-vue']) {
      frontend = 'vue';
    }
  }
  
  // Check for build.rs and lib.rs
  const hasBuildRs = fileExists(path.join(root, 'src-tauri', 'build.rs'));
  const hasLibRs = fileExists(path.join(root, 'src-tauri', 'src', 'lib.rs'));
  
  // Find Rust commands
  const commands = findTauriCommands(root);
  
  // Check for SQLite
  const hasSqlite = cargoContent.includes('rusqlite') || 
                    cargoContent.includes('sqlite') || 
                    cargoContent.includes('diesel');
  
  // Check for unsupported APIs (simplified for now)
  const unsupportedApis: string[] = [];
  
  return {
    tauriVersion,
    frontend,
    hasBuildRs,
    hasLibRs,
    commands,
    unsupportedApis,
    hasSqlite
  };
}

/**
 * Find all #[tauri::command] functions in Rust source files
 */
function findTauriCommands(root: string): string[] {
  const srcDir = path.join(root, 'src-tauri', 'src');
  const rustFiles = findRustFiles(srcDir);
  const commands: string[] = [];
  
  for (const file of rustFiles) {
    const content = readFile(file);
    
    // Simple regex to find #[tauri::command] followed by fn name
    const commandRegex = /#\[tauri::command\]\s*(?:pub\s+)?(?:async\s+)?fn\s+(\w+)/g;
    let match;
    
    while ((match = commandRegex.exec(content)) !== null) {
      commands.push(match[1]);
    }
  }
  
  return commands;
}
