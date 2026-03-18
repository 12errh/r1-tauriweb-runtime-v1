/**
 * R1 Frontend Shim for @tauri-apps/api/shell
 */

export async function open(path: string): Promise<void> {
  window.open(path, '_blank');
}

export class Command {
  static create() { return new Command(); }
  async execute() {
    console.warn('[R1] shell.Command.execute() is not supported in the browser');
    return { code: 1, stdout: '', stderr: 'Not supported in browser' };
  }
}
