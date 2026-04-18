# R1 Migration Prompt

**Instructions for the user**: Copy everything below the line and paste it to your AI agent (Claude, Cursor, Copilot, etc.). The agent will automatically configure your Tauri app to run with R1.

---

## PROMPT — Migrate My Tauri App to R1

```
You are configuring a Tauri application to run in the browser using the R1 TauriWeb Runtime.

Before making any changes, read the skill file at:
PROMTS AND SKILL/R1_SKILL.md

This file contains everything you need to know about R1 — the architecture,
the required changes, supported APIs, and common error patterns.

After reading the skill file, do the following:

STEP 1 — ANALYZE THE APP
Read these files and report what you find:
- src-tauri/Cargo.toml (what dependencies does it use?)
- src-tauri/build.rs (what does the build script do?)
- src-tauri/src/lib.rs or src-tauri/src/main.rs (what Tauri commands exist?)
- package.json (what @tauri-apps packages are imported?)
- vite.config.ts (what plugins are already configured?)
- Any .svelte, .tsx, .vue files that import from @tauri-apps (what APIs are used?)

Then tell me:
1. Which Tauri APIs this app uses (invoke, fs, path, event, window, dialog, etc.)
2. Whether any of those APIs are NOT supported by R1 v0.3 (check the skill file)
3. Whether the app uses SQLite (if yes, R1 v0.3 supports it via @tauri-apps/plugin-sql)
4. The Tauri version (v1 or v2) — check the tauri version in Cargo.toml
5. Whether I should use `npx r1 sync` CLI for automatic migration (recommended)

STEP 2 — APPLY THE 3 REQUIRED CHANGES
Apply all 3 of these changes. Do not skip any.

Change 1: Replace src-tauri/build.rs with:
fn main() {}

Change 2: In src-tauri/Cargo.toml:
- Remove the entire [build-dependencies] block
- Add [lib] section with crate-type = ["cdylib", "rlib"]
- Add wasm-bindgen, serde, serde_json to [dependencies]
- Move tauri and all other native deps to [target.'cfg(not(target_arch = "wasm32"))'.dependencies]

Change 3: In vite.config.ts:
- Import r1Plugin from '@r1/vite-plugin'
- Add r1Plugin({ rustSrc: './src-tauri' }) to the plugins array

Change 4: In package.json:
- Add "@r1/core": "file:../r1-tauriweb-runtime-v1/packages/core" to dependencies
- Add "@r1/apis": "file:../r1-tauriweb-runtime-v1/packages/apis" to dependencies
- Add "@r1/vite-plugin": "file:../r1-tauriweb-runtime-v1/packages/vite-plugin" to devDependencies
(Adjust the path ../r1-tauriweb-runtime-v1 to match where R1 is cloned on this machine)

STEP 3 — REWRITE THE RUST COMMANDS
For each Tauri command in lib.rs or main.rs, rewrite it to use the R1 JSON contract:

BEFORE (standard Tauri):
#[tauri::command]
fn greet(name: String) -> String {
    format!("Hello, {}!", name)
}

AFTER (R1 JSON contract):
use wasm_bindgen::prelude::*;
use serde::{Serialize, Deserialize};

#[derive(Deserialize)]
struct GreetArgs { name: String }

#[wasm_bindgen]
pub fn greet(payload: &str) -> String {
    let args: GreetArgs = match serde_json::from_str(payload) {
        Ok(a) => a,
        Err(e) => return serde_json::json!({ "error": e.to_string() }).to_string(),
    };
    serde_json::to_string(&format!("Hello, {}!", args.name)).unwrap()
}

Gate the native run() function:
#[cfg(not(target_arch = "wasm32"))]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![/* commands */])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

STEP 4 — VERIFY AND REPORT
After making all changes, tell me:
1. Which files you changed and what you changed in each one
2. Any APIs the app uses that R1 does not support (the user needs to know this)
3. Any TypeScript config issues you spotted (deprecated tsconfig options, etc.)
4. The exact commands to run to build and test the app

DO NOT change any frontend import statements — R1's Vite plugin rewrites them automatically.
DO NOT change any invoke() calls in the frontend — the IPC bridge handles them.
DO NOT add `rusqlite`, `sqlx`, or `diesel` to Cargo.toml for SQLite/DB support.
Native Rust databases cannot work over WASM due to strict browser TCP/Sandbox limits.
R1 uses `@sqlite.org/sqlite-wasm` via the official JS API.
You MUST install `@tauri-apps/plugin-sql` in the frontend and migrate all Rust SQL logic to Svelte/React TS code calling `Database.load()`.
```
