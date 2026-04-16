import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest';
import { SQLitePlugin } from './sqlite-plugin';
import { VFS } from './vfs';
import { existsSync, mkdirSync, rmSync } from 'fs';
import { join } from 'path';

const TEST_DB_DIR = join(process.cwd(), 'packages/kernel/test-db');

describe('Phase 2 & 3: SQLite Plugin Logic and Persistence', () => {
    let vfs: VFS;
    let plugin: SQLitePlugin;

    beforeEach(() => {
        if (!existsSync(TEST_DB_DIR)) {
            mkdirSync(TEST_DB_DIR, { recursive: true });
        }
        vfs = new VFS();
        plugin = new SQLitePlugin(vfs);
    });

    afterAll(() => {
        // Cleanup test databases
        try {
            if (existsSync(TEST_DB_DIR)) {
                rmSync(TEST_DB_DIR, { recursive: true, force: true });
            }
        } catch (e) {
            console.warn('Failed to cleanup test-db dir:', e);
        }
    });

    describe('Phase 2: Core Commands', () => {
        it('1. Normalizes database paths (removing sqlite: prefix)', async () => {
            const payload = { db: 'sqlite:test.db' };
            const handlers = plugin.getCommands();
            const path = await handlers.get('load')!(payload);
            expect(path).toBe('test.db');
        });

        it('2. Loads an in-memory database', async () => {
            const payload = { db: ':memory:' };
            const handlers = plugin.getCommands();
            const path = await handlers.get('load')!(payload);
            expect(path).toBe(':memory:');
        });

        it('3. Creates a table and inserts a row', async () => {
            const handlers = plugin.getCommands();
            await handlers.get('load')!({ db: ':memory:' });
            const executeHandler = handlers.get('execute')!;
            
            await executeHandler({
                db: ':memory:',
                query: 'CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT)',
                values: []
            });

            const insertResult: any = await executeHandler({
                db: ':memory:',
                query: 'INSERT INTO users (name) VALUES (?)',
                values: ['Alice']
            });

            expect(insertResult.lastInsertId).toBe(1);
            expect(insertResult.rowsAffected).toBe(1);
        });
    });

    describe('Phase 3: OPFS Persistence Logic Verification', () => {
        it('1. Path routing: OpfsDb is attempted for non-memory paths', async () => {
            const handlers = plugin.getCommands();
            const path = await handlers.get('load')!({ db: 'persistent.db' });
            expect(path).toBe('persistent.db');
            // Logic check: verify it successfully initializes and returns the path
        });

        it('2. Multiple database connections are isolated', async () => {
            const handlers = plugin.getCommands();
            const db1 = 'db1.db';
            const db2 = 'db2.db';

            await handlers.get('load')!({ db: db1 });
            await handlers.get('load')!({ db: db2 });

            await handlers.get('execute')!({ db: db1, query: 'CREATE TABLE t1 (id int)', values: [] });
            await handlers.get('execute')!({ db: db2, query: 'CREATE TABLE t2 (id int)', values: [] });

            const select1: any = await handlers.get('select')!({ db: db1, query: "SELECT name FROM sqlite_master WHERE type='table' AND name='t1'", values: [] });
            const select2: any = await handlers.get('select')!({ db: db2, query: "SELECT name FROM sqlite_master WHERE type='table' AND name='t2'", values: [] });

            expect(select1).toHaveLength(1);
            expect(select2).toHaveLength(1);
        });

        // NOTE: Real OPFS persistence (surviving close/reload) is verified in the browser.
        // In this test environment, we verify that closing doesn't crash the plugin.
        it('3. Database closure works correctly', async () => {
            const handlers = plugin.getCommands();
            const db = 'close-test.db';
            await handlers.get('load')!({ db });
            const result = await handlers.get('close')!({ db });
            expect(result).toBe(true);
        });
    });
});
