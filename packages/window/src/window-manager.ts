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
    this.container = document.createElement('div');
    this.container.id = 'r1-window-container';
    this.container.style.position = 'fixed';
    this.container.style.inset = '0';
    this.container.style.pointerEvents = 'none';
    this.container.style.zIndex = '9999';
    this.ensureContainer();
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
}
