# R1 TauriWeb Runtime

> Run your Tauri app in the browser. No server. No installer. Just a URL.

[![MIT License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Tests](https://img.shields.io/badge/tests-41%20passed-brightgreen.svg)](#)
[![Demo](https://img.shields.io/badge/live-demo-orange.svg)](https://resplendent-arithmetic-aee148.netlify.app/)
[![Version](https://img.shields.io/badge/version-v0.2--dev-yellow.svg)](#)

**[Live Demo](https://r1-todo-demo.netlify.app/)** — A real Tauri todo app running as WebAssembly in the browser.

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
| Persistent storage across page refreshes | ✅ |
| Virtual Window Manager (macOS, Windows 11, Linux) | ✅ |
| Tauri API plugins: `fs`, `event`, `store`, `os`, `path`, `dialog`, `clipboard` | ✅ |
| WASM panic isolation | ✅ |
| Automatic Rust compilation via Vite plugin | ✅ |
| 41/41 unit tests passing | ✅ |

---

## Development Status

### ✅ v0.1 Complete (January 2026)

v0.1 established the core runtime architecture and proved the concept works:

- Kernel Worker with WASM execution and VFS
- IPC Bridge for Tauri v1 and v2 compatibility
- WASI shim redirecting `std::fs` to OPFS
- Event bridge for Rust → JS communication
- Virtual Window Manager with OS themes
- Tauri API plugins (fs, event, store, os, path)
- Vite plugin for automatic Rust → WASM compilation
- Todo demo app running in browser
- 31 unit tests covering all core functionality

**What worked:** The todo demo app runs perfectly in the browser with full file persistence.

**What we learned:** Testing with `file-browser-tauri` revealed systematic gaps in the direct-export layer. Apps using `import { readDir } from '@tauri-apps/api/fs'` failed at build time because the vite-plugin wasn't patching sub-path imports, and the API modules only exported plugin classes, not top-level functions.

### 🚧 v0.2 In Progress (Current)

**Goal:** Close the "direct export gap" so any simple-to-medium Tauri app builds and runs with zero runtime errors.

**Progress so far:**

- ✅ **Phase 0 Complete** — Codebase audit identified all missing exports
- ✅ **Phase 1 Complete** — Fixed vite-plugin WASM path bug and import patcher
  - Changed WASM loading from `.js` to `_bg.wasm`
  - Added comprehensive import map covering all 14 Tauri API paths
  - Patcher handles sub-paths correctly (e.g., `@tauri-apps/api/fs` → `@r1/apis/fs`)
  - 5 new tests added, all passing
- ✅ **Phase 2 Complete** — Fixed `fs.ts` filesystem API
  - Implemented VFS singleton with promise lock to prevent race conditions
  - All 11 filesystem functions exported as top-level named exports
  - `FileEntry` interface exported
  - `read_dir` kernel command verified
  - 5 new tests added, all passing

- ✅ **Phase 3 Complete** — Fixed `path_util.ts` Path API
  - Implemented POSIX-compliant `relative()` function
  - Added VFS directory aliases (`config`, `data`, `cache`, `log`)
  - Improved robustness for `basename()`, `join()`, and `resolve()`
  - All 27 path-related functions exported as top-level named exports
  - 5 new tests added, all passing

**Next up:**
- Phase 4-7: Fix remaining API modules (event, window, dialog, clipboard, os, store)
- Phase 8: Update barrel exports in `index.ts`
- Phase 9-10: End-to-end testing with real apps

See [roadmap/v0.2 roadmap.md](./roadmap/v0.2%20roadmap.md) for the complete v0.2 plan.

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
│   ├── kernel/       — Kernel Worker: WASM execution, VFS, WASI shim
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