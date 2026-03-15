import { KernelPlugin, KernelHandler } from '@r1/kernel';

export class EventPlugin implements KernelPlugin {
  name = 'event';
  private onEmit: (event: string, payload: any) => void;

  constructor(onEmit: (event: string, payload: any) => void) {
    this.onEmit = onEmit;
  }

  getCommands(): Map<string, KernelHandler> {
    const commands = new Map<string, KernelHandler>();

    // Note: JS -> Rust events usually go through invoke("event:emit", ...)
    commands.set('emit', async (payload: { event: string; payload: any }) => {
      this.onEmit(payload.event, payload.payload);
      return null;
    });

    // listen and unlisten are handled on the main thread via IPC Bridge patching,
    // as it's purely a JS-to-JS event registration on the main EventBus.
    // But we can add stubs here if needed for cross-plugin events.

    return commands;
  }
}
