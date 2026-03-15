import type { KernelProxy } from './kernel-proxy';
import { CallbackRegistry } from './callback-registry';

/**
 * Patches the browser `window` to intercept Tauri frontend library calls
 * and route them to our Kernel Worker instead of the native Rust backend.
 */
export function installIpcBridge(kernelProxy: KernelProxy): void {
  const callbacks = new CallbackRegistry();

  // Make the registry available globally so Kernel responses can trigger them
  // (We'll use this in Phase 7 for events, or we route them back via the proxy resolving)
  (window as any).__R1_CALLBACKS__ = callbacks;

  // --------------------------------------------------------------------------
  // TAURI v2 BRIDGE
  // --------------------------------------------------------------------------
  (window as any).__TAURI_INTERNALS__ = {
    /**
     * Replaces V2 `invoke(cmd, args)`.
     */
    invoke: async (command: string, args: unknown = {}) => {
      // The protocol format requires an 'IPC_INVOKE' type.
      const payload = { command, args };
      // The kernel router will catch errors and reject the proxy Promise,
      // so we don't need manual try/catch here; it natively maps to Tauri's promise rejection.
      return kernelProxy.send('IPC_INVOKE', payload);
    },

    /**
     * Converts a JS function into a numeric ID passable to Rust.
     */
    transformCallback: (callback: Function, once = false) => {
      return callbacks.register(callback, once);
    },

    /**
     * listen() for global events.
     */
    listen: (event: string, handler: Function) => {
        return Promise.resolve(kernelProxy.eventBus.on(event, handler));
    },

    /**
     * once() for global events.
     */
    once: (event: string, handler: Function) => {
        return Promise.resolve(kernelProxy.eventBus.once(event, handler));
    }
  };

  // --------------------------------------------------------------------------
  // TAURI v1 BRIDGE
  // --------------------------------------------------------------------------
  (window as any).__TAURI_IPC__ = async (message: {
    cmd: string;
    callback?: number;
    error?: number;
    [key: string]: unknown;
  }) => {
    const { cmd, callback, error, ...args } = message;

    try {
      // Route the command via KernelProxy
      const response = await kernelProxy.send('IPC_INVOKE', { command: cmd, args });
      
      // If success and a success callback is registered, trigger it
      if (typeof callback === 'number') {
        callbacks.trigger(callback, response);
      }
    } catch (err) {
      // If failure and an error callback is registered, trigger it
      if (typeof error === 'number') {
        callbacks.trigger(error, err instanceof Error ? err.message : String(err));
      } else {
        // If no error callback, we must log it so it doesn't vanish silently.
        console.error(`[R1 IPC] Unhandled error from Tauri V1 invoke('${cmd}'):`, err);
      }
    }
  };
}
