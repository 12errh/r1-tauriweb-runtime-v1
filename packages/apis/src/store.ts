import { KernelPlugin, KernelHandler, VFS } from '@r1-runtime/kernel';

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

// ─── Direct JS exports (used by @tauri-apps/plugin-store imports) ─────────────

/**
 * A client-side proxy for the Store plugin.
 * Every method invokes the kernel equivalent.
 */
export class Store {
  path: string;

  constructor(path: string) {
    this.path = path;
  }

  async set(key: string, value: any): Promise<void> {
    return (window as any).__TAURI_INTERNALS__.invoke('store:set', { name: this.path, key, value });
  }

  async get<T>(key: string): Promise<T | null> {
    return (window as any).__TAURI_INTERNALS__.invoke('store:get', { name: this.path, key });
  }

  async has(key: string): Promise<boolean> {
    return (window as any).__TAURI_INTERNALS__.invoke('store:has', { name: this.path, key });
  }

  async delete(key: string): Promise<boolean> {
    await (window as any).__TAURI_INTERNALS__.invoke('store:delete', { name: this.path, key });
    return true;
  }

  async clear(): Promise<void> {
    const keys = await this.keys();
    for (const key of keys) {
      await this.delete(key);
    }
  }

  async keys(): Promise<string[]> {
    return (window as any).__TAURI_INTERNALS__.invoke('store:keys', { name: this.path });
  }

  async values(): Promise<any[]> {
    const keys = await this.keys();
    const values = [];
    for (const key of keys) {
      values.push(await this.get(key));
    }
    return values;
  }

  async entries<T>(): Promise<Array<[string, T]>> {
    const keys = await this.keys();
    const entries: Array<[string, T]> = [];
    for (const key of keys) {
      entries.push([key, await this.get<T>(key) as T]);
    }
    return entries;
  }

  async save(): Promise<void> {
    // In our implementation, every set() is already persisted to VFS.
    return Promise.resolve();
  }

  async load(): Promise<void> {
    // In our implementation, every method automatically interacts dynamically with getStore.
    return Promise.resolve();
  }

  async length(): Promise<number> {
    const k = await this.keys();
    return k.length;
  }
}
