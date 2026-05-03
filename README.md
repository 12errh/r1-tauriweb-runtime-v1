# R1 TauriWeb Runtime

> Run your Tauri app in the browser. No server. No installer. Just a URL.

[![npm](https://img.shields.io/npm/v/@r1-runtime/core?label=npm%20core)](https://www.npmjs.com/package/@r1-runtime/core)
[![npm cli](https://img.shields.io/npm/v/@r1-runtime/cli?label=npm%20cli)](https://www.npmjs.com/package/@r1-runtime/cli)
[![crates.io](https://img.shields.io/crates/v/r1-macros?label=crates.io)](https://crates.io/crates/r1-macros)
[![Tests](https://img.shields.io/badge/tests-105%20passed-brightgreen)](https://github.com/12errh/r1-tauriweb-runtime-v1)

**R1 is an advanced runtime** that lets you deploy real-world Tauri desktop apps as static websites. Unlike basic templates, R1 handles complex Tauri patterns like State management, Window references, and multiple plugins autonomously.

---

## What is R1?

R1 compiles your Rust backend to WebAssembly and runs it in a high-performance Web Worker, providing a Virtual File System (VFS) and standard Tauri API shims.

```
Your Tauri App (Existing or New)
      │
      ▼  npx r1 sync    (Advanced CLI migrates any project)
      │
      ▼  npm run build  (R1 compiles Rust → WASM automatically)
      │
      ▼  deploy to any static host (Vercel, Netlify, etc.)
```

---

## Advanced Features

| Feature | Description |
|---|---|
| **Autonomous Migration** | `npx r1 sync` handles complex `Cargo.toml` and Rust source patterns. |
| **Tauri Type Injection** | Supports `State`, `Window`, `AppHandle`, and `Runtime` in Rust commands. |
| **Lifetime Support** | Handles complex Rust lifetimes and generics in command signatures. |
| **Complete WASI Shim** | Expanded syscall support for directory traversal and metadata. |
| **Plugin Broadening** | Automatic support for SQL, Store, FS, Dialog, and many more. |
| **Persistence** | In-memory cache + Origin Private File System (OPFS) background sync. |

---

## Quick Start

### Migrate any Tauri app

```bash
cd your-tauri-app
npx @r1-runtime/cli sync
npm install
npm run build
npx serve dist -l 3000
```

Open **http://localhost:3000** and press `Ctrl+F5` on first load.

---

## Project Structure

```
r1-tauriweb-runtime-v1/
├── packages/
│   ├── kernel/        — WASM orchestration, VFS, Advanced WASI shim
│   ├── core/          — IPC bridge, EventBus, R1Runtime
│   ├── apis/          — Tauri API implementations
│   ├── sw/            — Service Worker (asset:// protocol)
│   ├── window/        — Virtual Window Manager
│   ├── vite-plugin/   — Build tooling & plugin redirection
│   └── cli/           — Migration tool with automated stubs
└── templates/
    └── r1-macros/     — Proc macro with Tauri type handling
```

---

## AI-Assisted Development

R1 ships with optimized prompts for AI agents (Cursor, Claude, Copilot) to help you build advanced R1 apps. See [`PROMTS AND SKILL/`](./PROMTS%20AND%20SKILL/) for more.
