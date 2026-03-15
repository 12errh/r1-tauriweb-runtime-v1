export type OSTheme = 'macos' | 'windows' | 'linux';

export interface WindowConfig {
  id: string;
  title: string;
  url: string;
  theme?: OSTheme;
  width?: number;
  height?: number;
  x?: number;
  y?: number;
}

/**
 * A VirtualWindow represents a single window in the host DOM.
 * It contains the chrome (title bar, controls) and an iframe for the content.
 */
export class VirtualWindow {
  public element: HTMLElement;
  private config: WindowConfig;
  private isDragging = false;
  private isResizing = false;
  private currentHandle: string | null = null;
  private startX = 0;
  private startY = 0;
  private startW = 0;
  private startH = 0;
  private startL = 0;
  private startT = 0;

  constructor(config: WindowConfig) {
    this.config = {
      theme: 'macos',
      width: 800,
      height: 600,
      x: 100,
      y: 100,
      ...config
    };

    this.element = this.createDom();
    this.attachEvents();
    this.updateStyle();
  }

  private createDom(): HTMLElement {
    const el = document.createElement('div');
    el.className = `r1-window r1-theme-${this.config.theme}`;
    el.id = `window-${this.config.id}`;

    el.innerHTML = `
      <div class="r1-window-chrome">
        <div class="r1-window-controls">
          ${this.getControlsHtml()}
        </div>
        <div class="r1-window-title">${this.config.title}</div>
      </div>
      <div class="r1-window-content">
        <iframe src="${this.config.url}"></iframe>
      </div>
      <!-- Resize Handles -->
      <div class="r1-handle r1-handle-n" data-handle="n"></div>
      <div class="r1-handle r1-handle-s" data-handle="s"></div>
      <div class="r1-handle r1-handle-e" data-handle="e"></div>
      <div class="r1-handle r1-handle-w" data-handle="w"></div>
      <div class="r1-handle r1-handle-nw" data-handle="nw"></div>
      <div class="r1-handle r1-handle-ne" data-handle="ne"></div>
      <div class="r1-handle r1-handle-sw" data-handle="sw"></div>
      <div class="r1-handle r1-handle-se" data-handle="se"></div>
    `;

    return el;
  }

  private getControlsHtml(): string {
    if (this.config.theme === 'macos') {
      return `
        <div class="r1-control-dot r1-close" style="background:#ff5f56"></div>
        <div class="r1-control-dot r1-min" style="background:#ffbd2e"></div>
        <div class="r1-control-dot r1-max" style="background:#27c93f"></div>
      `;
    }
    if (this.config.theme === 'linux') {
        return `
            <div class="r1-btn-linux r1-close">✕</div>
        `;
    }
    // Simple fallbacks for now
    return `
      <div class="r1-btn-win r1-close">✕</div>
    `;
  }

  private attachEvents() {
    const chrome = this.element.querySelector('.r1-window-chrome') as HTMLElement;
    
    // Drag Start
    chrome.onpointerdown = (e) => {
      this.isDragging = true;
      this.startX = e.clientX;
      this.startY = e.clientY;
      this.startL = this.config.x!;
      this.startT = this.config.y!;
      chrome.setPointerCapture(e.pointerId);
      e.stopPropagation();
    };

    chrome.onpointermove = (e) => {
      if (!this.isDragging) return;
      const dx = e.clientX - this.startX;
      const dy = e.clientY - this.startY;
      this.config.x = this.startL + dx;
      this.config.y = this.startT + dy;
      this.updateStyle();
    };

    chrome.onpointerup = (e) => {
      this.isDragging = false;
      chrome.releasePointerCapture(e.pointerId);
    };

    // Resize Start
    this.element.querySelectorAll('.r1-handle').forEach(handle => {
        (handle as HTMLElement).onpointerdown = (e) => {
            this.isResizing = true;
            this.currentHandle = (handle as HTMLElement).dataset.handle!;
            this.startX = e.clientX;
            this.startY = e.clientY;
            this.startW = this.config.width!;
            this.startH = this.config.height!;
            this.startL = this.config.x!;
            this.startT = this.config.y!;
            (handle as HTMLElement).setPointerCapture(e.pointerId);
            e.stopPropagation();
        };

        (handle as HTMLElement).onpointermove = (e) => {
            if (!this.isResizing) return;
            this.handleResize(e);
            this.updateStyle();
        };

        (handle as HTMLElement).onpointerup = (e) => {
            this.isResizing = false;
            this.currentHandle = null;
            (handle as HTMLElement).releasePointerCapture(e.pointerId);
        };
    });
  }

  private handleResize(e: PointerEvent) {
    const dx = e.clientX - this.startX;
    const dy = e.clientY - this.startY;

    if (this.currentHandle?.includes('e')) this.config.width = this.startW + dx;
    if (this.currentHandle?.includes('s')) this.config.height = this.startH + dy;
    
    if (this.currentHandle?.includes('w')) {
        this.config.width = this.startW - dx;
        this.config.x = this.startL + dx;
    }
    if (this.currentHandle?.includes('n')) {
        this.config.height = this.startH - dy;
        this.config.y = this.startT + dy;
    }
    
    // min constraints
    if (this.config.width! < 200) this.config.width = 200;
    if (this.config.height! < 100) this.config.height = 100;
  }

  private updateStyle() {
    this.element.style.width = `${this.config.width}px`;
    this.element.style.height = `${this.config.height}px`;
    this.element.style.left = `${this.config.x}px`;
    this.element.style.top = `${this.config.y}px`;
  }

  public setTitle(title: string) {
    this.config.title = title;
    const titleEl = this.element.querySelector('.r1-window-title');
    if (titleEl) titleEl.textContent = title;
  }

  public focus() {
      // Logic for focus will be managed by WindowManager to handle stacking
  }
}
