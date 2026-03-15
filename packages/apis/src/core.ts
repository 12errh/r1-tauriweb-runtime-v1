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
