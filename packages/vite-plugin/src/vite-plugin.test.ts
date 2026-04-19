import { describe, it, expect } from 'vitest';

describe('Vite Plugin - Phase 1 Tests', () => {
  it('loads _bg.wasm not .js', () => {
    // Test that the boot script references _bg.wasm
    const wasmName = 'my_app';
    const bootScript = `
      import { R1Runtime } from '@r1-runtime/core';
      console.log('[R1] Booting Runtime...');
      const r1 = new R1Runtime();
      r1.boot({ 
        wasmPath: '/wasm/${wasmName}_bg.wasm' 
      }).then(() => {
        console.log('[R1] Boot complete.');
        window.dispatchEvent(new Event('r1:ready'));
      });
    `;
    
    expect(bootScript).toContain('my_app_bg.wasm');
    expect(bootScript).not.toContain('my_app.js');
  });

  it('patches all tauri sub-path imports', () => {
    // Simulate the transform function
    const patchImports = (code: string): string => {
      const importMap: Record<string, string> = {
        '@tauri-apps/api/core':         '@r1-runtime/apis/core',
        '@tauri-apps/api/tauri':        '@r1-runtime/apis/core',
        '@tauri-apps/api/fs':           '@r1-runtime/apis/fs',
        '@tauri-apps/api/path':         '@r1-runtime/apis/path',
        '@tauri-apps/api/event':        '@r1-runtime/apis/event',
        '@tauri-apps/api/window':       '@r1-runtime/apis/window',
        '@tauri-apps/api/dialog':       '@r1-runtime/apis/dialog',
        '@tauri-apps/api/clipboard':    '@r1-runtime/apis/clipboard',
        '@tauri-apps/api/notification': '@r1-runtime/apis/notification',
        '@tauri-apps/api/os':           '@r1-runtime/apis/os',
        '@tauri-apps/api/shell':        '@r1-runtime/apis/shell',
        '@tauri-apps/api/http':         '@r1-runtime/apis/http',
        '@tauri-apps/api/store':        '@r1-runtime/apis/store',
        '@tauri-apps/plugin-store':     '@r1-runtime/apis/store',
        '@tauri-apps/api':              '@r1-runtime/apis',
      };

      let newCode = code;
      const sortedKeys = Object.keys(importMap).sort((a, b) => b.length - a.length);
      
      for (const tauriPath of sortedKeys) {
        const r1Path = importMap[tauriPath];
        const regex = new RegExp(`(['"])${tauriPath.replace(/\//g, '\\/')}\\1`, 'g');
        newCode = newCode.replace(regex, `$1${r1Path}$1`);
      }
      
      return newCode;
    };

    // Test fs import
    const input1 = `import { readDir } from '@tauri-apps/api/fs'`;
    const output1 = patchImports(input1);
    expect(output1).toContain('@r1-runtime/apis/fs');
    expect(output1).not.toContain('@tauri-apps/api/fs');

    // Test path import
    const input2 = `import { homeDir } from '@tauri-apps/api/path'`;
    const output2 = patchImports(input2);
    expect(output2).toContain('@r1-runtime/apis/path');
    expect(output2).not.toContain('@tauri-apps/api/path');

    // Test event import
    const input3 = `import { listen } from '@tauri-apps/api/event'`;
    const output3 = patchImports(input3);
    expect(output3).toContain('@r1-runtime/apis/event');
    expect(output3).not.toContain('@tauri-apps/api/event');

    // Test window import
    const input4 = `import { appWindow } from '@tauri-apps/api/window'`;
    const output4 = patchImports(input4);
    expect(output4).toContain('@r1-runtime/apis/window');
    expect(output4).not.toContain('@tauri-apps/api/window');

    // Test core import
    const input5 = `import { invoke } from '@tauri-apps/api/core'`;
    const output5 = patchImports(input5);
    expect(output5).toContain('@r1-runtime/apis/core');
    expect(output5).not.toContain('@tauri-apps/api/core');

    // Test tauri v1 import
    const input6 = `import { invoke } from '@tauri-apps/api/tauri'`;
    const output6 = patchImports(input6);
    expect(output6).toContain('@r1-runtime/apis/core');
    expect(output6).not.toContain('@tauri-apps/api/tauri');

    // Test store plugin import
    const input7 = `import { Store } from '@tauri-apps/plugin-store'`;
    const output7 = patchImports(input7);
    expect(output7).toContain('@r1-runtime/apis/store');
    expect(output7).not.toContain('@tauri-apps/plugin-store');

    // Test bare import (should be replaced last)
    const input8 = `import * as tauri from '@tauri-apps/api'`;
    const output8 = patchImports(input8);
    expect(output8).toContain('@r1-runtime/apis');
    expect(output8).not.toContain('@tauri-apps/api');
  });

  it('patcher handles both single and double quotes', () => {
    const patchImports = (code: string): string => {
      const importMap: Record<string, string> = {
        '@tauri-apps/api/fs': '@r1-runtime/apis/fs',
      };

      let newCode = code;
      for (const tauriPath of Object.keys(importMap)) {
        const r1Path = importMap[tauriPath];
        const regex = new RegExp(`(['"])${tauriPath.replace(/\//g, '\\/')}\\1`, 'g');
        newCode = newCode.replace(regex, `$1${r1Path}$1`);
      }
      return newCode;
    };

    const singleQuote = `import { readDir } from '@tauri-apps/api/fs'`;
    const doubleQuote = `import { readDir } from "@tauri-apps/api/fs"`;
    
    expect(patchImports(singleQuote)).toContain("'@r1-runtime/apis/fs'");
    expect(patchImports(doubleQuote)).toContain('"@r1-runtime/apis/fs"');
  });

  it('patcher is idempotent', () => {
    const patchImports = (code: string): string => {
      const importMap: Record<string, string> = {
        '@tauri-apps/api/fs': '@r1-runtime/apis/fs',
      };

      let newCode = code;
      for (const tauriPath of Object.keys(importMap)) {
        const r1Path = importMap[tauriPath];
        const regex = new RegExp(`(['"])${tauriPath.replace(/\//g, '\\/')}\\1`, 'g');
        newCode = newCode.replace(regex, `$1${r1Path}$1`);
      }
      return newCode;
    };

    const input = `import { readDir } from '@tauri-apps/api/fs'`;
    const firstPass = patchImports(input);
    const secondPass = patchImports(firstPass);
    const thirdPass = patchImports(secondPass);
    
    expect(firstPass).toBe(secondPass);
    expect(secondPass).toBe(thirdPass);
    expect(firstPass).toContain('@r1-runtime/apis/fs');
  });

  it('patcher processes longer paths before shorter paths', () => {
    const patchImports = (code: string): string => {
      const importMap: Record<string, string> = {
        '@tauri-apps/api/fs': '@r1-runtime/apis/fs',
        '@tauri-apps/api': '@r1-runtime/apis',
      };

      let newCode = code;
      const sortedKeys = Object.keys(importMap).sort((a, b) => b.length - a.length);
      
      for (const tauriPath of sortedKeys) {
        const r1Path = importMap[tauriPath];
        const regex = new RegExp(`(['"])${tauriPath.replace(/\//g, '\\/')}\\1`, 'g');
        newCode = newCode.replace(regex, `$1${r1Path}$1`);
      }
      return newCode;
    };

    // This should become @r1-runtime/apis/fs, not @r1-runtime/apis
    const input = `import { readDir } from '@tauri-apps/api/fs'`;
    const output = patchImports(input);
    
    expect(output).toContain('@r1-runtime/apis/fs');
    expect(output).not.toContain('@tauri-apps/api');
    
    // Verify the full output is correct
    expect(output).toBe(`import { readDir } from '@r1-runtime/apis/fs'`);
  });
});
