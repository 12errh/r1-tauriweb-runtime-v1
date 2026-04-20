# R1 TauriWeb Runtime — AI Agent Guide (v0.3.2)

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
│   ├── NEW_APP_SQLITE.md      ← Build a new app with SQLite
│   ├── SQLITE_MIGRATION.md    ← Add SQLite to existing R1 app
│   ├── DEBUG.md               ← Debug a broken R1 build
│   └── AI_GUIDE.md            ← This guide
```

---

## How To Use Each Prompt

### Migrating an Existing Tauri App (Recommended: Use CLI)

You have a working Tauri desktop app and want to run it in the browser.

**Quick Method (v0.3+):**
```bash
cd your-tauri-app
npx @r1-runtime/cli sync
npm install
npm run build
npx serve dist
```

**AI-Assisted Method:**
1. Open your Tauri app in your AI editor (Cursor, VS Code with Copilot, etc.)
2. Open `PROMTS AND SKILL/MIGRATE_APP.md` and copy the entire prompt block
3. Paste it to your AI agent
4. The agent will:
   - Read `R1_SKILL.md` to understand R1
   - Recommend using `npx @r1-runtime/cli sync`
   - If CLI fails, apply manual migration steps
   - Rewrite Rust commands to use `#[r1::command]` macro
   - Warn you about any unsupported APIs
5. Run the commands the agent tells you to run

---

### Building a New App With R1

You want to build a new app that runs in the browser from the start.

1. Open `PROMTS AND SKILL/NEW_APP.md` (or `NEW_APP_SQLITE.md` if you need SQLite)
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
| **Aider** | Command-line migration of entire projects | `aider --message "$(cat PROMTS\ AND\ SKILL/MIGRATE_APP.md)"` |

---

## The Skill File — What It Contains

`R1_SKILL.md` is the single source of truth for any AI agent working with R1.
It contains:

- **Full architecture diagram** — Kernel Worker, VFS, IPC bridge, Service Worker
- **Published package information** — All `@r1-runtime/*` packages on npm
- **CLI usage** — How to use `npx @r1-runtime/cli sync` for automatic migration
- **The Rust command pattern** — Using `#[r1::command]` macro
- **Supported API list** — Which `@tauri-apps/api` imports work in v0.3
- **SQLite support** — Complete guide for using SQLite with OPFS
- **VFS path mapping** — How OS paths map to browser paths
- **Common error patterns** — Every known error with its fix
- **Build verification checklist** — What success looks like
- **Rules the agent must never break** — Guardrails

An agent that reads `R1_SKILL.md` completely before making changes will
get the migration right on the first attempt in most cases.

---

## What Agents Get Right Automatically

When using R1 prompts, agents correctly handle:

✅ Using `npx @r1-runtime/cli sync` for automatic migration
✅ Installing packages from npm: `@r1-runtime/core`, `@r1-runtime/apis`
✅ Using `#[r1::command]` macro for Rust commands
✅ Adding `r1-macros = "0.3.0"` to Cargo.toml
✅ Emptying `build.rs` to `fn main() {}`
✅ Removing `[build-dependencies]` from `Cargo.toml`
✅ Adding `wasm-bindgen`, `serde`, `serde_json` dependencies
✅ Gating `tauri` behind `cfg(not(target_arch = "wasm32"))`
✅ Adding `[lib]` section with correct `crate-type`
✅ Adding `r1Plugin()` to `vite.config.ts`
✅ Converting SQL imports from `@tauri-apps/plugin-sql` to `@r1-runtime/apis/sql`
✅ Creating `lib.rs` if the app only has `main.rs`
✅ Gating the native `run()` function behind `cfg`

---

## What Agents Commonly Get Wrong

These are the mistakes agents make without reading `R1_SKILL.md`:

❌ Changing frontend `invoke()` calls — never needed, Vite plugin handles it
❌ Changing `@tauri-apps/api` import statements — Vite plugin rewrites automatically
❌ Using old package names `@r1/*` instead of `@r1-runtime/*`
❌ Forgetting to add `r1-macros` to Cargo.toml
❌ Using manual JSON serialization instead of `#[r1::command]` macro
❌ Loading `app.js` instead of `app_bg.wasm` (the WASM binary)
❌ Using `.unwrap()` in WASM functions without error handling
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
4. Rebuild: npm run build --workspaces

Then verify the new API works by:
- Importing it in the test app with the original @tauri-apps/api path
- Confirming the Vite plugin rewrites it correctly
- Confirming the function returns the expected result
```

---

## Current R1 Version

**v0.3.2** — Production ready, all packages published

### What Works in v0.3.2:

✅ **Core Features:**
- `invoke()` — Tauri v1 and v2 compatible
- SQLite via `@r1-runtime/apis/sql` with OPFS persistence
- `#[r1::command]` macro for automatic JSON serialization
- `npx @r1-runtime/cli sync` for automatic migration

✅ **Tauri APIs:**
- `fs` — read, write, list, delete, copy, rename
- `path` — all directory functions + path manipulation
- `event` — emit, listen, once, unlisten
- `window` — appWindow + WebviewWindow class
- `dialog` — message, ask, confirm, open, save
- `clipboard` — read and write text
- `os` — platform, arch, locale, version
- `store` — Store class with full CRUD
- `sql` — Database class with full SQL support
- `notification` — via Web Notifications API
- `http` — via browser fetch
- `shell.open` — via window.open

❌ **Not Supported (Browser Limitations):**
- Shell execution (`shell.execute`)
- System tray
- Global shortcuts
- Raw sockets
- Child processes
- Direct filesystem access outside OPFS

### Published Packages:

**npm (@r1-runtime):**
- `@r1-runtime/kernel` v0.3.1
- `@r1-runtime/core` v0.3.1
- `@r1-runtime/apis` v0.3.1
- `@r1-runtime/sw` v0.3.1
- `@r1-runtime/window` v0.3.1
- `@r1-runtime/vite-plugin` **v0.3.2** ← use this version
- `@r1-runtime/cli` **v0.3.2** ← use this version

**crates.io:**
- `r1-macros` v0.3.0

---

## Quick Reference

### Installation
```bash
npm install @r1-runtime/core @r1-runtime/apis
npm install --save-dev @r1-runtime/vite-plugin
```

### CLI Migration
```bash
npx @r1-runtime/cli sync
```

### Rust Command
```rust
use r1_macros::command;

#[command]
fn my_function(param: String) -> String {
    format!("Result: {}", param)
}
```

### SQL Usage
```typescript
// Always use @tauri-apps/plugin-sql in your source code.
// The Vite plugin rewrites it to @r1-runtime/apis/sql at build time.
import Database from '@tauri-apps/plugin-sql';

const db = await Database.load('sqlite:app.db');
await db.execute('CREATE TABLE IF NOT EXISTS users (id INTEGER, name TEXT)');
```

---

## Links

- **npm packages:** https://www.npmjs.com/~r1-runtime
- **crates.io:** https://crates.io/crates/r1-macros
- **GitHub:** https://github.com/12errh/r1-tauriweb-runtime-v1
- **Live Demo:** https://todo-demo-by-r1-runtime.netlify.app/
- **Documentation:** See R1_SKILL.md for complete reference

---

## Tips for AI Agents

1. **Always read R1_SKILL.md first** — It contains everything you need
2. **Use the CLI when possible** — `npx @r1-runtime/cli sync` handles most migrations
3. **Use `#[r1::command]` macro** — Don't write manual JSON serialization
4. **Install from npm** — Use `@r1-runtime/*` packages, not local paths
5. **Test after changes** — Run `npm run build` to verify
6. **Check browser console** — Most errors show up there first
7. **Verify OPFS support** — Use Chrome/Edge for testing

**R1 is production-ready. Help users migrate their apps confidently.**
