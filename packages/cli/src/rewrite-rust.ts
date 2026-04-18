import path from 'path';
import { fileExists, readFile, writeFile, createBackup, findRustFiles } from './utils.js';

/**
 * Rewrite Rust commands from #[tauri::command] to R1 JSON contract
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
 * Rewrite a single Rust file
 */
function rewriteRustFile(content: string): string {
  let result = content;
  
  // Add required imports at the top if not present
  if (!result.includes('use wasm_bindgen::prelude::*')) {
    result = 'use wasm_bindgen::prelude::*;\n' + result;
  }
  
  if (!result.includes('use serde::')) {
    result = 'use serde::{Serialize, Deserialize};\n' + result;
  }
  
  // Find and rewrite each #[tauri::command] function
  const commandRegex = /#\[tauri::command\]\s*(pub\s+)?(async\s+)?fn\s+(\w+)\s*\(([^)]*)\)\s*->\s*([^{]+)\{/g;
  
  result = result.replace(commandRegex, (match, pubMod, asyncMod, fnName, params, returnType) => {
    return rewriteCommand(fnName, params, returnType, match);
  });
  
  // Gate the run() function if it exists
  if (result.includes('pub fn run()') || result.includes('fn run()')) {
    result = result.replace(
      /(pub\s+)?fn\s+run\(\)/g,
      '#[cfg(not(target_arch = "wasm32"))]\n$&'
    );
  }
  
  return result;
}

/**
 * Rewrite a single command function
 */
function rewriteCommand(fnName: string, params: string, returnType: string, originalMatch: string): string {
  // Parse parameters
  const paramList = params.split(',').map(p => p.trim()).filter(p => p.length > 0);
  const parsedParams: Array<{ name: string; type: string }> = [];
  
  for (const param of paramList) {
    const parts = param.split(':').map(p => p.trim());
    if (parts.length >= 2) {
      let paramType = parts.slice(1).join(':').trim();
      // Convert &str to String for JSON deserialization
      if (paramType === '&str') {
        paramType = 'String';
      }
      parsedParams.push({
        name: parts[0],
        type: paramType
      });
    }
  }
  
  // Generate Args struct
  let argsStruct = '';
  if (parsedParams.length > 0) {
    argsStruct = '    #[derive(Deserialize)]\n';
    argsStruct += '    struct Args {\n';
    for (const param of parsedParams) {
      argsStruct += `        ${param.name}: ${param.type},\n`;
    }
    argsStruct += '    }\n\n';
  }
  
  // Generate argument parsing
  let argsParsing = '';
  if (parsedParams.length > 0) {
    argsParsing = '    let args: Args = match serde_json::from_str(payload) {\n';
    argsParsing += '        Ok(a) => a,\n';
    argsParsing += '        Err(e) => return serde_json::json!({ "error": e.to_string() }).to_string(),\n';
    argsParsing += '    };\n\n';
    
    // Extract individual parameters
    for (const param of parsedParams) {
      argsParsing += `    let ${param.name} = args.${param.name};\n`;
    }
    argsParsing += '\n';
  }
  
  // Note: The function body will need to be manually wrapped in serde_json::to_string
  // This is a limitation of the simple regex-based approach
  // For now, we just set up the signature and args parsing
  
  // Build the new function signature
  const newSignature = `#[wasm_bindgen]\npub fn ${fnName}(payload: &str) -> String {`;
  
  return newSignature + '\n' + argsStruct + argsParsing + '    // TODO: Wrap return value in serde_json::to_string(&result).unwrap()\n';
}
