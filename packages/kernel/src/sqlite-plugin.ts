import { KernelPlugin, KernelHandler } from './router';
import { VFS } from './vfs';

/**
 * SQLitePlugin (Phase 2): Official @sqlite.org/sqlite-wasm bridge.
 * 
 * Supports both :memory: and OPFS-based persistence.
 */
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

    // Use dynamic import to avoid blocking worker boot
    const { default: sqlite3InitModule } = await import('@sqlite.org/sqlite-wasm');
    this.sqlite3 = await sqlite3InitModule();
    console.log('[SQLitePlugin] Initialised version:', this.sqlite3.version.libVersion);
    return this.sqlite3;
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
