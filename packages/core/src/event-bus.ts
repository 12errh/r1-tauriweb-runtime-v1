/**
 * Simple Event Bus for R1 Runtime.
 * Allows components to subscribe to events and dispatch them with payloads.
 */
export class EventBus {
  private handlers: Map<string, Set<Function>> = new Map();

  /**
   * Listen for an event. Returns an unlisten function.
   */
  on(event: string, handler: Function): () => void {
    if (!this.handlers.has(event)) {
      this.handlers.set(event, new Set());
    }
    this.handlers.get(event)!.add(handler);

    return () => {
      const set = this.handlers.get(event);
      if (set) {
        set.delete(handler);
        if (set.size === 0) this.handlers.delete(event);
      }
    };
  }

  /**
   * Listen for an event once. Returns an unlisten function.
   */
  once(event: string, handler: Function): () => void {
    const unlisten = this.on(event, (payload: any) => {
      unlisten();
      handler(payload);
    });
    return unlisten;
  }

  /**
   * Emit an event to all subscribers.
   */
  emit(event: string, payload: any): void {
    const set = this.handlers.get(event);
    if (set) {
      // Execute on next tick to avoid blocking the emitter and handle potential re-entrancy
      set.forEach(handler => {
        try {
          handler(payload);
        } catch (e) {
          console.error(`[EventBus] Error in handler for event "${event}":`, e);
        }
      });
    }
  }
}
