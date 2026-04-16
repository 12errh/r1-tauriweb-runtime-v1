import { invoke } from './core';

/**
 * Result of a database execution that doesn't return rows.
 */
export interface QueryResult {
  /** The last inserted row ID. */
  lastInsertId: number;
  /** The number of rows affected by the query. */
  rowsAffected: number;
}

/**
 * A high-performance SQLite Database instance.
 * 
 * This class provides a promise-based API for interacting with SQLite databases
 * in the R1 Runtime. It maintains compatibility with the @tauri-apps/plugin-sql interface
 * while using @sqlite.org/sqlite-wasm and OPFS for persistent storage.
 * 
 * @example
 * ```typescript
 * const db = await Database.load('sqlite:test.db');
 * await db.execute('CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT)');
 * await db.execute('INSERT INTO users (name) VALUES (?)', ['Alice']);
 * const users = await db.select('SELECT * FROM users');
 * ```
 */
export class Database {
  private path: string;

  constructor(path: string) {
    this.path = path;
  }

  /**
   * Loads or creates a database from the given path.
   * 
   * @param path - The database path. Should be prefixed with 'sqlite:' (e.g. 'sqlite:production.db').
   *              Use ':memory:' for a volatile, in-memory database.
   * @returns A promise resolving to a new Database instance.
   */
  static async load(path: string): Promise<Database> {
    await invoke('plugin:sql|load', { db: path });
    return new Database(path);
  }

  /**
   * Executes a query that doesn't return rows, such as INSERT, UPDATE, or DELETE.
   * 
   * @param query - The SQL query to execute.
   * @param values - Optional array of values to bind to the query parameters (?).
   * @returns A promise resolving to information about the execution (lastInsertId, rowsAffected).
   */
  async execute(query: string, values: any[] = []): Promise<QueryResult> {
    return await invoke('plugin:sql|execute', {
      db: this.path,
      query,
      values,
    });
  }

  /**
   * Executes a SELECT query and returns the resulting rows.
   * 
   * @param query - The SQL query to execute.
   * @param values - Optional array of values to bind to the query parameters (?).
   * @returns A promise resolving to an array of objects representing the rows.
   */
  async select<T>(query: string, values: any[] = []): Promise<T> {
    return await invoke('plugin:sql|select', {
      db: this.path,
      query,
      values,
    });
  }

  /**
   * Closes the database connection.
   * 
   * @returns A promise resolving to true if the database was closed successfully.
   */
  async close(): Promise<boolean> {
    return await invoke('plugin:sql|close', { db: this.path });
  }
}
