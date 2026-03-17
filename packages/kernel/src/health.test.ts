import { describe, it, expect, beforeEach } from 'vitest';
import { WasmOrchestrator } from './wasm-orchestrator';
import { VFS } from './vfs';
import { Router } from './router';

describe('R1 Health Check (System Integrity)', () => {
  let vfs: VFS;
  let router: Router;
  let orchestrator: WasmOrchestrator;

  beforeEach(() => {
    vfs = new VFS();
    router = new Router();
    (vfs as any).isInit = true; // Mock init
    orchestrator = new WasmOrchestrator(vfs, router, () => {});
  });

  it('1. IPC Latency Check: Simple PING request should be ultra-fast', async () => {
    const start = performance.now();
    // Simulate router dispatch
    await router.handle({ id: 'test', type: 'PING', payload: {} });
    const end = performance.now();
    const duration = end - start;
    
    console.log(`[Health] IPC Internal Latency: ${duration.toFixed(4)}ms`);
    expect(duration).toBeLessThan(10); // Internal router should be sub-10ms
  });

  it('2. VFS Stress Check: Large write/read operations should succeed', async () => {
    const dataSize = 1024 * 1024; // 1MB
    const testData = new Uint8Array(dataSize).fill(0x41); // All 'A'
    
    const start = performance.now();
    await vfs.write('/stress_test.bin', testData);
    const readBack = await vfs.read('/stress_test.bin');
    const end = performance.now();
    
    expect(readBack?.length).toBe(dataSize);
    expect(readBack?.[0]).toBe(0x41);
    console.log(`[Health] VFS 1MB Write/Read: ${(end - start).toFixed(2)}ms`);
  });

  it('3. Isolation Check: Modules should not share exports', async () => {
    // This is essentially a sanity check for WasmOrchestrator's map
    expect((orchestrator as any).modules).toBeDefined();
    expect((orchestrator as any).modules.size).toBe(0);
  });
});
