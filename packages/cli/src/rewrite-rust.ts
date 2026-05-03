import path from 'path';
import { fileExists, readFile, writeFile, createBackup, findRustFiles } from './utils.js';

/**
 * Rewrite Rust commands from #[tauri::command] to #[r1::command] macro.
 */
export async function rewriteRust(root: string): Promise<void> {
  const srcDir = path.join(root, 'src-tauri', 'src');
  const rustFiles = findRustFiles(srcDir);
  
  for (const file of rustFiles) {
    const content = readFile(file);
    
    // Check if file has tauri::command annotations or other tauri things we need to gate
    if (!content.includes('#[tauri::command]') && !content.includes('tauri::Builder') && !content.includes('fn main()')) {
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
 * Rewrite a single Rust file to use #[r1::command] macro and add necessary stubs.
 */
function rewriteRustFile(content: string): string {
  let result = content;

  // 1. Add r1_macros and stubs
  if (!result.includes('use r1_macros') && !result.includes('r1_macros::command')) {
    const stubs = `
#[cfg(target_arch = "wasm32")]
mod r1_tauri_stubs {
    use serde::Deserialize;
    use std::ops::Deref;

    pub struct State<T>(pub T);
    impl<T> Deref for State<T> {
        type Target = T;
        fn deref(&self) -> &Self::Target { &self.0 }
    }
    impl<'de, T: Default> Deserialize<'de> for State<T> {
        fn deserialize<D>(_: D) -> Result<Self, D::Error> where D: serde::Deserializer<'de> {
            Ok(State(T::default()))
        }
    }

    pub struct Window;
    impl Window {
        pub fn label(&self) -> &str { "main" }
        pub fn close(&self) -> Result<(), ()> { Ok(()) }
    }
    impl<'de> Deserialize<'de> for Window {
        fn deserialize<D>(_: D) -> Result<Self, D::Error> where D: serde::Deserializer<'de> {
            Ok(Window)
        }
    }

    pub struct AppHandle<R = ()>(std::marker::PhantomData<R>);
    impl<R> AppHandle<R> {
        pub fn package_info(&self) -> &str { "" }
    }
    impl<'de, R> Deserialize<'de> for AppHandle<R> {
        fn deserialize<D>(_: D) -> Result<Self, D::Error> where D: serde::Deserializer<'de> {
            Ok(AppHandle(std::marker::PhantomData))
        }
    }

    pub trait Runtime {}
    impl Runtime for () {}
}
#[cfg(target_arch = "wasm32")]
#[allow(unused_imports)]
use r1_tauri_stubs::*;
use r1_macros::command;
`;
    // Find a good place to insert - after inner attributes
    const lines = result.split('\n');
    let insertIndex = 0;
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (line.startsWith('#![') || line.startsWith('//') || line === '') {
            insertIndex = i + 1;
        } else {
            break;
        }
    }
    lines.splice(insertIndex, 0, stubs);
    result = lines.join('\n');
  }

  // 2. Replace #[tauri::command] with #[command] and ensure function is pub
  result = result.replace(
    /#\[tauri::command\]\s*\n(\s*)(async\s+)?fn\s+/g,
    '#[command]\n$1pub $2fn '
  );
  result = result.replace(/#\[tauri::command\]/g, '#[command]');

  // 3. Remove &str parameter types — replace with String
  result = result.replace(
    /(#\[command\][^{]*fn\s+\w+\s*\([^)]*)\b(\w+)\s*:\s*&str([^)]*\))/g,
    (match, before, paramName, after) => `${before}${paramName}: String${after}`
  );

  // 4. Clean up signatures in WASM
  result = result.replace(
      /(#\[command\][^{]*fn\s+\w+\s*\([^)]*)\bState\s*<\s*'\s*\w+\s*,\s*([^>]*)\s*>([^)]*\))/g,
      '$1State<$2>$3'
  );

  result = result.replace(
      /(#\[command\][^{]*fn\s+\w+)\s*<\s*[^>]*\s*>(\s*\()/g,
      '$1$2'
  );

  result = result.replace(
      /(#\[command\][^{]*fn\s+\w+\s*\([^)]*)\bAppHandle\s*<\s*[^>]*\s*>([^)]*\))/g,
      '$1AppHandle$2'
  );

  // 5. Gate imports and functions
  result = result.replace(
    /^(use\s+tauri\b)/gm,
    '#[cfg(not(target_arch = "wasm32"))]\n$1'
  );

  result = result.replace(
    /^((pub\s+)?fn\s+run\(\))/gm,
    '#[cfg(not(target_arch = "wasm32"))]\n$1'
  );

  result = result.replace(
      /^((pub\s+)?fn\s+main\(\))/gm,
      '#[cfg(not(target_arch = "wasm32"))]\n$1'
  );

  return result;
}
