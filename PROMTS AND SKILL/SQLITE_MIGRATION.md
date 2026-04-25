# Add SQLite to Existing R1 App (v0.3.7)

**Instructions**: Use this prompt to add SQLite to an app that's already running on R1.

---

## PROMPT — Add SQLite to My R1 App

```
You are adding SQLite database support to an existing R1 TauriWeb Runtime application.

Read the skill file first:
PROMTS AND SKILL/R1_SKILL.md

Focus on the SQLite section — it explains OPFS persistence and WASI syscalls.

MY APP CURRENTLY:
[USER: DESCRIBE YOUR APP — e.g., "A note-taking app that currently stores notes
in localStorage. I want to migrate to SQLite for better querying and data structure."]

WHAT I WANT TO STORE IN SQLITE:
[USER: DESCRIBE YOUR DATA — e.g., "Notes with id, title, content, created_at, updated_at.
I want to be able to search by title and sort by date."]

STEP 1 — UPDATE CARGO.TOML
Add rusqlite with the bundled feature:

[dependencies]
rusqlite = { version = "0.31", features = ["bundled"] }

**CRITICAL**: The "bundled" feature is required for WASM compatibility.

STEP 2 — CREATE DATABASE HELPER
Add a helper function to get the database connection:

use rusqlite::{Connection, Result};

fn get_conn() -> Result<Connection> {
    Connection::open("/app/data/app.db")
}

**IMPORTANT**: Always use paths starting with `/app/data/` for database files.

STEP 3 — CREATE INITIALIZATION COMMAND
Add a command to create your tables:

use r1_macros::command;

#[command]
fn init_database() -> Result<(), String> {
    let conn = get_conn().map_err(|e| e.to_string())?;
    
    conn.execute(
        "CREATE TABLE IF NOT EXISTS notes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            content TEXT NOT NULL,
            created_at INTEGER NOT NULL,
            updated_at INTEGER NOT NULL
        )",
        []
    ).map_err(|e| e.to_string())?;
    
    // Add indexes for better query performance
    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_notes_title ON notes(title)",
        []
    ).map_err(|e| e.to_string())?;
    
    Ok(())
}

STEP 4 — CREATE CRUD COMMANDS
Add commands for Create, Read, Update, Delete:

#[command]
fn create_note(title: String, content: String) -> Result<i64, String> {
    let conn = get_conn().map_err(|e| e.to_string())?;
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_secs() as i64;
    
    conn.execute(
        "INSERT INTO notes (title, content, created_at, updated_at) VALUES (?1, ?2, ?3, ?4)",
        [&title, &content, &now.to_string(), &now.to_string()]
    ).map_err(|e| e.to_string())?;
    
    Ok(conn.last_insert_rowid())
}

#[command]
fn get_notes() -> Result<Vec<Note>, String> {
    #[derive(serde::Serialize)]
    struct Note {
        id: i64,
        title: String,
        content: String,
        created_at: i64,
        updated_at: i64,
    }
    
    let conn = get_conn().map_err(|e| e.to_string())?;
    let mut stmt = conn.prepare("SELECT id, title, content, created_at, updated_at FROM notes ORDER BY updated_at DESC")
        .map_err(|e| e.to_string())?;
    
    let notes = stmt.query_map([], |row| {
        Ok(Note {
            id: row.get(0)?,
            title: row.get(1)?,
            content: row.get(2)?,
            created_at: row.get(3)?,
            updated_at: row.get(4)?,
        })
    }).map_err(|e| e.to_string())?
      .collect::<Result<Vec<_>, _>>()
      .map_err(|e| e.to_string())?;
    
    Ok(notes)
}

#[command]
fn update_note(id: i64, title: String, content: String) -> Result<(), String> {
    let conn = get_conn().map_err(|e| e.to_string())?;
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_secs() as i64;
    
    conn.execute(
        "UPDATE notes SET title = ?1, content = ?2, updated_at = ?3 WHERE id = ?4",
        [&title, &content, &now.to_string(), &id.to_string()]
    ).map_err(|e| e.to_string())?;
    
    Ok(())
}

#[command]
fn delete_note(id: i64) -> Result<(), String> {
    let conn = get_conn().map_err(|e| e.to_string())?;
    
    conn.execute("DELETE FROM notes WHERE id = ?1", [&id.to_string()])
        .map_err(|e| e.to_string())?;
    
    Ok(())
}

#[command]
fn search_notes(query: String) -> Result<Vec<Note>, String> {
    #[derive(serde::Serialize)]
    struct Note {
        id: i64,
        title: String,
        content: String,
        created_at: i64,
        updated_at: i64,
    }
    
    let conn = get_conn().map_err(|e| e.to_string())?;
    let search_pattern = format!("%{}%", query);
    let mut stmt = conn.prepare(
        "SELECT id, title, content, created_at, updated_at FROM notes 
         WHERE title LIKE ?1 OR content LIKE ?1 
         ORDER BY updated_at DESC"
    ).map_err(|e| e.to_string())?;
    
    let notes = stmt.query_map([&search_pattern], |row| {
        Ok(Note {
            id: row.get(0)?,
            title: row.get(1)?,
            content: row.get(2)?,
            created_at: row.get(3)?,
            updated_at: row.get(4)?,
        })
    }).map_err(|e| e.to_string())?
      .collect::<Result<Vec<_>, _>>()
      .map_err(|e| e.to_string())?;
    
    Ok(notes)
}

STEP 5 — UPDATE FRONTEND
First, install the SQL plugin if not already installed:

    npm install @tauri-apps/plugin-sql

Initialize the database when the app loads.
Always use @tauri-apps/plugin-sql in your source — the Vite plugin rewrites it automatically:

    import Database from '@tauri-apps/plugin-sql';
    import { invoke } from '@tauri-apps/api/core';

    window.addEventListener('r1:ready', async () => {
        try {
            await invoke('init_database');
            console.log('Database initialized');
            
            // Load initial data
            const notes = await invoke('get_notes');
            console.log('Loaded notes:', notes);
        } catch (error) {
            console.error('Database initialization failed:', error);
        }
    });

STEP 6 — MIGRATE EXISTING DATA (If Applicable)
If you have data in localStorage, migrate it:

async function migrateFromLocalStorage() {
    const oldNotes = JSON.parse(localStorage.getItem('notes') || '[]');
    
    for (const note of oldNotes) {
        await invoke('create_note', {
            title: note.title,
            content: note.content
        });
    }
    
    // Clear old storage
    localStorage.removeItem('notes');
    console.log('Migration complete');
}

STEP 7 — REBUILD AND TEST
1. npm run build
2. npx serve dist -l 3000
3. Open http://localhost:3000

Test:
- Create some data
- Refresh the page
- Data should persist
- Search should work
- All CRUD operations should work

STEP 8 — VERIFY OPFS STORAGE
Check that data is stored in OPFS:
1. Open DevTools → Application → Storage
2. Look for Origin Private File System
3. You should see /app/data/app.db

STEP 9 — REPORT RESULTS
Tell me:
1. Did the build succeed?
2. Does the database initialize?
3. Can you create, read, update, delete data?
4. Does data persist after refresh?
5. Does search work?
6. Any errors?
```

---

## Migration Checklist

- [ ] Added rusqlite with "bundled" feature to Cargo.toml
- [ ] Created get_conn() helper function
- [ ] Created init_database() command
- [ ] Created CRUD commands (create, read, update, delete)
- [ ] Added search command (if needed)
- [ ] Updated frontend to call init_database() on r1:ready
- [ ] Migrated existing data (if applicable)
- [ ] Tested all operations
- [ ] Verified persistence after refresh
- [ ] Checked OPFS in DevTools

---

## Common Issues

**"rusqlite not found"**
- Make sure you added it to Cargo.toml with "bundled" feature

**"Database file not found"**
- Use paths starting with `/app/data/`
- Example: `/app/data/app.db`

**"Data doesn't persist"**
- Check browser console for OPFS errors
- Use Chrome/Edge (OPFS not supported in Firefox yet)
- Verify database path starts with `/app/data/`

**"Query errors"**
- Check SQL syntax
- Verify table exists (call init_database first)
- Check parameter types match column types
