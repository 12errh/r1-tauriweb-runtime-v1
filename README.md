# R1 TauriWeb Runtime

> Run your Tauri app in the browser. No server. No installer. Just a URL.

[![npm](https://img.shields.io/npm/v/@r1-runtime/core?label=npm%20core)](https://www.npmjs.com/package/@r1-runtime/core)
[![npm cli](https://img.shields.io/npm/v/@r1-runtime/cli?label=npm%20cli)](https://www.npmjs.com/package/@r1-runtime/cli)
[![crates.io](https://img.shields.io/crates/v/r1-macros?label=crates.io)](https://crates.io/crates/r1-macros)
[![Tests](https://img.shields.io/badge/tests-105%20passed-brightgreen)](https://github.com/12errh/r1-tauriweb-runtime-v1)
[![MIT License](https://img.shields.io/badge/license-MIT-blue)](LICENSE)
[![Live Demo](https://img.shields.io/badge/demo-live-orange)](https://todo-demo-by-r1-runtime.netlify.app/)

**[▶ Live Demo](https://todo-demo-by-r1-runtime.netlify.app/)** — a real Tauri todo app with a Rust + SQLite backend, running entirely in your browser.

---

## What is R1?

R1 is a runtime that lets you deploy Tauri desktop apps as static websites. You write a standard Tauri app — Rust backend, React/Vue/Svelte frontend — and R1 compiles the Rust to WebAssembly and runs it in the browser.

Your users visit a URL. No download. No installer. No trust prompt.

```
Your Tauri App
      │
      ▼  npm run build  (R1 compiles Rust → WASM automatically)
      │
      ▼  deploy to Vercel / Netlify / GitHub Pages
      │
      ▼  user visits URL → full app runs in browser
```

---

## Quick Start

### Migrate an existing Tauri app

```bash
cd your-tauri-app
npx @r1-runtime/cli sync
npm install
npm run build
npx serve dist -l 3000
```

Open **http://localhost:3000** and press `Ctrl+F5` on first load.

### Start from scratch

```bash
npm create tauri-app@latest my-app -- --template react-ts --yes
cd my-app
npx @r1-runtime/cli sync
npm install
npm run build
npx serve dist -l 3000
```

That's it. See [GETTING_STARTED.md](./GETTING_STARTED.md) for a full walkthrough.

---

## How It Works

The browser can't run a native Rust binary. R1 solves this with a layered architecture:

| Layer | What it does |
|---|---|
| **Vite Plugin** | Compiles `src-tauri/` to WebAssembly during `npm run build` |
| **Kernel Worker** | Runs all WASM in a Web Worker — UI thread never blocks |
| **WASI Shim** | Intercepts `std::fs` calls and redirects them to OPFS |
| **IPC Bridge** | Patches `window.__TAURI_INTERNALS__` so `invoke()` works unchanged |
| **Event Bridge** | Lets Rust emit events back to JavaScript via `listen()` |
| **Service Worker** | Intercepts `asset://` URLs and serves files from the VFS |
| **VFS** | In-memory cache backed by OPFS for persistent storage |

```
Your Frontend (React/Vue/Svelte)
      │ invoke('command', args)
      ▼
IPC Bridge ──► Kernel Worker ──► WASM (your Rust code)
                    │                    │
                   VFS              WASI Shim
                 (OPFS)          (std::fs → OPFS)
```

---

## Features

| Feature | Status |
|---|---|
| `invoke()` — Tauri v1 and v2 compatible | ✅ |
| `std::fs` read/write from Rust | ✅ |
| Rust → JS event bridge (`emit` / `listen`) | ✅ |
| SQLite with OPFS persistence | ✅ |
| Persistent storage + data loss prevention | ✅ |
| Virtual Window Manager (macOS, Windows 11, Linux themes) | ✅ |
| Tauri APIs: `fs`, `event`, `store`, `os`, `path`, `dialog`, `clipboard` | ✅ |
| WASM panic isolation | ✅ |
| Automatic Rust → WASM compilation via Vite plugin | ✅ |
| One-command migration: `npx @r1-runtime/cli sync` | ✅ |
| `#[r1::command]` proc macro for automatic serialization | ✅ |
| 105 tests passing | ✅ |

---

## Published Packages

All packages are live on npm and crates.io.

### npm — `@r1-runtime/*`

| Package | Version | Description |
|---|---|---|
| [`@r1-runtime/kernel`](https://www.npmjs.com/package/@r1-runtime/kernel) | 0.3.1 | WASM orchestration, VFS, WASI shim |
| [`@r1-runtime/core`](https://www.npmjs.com/package/@r1-runtime/core) | 0.3.1 | IPC bridge, EventBus, boot runtime |
| [`@r1-runtime/apis`](https://www.npmjs.com/package/@r1-runtime/apis) | 0.3.1 | Tauri API shims (fs, event, dialog…) |
| [`@r1-runtime/sw`](https://www.npmjs.com/package/@r1-runtime/sw) | 0.3.1 | Service Worker for `asset://` protocol |
| [`@r1-runtime/window`](https://www.npmjs.com/package/@r1-runtime/window) | 0.3.1 | Virtual Window Manager + OS themes |
| [`@r1-runtime/vite-plugin`](https://www.npmjs.com/package/@r1-runtime/vite-plugin) | **0.3.2** | Vite plugin — Rust compilation + import patching |
| [`@r1-runtime/cli`](https://www.npmjs.com/package/@r1-runtime/cli) | **0.3.2** | Migration CLI: `npx @r1-runtime/cli sync` |

### crates.io

| Crate | Version | Description |
|---|---|---|
| [`r1-macros`](https://crates.io/crates/r1-macros) | 0.3.0 | `#[r1::command]` proc macro |

---

## What the CLI Does

`npx @r1-runtime/cli sync` automatically patches your Tauri project:

1. **`build.rs`** — emptied to `fn main() {}` (prevents native build logic from breaking WASM)
2. **`Cargo.toml`** — adds WASM deps, moves native deps to `cfg(not(target_arch = "wasm32"))`
3. **`vite.config.ts`** — adds `r1Plugin({ rustSrc: './src-tauri' })`
4. **`package.json`** — adds `@r1-runtime/core`, `@r1-runtime/apis`, `@r1-runtime/vite-plugin`
5. **SQL imports** — converts `@tauri-apps/plugin-sql` → `@r1-runtime/apis/sql`
6. **Rust commands** — rewrites `#[tauri::command]` to the R1 JSON contract

All modified files get a `.r1-backup` copy before changes are applied.

---

## Limitations

R1 runs in a browser sandbox. Some things are not possible:

- **Child processes** — `shell::execute` is stubbed, not functional
- **System tray / global shortcuts** — not browser concepts
- **Raw sockets** — not available in WASM
- **Native OS libraries** — crates that depend on C system libraries may not compile to WASM
- **Multi-threading** — WASM workers are single-threaded

For most Tauri apps — CRUD, file management, tools, utilities — none of these are blockers.

---

## Project Structure

```
r1-tauriweb-runtime-v1/
├── packages/
│   ├── kernel/        — WASM orchestration, VFS, WASI shim
│   ├── core/          — IPC bridge, EventBus, R1Runtime
│   ├── apis/          — Tauri API implementations
│   ├── sw/            — Service Worker
│   ├── window/        — Virtual Window Manager
│   ├── vite-plugin/   — Build tooling
│   └── cli/           — Migration tool
├── apps/
│   ├── todo-demo/     — Live demo app (React + Rust + SQLite)
│   ├── phase6-test-app/ — TaskFlow: full SQLite CRUD demo
│   └── demo/          — Technical showcase
├── templates/
│   └── r1-macros/     — Proc macro crate source
└── tests/
    └── fixtures/      — Pre-compiled .wasm test binaries
```

---

## Documentation

| Document | What's in it |
|---|---|
| [GETTING_STARTED.md](./GETTING_STARTED.md) | Step-by-step: create and run your first R1 app |
| [USAGE_GUIDE.md](./USAGE_GUIDE.md) | Complete API reference and patterns |
| [DEVELOPER_GUIDE.md](./DEVELOPER_GUIDE.md) | Internal architecture and package internals |
| [CONTRIBUTING.md](./CONTRIBUTING.md) | How to contribute and report bugs |
| [CHANGELOG.md](./CHANGELOG.md) | Version history |

---

## AI-Assisted Development

R1 ships with prompt files and a skill document for AI coding assistants (Cursor, Claude, Copilot). These give any AI agent full context about R1's architecture so it can make accurate changes.

All AI resources are in the [`PROMTS AND SKILL/`](./PROMTS%20AND%20SKILL/) directory:

| File | Purpose |
|---|---|
| `R1_SKILL.md` | Master knowledge base — read this first |
| `MIGRATE_APP.md` | Prompt for migrating an existing Tauri app |
| `NEW_APP.md` | Prompt for building a new R1 app |
| `NEW_APP_SQLITE.md` | Prompt for building a new app with SQLite |
| `DEBUG.md` | Prompt for debugging build and runtime errors |
| `AI_GUIDE.md` | How to use AI agents with R1 |

---

## License

MIT © 2026 R1 Runtime Team
