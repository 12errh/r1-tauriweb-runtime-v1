import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Router } from './router';
import { KernelProxy } from '@r1/core';
import type { KernelRequest, KernelResponse } from './protocol';

// --- MOCKING THE WORKER API FOR NODE ENVIRONMENT ---
class MockWorker {
  onmessage: ((ev: MessageEvent) => void) | null = null;
  onerror: ((ev: ErrorEvent) => void) | null = null;
  onmessageerror: ((ev: MessageEvent) => void) | null = null;

  // The Simulated "Worker Thread" Router
  private _router = new Router();

  constructor() {
    this._router.register('PING', async () => ({ pong: true, ts: 123 }));
    this._router.register('CRASH_SIMULATION', async () => { throw new Error('Simulated panic'); });
    this._router.register('HANG_SIMULATION', () => new Promise(() => { })); // Never resolves
  }

  postMessage(data: KernelRequest) {
    // Simulate passing message from main thread -> worker thread
    setTimeout(async () => {
      const response = await this._router.handle(data);
      // Simulate passing message back worker thread -> main thread
      if (this.onmessage) {
        this.onmessage(new MessageEvent('message', { data: response }));
      }
    }, 10);
  }

  terminate() { }
}

// Intercept global Worker specifically for this test
let originalWorker: any;
beforeEach(() => {
  originalWorker = globalThis.Worker;
  globalThis.Worker = MockWorker as any;
});
afterEach(() => {
  globalThis.Worker = originalWorker;
  vi.restoreAllMocks();
});
// ---------------------------------------------------

describe('Phase 1: Kernel Worker + Message Protocol', () => {

  it('1. PING sent from main thread gets PONG response', async () => {
    const proxy = new KernelProxy('fake.js');
    const result = await proxy.send('PING', {}) as any;
    expect(result.pong).toBe(true);
    expect(result.ts).toBe(123);
  });

  it('2. Unknown message type returns clean error string, not a crash', async () => {
    const proxy = new KernelProxy('fake.js');
    // We expect the proxy.send Promise to reject since the router returns response.error
    await expect(proxy.send('UNKNOWN_COMMAND', {})).rejects.toThrow('Unknown command: UNKNOWN_COMMAND');
  });

  it('3. Worker crashes (handler throws) are caught and logged with readable message', async () => {
    const proxy = new KernelProxy('fake.js');
    await expect(proxy.send('CRASH_SIMULATION', {})).rejects.toThrow('Simulated panic');
  });

  it('4. Promise returned by send() rejects cleanly after 30s timeout', async () => {
    vi.useFakeTimers();
    const proxy = new KernelProxy('fake.js');

    // Start a request that will deliberately hang
    const promise = proxy.send('HANG_SIMULATION', {});

    // Advance timers by exactly 30000ms (30 seconds)
    vi.advanceTimersByTime(30000);

    await expect(promise).rejects.toThrow('Kernel Request timed out after 30000ms (type=HANG_SIMULATION)');

    vi.useRealTimers();
  });

});
