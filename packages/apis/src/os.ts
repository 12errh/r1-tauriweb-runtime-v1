import { KernelPlugin, KernelHandler } from '@r1/kernel';

export class OsPlugin implements KernelPlugin {
  name = 'os';

  getCommands(): Map<string, KernelHandler> {
    const commands = new Map<string, KernelHandler>();

    // Simulated OS values, can be made configurable later
    const info = {
      platform: 'windows',
      arch: 'x86_64',
      version: '10.0.19045',
      locale: 'en-US',
      hostname: 'r1-virtual-machine'
    };

    commands.set('platform', async () => info.platform);
    commands.set('arch', async () => info.arch);
    commands.set('version', async () => info.version);
    commands.set('locale', async () => info.locale);
    commands.set('hostname', async () => info.hostname);

    return commands;
  }
}

// ─── Direct JS exports (used by @tauri-apps/api/os imports) ───────────────────

export const platform = () => (window as any).__TAURI_INTERNALS__.invoke('os:platform');
export const arch     = () => (window as any).__TAURI_INTERNALS__.invoke('os:arch');
export const version  = () => (window as any).__TAURI_INTERNALS__.invoke('os:version');
export const locale   = () => (window as any).__TAURI_INTERNALS__.invoke('os:locale');
export const hostname = () => (window as any).__TAURI_INTERNALS__.invoke('os:hostname');

export type Platform = 'linux' | 'macos' | 'windows' | 'ios' | 'android';
