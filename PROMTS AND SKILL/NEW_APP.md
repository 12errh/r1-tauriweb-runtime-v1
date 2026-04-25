# R1 New App Prompt (v0.3.7)

**Instructions for the user**: Copy everything below the line and paste it to your AI agent. Describe what app you want to build at the bottom of the prompt.

---

## PROMPT — Build a New App With R1

```
You are building a new Tauri-compatible application using the R1 TauriWeb Runtime v0.3.7.
This app will run entirely in the browser — no installer, no server required.

Before writing any code, read the skill file at:
PROMTS AND SKILL/R1_SKILL.md

This file contains the complete R1 architecture, the Rust command pattern using
#[r1::command] macro, supported APIs, and rules you must follow.

WHAT I WANT TO BUILD:
[USER: DESCRIBE YOUR APP HERE — e.g., "A note-taking app where users can create,
edit, and delete notes. Notes should persist across browser refreshes.
The UI should be in React with TypeScript."]

STEP 1 — SCAFFOLD THE PROJECT
Create a new project with this structure:
my-app/
├── src/                    ← React/Svelte/Vue frontend
│   ├── App.tsx
│   └── main.tsx
├── src-tauri/
│   ├── src/
│   │   ├── lib.rs          ← Rust commands (use #[r1::command] macro)
│   │   └── main.rs         ← gated native entry point
│   ├── Cargo.toml          ← with r1-macros, wasm-bindgen
│   ├── build.rs            ← empty: fn main() {}
│   └── tauri.conf.json     ← standard Tauri config
├── index.html
├── package.json            ← with @r1-runtime/* packages
├── vite.config.ts          ← with r1Plugin()
└── tsconfig.json

STEP 2 — GENERATE THE CARGO.TOML
Use this exact template:
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

[target.'cfg(not(target_arch = "wasm32"))'.dependencies]
tauri = { version = "2", features = [] }

**IMPORTANT**: DO NOT add `rusqlite`, `sqlx`, or `diesel` without the bundled/wasm features!
For SQLite, use rusqlite with "bundled" feature or use @r1-runtime/apis/sql from JavaScript.

STEP 3 — GENERATE THE RUST COMMANDS
Based on what I want to build, create the Rust commands in lib.rs.
Use the #[r1::command] macro for automatic JSON serialization:

use r1_macros::command;

#[command]
fn my_function(param: String) -> String {
    format!("Result: {}", param)
}

#[command]
fn another_function(a: i32, b: i32) -> Result<i32, String> {
    if b == 0 {
        Err("Division by zero".to_string())
    } else {
        Ok(a / b)
    }
}

The macro handles all JSON serialization automatically.

STEP 4 — GENERATE THE FRONTEND
Create the frontend using the same @tauri-apps/api imports a real Tauri app uses.
Do NOT use @r1-runtime imports directly in the frontend — always use @tauri-apps/api.
The Vite plugin rewrites them automatically.

Example of correct frontend code:
import { invoke } from '@tauri-apps/api/core';
import { writeTextFile, readTextFile } from '@tauri-apps/api/fs';
import { listen } from '@tauri-apps/api/event';

STEP 5 — GENERATE PACKAGE.JSON
Install R1 packages from npm:
{
  "dependencies": {
    "@r1-runtime/core": "^0.3.4",
    "@r1-runtime/apis": "^0.3.2"
  },
  "devDependencies": {
    "@r1-runtime/vite-plugin": "^0.3.5"
  }
}

STEP 6 — GENERATE VITE.CONFIG.TS
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { r1Plugin } from '@r1-runtime/vite-plugin';

export default defineConfig({
  plugins: [
    react(),
    r1Plugin({ rustSrc: './src-tauri' })
  ]
});

STEP 7 — TELL ME HOW TO RUN IT
Provide the exact commands in order:
1. npm install
2. npm run build
3. npx serve dist -l 3000
4. Open http://localhost:3000 and press Ctrl+F5

Also tell me what I should see in the browser console when it loads correctly:
- [R1] Booting Runtime...
- [R1] Service Worker registered
- [R1] Loading WASM from /wasm/my_app_lib.js...
- [R1] Boot complete

STEP 8 — VERIFY THE SETUP
Check that:
1. Cargo.toml has r1-macros = "0.3.0"
2. All Rust functions use #[command] macro
3. package.json has @r1-runtime/* packages (not @r1/*)
4. vite.config.ts imports from @r1-runtime/vite-plugin
5. Frontend imports from @tauri-apps/api (not @r1-runtime/apis)
```

---

## Quick Reference

### Rust Command Pattern
```rust
use r1_macros::command;

#[command]
fn function_name(param: Type) -> ReturnType {
    // implementation
}
```

### Frontend Imports (Always use @tauri-apps/api)
```typescript
import { invoke } from '@tauri-apps/api/core';
import { readTextFile } from '@tauri-apps/api/fs';
import { listen } from '@tauri-apps/api/event';
```

### Package Installation
```bash
npm install @r1-runtime/core @r1-runtime/apis
npm install --save-dev @r1-runtime/vite-plugin
```
