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
  
  // Detect Tauri version from current dependencies
  let tauriVersion = "2.0.0";
  if (cargo.dependencies?.tauri) {
      if (typeof cargo.dependencies.tauri === 'string') {
          tauriVersion = cargo.dependencies.tauri;
      } else if (cargo.dependencies.tauri.version) {
          tauriVersion = cargo.dependencies.tauri.version;
      }
  }

  // Add [lib] section if not exists
  if (!cargo.lib) {
    cargo.lib = {
      name: crateName,
      'crate-type': ['cdylib', 'rlib']
    };
  } else {
    // Ensure crate-type is set correctly — remove staticlib if present
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
  const wasmDeps: Record<string, any> = {
    'wasm-bindgen': '0.2',
    'serde': { version: '1', features: ['derive'] },
    'serde_json': '1',
    'r1-macros': '0.4.0'
  };

  for (const [name, val] of Object.entries(wasmDeps)) {
      if (!cargo.dependencies[name]) {
          cargo.dependencies[name] = val;
      } else if (name === 'r1-macros') {
          // Force update to latest version
          cargo.dependencies[name] = val;
      }
  }
  
  // Move native-only dependencies to target-specific section
  const nativeDeps: Record<string, any> = {};
  
  for (const dep of Object.keys(cargo.dependencies)) {
    if (dep === 'tauri' || dep.startsWith('tauri-plugin-') || dep.startsWith('tauri-runtime-')) {
      nativeDeps[dep] = cargo.dependencies[dep];
      delete cargo.dependencies[dep];
    }
  }

  const targetNotWasmKey = "target.'cfg(not(target_arch = \"wasm32\"))'.dependencies";
  const targetWasmKey = "target.'cfg(target_arch = \"wasm32\")'.dependencies";
  
  if (Object.keys(nativeDeps).length > 0) {
    if (!cargo[targetNotWasmKey]) {
      cargo[targetNotWasmKey] = {};
    }
    Object.assign(cargo[targetNotWasmKey], nativeDeps);
  }

  // Ensure tauri is present in WASM target but without native features
  if (!cargo[targetWasmKey]) {
      cargo[targetWasmKey] = {};
  }
  if (!cargo[targetWasmKey]['tauri']) {
      cargo[targetWasmKey]['tauri'] = { version: tauriVersion, "default-features": false };
  }
  
  // Remove [build-dependencies] if they contain tauri-build which fails in WASM
  if (cargo['build-dependencies']) {
    if (cargo['build-dependencies']['tauri-build']) {
        delete cargo['build-dependencies']['tauri-build'];
    }
    if (Object.keys(cargo['build-dependencies']).length === 0) {
        delete cargo['build-dependencies'];
    }
  }
  
  // Create backup
  createBackup(cargoPath);
  
  // Write back
  writeFile(cargoPath, TOML.stringify(cargo));
}
