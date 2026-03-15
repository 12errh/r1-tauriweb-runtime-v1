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
