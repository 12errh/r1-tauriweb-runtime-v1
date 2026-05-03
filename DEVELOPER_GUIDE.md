# R1 Developer Guide

> How R1 works internally — architecture, package internals, and how to extend it.

---

## Philosophy

R1 is built on one idea: a Tauri app should be deployable to a URL with no changes to the frontend.

The browser is the most universally accessible runtime in existence. R1 bridges the gap between native desktop development — where Rust gives you a powerful, safe backend — and the web, where anyone can access your app instantly. It does this not by replacing Tauri, but by emulating everything Tauri provides at the browser level.

---

## Architecture

R1 uses a **Kernel-Worker** architecture. The UI runs on the main thread. Everything heavy — WASM execution, filesystem operations, IPC routing — runs in a dedicated Web Worker called the Kernel.

```
Browser Main Thread
┌─────────────────────────────────────────────────┐
│  Your App (React / Vue / Svelte)                │
│  │ invoke('command', args)                      │
│  ▼                                              │
│  IPC Bridge (@r1-runtime/core)                  │
│  │ patches window.__TAURI_INTERNALS__           │
│  ▼                                              │
│  KernelProxy → postMessage(id, type, payload)   │
└─────────────────────────────────────────────────┘
                      ↕ structured messages

Kernel Worker (Web Worker — never the main thread)
┌─────────────────────────────────────────────────┐
│  Message Router                                 │
│  ├── WasmOrchestrator                           │
│  │   ├── Module Registry (Map<name, WasmModule>)│
│  │   ├── Advanced WASI Shim → OPFS              │
│  │   └── Event Bridge → main thread             │
│  └── VFS (Virtual File System)                  │
│      ├── Memory cache (fast reads)              │
│      └── OPFS backend (persistent writes)       │
└─────────────────────────────────────────────────┘
                      ↕

Service Worker
┌─────────────────────────────────────────────────┐
│  Intercepts asset:// requests                   │
│  Reads from VFS → serves with correct MIME type │
└─────────────────────────────────────────────────┘
```

This separation means a slow Rust computation never freezes your UI. The Kernel Worker can block for seconds — the main thread stays perfectly responsive.

---

## Package Internals

### `@r1-runtime/kernel` — The Kernel Worker

Everything in this package runs inside a Web Worker, never on the main thread.

**`WasmOrchestrator`** manages the WASM lifecycle:
- Loads `.wasm` binaries by name and URL
- Maintains a `Map<string, WasmModule>` — no global state
- Catches WASM panics before they kill the Worker
- Auto-discovers and registers exported functions as commands on load

**`VFS`** (Virtual File System) provides persistent browser storage:
- Reads come from an in-memory cache — microsecond access
- Writes update the cache immediately, then persist to OPFS asynchronously
- Files survive browser refreshes and tab closes
- Falls back to memory-only mode if OPFS is unavailable

**`WasiShim`** intercepts Rust's standard OS calls. v0.4.0 added directory traversal and better metadata support.

| Syscall | Backed by |
|---|---|
| `fd_write` | VFS write |
| `fd_read` | VFS read |
| `fd_seek` (SEEK_SET, SEEK_CUR, SEEK_END) | VFS seek |
| `fd_readdir` | VFS directory listing (v0.4.0+) |
| `fd_filestat_get` | VFS metadata |
| `fd_fdstat_get` | File descriptor status |
| `fd_sync` | OPFS flush |
| `path_open` | VFS open |
| `path_filestat_get` | VFS stat by path |
| `path_rename` | VFS atomic rename |
| `path_unlink_file` | VFS delete (v0.4.0+) |
| `clock_time_get` | `Date.now()` |
| `random_get` | `crypto.getRandomValues()` |
| `proc_exit` | Throws a controlled error |
| `environ_get` / `environ_sizes_get` | Empty environment |
| `args_get` / `args_sizes_get` | Empty args |
| `sched_yield` | No-op / Success (v0.4.0+) |
| `poll_oneoff` | No-op |

Unimplemented syscalls return `ERRNO_NOSYS` — they never crash the Worker.

---

### `@r1-runtime/cli` — Migration tool

R1 v0.4.0's CLI is highly robust. It automatically:
1. Gates native-only dependencies in `Cargo.toml`.
2. Injects WASM stubs for `tauri::State`, `tauri::Window`, and `tauri::AppHandle`.
3. Rewrites Rust commands to use the `r1-macros` and strip lifetimes.

---

### `r1-macros` (crates.io) — Proc Macro

The `#[r1::command]` macro eliminates the JSON boilerplate and handles Tauri type injection.

**What the macro generates (v0.4.0):**

```rust
// You write:
#[command]
pub fn greet(state: State<'_, MyState>, name: String) -> String {
    format!("Hello, {}!", name)
}

// The macro generates:
#[wasm_bindgen]
pub fn greet(payload: &str) -> String {
    #[derive(serde::Deserialize)]
    struct Args { name: String }
    let args: Args = match serde_json::from_str(payload) {
        Ok(a) => a,
        Err(e) => return serde_json::json!({ "error": e.to_string() }).to_string(),
    };

    // Tauri types are stubbed via zeroed memory or local stubs
    let state: State<MyState> = unsafe { std::mem::zeroed() };

    let result = (|| {
        let name = args.name;
        format!("Hello, {}!", name)
    })();

    match serde_json::to_string(&result) {
        Ok(s) => {
            // Intelligent wrapping for bridge compatibility
            if s.starts_with('{') { s } else { serde_json::json!({ "ok": result }).to_string() }
        },
        Err(e) => serde_json::json!({ "error": e.to_string() }).to_string(),
    }
}
```

---

## Testing

R1's own test suite uses Vitest with happy-dom. Pre-compiled `.wasm` test binaries live in `tests/fixtures/wasm/` — never compile Rust in CI.

```bash
npm test
```

105 tests across 17 test files. All must pass before any PR is merged.
