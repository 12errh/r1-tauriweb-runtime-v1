import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { WasmOrchestrator } from './wasm-orchestrator';
import { readFileSync } from 'fs';
import { resolve } from 'path';

describe('Phase 4: WasmOrchestrator + Module Registry', () => {
  let wasmBytes: ArrayBuffer;
  let originalFetch: any;

  beforeEach(() => {
    // We are running tests in Node instead of a browser, so we need to bridge `fetch`
    // to load the local .wasm file off the exact disk boundary.
    const wasmPath = resolve(__dirname, '../../../tests/fixtures/wasm/test-module.wasm');
    const buffer = readFileSync(wasmPath);
    // Node Buffer to strict ArrayBuffer
    wasmBytes = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);

    originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn().mockImplementation(async (url: string) => {
      if (url === '/test-module.wasm') {
        return {
          ok: true,
          arrayBuffer: async () => wasmBytes,
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
});
