import { VirtualWindow, WindowConfig, OSTheme } from './virtual-window';

/**
 * Manages all open VirtualWindows on the main thread.
 */
export class WindowManager {
  private static instance: WindowManager;
  private windows: Map<string, VirtualWindow> = new Map();
  private container: HTMLElement;
  private currentZ = 1000;
  private theme: OSTheme = 'macos';

  private constructor() {
    this.injectStyles();
    this.container = document.createElement('div');
    this.container.id = 'r1-window-container';
    this.container.style.position = 'fixed';
    this.container.style.inset = '0';
    this.container.style.pointerEvents = 'none';
    this.container.style.zIndex = '9999';
    this.ensureContainer();
  }

  /**
   * Injects core window/dialog styles into the document head at runtime.
   * This ensures UI components are styled even if the bundle loader skips CSS.
   */
  private injectStyles() {
    if (document.getElementById('r1-core-styles')) return;
    const style = document.createElement('style');
    style.id = 'r1-core-styles';
    style.textContent = `
      #r1-window-container { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
      .r1-dialog-overlay {
        position: fixed; inset: 0; background: rgba(0,0,0,0.4);
        display: flex; align-items: center; justify-content: center;
        z-index: 10000; pointer-events: auto;
      }
      .r1-modal {
        background: #2b2b2b; color: white; border-radius: 12px; padding: 24px;
        min-width: 320px; box-shadow: 0 20px 60px rgba(0,0,0,0.5);
        border: 1px solid rgba(255,255,255,0.1);
      }
      .r1-modal-title { font-weight: 600; margin-bottom: 8px; font-size: 16px; }
      .r1-modal-body { margin-bottom: 24px; font-size: 14px; opacity: 0.8; }
      .r1-modal-actions { display: flex; justify-content: flex-end; gap: 12px; }
      .r1-btn { padding: 8px 20px; border-radius: 8px; border: none; font-size: 14px; cursor: pointer; transition: filter 0.2s; }
      .r1-btn:hover { filter: brightness(1.1); }
      .r1-btn-primary { background: #007aff; color: white; }
      .r1-btn-secondary { background: #444; color: white; }
    `;
    document.head.appendChild(style);
  }

  private ensureContainer() {
    if (!document.getElementById('r1-window-container')) {
      document.body.appendChild(this.container);
    }
  }

  public static getInstance(): WindowManager {
    if (!WindowManager.instance) {
      WindowManager.instance = new WindowManager();
    }
    return WindowManager.instance;
  }

  public open(config: WindowConfig): VirtualWindow {
    this.ensureContainer();
    if (this.windows.has(config.id)) {
      const win = this.windows.get(config.id)!;
      this.focus(config.id);
      return win;
    }

    const win = new VirtualWindow({ ...config, theme: this.theme });
    win.element.style.pointerEvents = 'auto'; // Window itself is interactive
    
    this.container.appendChild(win.element);
    this.windows.set(config.id, win);
    this.focus(config.id);

    return win;
  }

  public close(id: string) {
    const win = this.windows.get(id);
    if (win) {
      this.container.removeChild(win.element);
      this.windows.delete(id);
    }
  }

  public focus(id: string) {
    const win = this.windows.get(id);
    if (win) {
      this.currentZ += 1;
      win.element.style.zIndex = this.currentZ.toString();
    }
  }

  public getWindow(id: string): VirtualWindow | undefined {
    return this.windows.get(id);
  }

  public setTheme(theme: OSTheme) {
    this.theme = theme;
  }

  public showDialog(options: { title?: string, message: string, type?: 'alert' | 'confirm' }): Promise<boolean> {
      this.ensureContainer();
      return new Promise((resolve) => {
          const overlay = document.createElement('div');
          overlay.className = 'r1-dialog-overlay';
          
          overlay.innerHTML = `
            <div class="r1-modal r1-theme-${this.theme}">
                <div class="r1-modal-title">${options.title || 'System Message'}</div>
                <div class="r1-modal-body">${options.message}</div>
                <div class="r1-modal-actions">
                    ${options.type === 'confirm' ? '<button class="r1-btn r1-btn-secondary" id="r1-cancel">Cancel</button>' : ''}
                    <button class="r1-btn r1-btn-primary" id="r1-ok">OK</button>
                </div>
            </div>
          `;

          const cleanup = (val: boolean) => {
              this.container.removeChild(overlay);
              resolve(val);
          };

          overlay.querySelector('#r1-ok')?.addEventListener('click', () => cleanup(true));
          overlay.querySelector('#r1-cancel')?.addEventListener('click', () => cleanup(false));

          this.container.appendChild(overlay);
      });
  }

  // Call this after R1Runtime.boot() completes
  async showStorageWarningIfNeeded(): Promise<void> {
    if (!navigator.storage?.persisted) return;

    const isPersisted = await navigator.storage.persisted();
    if (isPersisted) return; // All good, no banner needed

    // Create the warning banner
    const banner = document.createElement('div');
    banner.id = 'r1-storage-warning';
    banner.innerHTML = `
      <span>
        ⚠ Your data may not persist long-term.
        <strong>Bookmark this page</strong> or
        <strong>install it as an app</strong> for reliable storage.
      </span>
      <button onclick="document.getElementById('r1-storage-warning').remove()">
        ✕
      </button>
    `;
    banner.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      z-index: 999999;
      background: #f59e0b;
      color: #1c1917;
      padding: 8px 16px;
      font-size: 13px;
      font-family: system-ui, sans-serif;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
    `;

    document.body.prepend(banner);
  }
}

// Automatically check for storage persistence when the runtime is ready
if (typeof window !== 'undefined') {
  window.addEventListener('r1:ready', () => {
    WindowManager.getInstance().showStorageWarningIfNeeded();
  });
}
