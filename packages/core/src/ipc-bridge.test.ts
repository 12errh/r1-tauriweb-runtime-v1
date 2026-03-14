import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { R1Runtime } from './runtime';
import { CallbackRegistry } from './callback-registry';
import { installIpcBridge } from './ipc-bridge';
import { KernelProxy } from './kernel-proxy';
import type { KernelRequest } from '@r1/kernel';

// Mock Worker to test IPC Bridge routing without spinning up real threads
class MockWorker {
  onmessage: any;
  postMessage(data: KernelRequest) {
    setTimeout(() => {
      // Mock the Router behaviour: return success or error based on the payload command
      const payload = data.payload as any;
      if (payload.command === 'test_command') {
        this.onmessage({ data: { id: data.id, payload: `[stub] called: ${payload.command}` } });
      } else if (payload.command === 'fail_command') {
        this.onmessage({ data: { id: data.id, error: `Simulated error for ${payload.command}` } });
      }
    }, 5);
  }
}

describe('Phase 2: IPC Bridge (Patching Tauri globals)', () => {
  let originalWorker: any;

  beforeEach(() => {
    // Clear globals
    delete (window as any).__TAURI_INTERNALS__;
    delete (window as any).__TAURI_IPC__;
    delete (window as any).__R1_CALLBACKS__;

    originalWorker = globalThis.Worker;
    globalThis.Worker = MockWorker as any;
  });

  afterEach(() => {
    globalThis.Worker = originalWorker;
    vi.restoreAllMocks();
  });

  it('1. invoke(command) reaches the Kernel Worker and returns response (Tauri v2)', async () => {
    const runtime = new R1Runtime();
    await runtime.boot('fake.js');

    const tauri = (window as any).__TAURI_INTERNALS__;
    expect(tauri).toBeDefined();

    const response = await tauri.invoke('test_command', { foo: 'bar' });
    expect(response).toBe('[stub] called: test_command');
  });

  it('2. Both Tauri v1 and v2 formats are handled correctly (Tauri v1 test)', async () => {
    const runtime = new R1Runtime();
    await runtime.boot('fake.js');

    const tauriIpc = (window as any).__TAURI_IPC__;
    expect(typeof tauriIpc).toBe('function');

    // Tauri V1 uses callbacks
    return new Promise<void>((resolve) => {
      const callbacks = (window as any).__R1_CALLBACKS__ as CallbackRegistry;
      
      const successCb = callbacks.register((res: any) => {
        expect(res).toBe('[stub] called: test_command');
        resolve();
      }, true);

      tauriIpc({
        cmd: 'test_command',
        callback: successCb,
        error: 999, // Unused in this path
        foo: 'bar'
      });
    });
  });

  it('3. Failed commands reject the Promise with clean error (Tauri v2)', async () => {
    const runtime = new R1Runtime();
    await runtime.boot('fake.js');

    const tauri = (window as any).__TAURI_INTERNALS__;
    await expect(tauri.invoke('fail_command', {})).rejects.toThrow('Simulated error for fail_command');
  });

  it('4. transformCallback correctly handles once: true', () => {
    const runtime = new R1Runtime();
    // We can just install the bridge manually with a dummy proxy to test registry
    const dummyProxy = {} as KernelProxy;
    installIpcBridge(dummyProxy);

    const tauri = (window as any).__TAURI_INTERNALS__;
    const callbacks = (window as any).__R1_CALLBACKS__ as CallbackRegistry;

    const myCb = vi.fn();
    const id = tauri.transformCallback(myCb, true);

    callbacks.trigger(id, 'first call');
    expect(myCb).toHaveBeenCalledWith('first call');

    // Trigger again -- shouldn't call because once: true deleted it
    callbacks.trigger(id, 'second call');
    expect(myCb).toHaveBeenCalledTimes(1);
  });
});
