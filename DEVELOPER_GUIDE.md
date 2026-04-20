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
│  │   ├── WASI Shim → OPFS                       │
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

**`WasiShim`** intercepts Rust's standard OS calls:

| Syscall | Backed by |
|---|---|
| `fd_write` | VFS write |
| `fd_read` | VFS read |
| `fd_seek` (SEEK_SET, SEEK_CUR, SEEK_END) | VFS seek |
| `fd_filestat_get` | VFS metadata |
| `fd_fdstat_get` | File descriptor status |
| `fd_sync` | OPFS flush |
| `path_open` | VFS open |
| `path_filestat_get` | VFS stat by path |
| `path_rename` | VFS atomic rename |
| `clock_time_get` | `Date.now()` |
| `random_get` | `crypto.getRandomValues()` |
| `proc_exit` | Throws a controlled error |
| `environ_get` / `environ_sizes_get` | Empty environment |
| `args_get` / `args_sizes_get` | Empty args |
| `sched_yield` | No-op |
| `poll_oneoff` | No-op |

Unimplemented syscalls return `ERRNO_NOSYS` — they never crash the Worker.

**`Router`** dispatches messages to the right handler:
- Every API plugin registers commands via `getCommands()` on boot
- WASM modules auto-register their exports on load
- Unknown commands return a clean error — never a crash

---

### `@r1-runtime/core` — Main Thread Runtime

**`R1Runtime`** is the single entry point. Calling `boot()` does everything:

```typescript
import { R1Runtime } from '@r1-runtime/core';

const runtime = new R1Runtime();
await runtime.boot();
// 1. Spawns the Kernel Worker
// 2. Patches window.__TAURI_INTERNALS__ (Tauri v2)
// 3. Patches window.__TAURI_IPC__ (Tauri v1)
// 4. Registers the Service Worker
// 5. Loads your app's .wasm backend
// 6. Dispatches the r1:ready event
```

**`IpcBridge`** patches two Tauri globals so existing apps work without changes:
- `window.__TAURI_INTERNALS__` — Tauri v2 format
- `window.__TAURI_IPC__` — Tauri v1 format

Both are intercepted and routed through the Kernel Worker.

**`KernelProxy`** manages Worker communication:
- Every message has a unique `id`
- `send(type, payload)` returns a Promise that resolves when the matching `id` comes back
- Times out after 30 seconds with a clean error
- Worker crashes are caught and logged — never silent

**`EventBus`** handles Tauri's event system:
- `emit(event, payload)` — fires to all listeners
- `emitTo(windowId, event, payload)` — fires to a specific window
- Rust emits events back via the Event Bridge in the Kernel Worker

---

### `@r1-runtime/apis` — Tauri API Implementations

Every standard Tauri API is implemented as a plugin class. Each plugin:
1. Registers its commands via `getCommands()` on boot
2. Receives the same arguments your real Tauri app would send
3. Returns the same response shape

**Implemented plugins:**

| Plugin | Commands | Backed by |
|---|---|---|
| `FsPlugin` | `read_file`, `write_file`, `read_text_file`, `write_text_file`, `exists`, `remove_file`, `create_dir`, `read_dir`, `rename`, `copy_file` | VFS / OPFS |
| `EventPlugin` | `emit`, `emit_to`, `listen`, `unlisten` | EventBus |
| `StorePlugin` | `get`, `set`, `delete`, `has`, `keys` | VFS (JSON files at `/.r1-store/`) |
| `DialogPlugin` | `message`, `ask`, `confirm`, `open`, `save` | OS-themed modals / `<input type="file">` |
| `ClipboardPlugin` | `read_text`, `write_text` | `navigator.clipboard` |
| `OsPlugin` | `platform`, `arch`, `version`, `locale` | `navigator.userAgent` + `navigator.language` |
| `PathPlugin` | `join`, `resolve`, `basename`, `dirname`, `extname` | Pure JS |
| `SqlPlugin` | `load`, `execute`, `select`, `close` | `@sqlite.org/sqlite-wasm` + OPFS |
| `WindowPlugin` | `set_title`, `minimize`, `maximize`, `close`, `set_size`, `set_focus` | Virtual Window Manager |
| `NotificationPlugin` | `requestPermission`, `sendNotification` | Web Notifications API |
| `HttpPlugin` | `fetch` | Browser `fetch` |
| `ShellPlugin` | `execute` | Stubbed — returns `ERRNO_NOSYS` |

**Import mapping** (applied automatically by the Vite plugin at build time):

```
@tauri-apps/api/core         → @r1-runtime/apis/core
@tauri-apps/api/tauri        → @r1-runtime/apis/core
@tauri-apps/api/fs           → @r1-runtime/apis/fs
@tauri-apps/api/path         → @r1-runtime/apis/path
@tauri-apps/api/event        → @r1-runtime/apis/event
@tauri-apps/api/window       → @r1-runtime/apis/window
@tauri-apps/api/dialog       → @r1-runtime/apis/dialog
@tauri-apps/api/clipboard    → @r1-runtime/apis/clipboard
@tauri-apps/api/os           → @r1-runtime/apis/os
@tauri-apps/api/store        → @r1-runtime/apis/store
@tauri-apps/api/notification → @r1-runtime/apis/notification
@tauri-apps/api/shell        → @r1-runtime/apis/shell
@tauri-apps/api/http         → @r1-runtime/apis/http
@tauri-apps/plugin-store     → @r1-runtime/apis/store
@tauri-apps/plugin-sql       → @r1-runtime/apis/sql
```

---

### `@r1-runtime/vite-plugin` — Build Tooling

Add one line to `vite.config.ts` and the plugin handles everything:

```typescript
r1Plugin({
    rustSrc: './src-tauri',   // default
    wasmOut: './public/wasm', // default
    manualBoot: false,        // set true to disable auto boot script injection
})
```

**What it does during `npm run build`:**

1. Detects `src-tauri/Cargo.toml`
2. Runs `wasm-pack build src-tauri/ --target web --out-dir public/wasm`
3. Replaces all `@tauri-apps/api/*` imports with `@r1-runtime/apis/*`
4. Injects the R1 boot script (`r1-boot.js`) into `index.html`
5. Bundles and emits `sw.js` (Kernel Worker)
6. Bundles and emits `r1-sw.js` (Service Worker)
7. Copies `sqlite3.wasm` and `sqlite3-opfs-async-proxy.js` to the output

**What it does during `npm run dev`:**

- Serves `sw.js`, `r1-boot.js`, and `r1-sw.js` on-the-fly via middleware
- Sets COOP/COEP/CORP headers on the dev server automatically
- Patches WASM glue code (`from "env"` → virtual module) on the fly

---

### `@r1-runtime/sw` — Service Worker

Intercepts requests to `asset://` URLs and serves files from the VFS.

This is what makes `convertFileSrc('/app/logo.png')` work. The URL is routed through the Service Worker, which reads the file from OPFS and returns it with the correct `Content-Type`.

The Service Worker registers automatically during `R1Runtime.boot()`.

---

### `@r1-runtime/window` — Virtual Window Manager

Renders app windows that look exactly like native OS windows — macOS traffic lights, Windows 11 title bar, or Linux GNOME header bar.

Each `VirtualWindow`:
- Is a sandboxed `iframe` hosted inside a styled `div`
- Supports drag-to-move, resize handles, minimise, maximise, close
- Has its own scoped EventBus channel for `emitTo` targeting

---

### `r1-macros` (crates.io) — Proc Macro

The `#[r1::command]` macro eliminates the JSON boilerplate from Rust commands.

**What the macro generates:**

```rust
// You write:
#[command]
pub fn greet(name: String) -> String {
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
    let result = {
        let name = args.name;
        format!("Hello, {}!", name)
    };
    match serde_json::to_string(&result) {
        Ok(s) => s,
        Err(e) => serde_json::json!({ "error": e.to_string() }).to_string(),
    }
}
```

---

## The JSON Contract

Every Rust function that exchanges data with JavaScript uses this exact signature:

```rust
#[wasm_bindgen]
pub fn my_command(payload: &str) -> String
```

One JSON string in. One JSON string out.

**Why JSON strings and not native types?**

WASM and JavaScript have incompatible type systems. Passing raw Rust structs across the boundary requires complex memory management. JSON strings are native to both sides — `serde_json` handles the Rust side, `JSON.parse` / `JSON.stringify` handle the JavaScript side. The overhead is under 1ms for typical payloads.

**Error convention:**

```rust
// Success — invoke() resolves with the value
serde_json::json!({ "ok": your_value }).to_string()

// Error — invoke() rejects with the message string
serde_json::json!({ "error": "description" }).to_string()
```

R1's `callFunction` inspects the response: if `"error"` is present, the `invoke()` Promise rejects. If `"ok"` is present, it resolves with the value.

---

## Rust → JavaScript Events

Rust code can emit events back to the frontend at any time during execution.

```rust
// Declared in the WASM module's r1.rs helper
extern "C" {
    fn r1_emit(name_ptr: *const u8, name_len: usize,
               payload_ptr: *const u8, payload_len: usize);
}

fn emit(event: &str, payload: &str) {
    unsafe {
        r1_emit(event.as_ptr(), event.len(),
                payload.as_ptr(), payload.len());
    }
}

#[wasm_bindgen]
pub fn process_file(payload: &str) -> String {
    for i in 0..100 {
        emit("progress", &format!(r#"{{"percent": {}}}"#, i));
    }
    serde_json::to_string(&"complete").unwrap()
}
```

```typescript
import { listen } from '@tauri-apps/api/event';

const unlisten = await listen<{ percent: number }>('progress', (event) => {
    updateProgressBar(event.payload.percent);
});

await invoke('process_file', { path: '/data/large.csv' });
unlisten();
```

---

## Performance

**VFS reads** come from memory — a read of a cached file is effectively instant (microseconds). The first read after a page load fetches from OPFS, which takes 1–5ms for small files.

**WASM execution** runs at near-native speed. The JSON serialisation overhead between JS and Rust is under 1ms for payloads under 1MB.

**WASM binary size** is the most common performance concern. A typical Rust backend compiles to 1–3MB of WASM. R1's Vite plugin runs `wasm-opt` automatically during builds, which typically reduces this by 30–40%.

For large payloads (images, binary files), use the VFS directly rather than passing binary data through `invoke` as Base64.

---

## Testing

R1's own test suite uses Vitest with happy-dom. Pre-compiled `.wasm` test binaries live in `tests/fixtures/wasm/` — never compile Rust in CI.

```typescript
import { describe, it, expect } from 'vitest';
import { WasmOrchestrator } from '@r1-runtime/kernel';
import { VFS } from '@r1-runtime/kernel';

describe('my command', () => {
    it('processes data correctly', async () => {
        const vfs = new VFS();
        await vfs.init();

        const orchestrator = new WasmOrchestrator(vfs);
        await orchestrator.loadModule('my-app', '/path/to/my_app_bg.wasm');

        const result = orchestrator.callFunction('my-app', 'my_command', {
            input: 'test value'
        });

        expect(result).toEqual({ ok: 'processed: test value' });
    });
});
```

Run the full suite:

```bash
npm test
```

105 tests across 17 test files. All must pass before any PR is merged.

---

## Package Dependency Rules

Packages must never import from packages above them in the stack:

```
@r1-runtime/kernel    ← no R1 imports (foundation)
@r1-runtime/core      ← may import from kernel
@r1-runtime/apis      ← may import from kernel
@r1-runtime/sw        ← no R1 imports (standalone)
@r1-runtime/window    ← may import from kernel
@r1-runtime/vite-plugin ← may import from all (build tool)
@r1-runtime/cli       ← no R1 runtime imports (Node.js tool)
```

`@r1-runtime/kernel` must never import from `@r1-runtime/core`. `@r1-runtime/core` must never import from `@r1-runtime/apis`.

---

## Adding a New API Plugin

1. Create `packages/apis/src/my-api.ts`:

```typescript
export class MyApiPlugin {
    getCommands() {
        return {
            'my_api|do_thing': this.doThing.bind(this),
        };
    }

    private async doThing(args: { value: string }): Promise<string> {
        return `processed: ${args.value}`;
    }
}
```

2. Register it in `packages/apis/src/index.ts`:

```typescript
import { MyApiPlugin } from './my-api.js';
// ... add to the plugin registry
```

3. Add an export to `packages/apis/package.json`:

```json
"./my-api": "./src/my-api.ts"
```

4. Add the import mapping to `packages/vite-plugin/src/index.ts`:

```typescript
'@tauri-apps/api/my-api': '@r1-runtime/apis/my-api',
```

5. Write tests in `packages/apis/src/my-api.test.ts`.

---

## Adding a WASI Syscall

If a Rust crate hits an unimplemented syscall, add it to `packages/kernel/src/wasi-shim.ts`:

```typescript
// Find the syscall table and add your implementation
fd_my_syscall: (fd: number, ...args: any[]): number => {
    // Implement using VFS or return ERRNO_NOSYS
    return ERRNO_NOSYS;
},
```

Every syscall has the same shape. Look at existing implementations as a template. Add a test in `packages/kernel/src/wasi-shim.test.ts`.

---

## Limitations

**Native OS APIs** — anything requiring real OS access (spawning processes, raw sockets, Unix signals, system tray) cannot work in a browser sandbox. R1 stubs these gracefully: unsupported commands return `ERRNO_NOSYS` rather than crashing.

**The `tauri` crate** — the main `tauri` crate depends on native OS bindings and cannot compile to WASM. R1 solves this with conditional compilation: the `tauri` dependency is gated behind `cfg(not(target_arch = "wasm32"))`. See GETTING_STARTED.md for the exact `Cargo.toml` setup.

**Memory sharing** — WASM and JavaScript cannot share memory directly without `SharedArrayBuffer` and special headers. All data must be serialisable to JSON. For most apps this is not a limitation in practice.

**WASI shim completeness** — R1 implements the most common WASI syscalls. Exotic syscalls (raw I/O multiplexing, Unix domain sockets) are stubbed with `ERRNO_NOSYS`. If your Rust code uses an unsupported syscall, it will receive that error code rather than crashing.
