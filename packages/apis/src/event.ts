import { KernelPlugin, KernelHandler } from '@r1/kernel';

export class EventPlugin implements KernelPlugin {
  name = 'event';
  private onEmit: (event: string, payload: any) => void;

  constructor(onEmit: (event: string, payload: any) => void) {
    this.onEmit = onEmit;
  }

  getCommands(): Map<string, KernelHandler> {
    const commands = new Map<string, KernelHandler>();

    // Note: JS -> Rust events usually go through invoke("event:emit", ...)
    commands.set('emit', async (payload: { event: string; payload: any }) => {
      this.onEmit(payload.event, payload.payload);
      return null;
    });

    // listen and unlisten are handled on the main thread via IPC Bridge patching,
    // as it's purely a JS-to-JS event registration on the main EventBus.
    // But we can add stubs here if needed for cross-plugin events.

    return commands;
  }
}

// ─── Direct JS exports (used by @tauri-apps/api/event imports) ────────────────

export interface Event<T> {
  event: string;
  windowLabel: string;
  id: number;
  payload: T;
}

export type EventCallback<T> = (event: Event<T>) => void;
export type UnlistenFn = () => void;

/**
 * Global Event Bus singleton access. 
 * We use window.__TAURI_INTERNALS__.listen which is patched by the IPC Bridge.
 */
export async function listen<T>(
  event: string,
  handler: EventCallback<T>
): Promise<UnlistenFn> {
  return (window as any).__TAURI_INTERNALS__.listen(event, handler);
}

export async function once<T>(
  event: string,
  handler: EventCallback<T>
): Promise<UnlistenFn> {
  return (window as any).__TAURI_INTERNALS__.once(event, handler);
}

export async function emit(
  event: string,
  payload?: unknown
): Promise<void> {
  return (window as any).__TAURI_INTERNALS__.invoke('event:emit', { event, payload });
}

/**
 * TauriEvent enum — commonly used constants
 */
export enum TauriEvent {
  WINDOW_RESIZED         = 'tauri://resize',
  WINDOW_MOVED           = 'tauri://move',
  WINDOW_CLOSE_REQUESTED = 'tauri://close-requested',
  WINDOW_FOCUS           = 'tauri://focus',
  WINDOW_BLUR            = 'tauri://blur',
}
