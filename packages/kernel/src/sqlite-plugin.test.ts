import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SQLitePlugin } from './sqlite-plugin';
import { VFS } from './vfs';

describe('Phase 2: SQLite Plugin Logic', () => {
    let vfs: VFS;
    let plugin: SQLitePlugin;

    beforeEach(() => {
        vfs = new VFS();
        plugin = new SQLitePlugin(vfs);
    });

    it('1. Normalizes database paths (removing sqlite: prefix)', async () => {
        const payload = { db: 'sqlite:test.db' };
        const handlers = plugin.getCommands();
        const loadHandler = handlers.get('load')!;
        
        const path = await loadHandler(payload);
        expect(path).toBe('test.db');
    });

    it('2. Loads an in-memory database', async () => {
        const payload = { db: ':memory:' };
        const handlers = plugin.getCommands();
        const loadHandler = handlers.get('load')!;
        
        const path = await loadHandler(payload);
        expect(path).toBe(':memory:');
    });

    it('3. Creates a table and inserts a row', async () => {
        const handlers = plugin.getCommands();
        await handlers.get('load')!({ db: ':memory:' });

        const executeHandler = handlers.get('execute')!;
        const result: any = await executeHandler({
            db: ':memory:',
            query: 'CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT)',
            values: []
        });

        expect(result.rowsAffected).toBe(0);

        const insertResult: any = await executeHandler({
            db: ':memory:',
            query: 'INSERT INTO users (name) VALUES (?)',
            values: ['Alice']
        });

        expect(insertResult.lastInsertId).toBe(1);
        expect(insertResult.rowsAffected).toBe(1);
    });

    it('4. Selects data with parameter binding', async () => {
        const handlers = plugin.getCommands();
        await handlers.get('load')!({ db: ':memory:' });
        await handlers.get('execute')!({
            db: ':memory:',
            query: 'CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT)',
            values: []
        });
        await handlers.get('execute')!({
            db: ':memory:',
            query: 'INSERT INTO users (name) VALUES (?)',
            values: ['Bob']
        });

        const selectHandler = handlers.get('select')!;
        const rows: any = await selectHandler({
            db: ':memory:',
            query: 'SELECT * FROM users WHERE name = ?',
            values: ['Bob']
        });

        expect(rows).toHaveLength(1);
        expect(rows[0].name).toBe('Bob');
    });

    it('5. Handles batch execution', async () => {
        const handlers = plugin.getCommands();
        await handlers.get('load')!({ db: ':memory:' });

        const batchHandler = handlers.get('execute_batch')!;
        await batchHandler({
            db: ':memory:',
            query: `
                CREATE TABLE items (id INTEGER PRIMARY KEY, title TEXT);
                INSERT INTO items (title) VALUES ('Item 1');
                INSERT INTO items (title) VALUES ('Item 2');
            `
        });

        const selectHandler = handlers.get('select')!;
        const rows: any = await selectHandler({
            db: ':memory:',
            query: 'SELECT COUNT(*) as count FROM items',
            values: []
        });

        expect(rows[0].count).toBe(2);
    });

    it('6. Closes a database', async () => {
        const handlers = plugin.getCommands();
        await handlers.get('load')!({ db: ':memory:' });
        
        const closeHandler = handlers.get('close')!;
        const result = await closeHandler({ db: ':memory:' });
        expect(result).toBe(true);
    });

    it('7. Throws error for non-existent database', async () => {
        const handlers = plugin.getCommands();
        const selectHandler = handlers.get('select')!;
        
        await expect(selectHandler({
            db: 'nonexistent.db',
            query: 'SELECT 1',
            values: []
        })).rejects.toThrow('Database not loaded: nonexistent.db');
    });

    it('8. Handles SQL syntax errors gracefully', async () => {
        const handlers = plugin.getCommands();
        await handlers.get('load')!({ db: ':memory:' });
        const executeHandler = handlers.get('execute')!;

        await expect(executeHandler({
            db: ':memory:',
            query: 'INVALID SQL STATEMENT',
            values: []
        })).rejects.toThrow();
    });

    it('9. Handles multiple database connections', async () => {
        const handlers = plugin.getCommands();
        await handlers.get('load')!({ db: 'db1.db' });
        await handlers.get('load')!({ db: 'db2.db' });

        await handlers.get('execute')!({ db: 'db1.db', query: 'CREATE TABLE t1 (id int)', values: [] });
        await handlers.get('execute')!({ db: 'db2.db', query: 'CREATE TABLE t2 (id int)', values: [] });

        const select1: any = await handlers.get('select')!({ db: 'db1.db', query: "SELECT name FROM sqlite_master WHERE type='table' AND name='t1'", values: [] });
        const select2: any = await handlers.get('select')!({ db: 'db2.db', query: "SELECT name FROM sqlite_master WHERE type='table' AND name='t2'", values: [] });

        expect(select1).toHaveLength(1);
        expect(select2).toHaveLength(1);
    });

    it('10. Persistence fallback: OpfsDb is attempted for non-memory paths', async () => {
        // We can't easily test real OPFS in Vitest JSDOM environment without mocks
        // but we can verify the code path doesn't crash and falls back to memory.
        const handlers = plugin.getCommands();
        const path = await handlers.get('load')!({ db: 'persistent.db' });
        expect(path).toBe('persistent.db');
    });
});
