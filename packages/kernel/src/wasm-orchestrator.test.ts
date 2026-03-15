import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { WasmOrchestrator } from './wasm-orchestrator';
import { readFileSync } from 'fs';
import { resolve } from 'path';

describe('Phase 4 & 5: WasmOrchestrator + Module Registry', () => {
  let wasmBgBytes: ArrayBuffer;
  let originalFetch: any;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn().mockImplementation(async (url: string) => {
      let fileName = '';
      if (url.includes('test-module_bg.wasm')) {
        fileName = 'test-module_bg.wasm';
      } else if (url.includes('test-module.wasm')) {
        fileName = 'test-module.wasm';
      }

      if (fileName) {
        const wasmPath = resolve(__dirname, `../../../tests/fixtures/wasm/${fileName}`);
        const buffer = readFileSync(wasmPath);
        const bytes = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
        return {
          ok: true,
          arrayBuffer: async () => bytes,
        };
      }
      return { ok: false, status: 404 };
    });
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('1. Two .wasm modules loaded simultaneously under different names are isolated', async () => {
    const orchestrator = new WasmOrchestrator();
    
    // Load two completely independent WASM memory bounds
    await orchestrator.loadModule('my-app-1', '/test-module.wasm');
    await orchestrator.loadModule('my-app-2', '/test-module.wasm');

    // Prove both evaluate successfully
    const res1 = orchestrator.callFunction('my-app-1', 'add', [10, 5]);
    const res2 = orchestrator.callFunction('my-app-2', 'multiply', [10, 5]);
    
    expect(res1).toBe(15);
    expect(res2).toBe(50);
  });

  it('2. Calling a function on an unloaded/non-existent module returns a clean error', async () => {
    const orchestrator = new WasmOrchestrator();
    
    expect(() => orchestrator.callFunction('ghost-app', 'add', [1, 2]))
      .toThrowError("[WasmOrchestrator] Module 'ghost-app' is not loaded.");

    await orchestrator.loadModule('my-app', '/test-module.wasm');

    expect(() => orchestrator.callFunction('my-app', 'ghost_function', []))
      .toThrowError("[WasmOrchestrator] Function 'ghost_function' not exported by 'my-app'.");
  });

  it('3. A WASM panic is caught and returned as an error string without crashing the thread', async () => {
    const orchestrator = new WasmOrchestrator();
    await orchestrator.loadModule('my-app', '/test-module.wasm');

    // The Rust `force_panic` triggers a memory trap 'unreachable' execution.
    // We must catch this trap safely.
    expect(() => orchestrator.callFunction('my-app', 'force_panic', []))
      .toThrowError(/\[WasmOrchestrator\] WASM Panic in my-app::force_panic:/);
  });

  it('4. unloadModule does not affect other loaded modules', async () => {
    const orchestrator = new WasmOrchestrator();
    
    await orchestrator.loadModule('app-A', '/test-module.wasm');
    await orchestrator.loadModule('app-B', '/test-module.wasm');

    // Destroy A
    orchestrator.unloadModule('app-A');

    // Check A throws completely
    expect(() => orchestrator.callFunction('app-A', 'add', [1, 1]))
      .toThrowError("[WasmOrchestrator] Module 'app-A' is not loaded.");

    // Check B is 100% fine
    const resB = orchestrator.callFunction('app-B', 'add', [3, 4]);
    expect(resB).toBe(7);
  });

  // --- Phase 5 Tests ---
  it('5. A nested JS object round-trips through Rust via Serde without data loss', async () => {
    const orchestrator = new WasmOrchestrator();
    
    // Instead of instantiating raw WebAssembly, let's mock testing evaluation pointing exactly to the `.js` 
    // generated glue via absolute path native ESM loading.
    const jsUrl = resolve(__dirname, '../../../tests/fixtures/wasm/test-module.js');
    await orchestrator.loadModule('serde-app', jsUrl);

    const payload = { name: 'Alice', count: 5 };
    
    // Call the rust `echo_object` wrapped through stringify parsing natively
    const result = orchestrator.callFunction('serde-app', 'echo_object', [payload]);

    expect(result).toEqual({ name: 'Alice', count: 5, doubled: 10 });
  });

  it('6. Missing required fields return a clean error from Rust, not a panic', async () => {
    const orchestrator = new WasmOrchestrator();
    const jsUrl = resolve(__dirname, '../../../tests/fixtures/wasm/test-module.js');
    await orchestrator.loadModule('serde-app', jsUrl);

    // Call passing an object missing the 'count' literal evaluation correctly translating down
    const invalidPayload = { name: 'Alice' }; // 'count' is missing missing bounds

    expect(() => orchestrator.callFunction('serde-app', 'echo_object', [invalidPayload]))
      .toThrowError('Missing required fields or malformed JSON');
  });
});
