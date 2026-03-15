import { KernelPlugin, KernelHandler, VFS } from '@r1/kernel';

/**
 * A JSON-backed key-value store that persists to the VFS.
 * Maps closely to the @tauri-apps/plugin-store.
 */
export class StorePlugin implements KernelPlugin {
  name = 'store';
  private vfs: VFS;
  private caches: Map<string, Record<string, any>> = new Map();

  constructor(vfs: VFS) {
    this.vfs = vfs;
  }

  private async getStore(name: string): Promise<Record<string, any>> {
    if (this.caches.has(name)) return this.caches.get(name)!;

    const path = `/.r1-store/${name}.json`;
    if (await this.vfs.exists(path)) {
      try {
        const text = await this.vfs.readText(path);
        const data = JSON.parse(text);
        this.caches.set(name, data);
        return data;
      } catch (e) {
        console.error(`[StorePlugin] Failed to parse store ${name}:`, e);
      }
    }

    const initial = {};
    this.caches.set(name, initial);
    return initial;
  }

  private async saveStore(name: string, data: Record<string, any>): Promise<void> {
    const path = `/.r1-store/${name}.json`;
    await this.vfs.writeText(path, JSON.stringify(data));
  }

  getCommands(): Map<string, KernelHandler> {
    const commands = new Map<string, KernelHandler>();

    commands.set('set', async (payload: { name: string; key: string; value: any }) => {
      const store = await this.getStore(payload.name);
      store[payload.key] = payload.value;
      await this.saveStore(payload.name, store);
      return null;
    });

    commands.set('get', async (payload: { name: string; key: string }) => {
      const store = await this.getStore(payload.name);
      return store[payload.key];
    });

    commands.set('has', async (payload: { name: string; key: string }) => {
      const store = await this.getStore(payload.name);
      return payload.key in store;
    });

    commands.set('delete', async (payload: { name: string; key: string }) => {
      const store = await this.getStore(payload.name);
      delete store[payload.key];
      await this.saveStore(payload.name, store);
      return null;
    });

    commands.set('keys', async (payload: { name: string }) => {
      const store = await this.getStore(payload.name);
      return Object.keys(store);
    });

    return commands;
  }
}
