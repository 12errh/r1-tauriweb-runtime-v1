# R1 SQLite Migration Prompt (v0.3.0)

> This prompt is for AI agents to migrate an existing Tauri + SQLite app to the R1 Runtime.

## Context
The user wants to migrate their Tauri application which uses `rusqlite`, `sqlx`, or `@tauri-apps/plugin-sql` to the R1 Runtime natively in the browser.

## Step 1: Architectural Assessment
If the app uses `rusqlite`, `sqlx`, or `diesel` via Rust, you MUST inform the user that **native database connections via Rust are blocked in WASM**. Browsers cannot open raw TCP sockets, and C-compilation inside WASM is unstable.

## Step 2: Rust Migration (Deletion)
1. Remove `rusqlite`, `sqlx`, `diesel`, etc. from `Cargo.toml`.
2. Remove all Rust endpoints (`#[tauri::command]`) that perform database lookups from `src-tauri/src/main.rs` and `lib.rs`.
3. If the app heavily relies on Rust state for DB connection pools, delete it for WASM targets (`cfg(not(target_arch = "wasm32"))`).

## Step 3: Frontend Migration
R1 uses the official `@sqlite.org/sqlite-wasm` module dynamically injected when you use `@tauri-apps/plugin-sql` in the frontend JS/TS.

1. **Install `@tauri-apps/plugin-sql` in `package.json`.**
2. In the Javascript/Typescript, replace all `invoke('get_db_data')` calls with actual SQL executions:
```typescript
import Database from '@tauri-apps/plugin-sql';
const db = await Database.load('sqlite:myapp.db');
const rows = await db.select('SELECT * FROM users');
```

## Step 4: Vite Integration
Add `r1Plugin({ rustSrc: './src-tauri' })` to `vite.config.ts`.
This plugin will automatically map `@tauri-apps/plugin-sql` to OPFS.

## Step 5: Test
Run `npm run build` and `npx serve dist -l 3000`.
No LLVM, no WASI SDK, no C-compilers are needed.
