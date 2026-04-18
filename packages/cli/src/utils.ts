import fs from 'fs';
import path from 'path';

/**
 * Check if a file exists
 */
export function fileExists(filePath: string): boolean {
  return fs.existsSync(filePath);
}

/**
 * Read file content as UTF-8 string
 */
export function readFile(filePath: string): string {
  return fs.readFileSync(filePath, 'utf-8');
}

/**
 * Write content to file
 */
export function writeFile(filePath: string, content: string): void {
  fs.writeFileSync(filePath, content, 'utf-8');
}

/**
 * Create a backup of a file with .r1-backup extension
 */
export function createBackup(filePath: string): void {
  if (fileExists(filePath)) {
    const backupPath = `${filePath}.r1-backup`;
    const content = readFile(filePath);
    writeFile(backupPath, content);
  }
}

/**
 * Convert kebab-case to snake_case
 */
export function toSnakeCase(str: string): string {
  return str.replace(/-/g, '_');
}

/**
 * Find all Rust files in a directory
 */
export function findRustFiles(dir: string): string[] {
  const results: string[] = [];
  
  if (!fs.existsSync(dir)) return results;
  
  const files = fs.readdirSync(dir);
  
  for (const file of files) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    
    if (stat.isDirectory()) {
      results.push(...findRustFiles(filePath));
    } else if (file.endsWith('.rs')) {
      results.push(filePath);
    }
  }
  
  return results;
}
