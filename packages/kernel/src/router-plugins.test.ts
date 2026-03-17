import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Router } from './router';
import { VFS } from './vfs';
import { WasmOrchestrator } from './wasm-orchestrator';
import { FsPlugin, EventPlugin, StorePlugin, OsPlugin, PathPlugin } from '@r1/apis';
import { resolve } from 'path';
import { readFileSync } from 'fs';

describe('Phase 8: Modular Router & Plugins', () => {
  let router: Router;
  let vfs: VFS;
  let orchestrator: WasmOrchestrator;
  let events: any[] = [];

  beforeEach(() => {
    router = new Router();
    vfs = new VFS();
    (vfs as any).isInit = true; // Skip OPFS init
    
    events = [];
    orchestrator = new WasmOrchestrator(vfs, router, (event, payload) => {
        events.push({ event, payload });
    });

    // Register Plugins
    router.use(new FsPlugin(vfs));
    router.use(new EventPlugin((event, payload) => {
        events.push({ event, payload });
    }));
    router.use(new StorePlugin(vfs));
    router.use(new OsPlugin(async (api, method) => {
        if (api === 'os' && method === 'platform') return 'mock-windows';
        return null;
    }));
    router.use(new PathPlugin());
  });

  it('1. FsPlugin mapping to VFS works via hierarchical naming', async () => {
    await vfs.writeText('/test-plugin.txt', 'HELLO PLUGIN');
    
    const result = await router.handle({ 
        id: '1', 
        type: 'fs:read_text_file', 
        payload: { path: '/test-plugin.txt' } 
    });

    expect(result.payload).toBe('HELLO PLUGIN');
  });

  it('2. EventPlugin captures emits from JS side', async () => {
    await router.handle({ 
        id: '2', 
        type: 'event:emit', 
        payload: { event: 'js-event', payload: 'from-js' } 
    });

    expect(events).toContainEqual({ event: 'js-event', payload: 'from-js' });
  });

  it('3. StorePlugin persists data to VFS', async () => {
    await router.handle({ 
      id: 's1', 
      type: 'store:set', 
      payload: { name: 'settings', key: 'theme', value: 'dark' } 
    });
    
    const res = await router.handle({ 
      id: 's2', 
      type: 'store:get', 
      payload: { name: 'settings', key: 'theme' } 
    });

    expect(res.payload).toBe('dark');

    // Verify it's actually in VFS
    const exists = await vfs.exists('/.r1-store/settings.json');
    expect(exists).toBe(true);
    const content = await vfs.readText('/.r1-store/settings.json');
    expect(JSON.parse(content)).toEqual({ theme: 'dark' });
  });

  it('4. OsPlugin returns bridged values from main thread', async () => {
    const res = await router.handle({ id: 'o1', type: 'os:platform', payload: {} });
    expect(res.payload).toBe('mock-windows');
  });

  it('5. PathPlugin provides path utilities', async () => {
    const res = await router.handle({ 
      id: 'p1', 
      type: 'path:join', 
      payload: { paths: ['usr', 'local', 'bin'] } 
    });
    expect(res.payload).toBe('usr/local/bin');

    const base = await router.handle({ 
      id: 'p2', 
      type: 'path:basename', 
      payload: { path: '/foo/bar.txt', ext: '.txt' } 
    });
    expect(base.payload).toBe('bar');
  });

  it('6. WasmOrchestrator auto-discovers and registers commands', async () => {
     // Mock fetch for WASM
     const originalFetch = globalThis.fetch;
     globalThis.fetch = vi.fn().mockImplementation(async (url: string) => {
        const wasmPath = resolve(__dirname, '../../../tests/fixtures/wasm/test-module.wasm');
        const buffer = readFileSync(wasmPath);
        return {
            ok: true,
            arrayBuffer: async () => buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength)
        };
     });

     await orchestrator.loadModule('my-wasm', '/test-module.wasm');
     
     // Verify "my-wasm:add" was registered in router
     const result = await router.handle({
         id: '3',
         type: 'my-wasm:add',
         payload: [10, 20]
     });

     expect(result.payload).toBe(30);

     globalThis.fetch = originalFetch;
  });

  it('7. IPC_INVOKE legacy handler works correctly', async () => {
     // Register the special IPC_INVOKE that forwards to hierarchical router
     router.register('IPC_INVOKE', async (payload: any) => {
        const { command, args } = payload;
        const res = await router.handle({ id: 'internal', type: command, payload: args });
        if (res.error) throw new Error(res.error);
        return res.payload;
     });

     await vfs.writeText('/legacy.txt', 'LEGACY DATA');

     const result = await router.handle({
         id: '4',
         type: 'IPC_INVOKE',
         payload: { command: 'fs:read_text_file', args: { path: '/legacy.txt' } }
     });

     expect(result.payload).toBe('LEGACY DATA');
  });
});
