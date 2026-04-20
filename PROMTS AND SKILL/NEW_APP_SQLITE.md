# R1 New App with SQLite Prompt (v0.3.5)

**Instructions**: Copy this prompt and describe your SQLite-powered app at the bottom.

---

## PROMPT — Build a New R1 App with SQLite

```
You are building a new application with R1 TauriWeb Runtime v0.3.5 that uses SQLite for data persistence.

Read the skill file first:
PROMTS AND SKILL/R1_SKILL.md

Pay special attention to the SQLite section — it explains how SQLite works in R1 with OPFS persistence.

WHAT I WANT TO BUILD:
[USER: DESCRIBE YOUR APP — e.g., "A task manager with SQLite database.
Users can create, edit, delete, and search tasks. Tasks have title, description,
due date, and status. React + TypeScript frontend."]

STEP 1 — SCAFFOLD THE PROJECT
Create the standard R1 project structure (see NEW_APP.md for details).

STEP 2 — CONFIGURE CARGO.TOML FOR SQLITE
[package]
name = "my_app"
version = "0.1.0"
edition = "2021"

[lib]
name = "my_app"
crate-type = ["cdylib", "rlib"]

[dependencies]
wasm-bindgen = "0.2"
serde = { version = "1", features = ["derive"] }
serde_json = "1"
r1-macros = "0.3.0"
rusqlite = { version = "0.31", features = ["bundled"] }

[target.'cfg(not(target_arch = "wasm32"))'.dependencies]
tauri = { version = "2", features = [] }

**CRITICAL**: rusqlite MUST have the "bundled" feature for WASM compatibility.

STEP 3 — CREATE RUST COMMANDS WITH SQLITE
Use rusqlite in your Rust commands. The WASI shim redirects all file I/O to OPFS:

use r1_macros::command;
use rusqlite::{Connection, Result};

fn get_conn() -> Result<Connection> {
    Connection::open("/app/data/app.db")
}

#[command]
fn create_table() -> Result<(), String> {
    let conn = get_conn().map_err(|e| e.to_string())?;
    
    conn.execute(
        "CREATE TABLE IF NOT EXISTS tasks (
            id INTEGER PRIMARY KEY,
            title TEXT NOT NULL,
            description TEXT,
            status TEXT NOT NULL
        )",
        []
    ).map_err(|e| e.to_string())?;
    
    Ok(())
}

#[command]
fn insert_task(title: String, description: String, status: String) -> Result<i64, String> {
    let conn = get_conn().map_err(|e| e.to_string())?;
    
    conn.execute(
        "INSERT INTO tasks (title, description, status) VALUES (?1, ?2, ?3)",
        [&title, &description, &status]
    ).map_err(|e| e.to_string())?;
    
    Ok(conn.last_insert_rowid())
}

#[command]
fn get_tasks() -> Result<Vec<Task>, String> {
    #[derive(serde::Serialize)]
    struct Task {
        id: i64,
        title: String,
        description: String,
        status: String,
    }
    
    let conn = get_conn().map_err(|e| e.to_string())?;
    let mut stmt = conn.prepare("SELECT id, title, description, status FROM tasks")
        .map_err(|e| e.to_string())?;
    
    let tasks = stmt.query_map([], |row| {
        Ok(Task {
            id: row.get(0)?,
            title: row.get(1)?,
            description: row.get(2)?,
            status: row.get(3)?,
        })
    }).map_err(|e| e.to_string())?
      .collect::<Result<Vec<_>, _>>()
      .map_err(|e| e.to_string())?;
    
    Ok(tasks)
}

STEP 4 — FRONTEND WITH SQLITE
Install the SQL plugin:

    npm install @tauri-apps/plugin-sql

Use it in your frontend with the standard @tauri-apps import.
The Vite plugin rewrites it to @r1-runtime/apis/sql at build time automatically.

    import Database from '@tauri-apps/plugin-sql';

    // Initialize database
    const db = await Database.load('sqlite:app.db');

    // Create table
    await db.execute(`
        CREATE TABLE IF NOT EXISTS tasks (
            id INTEGER PRIMARY KEY,
            title TEXT NOT NULL,
            description TEXT,
            status TEXT NOT NULL
        )
    `);

    // Insert data
    await db.execute(
        'INSERT INTO tasks (title, description, status) VALUES (?, ?, ?)',
        ['My Task', 'Description', 'pending']
    );

    // Query data
    const rows = await db.select('SELECT * FROM tasks');
    console.log(rows);

STEP 5 — INITIALIZE DATABASE ON APP START
In your frontend, initialize the database when the app loads:

import { invoke } from '@tauri-apps/api/core';

// Wait for R1 to be ready
window.addEventListener('r1:ready', async () => {
    try {
        await invoke('create_table');
        console.log('Database initialized');
    } catch (error) {
        console.error('Failed to initialize database:', error);
    }
});

STEP 6 — PACKAGE.JSON
{
  "dependencies": {
    "@r1-runtime/core": "^0.3.2",
    "@r1-runtime/apis": "^0.3.2"
  },
  "devDependencies": {
    "@r1-runtime/vite-plugin": "^0.3.5"
  }
}

STEP 7 — BUILD AND TEST
1. npm install
2. npm run build
3. npx serve dist -l 3000
4. Open http://localhost:3000

Test that:
- Database is created in OPFS
- Data persists across page refreshes
- All CRUD operations work

STEP 8 — VERIFY PERSISTENCE
To verify data persists:
1. Add some data
2. Refresh the page (Ctrl+F5)
3. Data should still be there

Check OPFS in DevTools:
- Open DevTools → Application → Storage → Origin Private File System
- You should see /app/data/app.db

STEP 9 — TELL ME THE RESULTS
Report:
1. Does the app build successfully?
2. Does the database initialize?
3. Can you insert and query data?
4. Does data persist after refresh?
5. Any errors in the console?
```

---

## SQLite Quick Reference

### Rust Side (rusqlite)
```rust
use rusqlite::{Connection, Result};
use r1_macros::command;

#[command]
fn db_operation() -> Result<(), String> {
    let conn = Connection::open("/app/data/app.db")
        .map_err(|e| e.to_string())?;
    // ... SQL operations
    Ok(())
}
```

### JavaScript Side (@tauri-apps/plugin-sql)
```typescript
// Always use @tauri-apps/plugin-sql in source code.
// The Vite plugin rewrites it to @r1-runtime/apis/sql at build time.
import Database from '@tauri-apps/plugin-sql';

const db = await Database.load('sqlite:app.db');
await db.execute('CREATE TABLE ...');
const rows = await db.select('SELECT * FROM ...');
```

### Database Path
- Always use `/app/data/` prefix
- Example: `/app/data/app.db`
- Stored in OPFS, persists across refreshes
