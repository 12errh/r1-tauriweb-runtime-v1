import type { KernelRequest, KernelResponse } from '@r1/kernel';

/** Let's wait up to 30s before considering the worker dead/stuck. */
const REQUEST_TIMEOUT_MS = 30000;

/**
 * The main thread's proxy to the R1 Kernel Worker.
 * Handles spawning the thread, managing lifecycle, and dispatching promises.
 */
export class KernelProxy {
  private worker: Worker;
  private requests = new Map<
    string,
    { resolve: (p: any) => void; reject: (e: any) => void; timer: ReturnType<typeof setTimeout> }
  >();

  constructor(workerUrl: string | URL) {
    this.worker = new Worker(workerUrl, { type: 'module' });

    this.worker.onmessage = (event: MessageEvent<KernelResponse>) => {
      this.handleResponse(event.data);
    };

    this.worker.onerror = (error: ErrorEvent) => {
      console.error('[R1 Main] Kernel Worker crashed:', error.message || error);
    };

    this.worker.onmessageerror = (event: MessageEvent) => {
      console.error('[R1 Main] Kernel Worker deserialisation error:', event);
    };
  }

  /**
   * Send a typed message to the worker and await its exact response.
   */
  public send(type: string, payload: unknown = {}): Promise<unknown> {
    return new Promise((resolve, reject) => {
      // 1. Generate unique request id (poor-man's nanoid)
      const id = typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : Math.random().toString(36).substring(2, 15);

      // 2. Setup 30s timeout
      const timer = setTimeout(() => {
        if (this.requests.has(id)) {
          this.requests.delete(id);
          reject(new Error(`Kernel Request timed out after ${REQUEST_TIMEOUT_MS}ms (type=${type})`));
        }
      }, REQUEST_TIMEOUT_MS);

      // 3. Register pending request
      this.requests.set(id, { resolve, reject, timer });

      // 4. Send
      const request: KernelRequest = { id, type, payload };
      this.worker.postMessage(request);
    });
  }

  /**
   * Internal processor for all inbound traffic from the kernel worker.
   */
  private handleResponse(response: KernelResponse) {
    if (!response || !response.id) return;
    
    const pending = this.requests.get(response.id);
    if (!pending) {
      console.warn(`[R1 Main] Received KernelResponse for unknown/expired request id: ${response.id}`);
      return;
    }

    clearTimeout(pending.timer);
    this.requests.delete(response.id);

    if (response.error) {
      pending.reject(new Error(response.error));
    } else {
      pending.resolve(response.payload);
    }
  }

  public terminate() {
    this.worker.terminate();
  }
}
