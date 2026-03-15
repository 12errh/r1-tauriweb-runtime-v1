import { KernelPlugin, KernelHandler } from '@r1/kernel';

/**
 * Allows the guest app (WASM/JS) to control its own window.
 */
export class WindowPlugin implements KernelPlugin {
  name = 'window';
  private onMainThreadCall: (api: string, method: string, args: any) => Promise<any>;

  constructor(onMainThreadCall: (api: string, method: string, args: any) => Promise<any>) {
    this.onMainThreadCall = onMainThreadCall;
  }

  getCommands(): Map<string, KernelHandler> {
    const commands = new Map<string, KernelHandler>();

    // These commands are proxied to the main thread via the bridge
    commands.set('set_title', async (args) => this.onMainThreadCall('window', 'set_title', args));
    commands.set('close', async (args) => this.onMainThreadCall('window', 'close', args));
    commands.set('maximize', async (args) => this.onMainThreadCall('window', 'maximize', args));
    commands.set('minimize', async (args) => this.onMainThreadCall('window', 'minimize', args));
    commands.set('focus', async (args) => this.onMainThreadCall('window', 'focus', args));

    return commands;
  }
}
