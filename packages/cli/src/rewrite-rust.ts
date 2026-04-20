import path from 'path';
import { fileExists, readFile, writeFile, createBackup, findRustFiles } from './utils.js';

/**
 * Rewrite Rust commands from #[tauri::command] to #[r1::command] macro.
 * 
 * This is the preferred approach — the r1-macros crate handles all JSON
 * serialization automatically, so we just swap the attribute.
 */
export async function rewriteRust(root: string): Promise<void> {
  const srcDir = path.join(root, 'src-tauri', 'src');
  const rustFiles = findRustFiles(srcDir);
  
  for (const file of rustFiles) {
    const content = readFile(file);
    
    // Check if file has tauri::command annotations
    if (!content.includes('#[tauri::command]')) {
      continue;
    }
    
    // Create backup
    createBackup(file);
    
    // Rewrite the file
    const rewritten = rewriteRustFile(content);
    writeFile(file, rewritten);
  }
}

/**
 * Rewrite a single Rust file to use #[r1::command] macro.
 */
function rewriteRustFile(content: string): string {
  let result = content;

  // 1. Add r1_macros import if not present
  if (!result.includes('use r1_macros') && !result.includes('r1_macros::command')) {
    result = 'use r1_macros::command;\n' + result;
  }

  // 2. Replace #[tauri::command] with #[command] and ensure function is pub
  result = result.replace(
    /#\[tauri::command\]\s*\n(\s*)(async\s+)?fn\s+/g,
    '#[command]\n$1pub $2fn '
  );
  // Also handle cases where pub is already there
  result = result.replace(/#\[tauri::command\]/g, '#[command]');

  // 3. Remove &str parameter types — replace with String (macro needs owned types)
  //    Only inside function signatures that now have #[command]
  result = result.replace(
    /(#\[command\][^{]*fn\s+\w+\s*\([^)]*)\b(\w+)\s*:\s*&str([^)]*\))/g,
    (match, before, paramName, after) => `${before}${paramName}: String${after}`
  );

  // 4. Gate the run() function so it doesn't compile to WASM.
  //    Step A: replace #[cfg_attr(mobile, tauri::mobile_entry_point)] with #[cfg(not(...))]
  result = result.replace(
    /#\[cfg_attr\(mobile,\s*tauri::mobile_entry_point\)\]\s*\n(pub\s+)?fn\s+run\(\)/g,
    '#[cfg(not(target_arch = "wasm32"))]\npub fn run()'
  );
  //    Step B: if run() still has no cfg gate, add one
  //    (only matches lines NOT already preceded by #[cfg(not(target_arch...)])
  if (!result.includes('#[cfg(not(target_arch = "wasm32"))]\npub fn run()') &&
      !result.includes('#[cfg(not(target_arch = "wasm32"))]\nfn run()')) {
    result = result.replace(
      /^((pub\s+)?fn\s+run\(\))/gm,
      '#[cfg(not(target_arch = "wasm32"))]\n$1'
    );
  }

  // 5. Remove wasm_bindgen imports that may have been added by a previous run
  //    (the macro handles this internally)
  result = result.replace(/^use wasm_bindgen::prelude::\*;\n/gm, '');

  return result;
}
