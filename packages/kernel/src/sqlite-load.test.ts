import { describe, it, expect } from 'vitest';

describe('Phase 1: SQLite WASM Load Verification', () => {
  it('1. @sqlite.org/sqlite-wasm package is importable', async () => {
    const { default: sqlite3InitModule } = await import(
      '@sqlite.org/sqlite-wasm'
    );
    expect(typeof sqlite3InitModule).toBe('function');
  });

  it('2. SQLite initialises and returns a version string', async () => {
    const { default: sqlite3InitModule } = await import(
      '@sqlite.org/sqlite-wasm'
    );
    const sqlite3 = await sqlite3InitModule();
    expect(sqlite3.version.libVersion).toMatch(/^\d+\.\d+\.\d+$/);
    console.log('[Test] SQLite version:', sqlite3.version.libVersion);
  });

  it('3. In-memory database creates and queries a table', async () => {
    const { default: sqlite3InitModule } = await import(
      '@sqlite.org/sqlite-wasm'
    );
    const sqlite3 = await sqlite3InitModule();
    const db = new sqlite3.oo1.DB(':memory:', 'ct');

    db.exec('CREATE TABLE test (id INTEGER PRIMARY KEY, value TEXT)');
    db.exec("INSERT INTO test (value) VALUES ('hello')");

    const rows: unknown[] = [];
    db.exec({
      sql: 'SELECT * FROM test',
      rowMode: 'object',
      callback: (row: unknown) => rows.push(row),
    });

    expect(rows).toHaveLength(1);
    expect((rows[0] as any).value).toBe('hello');
    db.close();
  });
});
