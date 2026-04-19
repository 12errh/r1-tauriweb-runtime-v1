# R1 TauriWeb Runtime — AI Agent Skill (v0.3.1)

> This file is the complete knowledge base for any AI agent working with R1.
> Read this entire file before making any changes to the R1 project.
> Every decision you make must be consistent with the rules in this document.

---

## What R1 Is

R1 is a browser-native runtime for Tauri applications. It compiles a Tauri
app's Rust backend to WebAssembly and runs it entirely in the browser — no
server, no installer, no native binary. The end user visits a URL and the
full Tauri app works in their browser tab.

```
Developer's Tauri App (Rust + React/Svelte/Vue)
         ↓  npm run build  (with R1 Vite plugin)
         ↓
Static folder (HTML + JS + .wasm)
         ↓  deploy to Vercel / Netlify / GitHub Pages
         ↓
End user visits URL → full app runs in browser
```

---

## Current Status (v0.3.1 - April 2026)

✅ **PRODUCTION READY - ALL PACKAGES PUBLISHED**

- **npm packages:** `@r1-runtime/*` (7 packages)
- **crates.io:** `r1-macros` v0.3.0
- **Tests:** 105+ passing
- **SQLite:** Full support with OPFS persistence
- **CLI:** `npx @r1-runtime/cli sync` for automatic migration

---

## Architecture (Memorise This)

```
Browser Main Thread
├── Your App (React / Svelte / Vue)
├── IPC Bridge — patches window.__TAURI_INTERNALS__
│   └── routes invoke() → Kernel Worker
└── R1Runtime.boot()

Kernel Worker (Web Worker — never the main thread)
├── Message Router
├── WasmOrchestrator
│   ├── Module Registry (Map<name, WasmInstance>)
│   ├── WASI Shim → redirects std::fs to OPFS
│   └── Event Bridge → Rust can emit to JS
└── VFS (Virtual File System)
    ├── Memory cache (fast reads)
    └── OPFS backend (persistent writes)

Service Worker
└── Intercepts asset:// URLs → serves from VFS
```

**Critical rules the agent must never violate:**
1. WASM never runs on the main thread — always in the Kernel Worker
2. All JS↔WASM data travels as JSON strings — no raw pointers
3. Every Rust panic must be caught at the JS boundary
4. WASI syscalls always redirect to OPFS — never real filesystem
5. Module Registry uses `Map<string, WasmModule>` — no global variables

---

## Package Structure

```
r1-tauriweb-runtime-v1/
├── packages/
│   ├── @r1-runtime/kernel/      ← Kernel Worker, WasmOrchestrator, VFS, WASI shim
│   ├── @r1-runtime/core/        ← IPC bridge, EventBus, R1Runtime, KernelProxy
│   ├── @r1-runtime/apis/        ← All Tauri API implementations (fs, path, event, sql…)
│   ├── @r1-runtime/sw/          ← Service Worker (asset:// protocol)
│   ├── @r1-runtime/window/      ← Virtual Window Manager + OS themes
│   ├── @r1-runtime/vite-plugin/ ← Build tooling, import patcher, WASM compiler
│   └── @r1-runtime/cli/         ← Migration CLI tool
├── templates/
│   └── r1-macros/               ← Proc macro crate for #[r1::command]
├── apps/
│   ├── todo-demo/               ← Reference working app
│   ├── phase6-test-app/         ← TaskFlow SQLite demo
│   └── demo/                    ← Technical showcase
└── tests/fixtures/wasm/         ← Pre-compiled test binaries
```

---

## Published Packages

### npm (@r1-runtime scope)

All packages are published to npm under the `@r1-runtime` scope:

1. **@r1-runtime/kernel** (v0.3.1)
   - WASM orchestration
   - Virtual File System (VFS) with OPFS
   - WASI shim for Rust std::fs
   - SQLite syscall support

2. **@r1-runtime/core** (v0.3.1)
   - IPC bridge
   - EventBus
   - Boot orchestration
   - Runtime initialization

3. **@r1-runtime/apis** (v0.3.1)
   - Complete Tauri API implementations
   - Direct imports: `@r1-runtime/apis/fs`, `@r1-runtime/apis/sql`, etc.
   - **Note:** Includes both `dist/` and `src/` for direct imports

4. **@r1-runtime/sw** (v0.3.1)
   - Service Worker for asset:// protocol
   - OPFS integration

5. **@r1-runtime/window** (v0.3.1)
   - Virtual Window Manager
   - OS themes (macOS, Windows 11, Linux)

6. **@r1-runtime/vite-plugin** (v0.3.1)
   - Automatic Rust→WASM compilation
   - Import patching
   - Boot script injection

7. **@r1-runtime/cli** (v0.3.1)
   - `npx @r1-runtime/cli sync` command
   - Automatic project migration
   - SQL import patching

### crates.io

- **r1-macros** (v0.3.0)
  - `#[r1::command]` proc macro
  - Automatic JSON serialization
  - Drop-in replacement for `#[tauri::command]`

---

## npx @r1-runtime/cli sync (v0.3+)

R1 includes a CLI tool that automatically migrates existing Tauri apps.

### Usage

```bash
# From your Tauri app directory
npx @r1-runtime/cli sync
```

### What the CLI Does

1. **Detects project configuration:**
   - Tauri version (v1 or v2)
   - Frontend framework (React, Svelte, Vue, etc.)
   - Number of Rust commands
   - SQLite usage

2. **Patches files automatically:**
   - `build.rs` → Emptied to `fn main() {}`
   - `Cargo.toml` → Adds WASM deps, gates native deps, adds r1-macros
   - `vite.config.ts` → Adds `@r1-runtime/vite-plugin`
   - `package.json` → Installs `@r1-runtime/core`, `@r1-runtime/apis`, `@r1-runtime/vite-plugin`
   - SQL imports → Converts `@tauri-apps/plugin-sql` to `@r1-runtime/apis/sql`

3. **Creates backups:**
   - All modified files get `.r1-backup` extension

### CLI Implementation Files

- `packages/cli/src/index.ts` - Main entry point
- `packages/cli/src/detect.ts` - Project detection
- `packages/cli/src/patch-build-rs.ts` - build.rs patcher
- `packages/cli/src/patch-cargo.ts` - Cargo.toml patcher
- `packages/cli/src/patch-vite.ts` - vite.config.ts patcher
- `packages/cli/src/patch-package.ts` - package.json patcher
- `packages/cli/src/patch-sql-imports.ts` - SQL import converter
- `packages/cli/src/rewrite-rust.ts` - Rust command rewriter (deprecated - use r1-macros)
- `packages/cli/src/utils.ts` - Shared utilities

---

## Rust Command Pattern (v0.3+)

### Using #[r1::command] Macro (Recommended)

```rust
use r1_macros::command;

#[command]
fn greet(name: String) -> String {
    format!("Hello, {}!", name)
}

#[command]
fn add(a: i32, b: i32) -> i32 {
    a + b
}

#[command]
fn get_user(id: u32) -> Result<User, String> {
    // ... implementation
}
```

The macro automatically:
- Generates `#[wasm_bindgen]` attribute
- Creates input struct from parameters
- Handles JSON deserialization
- Wraps return value in JSON
- Handles errors gracefully

### Manual Pattern (Legacy)

```rust
use wasm_bindgen::prelude::*;

#[wasm_bindgen]
pub fn greet(payload: &str) -> String {
    #[derive(serde::Deserialize)]
    struct Args { name: String }
    
    let args: Args = match serde_json::from_str(payload) {
        Ok(a) => a,
        Err(e) => return serde_json::json!({ "error": e.to_string() }).to_string(),
    };
    
    let result = format!("Hello, {}!", args.name);
    serde_json::to_string(&result).unwrap()
}
```

---

## SQLite Support (v0.3+)

R1 fully supports SQLite via `@sqlite.org/sqlite-wasm` with OPFS persistence.

### Rust Side (using rusqlite)

```toml
[dependencies]
rusqlite = { version = "0.31", features = ["bundled"] }
r1-macros = "0.3.0"
```

```rust
use rusqlite::{Connection, Result};
use r1_macros::command;

#[command]
fn create_table() -> Result<(), String> {
    let conn = Connection::open("/app/data/app.db")
        .map_err(|e| e.to_string())?;
    
    conn.execute(
        "CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY, name TEXT)",
        []
    ).map_err(|e| e.to_string())?;
    
    Ok(())
}

#[command]
fn insert_user(name: String) -> Result<i64, String> {
    let conn = Connection::open("/app/data/app.db")
        .map_err(|e| e.to_string())?;
    
    conn.execute("INSERT INTO users (name) VALUES (?1)", [&name])
        .map_err(|e| e.to_string())?;
    
    Ok(conn.last_insert_rowid())
}
```

### Frontend Side

```typescript
import { Database } from '@r1-runtime/apis/sql';

// Initialize database
const db = await Database.load('sqlite:app.db');

// Execute SQL
await db.execute('CREATE TABLE users (id INTEGER, name TEXT)');
await db.execute('INSERT INTO users VALUES (?, ?)', [1, 'Alice']);

// Query data
const rows = await db.select('SELECT * FROM users');
console.log(rows);
```

### WASI Syscalls for SQLite

The WASI shim implements all syscalls needed for SQLite:
- `fd_read`, `fd_write` - File I/O
- `fd_seek` - Seek with SEEK_SET, SEEK_CUR, SEEK_END
- `fd_tell` - Get current position
- `fd_sync` - Flush to storage
- `fd_close` - Close file descriptor
- `fd_filestat_get` - Get file metadata
- `fd_fdstat_get` - Get fd status
- `path_open` - Open file by path
- `path_filestat_get` - Stat file by path
- `path_create_directory` - Create directory
- `path_remove_file` - Delete file
- `path_rename` - Rename file (atomic)
- `clock_time_get` - Timestamps
- `random_get` - Randomness

---

## Tauri API Implementations

All APIs are in `packages/apis/src/`:

### File System (`@r1-runtime/apis/fs`)
- `readTextFile`, `writeTextFile`
- `readBinaryFile`, `writeBinaryFile`
- `readDir`, `createDir`, `removeDir`
- `exists`, `remove`, `rename`, `copyFile`

### SQL Database (`@r1-runtime/apis/sql`)
- `Database.load(path)` - Open database
- `db.execute(sql, params)` - Execute SQL
- `db.select(sql, params)` - Query data
- `db.close()` - Close connection

### Events (`@r1-runtime/apis/event`)
- `listen(event, handler)` - Listen for events
- `emit(event, payload)` - Emit events
- `once(event, handler)` - Listen once

### Dialog (`@r1-runtime/apis/dialog`)
- `open(options)` - File open dialog
- `save(options)` - File save dialog
- `message(text, options)` - Message box

### Path (`@r1-runtime/apis/path`)
- `appDataDir()`, `appCacheDir()`, `appLocalDataDir()`
- `join(...paths)`, `basename(path)`, `dirname(path)`
- `resolve(path)`, `normalize(path)`

### OS (`@r1-runtime/apis/os`)
- `platform()` - OS platform
- `arch()` - CPU architecture
- `version()` - OS version
- `type()` - OS type

### Clipboard (`@r1-runtime/apis/clipboard`)
- `writeText(text)` - Write to clipboard
- `readText()` - Read from clipboard

### Window (`@r1-runtime/apis/window`)
- `getCurrent()` - Get current window
- `getAll()` - Get all windows
- Window methods: `setTitle`, `setSize`, `center`, etc.

### Store (`@r1-runtime/apis/store`)
- `Store(path)` - Create store
- `store.set(key, value)` - Set value
- `store.get(key)` - Get value
- `store.save()` - Persist to disk

---

## Testing

### Test Structure

```
tests/
├── fixtures/
│   ├── rust/           ← Rust test modules
│   └── wasm/           ← Pre-compiled .wasm binaries
└── phase6-test-results.md
```

### Running Tests

```bash
# All tests
npm test

# Specific package
cd packages/kernel && npm test
cd packages/cli && npm test
```

### Test Count

- **Total:** 105+ tests
- **Kernel:** 85 tests (VFS, WASI, WASM orchestration, SQLite)
- **Core:** 8 tests (IPC bridge, EventBus)
- **APIs:** 4 tests (fs, path, event, store)
- **Vite Plugin:** 8 tests (import patching)
- **CLI:** 29 tests (SQL import patching, project detection)

---

## Build Process

### For R1 Development

```bash
# Install dependencies
npm install

# Build all packages
npm run build --workspaces

# Run tests
npm test
```

### For User Apps

```bash
# Migrate Tauri app
npx @r1-runtime/cli sync

# Install R1 packages
npm install

# Build (Vite plugin compiles Rust→WASM automatically)
npm run build

# Deploy dist/ folder
npx serve dist
```

---

## Critical Rules for AI Agents

### When Modifying R1 Core

1. **Never break the JSON contract:**
   - All Rust functions must accept `payload: &str`
   - All Rust functions must return `String` (JSON)
   - Use `#[r1::command]` macro for automatic serialization

2. **Never block the main thread:**
   - WASM execution always in Worker
   - Use `postMessage` for Worker communication
   - Never use `Atomics.wait` on main thread

3. **Always handle Rust panics:**
   - Wrap WASM calls in try-catch
   - Return error JSON: `{ "error": "message" }`
   - Never let panics crash the Worker

4. **Preserve OPFS integrity:**
   - All file paths start with `/`
   - Never expose real filesystem
   - Always use VFS methods

5. **Test before committing:**
   - Run `npm test` after any change
   - Verify no regressions
   - Update test count in README if adding tests

### When Helping Users Migrate Apps

1. **Always use the CLI first:**
   ```bash
   npx @r1-runtime/cli sync
   ```

2. **Check for unsupported APIs:**
   - Shell execution (not possible in browser)
   - System tray (not possible in browser)
   - Raw sockets (not possible in browser)

3. **Verify Cargo.toml:**
   - Must have `crate-type = ["cdylib", "rlib"]`
   - Must have `r1-macros = "0.3.0"`
   - Native deps must be gated with `cfg(not(target_arch = "wasm32"))`

4. **Verify package.json:**
   - Must have `@r1-runtime/core`
   - Must have `@r1-runtime/apis`
   - Must have `@r1-runtime/vite-plugin` in devDependencies

5. **Verify vite.config.ts:**
   ```typescript
   import { r1Plugin } from '@r1-runtime/vite-plugin';
   
   export default defineConfig({
     plugins: [
       r1Plugin({ rustSrc: './src-tauri' }),
       // ... other plugins
     ]
   });
   ```

### When Debugging Issues

1. **Check browser console first:**
   - Look for WASM loading errors
   - Check for IPC bridge errors
   - Verify r1:ready event fired

2. **Check Service Worker:**
   - DevTools → Application → Service Workers
   - Verify SW is registered
   - Check SW console logs

3. **Check OPFS:**
   - DevTools → Application → Storage → Origin Private File System
   - Verify files are being written
   - Check file sizes

4. **Common issues:**
   - **"Module not loaded"** → WASM didn't compile or load
   - **"Command not found"** → Function not exported or wrong name
   - **"JSON parse error"** → Rust returned invalid JSON
   - **"OPFS not available"** → Browser doesn't support OPFS (use Chrome/Edge)

---

## Version History

### v0.3.1 (Current)
- Added README files to all packages
- Republished to npm with documentation

### v0.3.0 (April 2026)
- Published all packages to npm and crates.io
- SQLite support with OPFS persistence
- CLI tool for automatic migration
- `#[r1::command]` proc macro
- 105+ tests passing

### v0.2.0 (March 2026)
- Complete Tauri API implementations
- Barrel exports
- Vite plugin
- Virtual Window Manager
- 63 tests

### v0.1.0 (February 2026)
- Initial release
- Basic WASM orchestration
- VFS with OPFS
- WASI shim
- IPC bridge

---

## Links

- **npm packages:** https://www.npmjs.com/~r1-runtime
- **crates.io:** https://crates.io/crates/r1-macros
- **GitHub:** https://github.com/12errh/r1-tauriweb-runtime-v1
- **Live Demo:** https://todo-demo-by-r1-runtime.netlify.app/
- **Documentation:** See README.md, GETTING_STARTED.md, USAGE_GUIDE.md

---

## Final Notes for AI Agents

- **Always read this file first** before making any changes
- **Follow the patterns** shown in existing code
- **Test thoroughly** - run `npm test` after every change
- **Update documentation** when adding features
- **Ask for clarification** if something is unclear
- **Never guess** - check the code to verify behavior

**R1 is production-ready. Treat it with care.**
