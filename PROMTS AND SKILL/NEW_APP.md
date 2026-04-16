# R1 New App Prompt

**Instructions for the user**: Copy everything below the line and paste it to your AI agent. Describe what app you want to build at the bottom of the prompt.

---

## PROMPT — Build a New App With R1

```
You are building a new Tauri-compatible application using the R1 TauriWeb Runtime.
This app will run entirely in the browser — no installer, no server required.

Before writing any code, read the skill file at:
PROMTS AND SKILL/R1_SKILL.md

This file contains the complete R1 architecture, the Rust JSON contract,
supported APIs, and rules you must follow.

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
│   │   ├── lib.rs          ← Rust commands (use JSON contract)
│   │   └── main.rs         ← gated native entry point
│   ├── Cargo.toml          ← with wasm-bindgen, no build-dependencies
│   ├── build.rs            ← empty: fn main() {}
│   └── tauri.conf.json     ← standard Tauri config
├── index.html
├── package.json            ← with R1 packages linked
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

[target.'cfg(not(target_arch = "wasm32"))'.dependencies]
tauri = { version = "2", features = [] }

**IMPORTANT**: DO NOT add `rusqlite`, `sqlx`, or `diesel`! Native database crates cannot establish TCP or C-bindings in browser WASM. Any database logic must be performed in JS using `@tauri-apps/plugin-sql`.

STEP 3 — GENERATE THE RUST COMMANDS
Based on what I want to build, create the Rust commands in lib.rs.
Every command must follow the JSON contract from the skill file:
- Takes payload: &str
- Returns String (always valid JSON)
- Uses serde to decode input and encode output
- Handles errors gracefully — never panics

STEP 4 — GENERATE THE FRONTEND
Create the frontend using the same @tauri-apps/api imports a real Tauri app uses.
Do NOT use @r1 imports directly in the frontend — always use @tauri-apps/api.
The Vite plugin rewrites them automatically.

Example of correct frontend code:
import { invoke } from '@tauri-apps/api/core';
import { writeTextFile, readTextFile } from '@tauri-apps/api/fs';
import { listen } from '@tauri-apps/api/event';

STEP 5 — GENERATE PACKAGE.JSON
Include R1 package links (adjust path to where R1 is cloned):
{
  "dependencies": {
    "@r1/core": "file:../r1-tauriweb-runtime-v1/packages/core",
    "@r1/apis": "file:../r1-tauriweb-runtime-v1/packages/apis"
  },
  "devDependencies": {
    "@r1/vite-plugin": "file:../r1-tauriweb-runtime-v1/packages/vite-plugin"
  }
}

STEP 6 — GENERATE VITE.CONFIG.TS
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { r1Plugin } from '@r1/vite-plugin';

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

Also tell me what I should see in the browser console when it loads correctly.
```
