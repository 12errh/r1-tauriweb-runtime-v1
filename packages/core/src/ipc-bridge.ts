import type { KernelProxy } from './kernel-proxy';
import { CallbackRegistry } from './callback-registry';
import { appWindow } from '@r1/apis/window';

/**
 * Patches the browser `window` to intercept Tauri frontend library calls
 * and route them to our Kernel Worker instead of the native Rust backend.
 */
export function installIpcBridge(kernelProxy: KernelProxy): void {
  const callbacks = new CallbackRegistry();

  // Make the registry available globally so Kernel responses can trigger them
  // (We'll use this in Phase 7 for events, or we route them back via the proxy resolving)
  (window as any).__R1_CALLBACKS__ = callbacks;

  // Numeric ID registry for unlisten functions
  const eventListeners = new Map<number, { event: string, unlisten: () => void }>();
  let nextListenerId = 1;

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
      const id = nextListenerId++;
      const unlisten = kernelProxy.eventBus.on(event, handler);
      eventListeners.set(id, { event, unlisten });
      
      const unlistenWrapper = () => {
        unlisten();
        eventListeners.delete(id);
      };
      // Tauri v2 returns a Promise<UnlistenFn>
      return Promise.resolve(unlistenWrapper);
    },

    /**
     * once() for global events.
     */
    once: (event: string, handler: Function) => {
      const id = nextListenerId++;
      const unlisten = kernelProxy.eventBus.once(event, handler);
      eventListeners.set(id, { event, unlisten });
      
      const unlistenWrapper = () => {
        unlisten();
        eventListeners.delete(id);
      };
      return Promise.resolve(unlistenWrapper);
    },

    /**
     * unlisten() by numeric ID (Tauri v1 style).
     */
    unlisten: (event: string, id: number) => {
      const entry = eventListeners.get(id);
      if (entry && entry.event === event) {
        entry.unlisten();
        eventListeners.delete(id);
      }
      return Promise.resolve();
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

  // --------------------------------------------------------------------------
  // GLOBAL OBJECT INJECTIONS
  // --------------------------------------------------------------------------

  // Tauri v2 structure
  (window as any).__TAURI__ = (window as any).__TAURI__ || {};
  (window as any).__TAURI__.window = (window as any).__TAURI__.window || {};
  
  // Make appWindow available globally so apps that access it
  // via window.__TAURI_INTERNALS__ also work
  (window as any).__TAURI_INTERNALS__.appWindow = appWindow;
  (window as any).__TAURI__.window = { appWindow };

  // Polyfill convertFileSrc (used for loading local assets into <img> tags)
  // In the browser/service-worker runtime, we just return the path as-is
  // and the Service Worker intercepts it.
  (window as any).__TAURI__.core = (window as any).__TAURI__.core || {};
  (window as any).__TAURI__.core.convertFileSrc = (path: string) => path;
  (window as any).__TAURI_INTERNALS__.convertFileSrc = (path: string) => path;
}
