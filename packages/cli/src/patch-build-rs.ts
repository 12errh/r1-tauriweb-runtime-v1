import path from 'path';
import { fileExists, readFile, writeFile, createBackup } from './utils.js';

/**
 * Patch build.rs to empty main function for WASM compatibility
 */
export async function patchBuildRs(root: string): Promise<void> {
  const buildRsPath = path.join(root, 'src-tauri', 'build.rs');
  
  // If no build.rs exists, nothing to do
  if (!fileExists(buildRsPath)) {
    return;
  }
  
  const current = readFile(buildRsPath);
  
  // Already patched - check if it's just the empty main
  if (current.trim() === 'fn main() {}') {
    return;
  }
  
  // Create backup
  createBackup(buildRsPath);
  
  // Replace with empty main
  writeFile(buildRsPath, 'fn main() {}\n');
}
