// SQLite Database Helper for R1
// Uses R1's built-in SQL API

import { Database } from "@r1/apis/sql";

export interface Task {
  id?: number;
  title: string;
  description: string;
  category: string;
  completed: boolean;
  created_at: string;
  updated_at: string;
}

let db: Database | null = null;

export async function initDatabase(): Promise<Database> {
  if (db) return db;

  try {
    // Load database using R1's SQL API
    db = await Database.load("sqlite:taskflow.db");
    console.log("[DB] SQLite database loaded successfully");

    // Create tables
    await db.execute(`
      CREATE TABLE IF NOT EXISTS tasks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        description TEXT,
        category TEXT NOT NULL,
        completed INTEGER DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )
    `);

    await db.execute(`CREATE INDEX IF NOT EXISTS idx_category ON tasks(category)`);
    await db.execute(`CREATE INDEX IF NOT EXISTS idx_completed ON tasks(completed)`);

    console.log("[DB] Database tables created successfully");
    return db;
  } catch (error) {
    console.error("[DB] Failed to initialize:", error);
    throw error;
  }
}

export async function getAllTasks(): Promise<Task[]> {
  const database = await initDatabase();

  try {
    const result = await database.select<any[]>("SELECT * FROM tasks ORDER BY created_at DESC");
    
    return result.map((row: any) => ({
      id: row.id,
      title: row.title,
      description: row.description,
      category: row.category,
      completed: Boolean(row.completed),
      created_at: row.created_at,
      updated_at: row.updated_at,
    }));
  } catch (error) {
    console.error("[DB] Failed to get tasks:", error);
    return [];
  }
}

export async function insertTask(task: Omit<Task, "id">): Promise<number> {
  const database = await initDatabase();

  try {
    const result = await database.execute(
      `INSERT INTO tasks (title, description, category, completed, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        task.title,
        task.description,
        task.category,
        task.completed ? 1 : 0,
        task.created_at,
        task.updated_at,
      ]
    );

    return result.lastInsertId;
  } catch (error) {
    console.error("[DB] Failed to insert task:", error);
    throw error;
  }
}

export async function updateTask(id: number, updates: Partial<Task>): Promise<void> {
  const database = await initDatabase();

  const fields: string[] = [];
  const values: any[] = [];

  if (updates.title !== undefined) {
    fields.push("title = ?");
    values.push(updates.title);
  }
  if (updates.description !== undefined) {
    fields.push("description = ?");
    values.push(updates.description);
  }
  if (updates.category !== undefined) {
    fields.push("category = ?");
    values.push(updates.category);
  }
  if (updates.completed !== undefined) {
    fields.push("completed = ?");
    values.push(updates.completed ? 1 : 0);
  }
  if (updates.updated_at !== undefined) {
    fields.push("updated_at = ?");
    values.push(updates.updated_at);
  }

  if (fields.length === 0) return;

  values.push(id);

  try {
    await database.execute(
      `UPDATE tasks SET ${fields.join(", ")} WHERE id = ?`,
      values
    );
  } catch (error) {
    console.error("[DB] Failed to update task:", error);
    throw error;
  }
}

export async function deleteTask(id: number): Promise<void> {
  const database = await initDatabase();

  try {
    await database.execute("DELETE FROM tasks WHERE id = ?", [id]);
  } catch (error) {
    console.error("[DB] Failed to delete task:", error);
    throw error;
  }
}

export async function getTaskStats() {
  const database = await initDatabase();

  try {
    const [totalResult, categoryResult] = await Promise.all([
      database.select<any[]>(`
        SELECT 
          COUNT(*) as total,
          SUM(CASE WHEN completed = 1 THEN 1 ELSE 0 END) as completed,
          SUM(CASE WHEN completed = 0 THEN 1 ELSE 0 END) as pending
        FROM tasks
      `),
      database.select<any[]>(`
        SELECT category, COUNT(*) as count
        FROM tasks
        GROUP BY category
        ORDER BY count DESC
      `),
    ]);

    const stats = totalResult[0];
    return {
      total: stats.total,
      completed: stats.completed,
      pending: stats.pending,
      by_category: categoryResult,
    };
  } catch (error) {
    console.error("[DB] Failed to get stats:", error);
    return { total: 0, completed: 0, pending: 0, by_category: [] };
  }
}

export async function searchTasks(keyword: string): Promise<Task[]> {
  const database = await initDatabase();

  try {
    const result = await database.select<any[]>(
      `SELECT * FROM tasks 
       WHERE title LIKE ? OR description LIKE ? OR category LIKE ?
       ORDER BY created_at DESC`,
      [`%${keyword}%`, `%${keyword}%`, `%${keyword}%`]
    );

    return result.map((row: any) => ({
      id: row.id,
      title: row.title,
      description: row.description,
      category: row.category,
      completed: Boolean(row.completed),
      created_at: row.created_at,
      updated_at: row.updated_at,
    }));
  } catch (error) {
    console.error("[DB] Failed to search tasks:", error);
    return [];
  }
}

export async function filterTasksByCategory(category: string): Promise<Task[]> {
  const database = await initDatabase();

  try {
    const result = await database.select<any[]>(
      "SELECT * FROM tasks WHERE category = ? ORDER BY created_at DESC",
      [category]
    );

    return result.map((row: any) => ({
      id: row.id,
      title: row.title,
      description: row.description,
      category: row.category,
      completed: Boolean(row.completed),
      created_at: row.created_at,
      updated_at: row.updated_at,
    }));
  } catch (error) {
    console.error("[DB] Failed to filter by category:", error);
    return [];
  }
}

export async function filterTasksByStatus(completed: boolean): Promise<Task[]> {
  const database = await initDatabase();

  try {
    const result = await database.select<any[]>(
      "SELECT * FROM tasks WHERE completed = ? ORDER BY created_at DESC",
      [completed ? 1 : 0]
    );

    return result.map((row: any) => ({
      id: row.id,
      title: row.title,
      description: row.description,
      category: row.category,
      completed: Boolean(row.completed),
      created_at: row.created_at,
      updated_at: row.updated_at,
    }));
  } catch (error) {
    console.error("[DB] Failed to filter by status:", error);
    return [];
  }
}