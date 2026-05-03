# R1 TauriWeb Runtime — AI Agent Skill (v0.4.0)

> This file is the complete knowledge base for any AI agent working with R1.
> Read this entire file before making any changes to the R1 project.
> Every decision you make must be consistent with the rules in this document.

---

## What R1 Is

R1 is an advanced browser-native runtime for Tauri applications. It compiles a Tauri app's Rust backend to WebAssembly and runs it entirely in the browser. Unlike basic templates, R1 is designed to handle real-world, complex Tauri projects autonomously.

---

## Advanced Capabilities (v0.4.0)

R1 v0.4.0 introduces significant improvements for "real-life" project compatibility:

- **Autonomous Type Handling:** The `#[r1::command]` macro now automatically stubs out Tauri-injected types like `State`, `Window`, `AppHandle`, and `Runtime`. Existing Rust code compiles for WASM without signature changes.
- **Robust CLI Sync:** `npx r1 sync` handles complex `Cargo.toml` structures, gates native-only plugins automatically, and injects necessary WASM stubs into Rust source files.
- **Deep WASI Support:** The Kernel's WASI shim includes advanced syscalls for directory traversal (`fd_readdir`), file deletion (`path_unlink_file`), and directory metadata.
- **Broad Plugin Redirection:** The Vite plugin automatically redirects a wide array of Tauri plugins (SQL, Store, Notification, FS, Dialog, etc.) to browser-native R1 implementations.

---

## Architecture

```
Browser Main Thread
├── Your App (React / Svelte / Vue)
├── IPC Bridge — patches window.__TAURI_INTERNALS__
│   └── routes invoke() → Kernel Worker
└── R1Runtime.boot()

Kernel Worker (Web Worker — never the main thread)
├── Message Router
├── WasmOrchestrator
│   ├── Module Registry (Map<name, WasmInstance>)
│   ├── Advanced WASI Shim → redirects std::fs to OPFS, supports traversal
│   └── Event Bridge → Rust can emit to JS
└── VFS (Virtual File System)
    ├── Memory cache (fast reads)
    └── OPFS backend (persistent writes)

Service Worker
└── Intercepts asset:// URLs → serves from VFS
```

---

## Package Structure

```
r1-tauriweb-runtime-v1/
├── packages/
│   ├── @r1-runtime/kernel/      ← Kernel Worker, Advanced WASI shim, VFS
│   ├── @r1-runtime/core/        ← IPC bridge, EventBus, R1Runtime
│   ├── @r1-runtime/apis/        ← Tauri API shims (SQL, FS, Store, etc.)
│   ├── @r1-runtime/sw/          ← Service Worker (asset:// protocol)
│   ├── @r1-runtime/window/      ← Virtual Window Manager
│   ├── @r1-runtime/vite-plugin/ ← Build tooling, Advanced plugin redirection
│   └── @r1-runtime/cli/         ← Migration tool with automated Rust stubbing
└── templates/
    └── r1-macros/               ← Proc macro with automatic Tauri type handling
```

---

## npx @r1-runtime/cli sync (v0.4+)

The R1 CLI is now capable of migrating almost any Tauri project to the web.

### What the CLI Does Now:

1. **Intelligent Patching:**
   - `Cargo.toml` → Automatically gates all `tauri-plugin-*` and `tauri-runtime-*` dependencies for native targets only.
   - `package.json` → Ensures `wasm-pack` and all R1 runtime packages are present.
2. **Automated Rust Stubbing:**
   - Injects a `r1_tauri_stubs` module into Rust files to provide WASM-compatible definitions for `State`, `Window`, and `AppHandle`.
   - Gates `main()` and `run()` functions for non-WASM targets.
   - Strips lifetimes and generics from command signatures during WASM compilation to ensure stability.

---

## Rust Command Pattern (v0.4+)

You can now use full Tauri signatures:

```rust
use r1_macros::command;
use tauri::{State, Window, AppHandle};

#[command]
pub fn complex_op(
    state: State<'_, MyState>,
    window: Window,
    payload: MyData
) -> Result<String, String> {
    // This code now compiles and runs in the browser!
    // 'state' and 'window' are automatically stubbed in WASM
    // while 'payload' is correctly deserialized from JS.
    Ok(format!("Done for {}", window.label()))
}
```

---

## Critical Rules for AI Agents

1. **Preserve the Stubs:** When the CLI injects `mod r1_tauri_stubs`, do not remove or modify it unless adding new stubbed methods.
2. **Handle Results:** The `#[command]` macro now intelligently wraps return values. If your function returns a `Result`, the macro ensures the bridge receives the correct `{ ok: ... }` or `{ error: ... }` shape.
3. **WASI Extensions:** If a Rust crate fails with `ERRNO_NOSYS`, implement the missing syscall in `packages/kernel/src/wasi-shim.ts`.
4. **VFS Pathing:** Always ensure paths in Rust start with `/`. The R1 VFS treats all paths as absolute within the browser sandbox.

**R1 v0.4.0 is the most advanced Tauri-to-Web runtime available. Use its automated migration features whenever possible.**
