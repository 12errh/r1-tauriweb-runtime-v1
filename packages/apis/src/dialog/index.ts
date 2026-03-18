/**
 * R1 Frontend Shim for @tauri-apps/api/dialog
 */

export interface OpenDialogOptions {
  title?: string;
  filters?: Array<{ name: string; extensions: string[] }>;
  defaultPath?: string;
  multiple?: boolean;
  directory?: boolean;
}

export interface SaveDialogOptions {
  title?: string;
  filters?: Array<{ name: string; extensions: string[] }>;
  defaultPath?: string;
}

export interface MessageDialogOptions {
  title?: string;
  type?: 'info' | 'warning' | 'error';
  okLabel?: string;
}

export interface ConfirmDialogOptions extends MessageDialogOptions {
  cancelLabel?: string;
}

// File picker — uses <input type="file"> under the hood
export async function open(
  options?: OpenDialogOptions
): Promise<string | string[] | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    if (options?.multiple) input.multiple = true;
    if (options?.directory) (input as any).webkitdirectory = true;
    if (options?.filters?.length) {
      input.accept = options.filters
        .flatMap((f) => f.extensions.map((e) => `.${e}`))
        .join(',');
    }
    input.onchange = () => {
      if (!input.files?.length) return resolve(null);
      const paths = Array.from(input.files).map((f) => f.name);
      resolve(options?.multiple ? paths : paths[0]);
    };
    input.oncancel = () => resolve(null);
    input.click();
  });
}

// Save dialog — simulated fallback since native "Save As" is not supported outside OPFS natively
export async function save(
  options?: SaveDialogOptions
): Promise<string | null> {
  return new Promise((resolve) => {
    const filename = options?.defaultPath
      ? options.defaultPath.split(/[/\\]/).pop()
      : 'download.file';
    resolve(filename || null);
  });
}

// Custom OS-themed modal framework
async function showModal(opts: {
  message: string;
  title?: string;
  type?: 'info' | 'warning' | 'error';
  buttons: string[];
}): Promise<number> {
  // Returns index of clicked button
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'r1-dialog-overlay';
    Object.assign(overlay.style, {
      position: 'fixed',
      top: '0',
      left: '0',
      right: '0',
      bottom: '0',
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: '999999',
    });

    const dialog = document.createElement('div');
    dialog.className = 'r1-dialog-modal';
    Object.assign(dialog.style, {
      backgroundColor: '#ffffff',
      color: '#333333',
      padding: '20px',
      borderRadius: '8px',
      boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
      minWidth: '300px',
      fontFamily: 'system-ui, sans-serif',
    });

    if (opts.title) {
      const titleEl = document.createElement('h3');
      titleEl.textContent = opts.title;
      Object.assign(titleEl.style, { marginTop: '0', marginBottom: '10px' });
      dialog.appendChild(titleEl);
    }

    const msgEl = document.createElement('div');
    msgEl.textContent = opts.message;
    Object.assign(msgEl.style, { marginBottom: '20px', whiteSpace: 'pre-wrap' });
    dialog.appendChild(msgEl);

    const btnContainer = document.createElement('div');
    Object.assign(btnContainer.style, {
      display: 'flex',
      justifyContent: 'flex-end',
      gap: '10px',
    });

    opts.buttons.forEach((btnText, index) => {
      const btn = document.createElement('button');
      btn.textContent = btnText;
      Object.assign(btn.style, {
        padding: '6px 16px',
        borderRadius: '4px',
        border: '1px solid #ccc',
        backgroundColor: index === 0 ? '#007aff' : '#f0f0f0',
        color: index === 0 ? '#ffffff' : '#333333',
        cursor: 'pointer',
      });
      btn.onclick = () => {
        document.body.removeChild(overlay);
        resolve(index);
      };
      btnContainer.appendChild(btn);
    });

    dialog.appendChild(btnContainer);
    overlay.appendChild(dialog);
    document.body.appendChild(overlay);
  });
}

// Message dialog — OS-themed modal
export async function message(
  msg: string,
  options?: MessageDialogOptions
): Promise<void> {
  await showModal({
    message: msg,
    title: options?.title || 'Message',
    type: options?.type,
    buttons: [options?.okLabel || 'OK'],
  });
}

// Ask dialog — returns true (Yes) or false (No)
export async function ask(
  msg: string,
  options?: ConfirmDialogOptions
): Promise<boolean> {
  const btnIndex = await showModal({
    message: msg,
    title: options?.title || 'Question',
    type: options?.type,
    buttons: [options?.okLabel || 'Yes', options?.cancelLabel || 'No'],
  });
  return btnIndex === 0;
}

// Confirm dialog — returns true (OK) or false (Cancel)
export async function confirm(
  msg: string,
  options?: ConfirmDialogOptions
): Promise<boolean> {
  const btnIndex = await showModal({
    message: msg,
    title: options?.title || 'Confirm',
    type: options?.type,
    buttons: [options?.okLabel || 'OK', options?.cancelLabel || 'Cancel'],
  });
  return btnIndex === 0;
}
