import type { KernelRequest, KernelResponse } from './protocol';

/** A function that handles a specific message type in the Worker */
export type KernelHandler = (payload: any) => Promise<unknown>;

/** Interface for Kernel Plugins */
export interface KernelPlugin {
  name: string;
  getCommands(): Map<string, KernelHandler>;
}

/**
 * Routes incoming KernelRequests to the appropriate registered handler.
 * Supports hierarchical naming (e.g., 'fs:read_file') and plugins.
 */
export class Router {
  private handlers = new Map<string, KernelHandler>();

  /**
   * Register a new message handler for a specific message type.
   */
  register(type: string, handler: KernelHandler): void {
    if (this.handlers.has(type)) {
      console.warn(`[R1 Kernel] Overwriting handler for message type: ${type}`);
    }
    this.handlers.set(type, handler);
  }

  /**
   * Register a plugin, adding all its commands to the router prefixing them with plugin name.
   */
  use(plugin: KernelPlugin): void {
    const commands = plugin.getCommands();
    for (const [cmd, handler] of commands) {
      this.register(`${plugin.name}:${cmd}`, handler);
    }
  }

  /**
   * Process an incoming request, route it to the handler, and return a response.
   * Guaranteed to never throw; it always returns a KernelResponse envelope.
   */
  async handle(request: KernelRequest): Promise<KernelResponse> {
    // Exact match or fallback for backward compatibility
    let handler = this.handlers.get(request.type);

    if (!handler) {
      return {
        id: request.id,
        error: `Unknown command: ${request.type}`
      };
    }

    try {
      const result = await handler(request.payload);
      return {
        id: request.id,
        payload: result
      };
    } catch (e) {
      return {
        id: request.id,
        error: e instanceof Error ? e.message : String(e)
      };
    }
  }
}
