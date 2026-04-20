import path from 'path';
import TOML from '@iarna/toml';
import { fileExists, readFile, writeFile, createBackup, toSnakeCase } from './utils.js';

/**
 * Patch Cargo.toml for WASM compatibility
 */
export async function patchCargo(root: string): Promise<void> {
  const cargoPath = path.join(root, 'src-tauri', 'Cargo.toml');
  
  if (!fileExists(cargoPath)) {
    throw new Error('src-tauri/Cargo.toml not found');
  }
  
  const raw = readFile(cargoPath);
  const cargo = TOML.parse(raw) as any;
  
  // Get crate name and convert to snake_case
  const crateName = toSnakeCase(cargo.package.name);
  
  // Add [lib] section if not exists
  if (!cargo.lib) {
    cargo.lib = {
      name: crateName,
      'crate-type': ['cdylib', 'rlib']
    };
  } else {
    // Ensure crate-type is set correctly — remove staticlib if present
    // (wasm-pack does not support staticlib)
    const existingTypes: string[] = cargo.lib['crate-type'] || [];
    const filtered = existingTypes.filter((t: string) => t !== 'staticlib');
    if (!filtered.includes('cdylib')) filtered.push('cdylib');
    if (!filtered.includes('rlib')) filtered.push('rlib');
    cargo.lib['crate-type'] = filtered;
  }
  
  // Ensure dependencies section exists
  if (!cargo.dependencies) {
    cargo.dependencies = {};
  }
  
  // Add WASM dependencies
  if (!cargo.dependencies['wasm-bindgen']) {
    cargo.dependencies['wasm-bindgen'] = '0.2';
  }
  
  if (!cargo.dependencies['serde']) {
    cargo.dependencies['serde'] = { version: '1', features: ['derive'] };
  }
  
  if (!cargo.dependencies['serde_json']) {
    cargo.dependencies['serde_json'] = '1';
  }
  
  // Add r1-macros for #[r1::command] support
  if (!cargo.dependencies['r1-macros']) {
    cargo.dependencies['r1-macros'] = '0.3.0';
  }
  
  // Move native-only dependencies to target-specific section
  const nativeDeps: Record<string, any> = {};
  const nativeOnly = [
    'tauri',
    'tauri-plugin-opener',
    'tauri-plugin-store',
    'tauri-plugin-shell',
    'tauri-plugin-dialog',
    'tauri-plugin-fs',
    'tauri-plugin-http',
    'tauri-plugin-notification',
    'tauri-plugin-clipboard-manager'
  ];
  
  for (const dep of nativeOnly) {
    if (cargo.dependencies[dep]) {
      nativeDeps[dep] = cargo.dependencies[dep];
      delete cargo.dependencies[dep];
    }
  }
  
  // Add target-specific dependencies if we moved any
  if (Object.keys(nativeDeps).length > 0) {
    const targetKey = "target.'cfg(not(target_arch = \"wasm32\"))'.dependencies";
    if (!cargo[targetKey]) {
      cargo[targetKey] = {};
    }
    Object.assign(cargo[targetKey], nativeDeps);
  }
  
  // Remove [build-dependencies] section
  if (cargo['build-dependencies']) {
    delete cargo['build-dependencies'];
  }
  
  // Create backup
  createBackup(cargoPath);
  
  // Write back
  writeFile(cargoPath, TOML.stringify(cargo));
}
