import { KernelPlugin, KernelHandler } from '@r1/kernel';

/**
 * A generic plugin that forwards calls to the Main Thread.
 * Used for APIs not available in Web Workers (Dialog, Clipboard, etc.)
 */
export class MainBridgePlugin implements KernelPlugin {
  name: string;
  private onMainThreadCall: (api: string, method: string, args: any) => Promise<any>;

  constructor(name: string, onMainThreadCall: (api: string, method: string, args: any) => Promise<any>) {
    this.name = name;
    this.onMainThreadCall = onMainThreadCall;
  }

  getCommands(): Map<string, KernelHandler> {
    const commands = new Map<string, KernelHandler>();

    // We can't know the methods ahead of time easily, so we handle them dynamically
    // or register them manually based on the Tauri API specs.
    
    if (this.name === 'dialog') {
      commands.set('message', async (args) => this.onMainThreadCall('dialog', 'message', args));
      commands.set('ask', async (args) => this.onMainThreadCall('dialog', 'ask', args));
      commands.set('confirm', async (args) => this.onMainThreadCall('dialog', 'confirm', args));
    }

    if (this.name === 'clipboard') {
      commands.set('write_text', async (args) => this.onMainThreadCall('clipboard', 'write_text', args));
      commands.set('read_text', async (args) => this.onMainThreadCall('clipboard', 'read_text', args));
    }

    if (this.name === 'notification') {
      commands.set('notify', async (args) => this.onMainThreadCall('notification', 'notify', args));
      commands.set('request_permission', async (args) => this.onMainThreadCall('notification', 'request_permission', args));
    }

    if (this.name === 'shell') {
      commands.set('open', async (args) => this.onMainThreadCall('shell', 'open', args));
    }

    return commands;
  }
}
