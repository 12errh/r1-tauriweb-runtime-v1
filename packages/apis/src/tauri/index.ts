/**
 * R1 Frontend Shim for @tauri-apps/api/tauri
 */

const getInternal = () => (window as any).__TAURI_INTERNALS__;

export const invoke = async <T>(command: string, args?: any): Promise<T> => {
  const invoker = getInternal()?.invoke;
  if (!invoker) {
    console.warn(`[R1] invoke('${command}') called before runtime ready.`);
    return null as any;
  }
  return invoker(command, args);
};

export const transformCallback = (callback: Function, once = false): number => {
  return getInternal()?.transformCallback?.(callback, once) || 0;
};

export const convertFileSrc = (filePath: string, protocol = 'asset'): string => {
  return getInternal()?.convertFileSrc?.(filePath, protocol) || filePath;
};
