import { KernelPlugin, KernelHandler, VFS } from '@r1/kernel';

export class FsPlugin implements KernelPlugin {
  name = 'fs';
  private vfs: VFS;

  constructor(vfs: VFS) {
    this.vfs = vfs;
  }

  getCommands(): Map<string, KernelHandler> {
    const commands = new Map<string, KernelHandler>();

    commands.set('read_text_file', async (payload: { path: string }) => {
      return this.vfs.readText(payload.path);
    });

    commands.set('write_text_file', async (payload: { path: string; contents: string }) => {
      await this.vfs.writeText(payload.path, payload.contents);
      return null;
    });

    commands.set('exists', async (payload: { path: string }) => {
      return this.vfs.exists(payload.path);
    });

    commands.set('remove_file', async (payload: { path: string }) => {
      // VFS doesn't have remove yet, we'll need to add it or stub it
      console.warn('[FsPlugin] remove_file not fully implemented in VFS yet');
      return null;
    });

    return commands;
  }
}
