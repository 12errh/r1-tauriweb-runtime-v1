import path from 'path';
import { fileExists, readFile, writeFile, createBackup } from './utils.js';

/**
 * Patch vite.config.ts to add r1Plugin
 */
export async function patchVite(root: string): Promise<void> {
  // Try both .ts and .js extensions
  let vitePath = path.join(root, 'vite.config.ts');
  if (!fileExists(vitePath)) {
    vitePath = path.join(root, 'vite.config.js');
  }
  
  if (!fileExists(vitePath)) {
    console.warn('⚠ No vite.config.ts or vite.config.js found - skipping vite patch');
    return;
  }
  
  let content = readFile(vitePath);
  
  // Already patched
  if (content.includes('@r1-runtime/vite-plugin') || content.includes('r1Plugin')) {
    return;
  }
  
  // Create backup
  createBackup(vitePath);
  
  // Add import at the top (after other imports)
  const importStatement = "import { r1Plugin } from '@r1-runtime/vite-plugin';\n";
  
  // Find the last import statement
  const lines = content.split('\n');
  let lastImportIndex = -1;
  
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim().startsWith('import ')) {
      lastImportIndex = i;
    }
  }
  
  if (lastImportIndex >= 0) {
    lines.splice(lastImportIndex + 1, 0, importStatement);
    content = lines.join('\n');
  } else {
    // No imports found, add at the top
    content = importStatement + content;
  }
  
  // Add r1Plugin to plugins array
  content = content.replace(
    /plugins:\s*\[/,
    `plugins: [\n    r1Plugin({ rustSrc: './src-tauri' }),`
  );
  
  writeFile(vitePath, content);
}
