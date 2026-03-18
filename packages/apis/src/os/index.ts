/**
 * R1 Frontend Shim for @tauri-apps/api/os
 */

export async function platform(): Promise<string> {
  const ua = navigator.userAgent.toLowerCase();
  if (ua.includes('win')) return 'win32';
  if (ua.includes('mac')) return 'darwin';
  if (ua.includes('linux')) return 'linux';
  return 'web';
}

export async function arch(): Promise<string> {
  return 'wasm32';
}

export async function version(): Promise<string> {
  return 'R1 Browser Runtime';
}

export async function type(): Promise<string> {
  return 'Web';
}

export async function locale(): Promise<string | null> {
  return navigator.language || null;
}

export async function hostname(): Promise<string | null> {
  return window.location.hostname || null;
}

export async function eol(): Promise<string> {
  return '\n';
}

export async function exePath(): Promise<string> {
  return window.location.href;
}
