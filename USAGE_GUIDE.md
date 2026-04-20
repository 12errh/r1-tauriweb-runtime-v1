# R1 Usage Guide

> Complete reference for building apps with R1 — commands, APIs, events, filesystem, SQLite, and deployment.

This guide assumes you have a working R1 app. If you haven't set one up yet, start with [GETTING_STARTED.md](./GETTING_STARTED.md).

---

## Table of Contents

- [Writing Rust Commands](#writing-rust-commands)
- [Calling Rust from JavaScript](#calling-rust-from-javascript)
- [Events — Rust to JavaScript](#events--rust-to-javascript)
- [Filesystem](#filesystem)
- [SQLite](#sqlite)
- [Store Plugin](#store-plugin)
- [Dialog](#dialog)
- [Clipboard](#clipboard)
- [OS Info](#os-info)
- [Window Manager](#window-manager)
- [Deploying](#deploying)
- [Supported APIs](#supported-apis)
- [Limitations](#limitations)

---

## Writing Rust Commands

### Using `#[r1::command]` (Recommended)

The `r1-macros` crate provides a `#[command]` attribute that handles all JSON serialization automatically. Add it to `Cargo.toml`:

```toml
[dependencies]
r1-macros = "0.3.0"
wasm-bindgen = "0.2"
serde = { version = "1", features = ["derive"] }
serde_json = "1"
```

Then write commands exactly like standard Tauri:

```rust
use r1_macros::command;
use serde::{Serialize, Deserialize};

#[command]
pub fn greet(name: String) -> String {
    format!("Hello, {}!", name)
}

#[command]
pub fn add(a: f64, b: f64) -> f64 {
    a + b
}

#[derive(Serialize, Deserialize)]
pub struct User {
    pub id: u32,
    pub name: String,
}

#[command]
pub fn get_user(id: u32) -> User {
    User { id, name: "Alice".to_string() }
}

#[command]
pub fn create_user(name: String) -> Result<User, String> {
    if name.is_empty() {
        return Err("Name cannot be empty".to_string());
    }
    Ok(User { id: 1, name })
}
```

The macro supports any parameter and return type that implements `serde::Deserialize` / `serde::Serialize`, including `Option<T>`, `Result<T, E>`, `Vec<T>`, and custom structs.

---

### Manual JSON Contract

If you prefer not to use the macro, every command follows this exact signature:

```rust
#[wasm_bindgen]
pub fn my_command(payload: &str) -> String
```

One JSON string in. One JSON string out.

**Basic command:**

```rust
use wasm_bindgen::prelude::*;
use serde::{Serialize, Deserialize};

#[derive(Deserialize)]
struct GreetArgs {
    name: String,
}

#[wasm_bindgen]
pub fn greet(payload: &str) -> String {
    let args: GreetArgs = match serde_json::from_str(payload) {
        Ok(a) => a,
        Err(e) => return serde_json::json!({ "error": e.to_string() }).to_string(),
    };
    let message = format!("Hello, {}!", args.name);
    serde_json::to_string(&message).unwrap()
}
```

**Error handling convention:**

```rust
// Success — invoke() resolves with the value
serde_json::json!({ "ok": your_value }).to_string()

// Error — invoke() rejects with the message
serde_json::json!({ "error": "something went wrong" }).to_string()
```

**Command with file I/O:**

```rust
use std::fs;

#[wasm_bindgen]
pub fn save_note(payload: &str) -> String {
    #[derive(Deserialize)]
    struct Args { path: String, content: String }

    let args: Args = match serde_json::from_str(payload) {
        Ok(a) => a,
        Err(e) => return serde_json::json!({ "error": e.to_string() }).to_string(),
    };

    match fs::write(&args.path, &args.content) {
        Ok(_) => serde_json::json!({ "ok": true }).to_string(),
        Err(e) => serde_json::json!({ "error": e.to_string() }).to_string(),
    }
}
```

`std::fs` calls are automatically redirected to OPFS by R1's WASI shim. No special setup needed.

---

## Calling Rust from JavaScript

Your frontend code is identical to standard Tauri. R1 intercepts the calls automatically.

```typescript
import { invoke } from '@tauri-apps/api/core';

// Basic call
const message = await invoke<string>('greet', { name: 'Alice' });

// With error handling
try {
    const user = await invoke<User>('create_user', { name: '' });
} catch (error) {
    console.error(error); // "Name cannot be empty"
}

// Tauri v1 style also works
import { invoke } from '@tauri-apps/api/tauri';
const result = await invoke('my_command', { arg: 'value' });
```

The Vite plugin automatically rewrites `@tauri-apps/api/core` and `@tauri-apps/api/tauri` to `@r1-runtime/apis/core` at build time. You never need to change your import statements.

---

## Events — Rust to JavaScript

Rust can push events to the frontend at any time during execution. Useful for progress updates, background tasks, and real-time data.

**JavaScript — subscribe to events:**

```typescript
import { listen } from '@tauri-apps/api/event';

const unlisten = await listen<{ percent: number }>('progress', (event) => {
    console.log(`Progress: ${event.payload.percent}%`);
    updateProgressBar(event.payload.percent);
});

// Start the Rust operation
await invoke('process_large_file', { path: '/data/file.csv' });

// Clean up when done
unlisten();
```

**JavaScript — emit events to Rust (or other listeners):**

```typescript
import { emit } from '@tauri-apps/api/event';

await emit('user-action', { type: 'click', target: 'button-1' });
```

---

## Filesystem

R1 implements the standard Tauri filesystem API. All data is stored in the browser's Origin Private File System (OPFS) and persists across page refreshes.

### From JavaScript

```typescript
import {
    writeTextFile,
    readTextFile,
    writeBinaryFile,
    readBinaryFile,
    exists,
    removeFile,
    createDir,
    readDir,
    renameFile,
    copyFile,
} from '@tauri-apps/api/fs';

// Write and read text
await writeTextFile('/app/settings.json', JSON.stringify({ theme: 'dark' }));
const content = await readTextFile('/app/settings.json');

// Check existence
const fileExists = await exists('/app/settings.json');

// List directory contents
const entries = await readDir('/app/');
entries.forEach(entry => console.log(entry.name, entry.children));

// Create directories
await createDir('/app/backups/', { recursive: true });

// Delete a file
await removeFile('/app/old-data.json');

// Rename / move
await renameFile('/app/old.json', '/app/new.json');
```

### From Rust

```rust
use std::fs;

// Write — automatically goes to OPFS
fs::write("/app/data.txt", "hello world").unwrap();

// Read
let content = fs::read_to_string("/app/data.txt").unwrap();

// Create directory
fs::create_dir_all("/app/cache/").unwrap();

// List directory
for entry in fs::read_dir("/app/").unwrap() {
    let entry = entry.unwrap();
    println!("{}", entry.file_name().to_string_lossy());
}
```

> Files are private to your app's origin. Users on other websites cannot access them.

---

## SQLite

R1 supports SQLite via `@tauri-apps/plugin-sql` on the frontend and `rusqlite` on the Rust side. Data is stored in OPFS and persists across page refreshes.

### Frontend (JavaScript)

```bash
npm install @tauri-apps/plugin-sql
```

```typescript
import Database from '@tauri-apps/plugin-sql';

// Open (or create) a database
const db = await Database.load('sqlite:myapp.db');

// Create a table
await db.execute(`
    CREATE TABLE IF NOT EXISTS tasks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        done INTEGER DEFAULT 0
    )
`);

// Insert
await db.execute('INSERT INTO tasks (title) VALUES (?)', ['Buy groceries']);

// Query
const tasks = await db.select<{ id: number; title: string; done: number }[]>(
    'SELECT * FROM tasks WHERE done = ?', [0]
);

// Update
await db.execute('UPDATE tasks SET done = 1 WHERE id = ?', [1]);

// Delete
await db.execute('DELETE FROM tasks WHERE id = ?', [1]);
```

The import is automatically rewritten to `@r1-runtime/apis/sql` at build time.

### Rust side (rusqlite)

```toml
[dependencies]
rusqlite = { version = "0.31", features = ["bundled"] }
r1-macros = "0.3.0"
```

```rust
use rusqlite::{Connection, Result};
use r1_macros::command;
use serde::Serialize;

#[derive(Serialize)]
pub struct Task {
    pub id: i64,
    pub title: String,
    pub done: bool,
}

#[command]
pub fn get_tasks() -> Result<Vec<Task>, String> {
    let conn = Connection::open("/app/tasks.db").map_err(|e| e.to_string())?;
    conn.execute(
        "CREATE TABLE IF NOT EXISTS tasks (id INTEGER PRIMARY KEY, title TEXT, done INTEGER)",
        [],
    ).map_err(|e| e.to_string())?;

    let mut stmt = conn.prepare("SELECT id, title, done FROM tasks")
        .map_err(|e| e.to_string())?;

    let tasks = stmt.query_map([], |row| {
        Ok(Task {
            id: row.get(0)?,
            title: row.get(1)?,
            done: row.get::<_, i32>(2)? != 0,
        })
    }).map_err(|e| e.to_string())?
    .filter_map(|r| r.ok())
    .collect();

    Ok(tasks)
}
```

### Required deployment headers

SQLite uses `SharedArrayBuffer` internally. Your hosting provider must send these headers or SQLite falls back to in-memory mode (data lost on refresh):

```
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Embedder-Policy: require-corp
Cross-Origin-Resource-Policy: cross-origin
```

See [Deploying](#deploying) for platform-specific config.

---

## Store Plugin

The Store plugin is a simple key-value store backed by the VFS. Good for settings and small data.

```typescript
import { invoke } from '@tauri-apps/api/core';

// Set a value
await invoke('plugin:store|set', { store: 'settings', key: 'theme', value: 'dark' });

// Get a value
const theme = await invoke<string>('plugin:store|get', { store: 'settings', key: 'theme' });

// Check if a key exists
const hasKey = await invoke<boolean>('plugin:store|has', { store: 'settings', key: 'theme' });

// Delete a key
await invoke('plugin:store|delete', { store: 'settings', key: 'theme' });

// List all keys
const keys = await invoke<string[]>('plugin:store|keys', { store: 'settings' });
```

Each store is saved as a JSON file at `/.r1-store/<store-name>.json` in the VFS.

---

## Dialog

Dialogs are rendered as OS-themed modals matching the active window theme.

```typescript
import { message, ask, confirm, open, save } from '@tauri-apps/api/dialog';

// Info / warning / error message
await message('File saved.', { title: 'Saved', type: 'info' });
await message('Something went wrong.', { title: 'Error', type: 'error' });

// Yes/No question — returns boolean
const shouldDelete = await ask('Delete this file?', { title: 'Confirm', type: 'warning' });

// OK/Cancel — returns boolean
const confirmed = await confirm('Are you sure you want to quit?');

// File open picker — returns path string or null
const filePath = await open({
    multiple: false,
    filters: [{ name: 'JSON Files', extensions: ['json'] }],
});

// File save dialog — returns chosen path or null
const savePath = await save({
    defaultPath: '/app/export.json',
    filters: [{ name: 'JSON', extensions: ['json'] }],
});
```

---

## Clipboard

```typescript
import { readText, writeText } from '@tauri-apps/api/clipboard';

// Write to clipboard
await writeText('Hello from R1!');

// Read from clipboard
const text = await readText();
console.log(text); // "Hello from R1!"
```

Backed by `navigator.clipboard`. Requires user permission on first use.

---

## OS Info

```typescript
import { platform, arch, version, locale } from '@tauri-apps/api/os';

const os = await platform();   // 'linux' | 'darwin' | 'win32'
const cpu = await arch();      // 'x86_64' | 'aarch64' | ...
const ver = await version();   // OS version string
const lang = await locale();   // 'en-US' | 'fr-FR' | ...
```

Values are derived from `navigator.userAgent` and `navigator.language`.

---

## Window Manager

The Virtual Window Manager renders your app inside a native-looking OS window frame.

```typescript
import { appWindow } from '@tauri-apps/api/window';

// Set the title bar text
await appWindow.setTitle('My App — Untitled');

// Resize
await appWindow.setSize({ width: 1024, height: 768 });

// Window controls
await appWindow.minimize();
await appWindow.toggleMaximize();
await appWindow.close();
```

**Set the OS theme** in `vite.config.ts`:

```typescript
r1Plugin({
    rustSrc: './src-tauri',
    os: 'macos',   // 'macos' | 'windows' | 'linux' | 'auto'
})
```

`'auto'` (the default) detects the user's OS and applies the matching theme.

---

## Deploying

`npm run build` produces a static folder. Deploy it anywhere that serves static files.

```bash
# Vercel
npx vercel dist --prod

# Netlify
npx netlify deploy --dir=dist --prod

# GitHub Pages — push dist/ contents to gh-pages branch

# Local preview
npx serve dist -l 3000
```

> Press `Ctrl+F5` (Windows/Linux) or `Cmd+Shift+R` (Mac) on first load to register the Service Worker. Subsequent loads are normal.

### Headers for SQLite / OPFS

Required if your app uses SQLite or OPFS persistence:

**Netlify (`netlify.toml`):**

```toml
[[headers]]
  for = "/*"
  [headers.values]
    Cross-Origin-Opener-Policy = "same-origin"
    Cross-Origin-Embedder-Policy = "require-corp"
    Cross-Origin-Resource-Policy = "cross-origin"
```

**Vercel (`vercel.json`):**

```json
{
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        { "key": "Cross-Origin-Opener-Policy", "value": "same-origin" },
        { "key": "Cross-Origin-Embedder-Policy", "value": "require-corp" },
        { "key": "Cross-Origin-Resource-Policy", "value": "cross-origin" }
      ]
    }
  ]
}
```

**GitHub Pages** — GitHub Pages does not support custom headers. Use Netlify or Vercel for apps that need SQLite.

---

## Supported APIs

| API | Import | Status | Notes |
|---|---|---|---|
| `invoke` | `@tauri-apps/api/core` | ✅ Full | Tauri v1 and v2 |
| `listen` / `emit` | `@tauri-apps/api/event` | ✅ Full | |
| `fs` | `@tauri-apps/api/fs` | ✅ Full | Backed by OPFS |
| `path` | `@tauri-apps/api/path` | ✅ Full | Pure JS |
| `dialog` | `@tauri-apps/api/dialog` | ✅ Full | OS-themed modals |
| `clipboard` | `@tauri-apps/api/clipboard` | ✅ Full | `navigator.clipboard` |
| `os` | `@tauri-apps/api/os` | ✅ Full | `navigator.userAgent` |
| `window` | `@tauri-apps/api/window` | ✅ Full | Virtual window frame |
| `store` | `@tauri-apps/plugin-store` | ✅ Full | VFS-backed JSON |
| `sql` | `@tauri-apps/plugin-sql` | ✅ Full | SQLite via OPFS |
| `notification` | `@tauri-apps/api/notification` | ⚠️ Partial | Web Notifications API |
| `shell` | `@tauri-apps/api/shell` | ❌ Stubbed | Browser sandbox |
| `http` | `@tauri-apps/api/http` | ✅ Full | Mapped to `fetch` |

---

## Limitations

| Feature | Status | Reason |
|---|---|---|
| `std::fs` read/write | ✅ | Redirected to OPFS |
| `serde` / `serde_json` | ✅ | Core to the JSON bridge |
| Async Rust | ✅ | Via `wasm-bindgen-futures` |
| External crates | ✅ Most | Must compile to `wasm32-wasip1` |
| `std::time` | ✅ | Via WASI `clock_time_get` |
| `rand` | ✅ | Via `crypto.getRandomValues()` |
| HTTP requests | ✅ | Mapped to browser `fetch` |
| Multi-threading (`rayon`) | ❌ | WASM workers are single-threaded |
| Raw sockets | ❌ | Not available in browser |
| Child processes | ❌ | `shell::execute` is stubbed |
| System tray | ❌ | Not a browser concept |
| Global shortcuts | ❌ | Not available outside focus |
| Native OS libraries | ❌ | Must compile to WASM |

---

## Troubleshooting

**Build fails: `error: failed to run custom build command for tauri-build`**

Replace `src-tauri/build.rs` with:
```rust
fn main() {}
```

**Build fails: `error[E0432]: unresolved import`**

The `tauri` crate is being compiled into WASM. Move it to the native-only section:
```toml
[target.'cfg(not(target_arch = "wasm32"))'.dependencies]
tauri = { version = "2", features = [] }
```

**`invoke()` hangs forever**

Press `Ctrl+F5` to force Service Worker registration.

**`invoke()` returns `undefined`**

Your Rust function isn't returning a JSON string. Add:
```rust
serde_json::to_string(&your_value).unwrap()
```

**WASM panic in console**

Your Rust function called `.unwrap()` on a failed operation. Add proper error handling.

**SQLite data lost on refresh**

Your hosting provider isn't sending the required COOP/COEP/CORP headers. See the [Deploying](#deploying) section.

**`wasm-pack: command not found`**
```bash
cargo install wasm-pack
```
