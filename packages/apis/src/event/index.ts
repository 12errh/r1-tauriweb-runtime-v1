/**
 * R1 Frontend Shim for @tauri-apps/api/event
 */
const getInternal = () => (window as any).__TAURI_INTERNALS__;

export const listen = async (event: string, handler: (event: any) => void): Promise<any> => {
  return getInternal()?.listen?.(event, handler);
}

export const once = async (event: string, handler: (event: any) => void): Promise<any> => {
  return getInternal()?.once?.(event, handler);
}

export const emit = async (event: string, payload?: any): Promise<void> => {
  return getInternal()?.invoke?.('event:emit', { event, payload });
}
