import { KernelPlugin, KernelHandler } from '@r1/kernel';

export class CorePlugin implements KernelPlugin {
  name = 'core';

  getCommands(): Map<string, KernelHandler> {
    const commands = new Map<string, KernelHandler>();

    commands.set('get_app_info', async () => {
      return {
        name: 'r1-app',
        version: '0.1.0',
        tauriVersion: '2.0.0-r1',
      };
    });

    return commands;
  }
}

// invoke — the primary way to call Rust commands
export async function invoke<T = unknown>(
  cmd: string,
  args?: Record<string, unknown>
): Promise<T> {
  return (window as any).__TAURI_INTERNALS__.invoke(cmd, args);
}

// transformCallback — used internally by Tauri's event system
export function transformCallback(
  callback: (response: unknown) => void,
  once = false
): number {
  return (window as any).__TAURI_INTERNALS__.transformCallback(callback, once);
}

// convertFileSrc — converts a VFS path to an asset URL
export function convertFileSrc(filePath: string, protocol = 'asset'): string {
  return (window as any).__TAURI_INTERNALS__?.convertFileSrc?.(filePath)
    ?? `https://r1-asset.localhost${filePath}`;
}
