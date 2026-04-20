import { KernelPlugin, KernelHandler } from '@r1-runtime/kernel';

/**
 * Allows the guest app (WASM/JS) to control its own window.
 */
export class WindowPlugin implements KernelPlugin {
  name = 'window';
  private onMainThreadCall: (api: string, method: string, args: any) => Promise<any>;

  constructor(onMainThreadCall: (api: string, method: string, args: any) => Promise<any>) {
    this.onMainThreadCall = onMainThreadCall;
  }

  getCommands(): Map<string, KernelHandler> {
    const commands = new Map<string, KernelHandler>();

    // These commands are proxied to the main thread via the bridge
    commands.set('set_title', async (args) => this.onMainThreadCall('window', 'set_title', args));
    commands.set('close', async (args) => this.onMainThreadCall('window', 'close', args));
    commands.set('maximize', async (args) => this.onMainThreadCall('window', 'maximize', args));
    commands.set('minimize', async (args) => this.onMainThreadCall('window', 'minimize', args));
    commands.set('focus', async (args) => this.onMainThreadCall('window', 'focus', args));

    return commands;
  }
}

// ─── Direct JS exports (used by @tauri-apps/api/window imports) ───────────────

/**
 * Interface for unlistening to events.
 */
export type UnlistenFn = () => void;

/**
 * Interface for screen size.
 */
export interface PhysicalSize {
  width: number;
  height: number;
}

/**
 * Interface for screen position.
 */
export interface PhysicalPosition {
  x: number;
  y: number;
}

/**
 * Represents a window in the R1 environment.
 * Maps closely to Tauri's WebviewWindow.
 */
export class WebviewWindow {
  label: string;

  constructor(label: string) {
    this.label = label;
  }

  async setTitle(title: string): Promise<void> {
    return (window as any).__TAURI_INTERNALS__.invoke('window:set_title', { label: this.label, title });
  }

  async minimize(): Promise<void> {
    return (window as any).__TAURI_INTERNALS__.invoke('window:minimize', { label: this.label });
  }

  async maximize(): Promise<void> {
    return (window as any).__TAURI_INTERNALS__.invoke('window:maximize', { label: this.label });
  }

  async unmaximize(): Promise<void> {
    return (window as any).__TAURI_INTERNALS__.invoke('window:unmaximize', { label: this.label });
  }

  async toggleMaximize(): Promise<void> {
    return (window as any).__TAURI_INTERNALS__.invoke('window:toggle_maximize', { label: this.label });
  }

  async close(): Promise<void> {
    return (window as any).__TAURI_INTERNALS__.invoke('window:close', { label: this.label });
  }

  async show(): Promise<void> {
    return (window as any).__TAURI_INTERNALS__.invoke('window:show', { label: this.label });
  }

  async hide(): Promise<void> {
    return (window as any).__TAURI_INTERNALS__.invoke('window:hide', { label: this.label });
  }

  async setFocus(): Promise<void> {
    return (window as any).__TAURI_INTERNALS__.invoke('window:focus', { label: this.label });
  }

  async setSize(size: PhysicalSize): Promise<void> {
    return (window as any).__TAURI_INTERNALS__.invoke('window:set_size', { label: this.label, width: size.width, height: size.height });
  }

  async setPosition(position: PhysicalPosition): Promise<void> {
    return (window as any).__TAURI_INTERNALS__.invoke('window:set_position', { label: this.label, x: position.x, y: position.y });
  }

  async setResizable(resizable: boolean): Promise<void> {
    return (window as any).__TAURI_INTERNALS__.invoke('window:set_resizable', { label: this.label, resizable });
  }

  async setAlwaysOnTop(alwaysOnTop: boolean): Promise<void> {
    return (window as any).__TAURI_INTERNALS__.invoke('window:set_always_on_top', { label: this.label, alwaysOnTop });
  }

  async innerSize(): Promise<PhysicalSize> {
    return (window as any).__TAURI_INTERNALS__.invoke('window:inner_size', { label: this.label });
  }

  async outerSize(): Promise<PhysicalSize> {
    return (window as any).__TAURI_INTERNALS__.invoke('window:outer_size', { label: this.label });
  }

  async isMaximized(): Promise<boolean> {
    return (window as any).__TAURI_INTERNALS__.invoke('window:is_maximized', { label: this.label });
  }

  async isMinimized(): Promise<boolean> {
    return (window as any).__TAURI_INTERNALS__.invoke('window:is_minimized', { label: this.label });
  }

  async isVisible(): Promise<boolean> {
    return (window as any).__TAURI_INTERNALS__.invoke('window:is_visible', { label: this.label });
  }

  /**
   * Listen for window events.
   */
  async onCloseRequested(handler: () => void): Promise<UnlistenFn> {
    return (window as any).__TAURI_INTERNALS__.listen(`tauri://close-requested`, handler);
  }

  async onResized(handler: (size: PhysicalSize) => void): Promise<UnlistenFn> {
    return (window as any).__TAURI_INTERNALS__.listen(`tauri://resize`, (e: any) => handler(e.payload));
  }

  async onMoved(handler: (position: PhysicalPosition) => void): Promise<UnlistenFn> {
    return (window as any).__TAURI_INTERNALS__.listen(`tauri://move`, (e: any) => handler(e.payload));
  }

  async onFocusChanged(handler: (focused: boolean) => void): Promise<UnlistenFn> {
    const l1 = await (window as any).__TAURI_INTERNALS__.listen(`tauri://focus`, () => handler(true));
    const l2 = await (window as any).__TAURI_INTERNALS__.listen(`tauri://blur`, () => handler(false));
    return () => { l1(); l2(); };
  }

  /**
   * Static factory to get a window by label.
   */
  static getByLabel(label: string): WebviewWindow | null {
    // In our single-webview runtime, we only really have 'main'
    if (label === 'main') return appWindow;
    return new WebviewWindow(label);
  }
}

/**
 * The default window singleton.
 */
export const appWindow = new WebviewWindow('main');

// Type aliases Tauri uses
export type { WebviewWindow as Window };
