# R1 TauriWeb Runtime

> **⚠️ DISCONTINUED PROJECT**
> This project is **discontinued and no longer actively maintained**. It was created as an experimental research project to explore running Tauri applications entirely in the browser via WebAssembly and virtualized environments.
> *If you need any information or want to contact us, please feel free to reach out.*

---

[![npm](https://img.shields.io/npm/v/@r1-runtime/core?label=npm%20core)](https://www.npmjs.com/package/@r1-runtime/core)
[![npm cli](https://img.shields.io/npm/v/@r1-runtime/cli?label=npm%20cli)](https://www.npmjs.com/package/@r1-runtime/cli)
[![crates.io](https://img.shields.io/crates/v/r1-macros?label=crates.io)](https://crates.io/crates/r1-macros)
[![Tests](https://img.shields.io/badge/tests-105%20passed-brightgreen)](https://github.com/12errh/r1-tauriweb-runtime-v1)
[![MIT License](https://img.shields.io/badge/license-MIT-blue)](LICENSE)
[![Live Demo](https://img.shields.io/badge/demo-live-orange)](https://todo-demo-by-r1-runtime.netlify.app/)

**[▶ Live Demo](https://todo-demo-by-r1-runtime.netlify.app/)** — a real Tauri todo app with a React + Rust + SQLite backend, running entirely in your browser.

---

## Realistic Capabilities & Expectations

R1 is an **experimental proof-of-concept (POC)** designed to run lightweight, self-contained Tauri applications as static websites. It compiles the Rust backend to WebAssembly (`wasm32-wasip1`) and proxies Tauri's system calls to browser-level shims.

Contrary to early marketing claims, **R1 cannot run arbitrary or unmodified Tauri apps.** Standard desktop applications with native dependencies or complex OS integrations require significant manual rewrite, removal of incompatible dependencies, and custom porting to run on this runtime.

### What Actually Works (Real Capabilities)

If you design or heavily refactor your Tauri app specifically for this runtime, the following features are functional:

| Feature | What is actually supported |
|---|---|
| **Simple `invoke()` Calls** | Passing JSON strings back and forth between the JS frontend and the WASM-compiled Rust backend works. |
| **Rust `std::fs` (Virtualized)** | File writes and reads inside Rust are intercepted by a WASI shim and routed to an in-memory Virtual File System (VFS) backed by the Origin Private File System (OPFS). |
| **Event Bridge** | Emitting events from JS to Rust and listening to Rust-emitted events in JS (`emit`/`listen`) is supported. |
| **Self-Contained SQLite** | SQLite database operations persist in the browser's OPFS sandbox. |
| **Virtual Window Manager** | Multiple simulated OS-like windows can be rendered within a single browser tab using macOS/Windows 11 CSS themes. |
| **Mock API Shims** | Basic subset of Tauri APIs (`fs`, `event`, `store`, `os`, `path`, `dialog`, `clipboard`) are partially shimmed to use equivalent Web/browser APIs. |

---

## Severe Limitations (The Reality Check)

Because the entire application runs inside the browser's strict sandbox, many native features are fundamentally impossible:

* **Incompatible Rust Crates**: Any crate that depends on native C-bindings, OS system APIs, native cryptography, thread-pooling, or platform-specific libraries **will fail to compile to WASM** or crash at runtime.
* **No Child Processes**: Commands like `Command::new` or Tauri's `shell::execute` are non-functional and stubbed as no-ops.
* **No Raw Sockets or TCP/UDP**: Standard networking using `std::net` is unsupported. All external network calls must use standard Web `fetch` or the shimmed HTTP API.
* **No Multi-Threading**: The WASM runtime in the Web Worker is strictly single-threaded. Multi-threaded asynchronous features or parallel loops will cause deadlocks or panic.
* **No Native System UI**: Features like the system tray, global shortcuts, native file dialogues, native notifications, window transparency, and multi-window management do not exist and are simulated or disabled.

---

## Quick Start (For Historical Reference)

To test a compatible or heavily-simplified app:

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

See [GETTING_STARTED.md](./GETTING_STARTED.md) for a full walkthrough.

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

## Published Packages

All packages are live on npm and crates.io.

### npm — `@r1-runtime/*`

| Package | Version | Description |
|---|---|---|
| [`@r1-runtime/kernel`](https://www.npmjs.com/package/@r1-runtime/kernel) | **0.3.2** | WASM orchestration, VFS, WASI shim |
| [`@r1-runtime/core`](https://www.npmjs.com/package/@r1-runtime/core) | **0.3.4** | IPC bridge, EventBus, boot runtime |
| [`@r1-runtime/apis`](https://www.npmjs.com/package/@r1-runtime/apis) | **0.3.2** | Tauri API shims (fs, event, dialog…) |
| [`@r1-runtime/sw`](https://www.npmjs.com/package/@r1-runtime/sw) | 0.3.1 | Service Worker for `asset://` protocol |
| [`@r1-runtime/window`](https://www.npmjs.com/package/@r1-runtime/window) | 0.3.1 | Virtual Window Manager + OS themes |
| [`@r1-runtime/vite-plugin`](https://www.npmjs.com/package/@r1-runtime/vite-plugin) | **0.3.5** | Vite plugin — ships pre-built workers, Rust compilation |
| [`@r1-runtime/cli`](https://www.npmjs.com/package/@r1-runtime/cli) | **0.3.7** | Migration CLI: `npx @r1-runtime/cli sync` |

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
6. **Rust commands** — rewrites `#[tauri::command]` to `#[r1::command]` macro (adds `pub`, removes `staticlib` from crate-type)

All modified files get a `.r1-backup` copy before changes are applied.

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
