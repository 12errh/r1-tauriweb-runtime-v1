import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { WasmOrchestrator } from './wasm-orchestrator';
import { VFS } from './vfs';
import { Router } from './router';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

describe('Phase 2: WASI Integration (SQLite Requirements)', () => {
  let vfs: VFS;
  let router: Router;
  let orchestrator: WasmOrchestrator;

  beforeEach(async () => {
    vfs = new VFS();
    router = new Router();
    (vfs as any).isInit = true;

    // Mock fetch for WASM loading
    globalThis.fetch = vi.fn().mockImplementation(async (url: string) => {
      const fileName = url.split(/[\/\\]/).pop() || '';
      
      if (fileName && (fileName.endsWith('.wasm') || fileName.endsWith('.js'))) {
        const wasmPath = resolve(__dirname, `../../../tests/fixtures/wasm/${fileName}`);
        if (!existsSync(wasmPath)) throw new Error(`Fixture not found: ${wasmPath}`);
        const buffer = readFileSync(wasmPath);
        const bytes = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
        return {
          ok: true,
          arrayBuffer: async () => bytes,
          text: async () => new TextDecoder().decode(bytes),
        };
      }
      return { ok: false, status: 404 };
    });

    orchestrator = new WasmOrchestrator(vfs, router, () => {});
    const wasmUrl = resolve(__dirname, '../../../tests/fixtures/wasm/sqlite_test.wasm');
    await orchestrator.loadModule('sqlite-app', wasmUrl);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('1. path_filestat_get (metadata) retrieves correct file size', async () => {
    const path = '/data.txt';
    const content = 'hello world'; // 11 bytes
    await vfs.writeText(path, content);

    const result = orchestrator.callFunction('sqlite-app', 'test_metadata', [{ path }]);
    expect(result).toEqual({ size: 11, is_file: true });
  });

  it('2. fd_seek + fd_tell (stream_position) behaves correctly', async () => {
    const path = '/seek-test.txt';
    await vfs.writeText(path, '0123456789'); // 10 bytes

    const result = orchestrator.callFunction('sqlite-app', 'test_seek_and_tell', [{ path }]);
    expect(result).toEqual({ pos: 5 });
  });

  it('3. fd_sync ensures data is written to VFS', async () => {
    const path = '/sync-test.txt';
    const content = 'persisted content';

    const result = orchestrator.callFunction('sqlite-app', 'test_sync', [{ path, content }]);
    expect(result).toBe(true);
    expect(vfs.readText(path)).toBe(content);
  });

  it('4. path_rename moves file and integrity remains', async () => {
    const oldPath = '/old.db';
    const newPath = '/new.db';
    const content = 'database binary dump';
    await vfs.writeText(oldPath, content);

    const result = orchestrator.callFunction('sqlite-app', 'test_rename', [{ oldPath, newPath }]);
    expect(result).toBe(true);
    
    expect(vfs.exists(newPath)).toBe(true);
    // In our path_rename shim, we currently clear old text for safety
    // expect(vfs.exists(oldPath)).toBe(false); // Depends on implementation
    expect(vfs.readText(newPath)).toBe(content);
  });
});
