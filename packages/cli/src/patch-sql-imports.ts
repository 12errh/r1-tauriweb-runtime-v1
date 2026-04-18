import * as fs from 'fs';
import * as path from 'path';

/**
 * Patches SQL imports from @tauri-apps/plugin-sql to @r1/apis/sql
 * 
 * This ensures that apps using Tauri's SQL plugin work seamlessly with R1.
 * The API is identical, only the import path changes.
 */
export async function patchSqlImports(root: string): Promise<number> {
  const srcDir = path.join(root, 'src');
  
  if (!fs.existsSync(srcDir)) {
    return 0; // No src directory, nothing to patch
  }

  let patchedCount = 0;

  // Recursively find all TypeScript/JavaScript files
  const files = findSourceFiles(srcDir);

  for (const file of files) {
    const content = fs.readFileSync(file, 'utf-8');
    const updated = patchSqlImportsInContent(content);

    if (updated !== content) {
      fs.writeFileSync(file, updated);
      patchedCount++;
      console.log(`    ✓ Updated SQL imports in ${path.relative(root, file)}`);
    }
  }

  return patchedCount;
}

/**
 * Patches SQL imports in a string content
 */
export function patchSqlImportsInContent(content: string): string {
  let updated = content;

  // Pattern 1: import Database from "@tauri-apps/plugin-sql"
  // Must be at start of line (not in comments or strings)
  updated = updated.replace(
    /^(\s*)import\s+Database\s+from\s+["']@tauri-apps\/plugin-sql["']/gm,
    '$1import { Database } from "@r1/apis/sql"'
  );

  // Pattern 2: import { Database } from "@tauri-apps/plugin-sql"
  updated = updated.replace(
    /^(\s*)import\s+\{\s*Database\s*\}\s+from\s+["']@tauri-apps\/plugin-sql["']/gm,
    '$1import { Database } from "@r1/apis/sql"'
  );

  // Pattern 3: import type Database from "@tauri-apps/plugin-sql"
  updated = updated.replace(
    /^(\s*)import\s+type\s+Database\s+from\s+["']@tauri-apps\/plugin-sql["']/gm,
    '$1import type { Database } from "@r1/apis/sql"'
  );

  // Pattern 4: import type { Database } from "@tauri-apps/plugin-sql"
  updated = updated.replace(
    /^(\s*)import\s+type\s+\{\s*Database\s*\}\s+from\s+["']@tauri-apps\/plugin-sql["']/gm,
    '$1import type { Database } from "@r1/apis/sql"'
  );

  // Pattern 5: import type { Database as Alias } from "@tauri-apps/plugin-sql"
  updated = updated.replace(
    /^(\s*)import\s+type\s+\{\s*Database\s+as\s+\w+\s*\}\s+from\s+["']@tauri-apps\/plugin-sql["']/gm,
    (match) => match.replace('@tauri-apps/plugin-sql', '@r1/apis/sql')
  );

  // Pattern 6: const Database = require("@tauri-apps/plugin-sql")
  updated = updated.replace(
    /^(\s*)const\s+Database\s+=\s+require\(["']@tauri-apps\/plugin-sql["']\)/gm,
    '$1const { Database } = require("@r1/apis/sql")'
  );

  // Pattern 7: Dynamic imports (must be careful not to match strings)
  updated = updated.replace(
    /\bimport\(["']@tauri-apps\/plugin-sql["']\)/g,
    'import("@r1/apis/sql")'
  );

  return updated;
}

/**
 * Recursively finds all source files in a directory
 */
function findSourceFiles(dir: string): string[] {
  const files: string[] = [];

  function walk(currentDir: string) {
    const entries = fs.readdirSync(currentDir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);

      if (entry.isDirectory()) {
        // Skip node_modules, dist, build directories
        if (!['node_modules', 'dist', 'build', '.git'].includes(entry.name)) {
          walk(fullPath);
        }
      } else if (entry.isFile()) {
        // Only process TypeScript and JavaScript files
        if (/\.(ts|tsx|js|jsx)$/.test(entry.name)) {
          files.push(fullPath);
        }
      }
    }
  }

  walk(dir);
  return files;
}
