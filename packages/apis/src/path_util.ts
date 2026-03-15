import { KernelPlugin, KernelHandler } from '@r1/kernel';

export class PathPlugin implements KernelPlugin {
  name = 'path';

  getCommands(): Map<string, KernelHandler> {
    const commands = new Map<string, KernelHandler>();

    // Simple path utilities (posix-style for VFS)
    commands.set('join', async (payload: { paths: string[] }) => {
      return payload.paths.join('/').replace(/\/+/g, '/');
    });

    commands.set('basename', async (payload: { path: string; ext?: string }) => {
      let base = payload.path.split('/').pop() || '';
      if (payload.ext && base.endsWith(payload.ext)) {
        base = base.slice(0, -payload.ext.length);
      }
      return base;
    });

    commands.set('dirname', async (payload: { path: string }) => {
      const parts = payload.path.split('/');
      parts.pop();
      return parts.join('/') || '/';
    });

    commands.set('extname', async (payload: { path: string }) => {
      const parts = payload.path.split('.');
      return parts.length > 1 ? `.${parts.pop()}` : '';
    });

    return commands;
  }
}
