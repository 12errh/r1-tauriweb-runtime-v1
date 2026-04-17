# R1 Developer Guide

> A deep dive into how R1 works, what it supports, and how to build complex applications on top of it.

---

## Philosophy

R1 is built on one idea: **a Tauri app should be deployable to a URL with no code changes to the frontend.**

The browser is the most universally accessible runtime in existence. R1 bridges the gap between native desktop development — where Rust gives you a powerful, safe backend — and the web, where anyone can access your app instantly. It does this not by replacing Tauri, but by emulating everything Tauri provides at the browser level.

The result: you write a standard Tauri app. R1 runs it in the browser.

---

## Architecture Overview

R1 uses a "Kernel-Worker" architecture. The UI runs on the main thread. Everything heavy — WASM execution, filesystem operations, IPC routing — runs in a dedicated Web Worker called the Kernel.

```
Browser Main Thread
┌──────────────────────────────────────────────┐
│  Your App (React / Vue / Svelte)             │
│  ↓ invoke('command', args)                   │
│  IPC Bridge (@r1/core)                       │
│  ↓ patches window.__TAURI_INTERNALS__        │
│  KernelProxy → postMessage                   │
└──────────────────────────────────────────────┘
                    ↕ structured messages

Kernel Worker (Web Worker)
┌──────────────────────────────────────────────┐
│  Message Router                              │
│  ├── WasmOrchestrator                        │
│  │   ├── Module Registry (Map<name, wasm>)   │
│  │   ├── WASI Shim → OPFS                    │
│  │   └── Event Bridge → main thread          │
│  └── VFS (Virtual File System)               │
│      ├── Memory cache (fast reads)           │
│      └── OPFS backend (persistent writes)    │
└──────────────────────────────────────────────┘
                    ↕

Service Worker
┌──────────────────────────────────────────────┐
│  Intercepts asset:// requests                │
│  Reads from VFS → serves with correct MIME   │
└──────────────────────────────────────────────┘
```

This separation means a slow Rust computation never freezes your UI. The Kernel Worker can block for seconds — the main thread stays perfectly responsive.

---

## Core Packages

### `@r1/kernel` — The Kernel Worker

Everything in this package runs inside a Web Worker, never on the main thread.

**`WasmOrchestrator`** manages the WASM lifecycle:
- Loads `.wasm` binaries by name and URL
- Catches WASM panics before they kill the Worker
- Supports 63 unit tests across the monorepo

**`VFS`** (Virtual File System) provides persistent browser storage:
- Reads come from an in-memory cache — microsecond access
- Writes update the cache immediately, then persist to OPFS asynchronously
- Files survive browser refreshes and tab closes

**`WasiShim`** intercepts Rust's standard OS calls:
- `std::fs::write` → writes to OPFS
- `std::fs::read_to_string` → reads from OPFS
- `clock_time_get` → returns `Date.now()`
- `random_get` → uses `crypto.getRandomValues()`
- Unimplemented syscalls return `ERRNO_NOSYS` instead of crashing

**`Router`** dispatches messages to the right handler:
- Every API plugin registers commands via `getCommands()`
- WASM modules auto-register their exports on load
- Unknown commands return a clean error — never a crash

---

### `@r1/core` — Main Thread Runtime

**`R1Runtime`** is the single entry point:
```typescript
import { R1Runtime } from '@r1/core';

const runtime = new R1Runtime();
await runtime.boot();
// ↑ This does everything:
//   1. Spawns the Kernel Worker
//   2. Patches window.__TAURI_INTERNALS__
//   3. Registers the Service Worker
//   4. Loads your app's .wasm backend
```

**`IpcBridge`** patches two Tauri globals so existing apps work without changes:
- `window.__TAURI_INTERNALS__` (Tauri v2)
- `window.__TAURI_IPC__` (Tauri v1)

Both formats are intercepted and routed through the Kernel Worker.

**`KernelProxy`** manages Worker communication:
- Every message has a unique `id`
- `send(type, payload)` returns a Promise that resolves when the matching `id` comes back
- Times out after 30 seconds with a clean error
- Worker crashes are caught and logged — never silent

**`EventBus`** handles Tauri's event system:
- `emit(event, payload)` — fires to all listeners
- `emitTo(windowId, event, payload)` — fires to a specific window
- Rust can emit events back via the Event Bridge

---

### `@r1/apis` — Tauri API Implementations

Every standard Tauri API is implemented as a plugin class. Each plugin:
1. Registers its commands via `getCommands()` on boot
2. Receives the same arguments your real Tauri app would send
3. Returns the same response shape

**Currently implemented:**

| Plugin | Commands | Backed By |
|---|---|---|
| `FsPlugin` | `read_file`, `write_file`, `read_text_file`, `write_text_file`, `exists`, `remove_file`, `create_dir`, `read_dir`, `rename`, `copy_file` | VFS / OPFS |
| `EventPlugin` | `emit`, `emit_to`, `listen`, `unlisten` | EventBus |
| `StorePlugin` | `get`, `set`, `delete`, `has`, `keys` | VFS (JSON files) |
| `DialogPlugin` | `message`, `ask`, `confirm`, `open`, `save` | OS-themed modals / `<input type="file">` |
| `ClipboardPlugin` | `read_text`, `write_text` | `navigator.clipboard` |
| `OsPlugin` | `platform`, `arch`, `version`, `locale` | Configurable + `navigator` |
| `PathPlugin` | `join`, `resolve`, `basename`, `dirname`, `extname` | Pure JS |

---

### `@r1/window` — Virtual Window Manager

Renders app windows that look exactly like native OS windows — macOS traffic lights, Windows 11 Mica title bar, or Linux GNOME header bar.

Each `VirtualWindow`:
- Is a sandboxed `iframe` hosted inside a styled `div`
- Supports drag-to-move, resize handles, minimise, maximise, close
- Has its own scoped EventBus channel for `emitTo` targeting

**Supported window IPC commands:**
```
window_set_title, window_minimize, window_maximize,
window_close, window_set_size, window_set_focus
```

**Setting the OS theme:**
```typescript
import { WindowManager } from '@r1/window';

const wm = new WindowManager({ theme: 'macos' }); // 'macos' | 'windows' | 'linux' | 'auto'
wm.open({ title: 'My App', width: 800, height: 600, src: '/index.html' });
```

---

### `@r1/sw` — Service Worker

Intercepts requests to `https://r1-asset.localhost/*` and serves files from the VFS.

This is what makes `convertFileSrc('/app/logo.png')` work. The URL is routed through the Service Worker, which reads the file from OPFS and returns it with the correct `Content-Type`.

The Service Worker registers automatically during `R1Runtime.boot()`.

---

### `@r1/vite-plugin` — Build Tooling

Adds one line to `vite.config.ts` and handles everything else automatically:

```typescript
r1Plugin({
  rustSrc: './src-tauri',          // default
  wasmOut: './public/wasm',        // default
  os: 'auto'                       // 'macos' | 'windows' | 'linux' | 'auto'
})
```

**What it does during `npm run build`:**
1. Detects `src-tauri/Cargo.toml`
2. Runs `wasm-pack build src-tauri/ --target web`
3. Replaces all `@tauri-apps/api` imports with `@r1/apis`
4. Injects the R1 boot script before your app's entry point
5. Copies `sw.js` to the output root

---

## The JSON Contract

Every Rust function that exchanges data with JavaScript uses this exact signature:

```rust
pub fn my_command(payload: &str) -> String
```

One JSON string in. One JSON string out. This is the same pattern Tauri uses internally — it just becomes explicit in R1 because you're writing the WASM boundary yourself.

**Why JSON and not raw types?**

WASM and JavaScript have incompatible type systems. Passing raw Rust structs across the boundary requires complex memory management. JSON strings are native to both sides — Rust's `serde_json` handles the Rust side, and `JSON.parse` / `JSON.stringify` handle the JavaScript side. The overhead is under 1ms for typical payloads.

**Standard pattern:**

```rust
use wasm_bindgen::prelude::*;
use serde::{Serialize, Deserialize};

#[derive(Deserialize)]
struct MyArgs {
    user_id: u32,
    message: String,
}

#[derive(Serialize)]
struct MyResponse {
    status: String,
    processed_at: u64,
}

#[wasm_bindgen]
pub fn process_message(payload: &str) -> String {
    // Decode input
    let args: MyArgs = match serde_json::from_str(payload) {
        Ok(a) => a,
        Err(e) => return serde_json::json!({ "error": e.to_string() }).to_string(),
    };

    // Your logic here
    let response = MyResponse {
        status: format!("Processed message from user {}", args.user_id),
        processed_at: 0, // use WASI clock_time_get in real code
    };

    // Always encode output
    serde_json::to_string(&response).unwrap()
}
```

**Error handling convention:**

```rust
// Success response shape
{ "ok": <your value> }

// Error response shape
{ "error": "description of what went wrong" }
```

R1's `callFunction` inspects the response: if `"error"` is present, the `invoke()` Promise rejects. If `"ok"` is present, it resolves with the value.

---

## Rust → JavaScript Events

Rust code can emit events back to the frontend at any time during execution. This is how you push progress updates, background results, or state changes.

**In Rust:**
```rust
// Declared in src/r1.rs (included in the wasm-template)
extern "C" {
    fn r1_emit(name_ptr: *const u8, name_len: usize,
               payload_ptr: *const u8, payload_len: usize);
}

pub fn emit(event: &str, payload: &str) {
    unsafe {
        r1_emit(event.as_ptr(), event.len(),
                payload.as_ptr(), payload.len());
    }
}

// Usage in your command:
#[wasm_bindgen]
pub fn process_large_file(payload: &str) -> String {
    for i in 0..100 {
        r1::emit("progress", &format!(r#"{{"percent": {}}}"#, i));
    }
    serde_json::to_string(&"complete").unwrap()
}
```

**In JavaScript:**
```typescript
import { listen } from '@tauri-apps/api/event';

const unlisten = await listen('progress', (event) => {
    console.log(`Progress: ${event.payload.percent}%`);
});

await invoke('process_large_file', { path: '/data/large.csv' });
unlisten(); // clean up the listener
```

---

## Supported Features

| Feature | Status | Notes |
|---|---|---|
| `std::fs` read/write | ✅ Full | Redirected to OPFS via WASI shim |
| `std::fs` directories | ✅ Full | `create_dir`, `read_dir`, `remove_dir` |
| `serde` / `serde_json` | ✅ Full | Core to the JSON bridge |
| Async Rust | ✅ Full | Via `wasm-bindgen-futures` |
| Rust → JS events | ✅ Full | Via the r1_emit callback bridge |
| External crates | ✅ Most | Any crate targeting `wasm32-wasi` |
| `std::time` | ✅ Full | Backed by `clock_time_get` → `Date.now()` |
| `rand` / random | ✅ Full | Backed by `crypto.getRandomValues()` |
| HTTP requests | ✅ Full | Mapped to browser `fetch` |
| Multi-threading (`rayon`) | ❌ No | WASM is single-threaded in workers |
| Raw sockets | ❌ No | Not available in browser sandbox |
| Child process spawning | ❌ No | `shell::execute` is stubbed |
| System tray | ❌ No | Not a browser concept |
| Global shortcuts | ❌ No | Not available outside browser focus |
| OS notifications | ⚠️ Partial | Uses Web Notifications API |

---

## Performance

**VFS reads** come from memory — a read of a cached file is effectively instant (microseconds). The first read after a page load fetches from OPFS, which takes 1–5ms for small files.

**WASM execution** runs at near-native speed. The JSON serialisation overhead between JS and Rust is under 1ms for payloads under 1MB.

**WASM binary size** is the most common performance concern. A typical Rust backend compiles to 1–3MB of WASM. R1's Vite plugin runs `wasm-opt` automatically during `--release` builds, which typically reduces this by 30–40%.

For large payloads (images, binary files), use the VFS directly rather than passing binary data through `invoke` as Base64.

---

## Testing

R1's own test suite gives you a clear model for how to write tests:

```typescript
// Example: testing a Rust command end-to-end
import { describe, it, expect } from 'vitest';
import { WasmOrchestrator } from '@r1/kernel';
import { VFS } from '@r1/kernel';

describe('My command', () => {
    it('processes data correctly', async () => {
        const vfs = new VFS();
        await vfs.init();

        const orchestrator = new WasmOrchestrator(vfs);
        await orchestrator.loadModule('my-app', '/path/to/my_app_bg.wasm');

        const result = orchestrator.callFunction('my-app', 'my_command', {
            input: 'test value'
        });

        expect(result).toEqual({ output: 'processed: test value' });
    });
});
```

Pre-compile your WASM test binary and commit it to `tests/fixtures/wasm/`. Never compile Rust in CI — it adds 5+ minutes to every run.

---

## Limitations

**Native OS APIs** — anything that requires access to the real operating system (spawning processes, raw sockets, Unix signals, system tray) cannot work in a browser sandbox. R1 stubs these gracefully: unsupported commands return a `ERRNO_NOSYS` error rather than crashing.

**The `tauri` crate itself** — the main `tauri` crate depends on native OS bindings and cannot compile to WASM. R1 solves this with conditional compilation: the `tauri` dependency is gated behind `cfg(not(target_arch = "wasm32"))`, so it only compiles for native desktop builds. See the Getting Started guide for the exact `Cargo.toml` setup.

**Memory sharing** — WASM and the JavaScript runtime cannot share memory directly (without `SharedArrayBuffer` and special headers). All data must be serialisable to JSON. For most apps this is not a limitation in practice, but it means you cannot pass raw pointers or complex non-serialisable types across the JS/Rust boundary.

**WASI shim completeness** — R1 implements the most common WASI syscalls. Exotic syscalls (raw I/O multiplexing, Unix domain sockets) are stubbed with `ERRNO_NOSYS`. If your Rust code uses an unsupported syscall, it will receive that error code rather than crashing.

---

## Roadmap

R1 is at v0.3. The following are planned for upcoming versions:

- **`npx r1 sync`** — a CLI that automatically patches `Cargo.toml`, `build.rs`, and `lib.rs` in existing Tauri apps *(in progress — Phase 4)*
- **`#[r1::command]` macro** — write standard `#[tauri::command]` style functions with no JSON contract required *(in progress — Phase 5)*
- **Real-world app testing** — verified compatibility with 3+ open source Tauri apps *(Phase 6)*

**Completed in v0.3:**
- ✅ npm publishing — install R1 packages directly without cloning (`npm install @r1/core @r1/apis`)
- ✅ SQLite support — via `@tauri-apps/plugin-sql` backed by `@sqlite.org/sqlite-wasm` and OPFS
- ✅ Full WASI shim — `fd_seek` (all modes), `fd_filestat_get`, `fd_fdstat_get`, `fd_sync`, `path_filestat_get`, `path_rename`

---

The most valuable contributions right now are:

1. **Test R1 with your own Tauri app** and open an issue describing what broke. R1 v0.2 supports complex APIs, so we need real-world stress tests.
2. **WASI shim additions** — if a syscall returns `ERRNO_NOSYS` that you need, adding it to `packages/kernel/src/wasi-shim.ts` is well-scoped and testable.
3. **API plugin completeness** — if a `@tauri-apps/api` command returns wrong data or is missing, `packages/apis/src/` is the place to add it.

See `CONTRIBUTING.md` for setup instructions and code style guidelines.