# R1 TauriWeb Runtime — AI Agent Guide

> This guide explains how to use AI agents with R1 to configure, build,
> debug, and extend Tauri apps for the browser.

---

## Overview

R1 is designed to work with AI agents. Every file an agent needs to understand
the system, make correct changes, and avoid common mistakes is included in
this repository.

The workflow is simple:
1. The agent reads the skill file to understand R1
2. The user pastes a prompt describing what they want
3. The agent applies the correct changes automatically
4. The user runs the build commands and gets a working browser app

---

## File Structure for AI Integration

```
r1-tauriweb-runtime-v1/
├── PROMTS AND SKILL/
│   ├── R1_SKILL.md            ← The agent reads this FIRST
│   ├── MIGRATE_APP.md         ← Migrate existing Tauri app to R1
│   ├── NEW_APP.md             ← Build a new app with R1 from scratch
│   └── DEBUG.md               ← Debug a broken R1 build
└── AI_GUIDE.md                ← This guide
```

---

## How To Use Each Prompt

### Migrating an Existing Tauri App

You have a working Tauri desktop app and want to run it in the browser.

1. Clone R1:
   ```bash
   git clone https://github.com/12errh/r1-tauriweb-runtime-v1.git
   cd r1-tauriweb-runtime-v1
   npm install && npm run build
   ```

2. Open your Tauri app in your AI editor (Cursor, VS Code with Copilot, etc.)

3. Open `PROMTS AND SKILL/MIGRATE_APP.md` and copy the entire prompt block

4. Paste it to your AI agent

5. The agent will:
   - Read `R1_SKILL.md` to understand R1
   - Analyse your app's dependencies and commands
   - Apply the 3 required changes automatically
   - Rewrite your Rust commands to the JSON contract
   - Warn you about any unsupported APIs

6. Run the commands the agent tells you to run

---

### Building a New App With R1

You want to build a new app that runs in the browser from the start.

1. Open `PROMTS AND SKILL/NEW_APP.md`

2. Copy the prompt block

3. At the bottom of the prompt, describe what you want to build:
   ```
   WHAT I WANT TO BUILD:
   A note-taking app where users can create, edit, and delete notes.
   Notes should persist. React + TypeScript frontend.
   ```

4. Paste to your AI agent

5. The agent scaffolds the entire project — frontend, Rust backend, config files — all R1-compatible from the start

---

### Debugging a Broken Build

Your `npm run build` fails or the browser shows errors.

1. Open `PROMTS AND SKILL/DEBUG.md`

2. Copy the prompt block

3. Paste your error output at the bottom of the prompt

4. Paste to your AI agent

5. The agent classifies the error, finds the root cause, and applies the fix

---

## Which AI Agents Work Best

R1's prompts are designed to work with any code-aware AI agent. These are
tested and recommended:

| Agent | Best For | How To Use |
|---|---|---|
| **Cursor** | Full project migration — reads all files automatically | Paste prompt into Cursor's AI chat |
| **Claude (claude.ai)** | Understanding R1 architecture + targeted fixes | Paste prompt + attach relevant files |
| **GitHub Copilot** | In-editor changes to specific files | Use the inline chat with the prompt |
| **Aider** | Command-line migration of entire projects | `aider --message "$(cat prompts/MIGRATE_APP.md)"` |

---

## The Skill File — What It Contains

`R1_SKILL.md` is the single source of truth for any AI agent working with R1.
It contains:

- **Full architecture diagram** — Kernel Worker, VFS, IPC bridge, Service Worker
- **The 3 required setup changes** — build.rs, Cargo.toml, vite.config.ts (or use `npx r1 sync` CLI)
- **The Rust JSON contract** — exactly how every command must be written
- **Supported API list** — which `@tauri-apps/api` imports work in v0.3
- **Import patcher map** — what the Vite plugin rewrites
- **VFS path mapping** — how OS paths map to browser paths
- **CLI usage** — how to use `npx r1 sync` for automatic migration
- **Common error patterns** — every known error with its fix
- **Build verification checklist** — what success looks like
- **Rules the agent must never break** — guardrails

An agent that reads `R1_SKILL.md` completely before making changes will
get the migration right on the first attempt in most cases.

---

## What Agents Get Right Automatically

When using R1 prompts, agents correctly handle:

✅ Emptying `build.rs`
✅ Removing `[build-dependencies]` from `Cargo.toml`
✅ Adding `wasm-bindgen`, `serde`, `serde_json` dependencies
✅ Gating `tauri` behind `cfg(not(target_arch = "wasm32"))`
✅ Adding `[lib]` section with correct `crate-type`
✅ Adding `r1Plugin()` to `vite.config.ts`
✅ Linking R1 packages in `package.json`
✅ Rewriting Rust commands to the JSON contract
✅ Creating `lib.rs` if the app only has `main.rs`
✅ Gating the native `run()` function behind `cfg`

---

## What Agents Commonly Get Wrong

These are the mistakes agents make without reading `R1_SKILL.md`:

❌ Changing frontend `invoke()` calls — never needed, Vite plugin handles it
❌ Changing `@tauri-apps/api` import statements — Vite plugin rewrites automatically
❌ Forgetting to rebuild R1 packages after changing them
❌ Loading `app.js` instead of `app_bg.wasm` (the WASM binary)
❌ Using `.unwrap()` in WASM functions without error handling
❌ Adding native Rust SQLite dependencies like `rusqlite`/`sqlx` (unsupported due to WASM TCP limits. Use `@tauri-apps/plugin-sql` in Javascript instead).
❌ Putting WASM execution on the main thread

The prompts include explicit "DO NOT" instructions to prevent these mistakes.

---

## Extending R1 With an Agent

If a Tauri API is missing from R1 (a new app needs it), use this prompt:

```
Read PROMTS AND SKILL/R1_SKILL.md first.

The app I'm migrating uses this Tauri API that R1 doesn't support yet:
[DESCRIBE THE MISSING API — e.g., "@tauri-apps/api/http fetch()"]

Add it to R1 following this pattern:
1. Create packages/apis/src/<module>.ts with:
   - A KernelPlugin class with getCommands() for invoke() calls
   - Top-level named exports for direct import() calls
   - Use the VFS singleton pattern from fs.ts as a template
2. Add the import mapping to packages/vite-plugin/src/index.ts
3. Export the new module from packages/apis/src/index.ts
4. Rebuild: cd r1-tauriweb-runtime-v1 && npm run build

Then verify the new API works by:
- Importing it in the test app with the original @tauri-apps/api path
- Confirming the Vite plugin rewrites it correctly
- Confirming the function returns the expected result
```

---

## Current R1 Version

**v0.3** — API and SQLite compatibility layer complete

What works in v0.3:
- SQLite via WASM + OPFS (via `@tauri-apps/plugin-sql`)
- `invoke()` — Tauri v1 and v2
- `fs` — read, write, list, delete, copy, rename
- `path` — all directory functions + path manipulation
- `event` — emit, listen, once, unlisten
- `window` — appWindow + WebviewWindow class
- `dialog` — message, ask, confirm, open, save
- `clipboard` — read and write text
- `os` — platform, arch, locale, version
- `store` — Store class with full CRUD
- `notification` — via Web Notifications API
- `http` — via browser fetch
- `shell.open` — via window.open

Coming Soon:
- `npx r1 sync` CLI migration tool
- `#[r1::command]` macro — eliminates JSON contract boilerplate
- npm publishing — install without local clone
