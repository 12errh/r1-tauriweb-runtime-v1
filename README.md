# R1 TauriWeb Runtime

> Run your Tauri app in the browser. No server. No installer. Just a URL.

[![Hypercommit](https://img.shields.io/badge/Hypercommit-DB2475)](https://hypercommit.com/r1-tauriweb-runtime-v1)
[![MIT License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![MIT License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Tests](https://img.shields.io/badge/tests-67%20passed-brightgreen.svg)](#)
[![Demo](https://img.shields.io/badge/live-demo-orange.svg)](https://todo-demo-by-r1-runtime.netlify.app/)
[![Version](https://img.shields.io/badge/version-v0.3--dev-blue.svg)](#)

**[Live Demo](https://todo-demo-by-r1-runtime.netlify.app/)** — A real Tauri todo app running as WebAssembly in the browser.

---

## What is R1?

R1 is a browser-native runtime for Tauri applications. You write a standard Tauri app — Rust backend, React/Vue/Svelte frontend — and R1 runs it entirely in the browser.

The developer adds one line to `vite.config.ts`. The end user visits a URL. That's it.

```
Your Tauri App  →  npm run build  →  Static folder  →  Deploy anywhere
                   (R1 compiles                         Vercel / Netlify /
                    Rust → WASM                         GitHub Pages)
                    automatically)
```

---

## How It Works

The browser can't run a native Rust binary. R1 solves this with a layered architecture:

- **Rust → WASM** — the R1 Vite plugin compiles your `src-tauri/` directory to WebAssembly automatically during `npm run build`
- **Kernel Worker** — all WASM execution runs in a dedicated Web Worker, so the UI thread is never blocked
- **WASI Shim** — intercepts `std::fs` calls from Rust and redirects them to the browser's Origin Private File System (OPFS). Your Rust file I/O works unchanged
- **IPC Bridge** — patches `window.__TAURI_INTERNALS__` so your existing `invoke()` calls work with zero frontend code changes
- **Event Bridge** — Rust can emit events back to JavaScript via `listen()` just like in native Tauri
- **Service Worker** — intercepts `asset://` URLs and serves files from the virtual filesystem
- **Persistence Layer** — automatically requests persistent storage from the browser and monitors storage quotas to prevent data loss.

### WASI & SQLite
R1 supports the WASI `snapshot_preview1` ABI, enabling standard Rust crates like `rusqlite` (with `bundled` feature) to run in the web.

```rust
// Example: Using SQLite in R1 (compiled to wasm32-wasip1)
let conn = Connection::open("/app/data/prod.db")?;
conn.execute("CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT)", [])?;
```

The runtime handles `fd_seek`, `fd_tell`, `fd_sync`, and `path_rename` to ensure database integrity.

```
Your Frontend (React)
      ↓ invoke('command', args)
IPC Bridge  →  Kernel Worker  →  WASM (your Rust code)
                     ↕                    ↕
                    VFS              WASI Shim
                 (OPFS)           (std::fs → OPFS)
```

---

## Features

| Feature | Status |
|---|---|
| `invoke()` — Tauri v1 and v2 compatible | ✅ |
| `std::fs` read/write from Rust | ✅ |
| Rust → JS event bridge (`emit` / `listen`) | ✅ |
| Persistent storage (OPFS) + Data Loss Prevention | ✅ |
| Virtual Window Manager (macOS, Windows 11 themes) | ✅ |
| Tauri API plugins: `fs`, `event`, `store`, `os`, `path`, `dialog`, `clipboard` | ✅ |
| WASM panic isolation | ✅ |
| Automatic Rust compilation via Vite plugin | ✅ |
| SQLite Support (rusqlite) — Done | ✅ |
| 71/71 unit tests passing | ✅ |

---

## Development Status

### ✅ v0.2 Complete (March 2026)

v0.2 solidified the API layer and enabled complex Tauri applications to run with zero manual code changes.

- **Phase 0-8 (Core APIs)**: Completed full implementations of `fs`, `path`, `event`, `window`, `dialog`, `clipboard`, `os`, and `store`.
- **Barrel Exports**: Implemented a robust direct-export layer allowing standard imports like `import { readDir } from '@tauri-apps/api/fs'`.
- **Vite Plugin**: Advanced patcher handles all 14 Tauri API paths and sub-paths.
- **E2E Testing**: Verified with `file-browser-tauri` and `test-greet` scaffolds.
- **Improved Onboarding**: Updated `GETTING_STARTED.md` with build optimization and troubleshooting.
- **Stability**: 63 unit tests passing total (2x original coverage).

### 🚀 v0.3 In Progress (Current)

**Goal:** Automate migration, enable SQLite, and Move to NPM publishing.

- **SQLite Support** — Full WASI syscall completion for `rusqlite` (Done ✅).
- **Data Loss Prevention** — Automated storage persistence requests and quota monitoring.
- **`npx r1 sync`** — CLI tool for zero-config Tauri migration (Phase 4).
- **#[r1::command]** — Rust macro to eliminate JSON contract boilerplate.
- **NPM Publishing** — Moving from local clones to `@r1` package imports.
- **Enterprise Support** — Internal test suite with 3+ real-world open source Tauri apps.
t local cloning.
- Support for 3 more real-world open source Tauri apps.


---

## Quick Start

### Run the Todo Demo

```bash
git clone https://github.com/12errh/r1-tauriweb-runtime-v1.git
cd r1-tauriweb-runtime-v1
npm install
npm run build
cd apps/todo-demo
npm run dev
```

Open **http://localhost:5173** — the todo app is running entirely in the browser with its Rust backend executing as WASM.

### Build Your Own App

See **[GETTING_STARTED.md](./GETTING_STARTED.md)** for a complete step-by-step guide to creating your first R1 app from scratch.

---

## Project Structure

```
r1-tauriweb-runtime/
├── packages/
│   ├── kernel/       —**71/71 Tests Passing** (Core Kernel, IPC, VFS, WASI Shim)
│   ├── core/         — Main thread: IPC bridge, EventBus, R1Runtime
│   ├── apis/         — Tauri API implementations (fs, event, dialog…)
│   ├── sw/           — Service Worker: asset:// protocol
│   ├── window/       — Virtual Window Manager + OS themes
│   └── vite-plugin/  — Build tooling: Rust → WASM, import patching
├── apps/
│   ├── todo-demo/    — Complete Tauri todo app running in the browser
│   └── demo/         — Technical showcase and API tests
└── tests/
    └── fixtures/     — Pre-compiled .wasm test binaries
```

---

## Documentation

| Document | What's in it |
|---|---|
| [GETTING_STARTED.md](./GETTING_STARTED.md) | Create and run your first R1 app from scratch |
| [USAGE_GUIDE.md](./USAGE_GUIDE.md) | Detailed reference for all R1 features and APIs |
| [DEVELOPER_GUIDE.md](./DEVELOPER_GUIDE.md) | Internal architecture, package internals, contributing |
| [CONTRIBUTING.md](./CONTRIBUTING.md) | How to report bugs and submit pull requests |

---

## Limitations

R1 is at v0.1. It works well for simple to medium complexity Tauri apps. Things that don't work:

- Spawning child processes (`shell::execute`) — not possible in a browser sandbox
- System tray, global shortcuts — not browser concepts
- Raw sockets and Unix signals — not available in WASM
- Apps that depend on native OS libraries that can't compile to WASM

See [DEVELOPER_GUIDE.md](./DEVELOPER_GUIDE.md) for the complete limitations list.

---

## 🤖 AI-First Development

R1 is designed to be built and maintained with AI agents. We provide a set of specialized prompts and a technical "Skill" file that allows any code-aware AI (Cursor, Claude, Copilot) to understand R1's architecture and apply changes with 100% accuracy.

### AI Prompts & Skills

All AI resources are located in the `PROMTS AND SKILL/` directory:

| Resource | Description | Usage Guide |
|---|---|---|
| [R1_SKILL.md](./PROMTS%20AND%20SKILL/R1_SKILL.md) | **The Master Skill**. Technical knowledge base. | Agents should read this FIRST for any task. |
| [MIGRATE_APP.md](./PROMTS%20AND%20SKILL/MIGRATE_APP.md) | **Migration Prompt**. Ports existing Tauri apps. | Paste into AI chat to automate v0.2 setup. |
| [NEW_APP.md](./PROMTS%20AND%20SKILL/NEW_APP.md) | **Scaffold Prompt**. Builds new R1 apps. | Paste and describe your app idea. |
| [DEBUG.md](./PROMTS%20AND%20SKILL/DEBUG.md) | **Troubleshooting Prompt**. Fixes build/runtime errors. | Paste and attach your error logs. |
| [AI_GUIDE.md](./PROMTS%20AND%20SKILL/AI_GUIDE.md) | **General Guide**. Best practices for AI workflow. | Read to understand the AI-native workflow. |
| [.cursorrules](./PROMTS%20AND%20SKILL/.cursorrules) | **Cursor Config**. Optimises Cursor IDE behavior. | Place in root or reference for Cursor. |

---

## Roadmap

### v0.3 and Beyond

- `npx r1 sync` — CLI that automatically patches existing Tauri apps to work with R1
- `#[r1::command]` macro — write standard `#[tauri::command]` functions with no JSON contract required
- npm publishing — install R1 without cloning
- Test with 3+ real open source Tauri apps
- Deeper WASI syscall coverage based on real app needs

---

## License

MIT © 2026 R1 Runtime Team