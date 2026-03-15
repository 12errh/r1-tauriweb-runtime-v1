import type { KernelRequest, KernelResponse } from '@r1/kernel';
import { EventBus } from './event-bus';

/** Let's wait up to 30s before considering the worker dead/stuck. */
const REQUEST_TIMEOUT_MS = 30000;

/**
 * The main thread's proxy to the R1 Kernel Worker.
 * Handles spawning the thread, managing lifecycle, and dispatching promises.
 */
export class KernelProxy {
  private worker: Worker;
  public eventBus = new EventBus();
  private requests = new Map<
    string,
    { resolve: (p: any) => void; reject: (e: any) => void; timer: ReturnType<typeof setTimeout> }
  >();

  constructor(workerUrl: string | URL) {
    this.worker = new Worker(workerUrl, { type: 'module' });

    this.worker.onmessage = (event: MessageEvent<KernelResponse | { type: string, payload: any }>) => {
      const data = event.data;
      
      // Check if this is an out-of-band event emission (e.g. from Rust)
      if (data && 'type' in data && data.type === 'EVENT_EMIT') {
        const { event: eventName, payload } = data.payload as { event: string, payload: any };
        this.eventBus.emit(eventName, payload);
        return;
      }

      // Check if this is a request to execute a Main Thread API (Worker -> Main)
      if (data && 'type' in data && data.type === 'MAIN_THREAD_CALL') {
        const { api, method, args } = (data as any).payload;
        this.handleMainThreadCall((data as any).id, api, method, args);
        return;
      }

      this.handleResponse(data as KernelResponse);
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

  /**
   * Dispatches a call to real Web APIs on the main thread.
   */
  private async handleMainThreadCall(id: string, api: string, method: string, args: any) {
    let result: any;
    let error: string | undefined;

    try {
      if (api === 'dialog') {
        if (method === 'message') alert(args.message);
        else if (method === 'confirm') result = confirm(args.message);
        else if (method === 'ask') result = confirm(args.message);
      } else if (api === 'clipboard') {
        if (method === 'write_text') await navigator.clipboard.writeText(args.text);
        else if (method === 'read_text') result = await navigator.clipboard.readText();
      } else if (api === 'notification') {
        if (method === 'request_permission') result = await Notification.requestPermission();
        else if (method === 'notify') new Notification(args.title, args.options);
      } else if (api === 'shell') {
        if (method === 'open') window.open(args.url, '_blank');
      }
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
    }

    this.worker.postMessage({
      type: 'MAIN_THREAD_RESPONSE',
      id,
      payload: result,
      error
    });
  }

  public terminate() {
    this.worker.terminate();
  }
}
