import { KernelPlugin, KernelHandler } from './router';
import { VFS } from './vfs';

// ──────────────────────────────────────────────────────────────────────────
// Global SQLite Configuration Hook
// This MUST be defined in the global scope BEFORE initialize code runs.
const isNode = typeof process !== 'undefined' && process.versions && process.versions.node;

if (typeof self !== 'undefined' && !isNode) {
  const origin = self.location.origin || (self.location.href ? new URL(self.location.href).origin : '');
  const baseUrl = origin + '/';
  
  (self as any).sqlite3ApiConfig = {
    locateFile: (file: string) => {
      const result = new URL(file, baseUrl).href;
      // We log specifically for the proxy to verify detection
      if (file.includes('proxy')) {
        console.log('[SQLitePlugin] Resolving OPFS Proxy (Global):', file, '->', result);
      }
      return result;
    }
  };
}

export class SQLitePlugin implements KernelPlugin {
  name = 'plugin:sql';
  private sqlite3: any = null;
  private dbs = new Map<string, any>();
  private vfs: VFS;

  constructor(vfs: VFS) {
    this.vfs = vfs;
  }

  /**
   * Lazy-load SQLite WASM
   */
  private async initSqlite() {
    if (this.sqlite3) return this.sqlite3;

    try {
      // Use dynamic import to avoid blocking worker boot
      const { default: sqlite3InitModule } = await import('@sqlite.org/sqlite-wasm');
      
      const config: any = {};
      
      if (!isNode) {
        const origin = self.location.origin || (self.location.href ? new URL(self.location.href).origin : '');
        const baseUrl = origin + '/';
        config.locateFile = (file: string) => new URL(file, baseUrl).href;
      }
      
      this.sqlite3 = await (sqlite3InitModule as any)(config);
      
      console.log('[SQLitePlugin] Initialised version:', this.sqlite3.version.libVersion);
      return this.sqlite3;
    } catch (e) {
      console.error('[SQLitePlugin] Failed to initialise SQLite module:', e);
      throw e;
    }
  }

  getCommands(): Map<string, KernelHandler> {
    const commands = new Map<string, KernelHandler>();

    // tauri-apps/plugin-sql sends 'plugin:sql|load', which router handles
    // we just need to provide the 'load', 'execute', etc handlers.

    commands.set('load', async (payload: { db: string }) => {
      const sqlite3 = await this.initSqlite();
      const dbPath = this.normalizePath(payload.db);

      if (this.dbs.has(dbPath)) return dbPath;

      let db;
      if (dbPath === ':memory:') {
        db = new sqlite3.oo1.DB(':memory:', 'ct');
      } else {
        try {
          // Attempt OPFS Persistence
          db = new sqlite3.oo1.OpfsDb(dbPath, 'ct');
          console.log('[SQLitePlugin] Opened persistence DB (OPFS):', dbPath);
        } catch (e) {
          console.warn('[SQLitePlugin] OPFS unavailable or failed, falling back to memory:', (e as Error).message);
          db = new sqlite3.oo1.DB(dbPath, 'ct');
        }
      }

      this.dbs.set(dbPath, db);
      return dbPath;
    });

    commands.set('execute', async (payload: { db: string; query: string; values: any[] }) => {
      const sqlite3 = await this.initSqlite();
      const db = this.getDb(payload.db);
      db.exec({
        sql: payload.query,
        bind: payload.values || [],
      });
      return { 
        lastInsertId: Number(sqlite3.capi.sqlite3_last_insert_rowid(db.pointer)), 
        rowsAffected: sqlite3.capi.sqlite3_changes(db.pointer) 
      };
    });

    commands.set('select', async (payload: { db: string; query: string; values: any[] }) => {
      const db = this.getDb(payload.db);
      const rows: any[] = [];
      db.exec({
        sql: payload.query,
        bind: payload.values || [],
        rowMode: 'object',
        callback: (row: any) => { rows.push(row); },
      });
      return rows;
    });

    commands.set('close', async (payload: { db: string }) => {
      const dbPath = this.normalizePath(payload.db);
      const db = this.dbs.get(dbPath);
      if (db) {
        db.close();
        this.dbs.delete(dbPath);
      }
      return true;
    });

    commands.set('execute_batch', async (payload: { db: string; query: string }) => {
        const sqlite3 = await this.initSqlite();
        const db = this.getDb(payload.db);
        db.exec(payload.query);
        return { 
          lastInsertId: Number(sqlite3.capi.sqlite3_last_insert_rowid(db.pointer)), 
          rowsAffected: sqlite3.capi.sqlite3_changes(db.pointer) 
        };
    });

    return commands;
  }

  private getDb(path: string) {
    const dbPath = this.normalizePath(path);
    const db = this.dbs.get(dbPath);
    if (!db) throw new Error(`Database not loaded: ${dbPath}`);
    return db;
  }

  private normalizePath(path: string) {
    // Tauri often prefixes with 'sqlite:'
    return path.startsWith('sqlite:') ? path.substring(7) : path;
  }
}
