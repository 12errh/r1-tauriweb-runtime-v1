import { KernelPlugin, KernelHandler } from '@r1-runtime/kernel';

export class HttpPlugin implements KernelPlugin {
  name = 'http';

  getCommands(): Map<string, KernelHandler> {
    const commands = new Map<string, KernelHandler>();

    /**
     * Proxies fetch from the guest app.
     * Note: This is subject to CORS of the browser environment.
     */
    commands.set('fetch', async (payload: { url: string; options?: any }) => {
      const response = await fetch(payload.url, payload.options);
      
      const headers: Record<string, string> = {};
      response.headers.forEach((val, key) => headers[key] = val);

      return {
        status: response.status,
        statusText: response.statusText,
        headers,
        data: await response.text() // We return text by default, can expand to binary
      };
    });

    return commands;
  }
}
