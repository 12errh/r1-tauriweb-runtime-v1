import { KernelPlugin, KernelHandler } from '@r1/kernel';

export class OsPlugin implements KernelPlugin {
  name = 'os';
  private onMainThreadCall: (api: string, method: string, args: any) => Promise<any>;

  constructor(onMainThreadCall: (api: string, method: string, args: any) => Promise<any>) {
    this.onMainThreadCall = onMainThreadCall;
  }

  getCommands(): Map<string, KernelHandler> {
    const commands = new Map<string, KernelHandler>();

    commands.set('platform', async (args) => this.onMainThreadCall('os', 'platform', args));
    commands.set('arch', async (args) => this.onMainThreadCall('os', 'arch', args));
    commands.set('version', async (args) => this.onMainThreadCall('os', 'version', args));
    commands.set('locale', async (args) => this.onMainThreadCall('os', 'locale', args));
    commands.set('hostname', async (args) => this.onMainThreadCall('os', 'hostname', args));
    commands.set('type', async (args) => this.onMainThreadCall('os', 'type', args));

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
