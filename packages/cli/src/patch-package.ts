import path from 'path';
import { fileExists, readFile, writeFile, createBackup } from './utils.js';

/**
 * Patch package.json to add R1 dependencies
 */
export async function patchPackage(root: string): Promise<void> {
  const packagePath = path.join(root, 'package.json');
  
  if (!fileExists(packagePath)) {
    console.warn('⚠ No package.json found - skipping package patch');
    return;
  }
  
  const content = readFile(packagePath);
  const pkg = JSON.parse(content);
  
  // Ensure dependencies and devDependencies exist
  if (!pkg.dependencies) {
    pkg.dependencies = {};
  }
  if (!pkg.devDependencies) {
    pkg.devDependencies = {};
  }
  
  // Add R1 dependencies if not already present
  let modified = false;
  
  if (!pkg.dependencies['@r1-runtime/core']) {
    pkg.dependencies['@r1-runtime/core'] = '^0.3.4';
    modified = true;
  }
  
  if (!pkg.dependencies['@r1-runtime/apis']) {
    pkg.dependencies['@r1-runtime/apis'] = '^0.3.2';
    modified = true;
  }

  if (!pkg.dependencies['@r1-runtime/window']) {
    pkg.dependencies['@r1-runtime/window'] = '^0.3.1';
    modified = true;
  }
  
  if (!pkg.devDependencies['@r1-runtime/vite-plugin']) {
    pkg.devDependencies['@r1-runtime/vite-plugin'] = '^0.3.5';
    modified = true;
  }
  
  // Only write if we made changes
  if (modified) {
    createBackup(packagePath);
    writeFile(packagePath, JSON.stringify(pkg, null, 2) + '\n');
  }
}
