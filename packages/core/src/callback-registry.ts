/**
 * Tauri's frontend APIs (like `invoke`) pass a callback function to the backend.
 * Because functions cannot be serialized to the Web Worker, we store them in this
 * registry and pass a numeric ID to the backend instead.
 * 
 * When the backend replies, it targets the numeric ID, and we trigger the real
 * JS function here.
 */
export class CallbackRegistry {
  private count = 0;
  private registry = new Map<number, { fn: Function; once: boolean }>();

  /**
   * Register a function and return its unique numerical ID.
   */
  register(fn: Function, once: boolean): number {
    const id = ++this.count;
    this.registry.set(id, { fn, once });
    return id;
  }

  /**
   * Trigger the callback with given payload.
   * If `once` was true, the callback is removed immediately.
   */
  trigger(id: number, payload: unknown): void {
    const entry = this.registry.get(id);
    if (!entry) {
      console.warn(`[R1 IPC] Attempted to trigger unknown callback id: ${id}`);
      return;
    }

    try {
      entry.fn(payload);
    } catch (e) {
      console.error(`[R1 IPC] Error inside callback ${id}:`, e);
    }

    if (entry.once) {
      this.registry.delete(id);
    }
  }

  /** Remove a callback completely */
  delete(id: number): void {
    this.registry.delete(id);
  }
}
