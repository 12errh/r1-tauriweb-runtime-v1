# R1 TauriWeb Runtime — From-Scratch Roadmap

> **Mission**: End users can visit a URL and run any Tauri app instantly —
> no installer, no download, no server required.
>
> **Constraint**: 100% serverless. Deploys to Vercel, Netlify, or GitHub Pages.
> The only "server" is the developer's own machine during the build step.
>
> **Target apps**: Simple to medium Tauri apps — notes, todos, file viewers,
> editors, dashboards. Anything that uses `invoke`, `fs`, `event`, and `dialog`.
>
> **Rule #1**: Never start a phase unless every Exit Criteria of the previous
> phase is checked off. No exceptions.
>
> **Rule #2**: Never run WASM on the main thread. Ever.
>
> **Rule #3**: All JS ↔ WASM data travels as JSON strings. No raw pointers.

---

## How It Works (The Big Picture)

```
DEVELOPER'S MACHINE (build time)
┌─────────────────────────────────────────────┐
│  1. Developer has a normal Tauri project     │
│  2. Runs: npm run build                      │
│  3. @r1/vite-plugin automatically:           │
│     a. Compiles src-tauri/ → app.wasm        │
│     b. Patches @tauri-apps imports → @r1     │
│     c. Injects R1 boot script                │
│  4. Output: a static folder → deploy anywhere│
└─────────────────────────────────────────────┘
                      ↓  (static files on CDN)

END USER'S BROWSER (runtime)
┌─────────────────────────────────────────────┐
│  Main Thread                                 │
│  ├─ R1 Runtime boots                         │
│  ├─ Patches window.__TAURI_INTERNALS__        │
│  ├─ Registers Service Worker                 │
│  ├─ Spawns Kernel Worker                     │
│  └─ Virtual Window Manager                   │
│     └─ Hosts app in sandboxed iframe         │
│                                              │
│  Kernel Worker (Web Worker)                  │
│  ├─ WasmOrchestrator                         │
│  │  ├─ Module Registry (Map<name, instance>) │
│  │  ├─ WASI Shim → redirects to OPFS         │
│  │  └─ Event Bridge → emits back to JS       │
│  └─ VFS (Virtual File System)                │
│     ├─ Memory cache (fast reads)             │
│     └─ OPFS backend (persistent writes)      │
│                                              │
│  Service Worker                              │
│  └─ Intercepts asset:// → serves from VFS   │
└─────────────────────────────────────────────┘
```

---

## Package Structure

```
r1-runtime/                        ← monorepo root
├── packages/
│   ├── @r1/core/                  ← IPC bridge + EventBus + Boot
│   ├── @r1/kernel/                ← Web Worker + WasmOrchestrator + WASI
│   ├── @r1/apis/                  ← All Tauri API implementations
│   ├── @r1/window/                ← Virtual Window Manager + OS themes
│   ├── @r1/sw/                    ← Service Worker (asset protocol)
│   └── @r1/vite-plugin/           ← Build tooling (Rust → WASM)
├── apps/
│   └── demo/                      ← A real simple Tauri app for testing
├── tests/
│   └── fixtures/
│       └── wasm/                  ← Pre-compiled test .wasm binaries
├── package.json                   ← Workspace root
├── tsconfig.base.json             ← Shared TypeScript config
└── vite.config.base.ts            ← Shared Vite config
```

---

## Technology Reference

Know these before writing any code. Each does one specific job.

| Tool | Job | Never confuse it with |
|---|---|---|
| `wasm-pack` | Compiles a Rust project → `.wasm` + JS glue | `cargo build` (makes native binaries) |
| `wasm-bindgen` | Lets Rust and JS share strings and objects | Raw WASM memory pointers |
| `WASI` | Standard API so WASM can call "OS" functions (files, time) | Direct OPFS calls |
| `serde_json` | Rust library that converts structs → JSON strings | Manual string parsing |
| `OPFS` | Browser API for persistent file storage (survives refresh) | `localStorage` (string-only, tiny limit) |
| `Kernel Worker` | The Web Worker where all WASM runs | The main UI thread |
| `Module Registry` | `Map<string, WasmInstance>` tracking loaded modules | A single hardcoded module variable |

---

## Non-Negotiable Architecture Rules

These apply to every single phase. Breaking any of these will cause hard-to-debug
bugs in later phases.

### Rule 1 — WASM never runs on the main thread
All WASM execution happens inside the Kernel Worker. The main thread only handles
UI work (rendering windows, showing dialogs, writing to clipboard). If the Kernel
Worker blocks for 5 seconds processing a large file, the UI stays perfectly responsive.

### Rule 2 — One message protocol, everywhere
The Kernel Worker and main thread communicate through a single, typed message format.
Every message has a `type`, `id`, `payload`, and optional `error`. No ad-hoc strings.

```typescript
// Every message across the Worker boundary looks like this
interface KernelMessage {
  id: string;       // UUID — used to match request to response
  type: string;     // e.g. 'IPC_INVOKE' | 'VFS_READ' | 'WASM_LOAD'
  payload: unknown; // JSON-serialisable data
  error?: string;   // Set on error responses
}
```

### Rule 3 — All WASM functions use the JSON contract
Every Rust function that needs to exchange data with JS uses this exact signature:
```rust
pub fn my_command(payload: &str) -> String
// JSON string in → process → JSON string out
```
The JS side serialises before calling and deserialises after. The Rust side uses
`serde_json` to decode the input and encode the output. No exceptions.

### Rule 4 — All Rust panics are caught at the JS boundary
A WASM panic that reaches JS silently kills the Kernel Worker. Every single
WASM function call must be wrapped in a `try/catch`. On error, return a structured
error message back through the message protocol. Never let a panic disappear.

### Rule 5 — WASI syscalls always go to OPFS
When Rust code calls `std::fs::read_to_string`, that becomes a WASI syscall.
Your WASI shim catches it and redirects to the VFS. Rust code never needs to
know it is running in a browser. It writes files exactly as it would on macOS
or Windows.

### Rule 6 — The Module Registry owns all WASM instances
Use `Map<string, WasmModule>`. Every `loadModule(name, url)` call stores under
the given name. Every `callFunction(name, fn, args)` looks up by name first.
`unloadModule(name)` removes it cleanly. No global variables, no singletons.

### Rule 7 — IPC commands register themselves
Every Tauri API class and every WASM module registers its own commands at boot
using a `getCommands()` method that returns `Map<string, CommandHandler>`.
The IPC router never has hardcoded command names.

---

## Phase 0 — Monorepo Foundation

> **Goal**: A working, properly configured monorepo where every package can be
> developed, built, and tested independently.
>
> This phase has zero runtime code. It is entirely setup. Do it right once so
> you never fight tooling again.

### Why this matters
Skipping proper monorepo setup causes circular import bugs, broken TypeScript
paths, and packages that can only be tested together. Phase 0 is the foundation
under the foundation.

### Tasks

- [x] **0.1 — Initialise the npm workspace.**
  Create the root `package.json` with `"workspaces": ["packages/*", "apps/*"]`.
  Install TypeScript, Vite, and Vitest at the workspace root only.

- [x] **0.2 — Create `tsconfig.base.json` at the root.**
  Settings that every package inherits:
  ```json
  {
    "compilerOptions": {
      "target": "ES2022",
      "module": "ESNext",
      "moduleResolution": "bundler",
      "strict": true,
      "isolatedModules": true,
      "lib": ["ES2022", "DOM", "DOM.Iterable"]
    }
  }
  ```

- [x] **0.3 — Scaffold each package.**
  Create the six package directories. Each gets:
  - `package.json` with its own name, version `0.1.0`, and `"type": "module"`
  - `tsconfig.json` that extends `../../tsconfig.base.json`
  - `src/index.ts` with a single export comment: `// @r1/package-name`
  - `vite.config.ts` in library mode

- [x] **0.4 — Configure path aliases.**
  In the root `tsconfig.json`, add paths so packages can import each other
  without published npm versions:
  ```json
  "paths": {
    "@r1/core":        ["./packages/core/src/index.ts"],
    "@r1/kernel":      ["./packages/kernel/src/index.ts"],
    "@r1/apis":        ["./packages/apis/src/index.ts"],
    "@r1/window":      ["./packages/window/src/index.ts"]
  }
  ```

- [x] **0.5 — Set up Vitest.**
  One `vitest.config.ts` at the root. All `*.test.ts` files in any package are
  discovered automatically. Confirm `npm test` runs from the root.

- [x] **0.6 — Create the demo app scaffold.**
  `apps/demo/` is a blank Vite + React app. It imports `@r1/core` but does
  nothing yet. Confirm `npm run dev` starts it without errors.

- [x] **0.7 — Create the WASM test fixtures directory.**
  `tests/fixtures/wasm/` will hold pre-compiled test `.wasm` binaries.
  Commit a `README.md` explaining that these are compiled with
  `wasm-pack build --target web` and should never be rebuilt in CI.

### Exit Criteria
- [x] `npm install` at the root installs everything.
- [x] `npm test` at the root runs without errors (zero tests, zero failures).
- [x] `npm run dev` in `apps/demo/` starts a working dev server.
- [x] Each package has its own `tsconfig.json` that compiles without errors.
- [x] No circular dependencies exist between packages.

---

## Phase 1 — Kernel Worker + Message Protocol

> **Goal**: A Web Worker that accepts typed messages, processes them through a
> router, and sends typed responses back. No WASM yet. Just the communication
> infrastructure.

### What you are building

The Kernel Worker is a permanent background thread. It never stops. Every heavy
operation in R1 goes through it. The message protocol is the contract that lets
the main thread talk to it safely.

```
Main Thread                              Kernel Worker
──────────                              ─────────────
kernelProxy.send('PING', {})    ──→     router.handle('PING')
                                ←──     { id, type: 'PONG', payload: {} }
```

### Tasks

- [ ] **1.1 — Create `packages/kernel/src/kernel.worker.ts`.**
  This is the Worker entry point. It sets up the message router and listens for
  messages on `self.onmessage`. It never imports anything from `@r1/core`.

- [ ] **1.2 — Define the message protocol types.**
  Create `packages/kernel/src/protocol.ts`:
  ```typescript
  export interface KernelRequest {
    id: string;       // nanoid() — unique per request
    type: string;     // Command name e.g. 'IPC_INVOKE'
    payload: unknown; // Must be JSON-serialisable
  }

  export interface KernelResponse {
    id: string;       // Matches the request id
    payload: unknown; // Result data
    error?: string;   // Defined only on failure
  }
  ```

- [x] **1.3 — Build the message router.**
  Create `packages/kernel/src/router.ts`. The router holds a
  `Map<string, Handler>` and a `register(type, handler)` method.
  When a message arrives, the router finds the handler by `type`, calls it with
  the `payload`, and returns a `KernelResponse`. Unknown types return
  `{ error: 'Unknown command: TYPE' }`.

- [x] **1.4 — Build the `KernelProxy` for the main thread.**
  Create `packages/core/src/kernel-proxy.ts`. This class:
  - Spawns the Kernel Worker using `new Worker(url, { type: 'module' })`
  - Exposes `send(type, payload): Promise<unknown>`
  - Each call creates a unique `id`, sends the message, and returns a Promise
    that resolves when a response with the matching `id` arrives
  - Times out after 30 seconds and rejects with a clear error message
  - Attaches `worker.onerror` and `worker.onmessageerror` handlers that log
    a clear error — never silently swallow Worker crashes

- [x] **1.5 — Register a PING handler as the first smoke test.**
  In `kernel.worker.ts`, register:
  ```typescript
  router.register('PING', async () => ({ pong: true, ts: Date.now() }));
  ```

- [ ] **1.6 — Write the smoke test.**
  In `packages/kernel/src/kernel.test.ts`:
  - Send a `PING` message via `KernelProxy`
  - Assert the response contains `{ pong: true }`
  - Send an unknown message type
  - Assert the response contains `{ error: 'Unknown command: ...' }`

### Exit Criteria
- [x] A `PING` sent from the main thread gets a `PONG` response from the Worker.
- [x] An unknown message type returns a clean `error` string, not a crash.
- [x] Worker crashes (`onerror`) are caught and logged with a readable message.
- [x] The Promise returned by `send()` rejects cleanly after 30s on no response.

---

## Phase 2 — IPC Bridge (Patching Tauri)

> **Goal**: When the developer's Tauri app calls `invoke('my_command', {...})`,
> R1 intercepts it, routes it through the Kernel Worker, and returns the result.
> The app never knows it is running in a browser.

### What you are building

Real Tauri injects two globals that its JS API uses:
- **Tauri v1**: `window.__TAURI_IPC__` — a function that posts messages to Rust
- **Tauri v2**: `window.__TAURI_INTERNALS__` — an object with `invoke` and `transformCallback`

R1 replaces both of these at boot time. Any call to `invoke()` from the developer's
app hits R1's handler, which forwards it to the Kernel Worker.

```
Developer app:   await invoke('greet', { name: 'Alice' })
                        ↓
IPC Bridge:      window.__TAURI_INTERNALS__.invoke('greet', { name: 'Alice' })
                        ↓
KernelProxy:     send('IPC_INVOKE', { command: 'greet', args: { name: 'Alice' } })
                        ↓
Kernel Router:   finds handler for 'greet', calls it, returns result
                        ↓
Developer app:   receives: 'Hello, Alice!'
```

### Tasks

- [x] **2.1 — Create `packages/core/src/ipc-bridge.ts`.**
  Export a function `installIpcBridge(kernelProxy: KernelProxy): void`.
  This function patches both globals.

- [x] **2.2 — Patch Tauri v2 (`window.__TAURI_INTERNALS__`).**
  ```typescript
  (window as any).__TAURI_INTERNALS__ = {
    invoke: async (command: string, args: unknown) => {
      const response = await kernelProxy.send('IPC_INVOKE', { command, args });
      if (response.error) throw new Error(response.error);
      return response.payload;
    },
    transformCallback: (callback: Function, once: boolean) => {
      const id = callbackRegistry.register(callback, once);
      return id;
    }
  };
  ```

- [x] **2.3 — Patch Tauri v1 (`window.__TAURI_IPC__`).**
  Tauri v1 uses a different message format with `cmd` and `callback`/`error`
  numeric IDs (from `transformCallback`). Parse this format and translate it
  to the same `IPC_INVOKE` message the router handles.

- [x] **2.4 — Build the callback registry.**
  Create `packages/core/src/callback-registry.ts`. This holds a
  `Map<number, Function>`. `register(fn, once)` stores the callback and returns
  a unique numeric ID. `trigger(id, payload)` calls the callback.
  If `once` is true, the callback is removed after the first call.
  This is what makes Tauri's promise-based `invoke` work under the hood.

- [x] **2.5 — Register `IPC_INVOKE` stub handler in the Kernel Worker.**
  For now, the handler just echoes back the command name as a test:
  ```typescript
  router.register('IPC_INVOKE', async ({ command, args }) => {
    return { result: `[stub] called: ${command}` };
  });
  ```
  This will be replaced with real dispatch in Phase 8.

- [x] **2.6 — Create `R1Runtime` class in `packages/core/src/runtime.ts`.**
  The single entry point for all of R1:
  ```typescript
  export class R1Runtime {
    async boot(): Promise<void> {
      // 1. Spawn Kernel Worker
      // 2. Install IPC bridge
      // 3. Register Service Worker (Phase 10)
      // 4. Load developer's WASM (Phase 4)
    }
  }
  ```
  For now, `boot()` just spawns the Worker and installs the IPC bridge.

- [x] **2.7 — Write the smoke test.**
  - Call `await invoke('test_command', { value: 42 })`
  - Assert the response contains `[stub] called: test_command`
  - Confirm no errors appear in the console

### Exit Criteria
- [x] `invoke('any_command')` from the developer's app reaches the Kernel Worker.
- [x] Both Tauri v1 and v2 `invoke` formats are handled.
- [x] A failed command (handler throws) rejects the `invoke` promise with a
  clean error, not an unhandled rejection.
- [x] The `transformCallback` implementation correctly handles `once: true`.

---

## Phase 3 — Virtual File System (OPFS)

> **Goal**: A persistent, in-browser filesystem that survives page refreshes.
> Reads are instant (memory cache). Writes persist to OPFS.
> This runs entirely inside the Kernel Worker.

### What you are building

OPFS (Origin Private File System) is a modern browser API that gives each origin
a real persistent filesystem. It is fast, has no size limit (beyond disk space),
and is completely private to your origin. R1 wraps it in a simple VFS class with
a memory cache for fast reads.

```
VFS.read('/app/settings.json')
  → found in memory cache → return immediately (microseconds)

VFS.write('/app/settings.json', data)
  → update memory cache immediately (sync)
  → write to OPFS in background (async)
  → both complete → return to caller

After browser refresh:
VFS.read('/app/settings.json')
  → not in memory cache → read from OPFS → populate cache → return
```

### Tasks

- [x] **3.1 — Create `packages/kernel/src/vfs.ts`.**
  Export a `VFS` class. It is only ever instantiated inside the Kernel Worker.

- [x] **3.2 — Implement the memory cache layer.**
  Private `cache: Map<string, Uint8Array>`. This is the fast path for reads.
  All reads check the cache first.

- [x] **3.3 — Implement OPFS initialisation.**
  `async init(): Promise<void>` calls `navigator.storage.getDirectory()` to
  get the OPFS root. Stores the handle privately. Must be called once before
  any other VFS operation.

- [x] **3.4 — Implement the core VFS operations.**
  All methods are `async`. All paths are POSIX-style strings (`/app/data.json`).

  | Method | Signature | Behaviour |
  |---|---|---|
  | `read` | `(path) → Uint8Array` | Cache hit → return. Miss → read OPFS → cache → return |
  | `write` | `(path, data: Uint8Array) → void` | Update cache immediately, write OPFS async |
  | `delete` | `(path) → void` | Remove from cache and OPFS |
  | `exists` | `(path) → boolean` | Check cache first, then OPFS |
  | `list` | `(dir) → string[]` | List all paths under a directory |
  | `mkdir` | `(dir) → void` | Create directory recursively |
  | `readText` | `(path) → string` | `read()` then decode as UTF-8 |
  | `writeText` | `(path, text) → void` | Encode UTF-8 then `write()` |

- [x] **3.5 — Implement OPFS path resolution.**
  OPFS uses nested directory handles, not string paths. Build a private helper
  `resolvePath(path: string): Promise<FileSystemFileHandle>` that walks the
  path segments to find or create the correct handle.

- [x] **3.6 — Register VFS handlers in the Kernel Router.**
  ```
  'VFS_READ'   → { path } → { data: number[] }
  'VFS_WRITE'  → { path, data: number[] } → {}
  'VFS_DELETE' → { path } → {}
  'VFS_EXISTS' → { path } → { exists: boolean }
  'VFS_LIST'   → { dir }  → { paths: string[] }
  ```

- [x] **3.7 — Write the smoke test.**
  - Write a string to `/test/hello.txt` — read it back — assert content matches
  - Delete it — assert `exists` returns false
  - Write a nested path `/test/deep/nested/file.txt` — assert it works
  - Confirm the file persists after reinitialising the VFS (simulates refresh)

### Exit Criteria
- [x] Files written survive VFS reinitialisation.
- [x] Nested directory paths are created automatically on write.
- [x] Reading a non-existent path returns a clean error, not a crash.
- [x] All 8 VFS operations work correctly.

---

## Phase 4 — WasmOrchestrator + Module Registry

> **Goal**: The Kernel Worker can load a `.wasm` binary by name and URL, call
> exported functions on it, and unload it cleanly. Multiple modules can be
> loaded simultaneously.

### Tasks

- [x] **4.1 — Create `packages/kernel/src/wasm-orchestrator.ts`.**
  Export a `WasmOrchestrator` class. Instantiated once inside the Kernel Worker.

- [x] **4.2 — Implement the Module Registry.**
  ```typescript
  interface WasmModule {
    instance: WebAssembly.Instance;
    exports: WebAssembly.Exports;
  }
  private modules: Map<string, WasmModule> = new Map();
  ```

- [x] **4.3 — Implement `loadModule(name, url)`.**
  1. Fetch the `.wasm` binary from `url`
  2. Build the `importObject` (empty for now — WASI comes in Phase 6)
  3. Call `WebAssembly.instantiate(bytes, importObject)`
  4. Store in the Module Registry under `name`
  5. If a module with that name already exists, unload it first

- [x] **4.4 — Implement `callFunction(moduleName, fnName, args)`.**
  1. Look up module in registry — throw clean error if not found
  2. Look up function in `module.exports` — throw clean error if not found
  3. Wrap the call in `try/catch` — convert any WASM panic to a clean error string
  4. For numeric args (array of numbers): call with spread args
  5. For object args: `JSON.stringify` → call → `JSON.parse`
  6. Return the result

- [x] **4.5 — Implement `unloadModule(name)`.**
  Remove from the registry. Log a warning if the module does not exist.

- [x] **4.6 — Register WASM handlers in the Kernel Router.**
  ```
  'WASM_LOAD'   → { name, url } → {}
  'WASM_CALL'   → { module, fn, args } → { result }
  'WASM_UNLOAD' → { name } → {}
  ```

- [x] **4.7 — Compile the test fixture.**
  Create `tests/fixtures/rust/test-module/src/lib.rs`:
  ```rust
  #[no_mangle]
  pub fn add(a: i32, b: i32) -> i32 { a + b }

  #[no_mangle]
  pub fn multiply(a: i32, b: i32) -> i32 { a * b }
  ```
  Compile with `wasm-pack build --target web`.
  Commit the `.wasm` output to `tests/fixtures/wasm/test-module.wasm`.

- [x] **4.8 — Write the smoke test.**
  - Load `test-module.wasm` — call `add(3,4)` → assert `7`
  - Call `multiply(3,4)` → assert `12`
  - Call a non-existent function — assert clean error returned
  - Load a second module simultaneously — assert both callable
  - Unload first — assert its functions no longer callable
  - Assert second module still works

### Exit Criteria
- [x] Two `.wasm` modules loaded simultaneously under different names.
- [x] Calling a function on an unloaded module returns a clean error.
- [x] A WASM panic is caught and returned as an error string.
- [x] `unloadModule` does not affect other loaded modules.

---

## Phase 5 — Serde JSON Bridge

> **Goal**: JS can pass a complex nested object to a Rust function and receive
> a complex object back. No raw memory pointers. No manual string packing.

### The contract (memorise this)

Every Rust function that exchanges data uses this exact signature:
```rust
pub fn my_command(payload: &str) -> String
//                ^^^^^^^^^^^         ^^^^^^
//                JSON string in      JSON string out
```

### Tasks

- [ ] **5.1 — Create the Rust WASM template.**
  Create `packages/wasm-template/` — a complete Rust project developers copy:
  ```
  wasm-template/
  ├── Cargo.toml        ← includes serde, serde_json, wasm-bindgen
  └── src/
      ├── lib.rs        ← example commands using the JSON contract
      └── r1.rs         ← R1 helper module (emit events)
  ```
  `Cargo.toml` dependencies:
  ```toml
  [dependencies]
  wasm-bindgen = "0.2"
  serde = { version = "1", features = ["derive"] }
  serde_json = "1"

  [lib]
  crate-type = ["cdylib"]
  ```

- [ ] **5.2 — Write the example command in `lib.rs`.**
  ```rust
  use wasm_bindgen::prelude::*;
  use serde::{Deserialize, Serialize};

  #[derive(Serialize, Deserialize)]
  struct GreetArgs { name: String }

  #[derive(Serialize, Deserialize)]
  struct GreetResult { message: String, length: usize }

  #[wasm_bindgen]
  pub fn greet(payload: &str) -> String {
      let args: GreetArgs = serde_json::from_str(payload).expect("invalid payload");
      let result = GreetResult {
          message: format!("Hello, {}!", args.name),
          length: args.name.len(),
      };
      serde_json::to_string(&result).unwrap()
  }
  ```

- [ ] **5.3 — Update `callFunction` in `WasmOrchestrator`.**
  Detect contract: object args → JSON contract. Array of numbers → numeric contract.

- [ ] **5.4 — Handle Rust errors through the JSON contract.**
  All commands return errors as a JSON envelope:
  ```rust
  // Success:  { "ok": <result> }
  // Failure:  { "error": "description" }
  ```
  `callFunction` on JS inspects the response: if `"error"` key exists, throw.
  If `"ok"` key exists, return the value.

- [ ] **5.5 — Compile the JSON test fixture.**
  Add `echo_object` to the test fixture:
  receives `{ name: string, count: number }`,
  returns `{ name: string, count: number, doubled: number }`.
  Recompile and commit the new `.wasm`.

- [ ] **5.6 — Write the smoke test.**
  - Call `echo_object({ name: 'Alice', count: 5 })` → assert `doubled: 10`
  - Call with a missing required field — assert clean error string
  - Call with malformed JSON — assert clean error string, no crash

### Exit Criteria
- [x] A nested JS object round-trips through Rust and back without data loss.
- [x] Missing required fields return a clean error, not a WASM panic.
- [x] The `wasm-template` compiles with `wasm-pack build` with zero warnings.
- [x] Error responses use the `{ error: string }` envelope correctly.

---

## Phase 6 — WASI Shim (Rust File I/O → VFS)

> **Goal**: When Rust code calls `std::fs::read_to_string("/config.json")`,
> that silently redirects to the VFS. The Rust developer's code is unchanged.

### How WASI works

When Rust is compiled with `--target wasm32-wasi`, every `std::fs` call becomes
a call to a standard function in the `wasi_snapshot_preview1` namespace.
These functions do not exist in the browser — you must provide them as imports.
By providing your own implementations, you intercept all file I/O and redirect
it to the VFS.

### Tasks

- [ ] **6.1 — Create `packages/kernel/src/wasi-shim.ts`.**
  Export one function: `createWasiImports(vfs: VFS): WebAssembly.Imports`

- [ ] **6.2 — Implement the file descriptor table.**
  - fd 0 = stdin (stub — always returns EOF)
  - fd 1 = stdout (capture output, emit as events or log)
  - fd 2 = stderr (capture output, emit as error events)
  - fd 3+ = real VFS files, assigned dynamically on `path_open`

- [ ] **6.3 — Implement WASI functions in priority order.**

  **Priority 1 — File I/O (implement first):**
  - `path_open` — look up or create a VFS file, return a new fd
  - `fd_read` — read bytes from the VFS file at this fd
  - `fd_write` — write bytes to VFS (or stdout/stderr for fd 1/2)
  - `fd_close` — release the fd from the table
  - `fd_seek` — move the read/write position

  **Priority 2 — Directory operations:**
  - `path_create_directory`, `path_remove_directory`, `path_unlink_file`, `fd_readdir`

  **Priority 3 — Time and random:**
  - `clock_time_get` → return `BigInt(Date.now() * 1_000_000)` (nanoseconds)
  - `random_get` → fill buffer with `crypto.getRandomValues()`
  - `proc_exit` → throw a catchable `WasiExitError`

  **Priority 4 — All remaining functions:**
  Implement as stubs returning `ERRNO_NOSYS` (error code 52).
  This prevents crashes without requiring all ~50 WASI functions upfront.

- [ ] **6.4 — Wire the shim into `WasmOrchestrator.loadModule`.**
  The `importObject` passed to `WebAssembly.instantiate` must always include
  the WASI shim. The `VFS` instance is injected into `WasmOrchestrator` at
  construction time.

- [ ] **6.5 — Update wasm-template to target `wasm32-wasi`.**
  Change compile target. Rebuild the test fixture. Commit updated `.wasm`.

- [ ] **6.6 — Compile the WASI test fixture.**
  Add `write_and_read` to the test fixture:
  receives `{ path: string, content: string }`,
  writes with `std::fs::write`, reads back with `std::fs::read_to_string`,
  returns `{ ok: string }`.

- [ ] **6.7 — Write the smoke test.**
  - Call `write_and_read({ path: '/wasi-test.txt', content: 'hello wasi' })`
  - Assert returned content is `'hello wasi'`
  - Verify file exists in VFS via `vfs.exists('/wasi-test.txt')`
  - Verify file persists after VFS reinitialisation
  - Verify an unimplemented WASI syscall returns `ERRNO_NOSYS`, no crash

### Exit Criteria
- [x] `std::fs::write` and `std::fs::read_to_string` work from Rust.
- [x] Files written by Rust are readable from JS via VFS.
- [x] Files written by Rust survive browser refresh.
- [x] An unimplemented WASI syscall returns `ERRNO_NOSYS`, no crash.
- [x] `proc_exit(0)` throws a catchable error, not a hard Worker crash.

---

## Phase 7 — Rust → JS Event Bridge

> **Goal**: Rust code can emit events that arrive at JS `listen()` handlers,
> exactly like `app_handle.emit("progress", payload)` in real Tauri.

### How it works

WASM execution is synchronous — it cannot "push" to JS mid-execution.
The solution is callback injection: a JS function is passed into WASM at load
time via the `env` import. Rust calls this function to emit events.

**JS side** — inject callback at module load time:
```typescript
const importObject = {
  env: {
    r1_emit: (namePtr: number, nameLen: number,
               payloadPtr: number, payloadLen: number) => {
      const name    = readUtf8(instance, namePtr, nameLen);
      const payload = readUtf8(instance, payloadPtr, payloadLen);
      eventBus.emit(name, JSON.parse(payload));
    }
  },
  wasi_snapshot_preview1: { /* shim from Phase 6 */ }
};
```

**Rust side** — declare the external import in `src/r1.rs`:
```rust
extern "C" {
    fn r1_emit(name: *const u8, name_len: usize,
               payload: *const u8, payload_len: usize);
}

pub fn emit(event: &str, payload: &str) {
    unsafe {
        r1_emit(event.as_ptr(), event.len(),
                payload.as_ptr(), payload.len());
    }
}
```

Developers call: `r1::emit("download-progress", r#"{ "percent": 75 }"#);`

### Tasks

- [ ] **7.1 — Implement `readUtf8(instance, ptr, len)` helper.**
  Reads a UTF-8 string from the WASM linear memory buffer using
  `instance.exports.memory` and `TextDecoder`.

- [ ] **7.2 — Build the `EventBus` in `packages/core/src/event-bus.ts`.**
  ```typescript
  export class EventBus {
    on(event: string, handler: Function): () => void   // returns unlisten fn
    once(event: string, handler: Function): () => void
    emit(event: string, payload: unknown): void
    emitTo(windowId: string, event: string, payload: unknown): void
  }
  ```

- [ ] **7.3 — Add `env.r1_emit` to `WasmOrchestrator.loadModule`.**
  Added to the `importObject` alongside the WASI shim.
  The callback calls `this.eventBus.emit(name, JSON.parse(payload))`.

- [ ] **7.4 — Add `src/r1.rs` to the wasm-template.**
  Contains the `extern "C"` declaration and safe `emit()` wrapper.
  Zero raw pointer work required from the developer.

- [ ] **7.5 — Expose Tauri-compatible `listen()` in the IPC bridge.**
  ```typescript
  (window as any).__TAURI_INTERNALS__.listen =
    (event, handler) => Promise.resolve(eventBus.on(event, handler));

  (window as any).__TAURI_INTERNALS__.once =
    (event, handler) => Promise.resolve(eventBus.once(event, handler));
  ```

- [ ] **7.6 — Compile the event test fixture.**
  Add `run_counter` to the test fixture:
  emits 5 events (`{ value: 1 }` through `{ value: 5 }`), returns `{ ok: "done" }`.

- [ ] **7.7 — Write the smoke test.**
  - Subscribe to `"count"` with `listen()`
  - Call `run_counter({})` — assert all 5 events arrive in order
  - Unsubscribe — call again — assert no events received

### Exit Criteria
- [ ] Rust emits events received by a JS `listen()` handler.
- [ ] Events fire in correct order.
- [ ] Unsubscribing stops receiving events.
- [ ] The `wasm-template` emits events with zero pointer manipulation in user code.

---

## Phase 8 — Tauri API Layer

> **Goal**: All common Tauri APIs work. The developer's app calls them exactly
> as it would on a real desktop.

### Architecture

Every Tauri API is a class in `packages/apis/src/`. Each class has a
`getCommands()` method that returns `Map<string, CommandHandler>`.

Main-thread-only APIs (dialog, clipboard) are registered with the main thread.
All other APIs run in the Kernel Worker.

### APIs — implement in priority order

#### Tier 1 — Core (all required before moving on)

- [ ] **8.1 — `fs` plugin.**
  `read_file`, `write_file`, `read_text_file`, `write_text_file`, `exists`,
  `remove_file`, `create_dir`, `read_dir`, `rename`, `copy_file`.
  All proxy to the VFS from Phase 3.

- [ ] **8.2 — `event` plugin.**
  `emit`, `emit_to`, `listen`, `unlisten`.
  Proxies to the EventBus from Phase 7.

- [ ] **8.3 — `core` plugin.**
  `get_app_info` — returns app name, version, Tauri version injected at build time.

#### Tier 2 — Standard

- [ ] **8.4 — `dialog` plugin (main thread).**
  `message`, `ask`, `confirm` → OS-themed modal dialogs (Phase 9 Window Manager).
  `open`, `save` → use `<input type="file">`.

- [ ] **8.5 — `os` plugin.**
  `platform`, `arch`, `version`, `locale`, `hostname`.
  Returns simulated OS values — configurable per-app.

- [ ] **8.6 — `clipboard` plugin (main thread).**
  `read_text`, `write_text` — uses `navigator.clipboard`.

- [ ] **8.7 — `store` plugin.**
  Key-value store backed by VFS. Data stored at `/.r1-store/<name>.json`.
  Commands: `get`, `set`, `delete`, `has`, `keys`.

#### Tier 3 — Extended (implement after the demo app works)

- [ ] **8.8 — `http` plugin.** Proxies `fetch()` from the guest app context.
- [ ] **8.9 — `notification` plugin.** Uses the Web Notifications API.
- [ ] **8.10 — `shell` plugin (partial).** `open(url)` → `window.open()`.
- [ ] **8.11 — `path` plugin.** Path manipulation utilities, pure JS.

### Developer WASM command auto-wiring

After the developer's `.wasm` loads, auto-discover its commands:
```typescript
for (const [name, fn] of Object.entries(instance.exports)) {
  if (typeof fn === 'function' && !name.startsWith('__')) {
    router.register(name, (args) => orchestrator.callFunction(moduleName, name, args));
  }
}
```

- [ ] **8.12 — Write the integration test.**
  Using wasm-template, create a mini app that:
  - Writes and reads a file via `fs`
  - Stores and retrieves a value via `store`
  - Emits and receives an event via `event`
  All via `invoke()`. Assert all operations return correct results.

### Exit Criteria
- [ ] All Tier 1 APIs work correctly end-to-end.
- [ ] `dialog.message()` shows a visible modal on screen.
- [ ] `clipboard.writeText()` and `readText()` work.
- [ ] Store values persist across VFS reinitialisation.
- [ ] Developer WASM commands are auto-discovered and callable via `invoke`.

---

## Phase 9 — Virtual Window Manager + OS Themes

> **Goal**: The developer's Tauri app runs in a window that looks exactly like
> a native OS window — traffic lights on macOS, Mica title bar on Windows 11,
> header bar on Linux.

### Tasks

- [ ] **9.1 — Create `packages/window/src/window-manager.ts`.**
  `open(config)`, `close(id)`, `focus(id)`, `getWindow(id)`.

- [ ] **9.2 — Create `packages/window/src/virtual-window.ts`.**
  A DOM `div` with OS chrome + sandboxed `iframe` for the app.
  `setTitle(title)`, `setSize(w, h)`, `setPosition(x, y)`.

- [ ] **9.3 — Implement OS-accurate window chrome.**
  CSS themes in `packages/window/src/themes/`:
  - `macos.css` — traffic light buttons, blurred title bar
  - `windows11.css` — Mica-effect title bar, Windows control icons
  - `linux.css` — GNOME-style header bar

- [ ] **9.4 — Implement drag-to-move.**
  Pointer events on the title bar move the window via `transform: translate(x, y)`.
  Use pointer capture for smooth dragging.

- [ ] **9.5 — Implement resize handles.**
  8 resize handles (N, NE, E, SE, S, SW, W, NW) as transparent `div` elements.

- [ ] **9.6 — Implement OS-themed dialog modals.**
  `DialogApi` calls into `WindowManager` to show modals that match the active OS theme.

- [ ] **9.7 — Register window control IPC commands.**
  `window_set_title`, `window_minimize`, `window_maximize`, `window_close`,
  `window_set_size`, `window_set_focus` — all as main-thread IPC commands.

- [ ] **9.8 — Write the visual test.**
  Open demo app in VirtualWindow. Verify drag, resize, close, title update,
  and OS chrome for all three themes.

### Exit Criteria
- [ ] VirtualWindow renders with correct macOS, Windows 11, and Linux chrome.
- [ ] Drag, resize, minimise, maximise, and close all work.
- [ ] OS-themed dialogs appear inside the window, not as browser alerts.
- [ ] Multiple windows open simultaneously with correct focus.

---

## Phase 10 — Service Worker (Asset Protocol)

> **Goal**: `convertFileSrc('/app/logo.png')` returns a URL that loads the
> image from the VFS, not a 404.

### How it works

```
Tauri app:   const src = convertFileSrc('/app/logo.png')
             // returns: https://r1-asset.localhost/app/logo.png

Browser:     <img src="https://r1-asset.localhost/app/logo.png">
                    ↓ Service Worker intercepts

SW:          sends VFS_READ to main thread via MessageChannel
             receives Uint8Array
             returns Response with correct Content-Type
```

### Tasks

- [ ] **10.1 — Create `packages/sw/src/sw.ts`.**
  Intercepts fetch events matching `https://r1-asset.localhost/`.

- [ ] **10.2 — Implement the VFS fetch flow.**
  Extract path from URL → request from main thread via `MessageChannel` →
  receive `Uint8Array` → wrap in `Response` with correct MIME type.

- [ ] **10.3 — Implement MIME type detection.**
  Lookup table covering: `png`, `jpg`, `gif`, `webp`, `svg`, `mp4`, `webm`,
  `mp3`, `ogg`, `woff2`, `json`, `txt`, `html`, `css`, `js`.
  Unknown extensions → `application/octet-stream`.

- [ ] **10.4 — Register the Service Worker in `R1Runtime.boot()`.**
  `navigator.serviceWorker.register('/sw.js', { scope: '/' })`.
  Set up `MessageChannel` listener on the main thread.

- [ ] **10.5 — Patch `convertFileSrc` in the IPC bridge.**
  ```typescript
  (window as any).__TAURI_INTERNALS__.convertFileSrc =
    (path: string) => `https://r1-asset.localhost${path}`;
  ```

- [ ] **10.6 — Write the smoke test.**
  - Write HTML to `/test/page.html` via VFS — fetch the asset URL — assert correct body
  - Write a PNG buffer — fetch — assert MIME is `image/png`
  - Request a missing file — assert `404 Not Found`, not a SW crash

### Exit Criteria
- [ ] `convertFileSrc` returns a URL that resolves to the correct VFS file.
- [ ] Images, HTML, and JSON load with the correct Content-Type.
- [ ] A missing file returns `404 Not Found`, not a SW crash.
- [ ] SW registers without errors on first load.

---

## Phase 11 — Vite Plugin

> **Goal**: A developer adds one line to `vite.config.ts`. `npm run build`
> automatically compiles their Rust, patches imports, and outputs a deployable
> static folder.

### Developer experience

```typescript
// vite.config.ts — the only change a developer makes
import { r1Plugin } from '@r1/vite-plugin';
export default defineConfig({
  plugins: [react(), r1Plugin()]
});
```

```
npm run build
  → Compiling Rust to WASM...
  → Patching Tauri imports...
  → Injecting R1 boot script...
  → Build complete. Deploy the dist/ folder anywhere.
```

### What the plugin does automatically

1. Detects `src-tauri/Cargo.toml`.
2. Runs `wasm-pack build src-tauri/ --target web --out-dir public/wasm/`.
3. Patches all `@tauri-apps/api` imports → `@r1/apis`.
4. Injects the R1 boot + loadBackend script before the app entry point.
5. Copies `sw.js` from `@r1/sw` to the output root.

### Tasks

- [ ] **11.1 — Create `packages/vite-plugin/src/index.ts`.**
  Export `r1Plugin(options?: R1PluginOptions)` — a standard Vite plugin.

- [ ] **11.2 — Implement Rust detection and compilation (`buildStart`).**
  Check for `src-tauri/Cargo.toml`. If found, spawn `wasm-pack build`.
  Stream output to Vite terminal. Fail build on non-zero exit.
  Show install instruction if `wasm-pack` is not found:
  `curl https://rustwasm.github.io/wasm-pack/installer/init.sh -sSf | sh`

- [ ] **11.3 — Implement import patching (`transform`).**
  Replace `@tauri-apps/api` with `@r1/apis`. Must be idempotent.
  Handle both named imports and namespace imports.

- [ ] **11.4 — Implement entry point injection (`transformIndexHtml`).**
  Inject before the app's main script:
  ```html
  <script type="module">
    import { R1Runtime } from '@r1/core';
    const r1 = new R1Runtime();
    await r1.boot();
    await r1.loadBackend('/wasm/app_bg.wasm');
    window.dispatchEvent(new Event('r1:ready'));
  </script>
  ```

- [ ] **11.5 — Copy Service Worker to output root (`generateBundle`).**

- [ ] **11.6 — Add config schema.**
  ```typescript
  interface R1PluginOptions {
    rustSrc?: string;                            // default: './src-tauri'
    wasmOut?: string;                            // default: './public/wasm'
    os?: 'macos' | 'windows' | 'linux' | 'auto'; // default: 'auto'
  }
  ```

- [ ] **11.7 — Write the end-to-end test.**
  Build the `tests/fixtures/tauri-app/` fixture with the plugin. Assert:
  - A `.wasm` file exists in output
  - No `@tauri-apps/api` strings remain in built JS
  - `sw.js` exists in output root
  - `index.html` contains R1 boot script before the app script

### Exit Criteria
- [ ] A standard Tauri project builds with one config line.
- [ ] Built app boots R1 before any app code runs.
- [ ] Missing `wasm-pack` shows a clear install instruction.
- [ ] Import patcher is idempotent.

---

## Milestone Summary

| Phase | Name | What Unlocks | Complexity |
|---|---|---|---|
| **0** | Monorepo Foundation | All other phases | Low |
| **1** | Kernel Worker + Protocol | Everything in the Worker | Low |
| **2** | IPC Bridge | `invoke()` works | Low |
| **3** | Virtual File System | Persistent storage | Medium |
| **4** | WasmOrchestrator | WASM loading + calling | Medium |
| **5** | Serde JSON Bridge | Complex data JS ↔ Rust | Medium |
| **6** | WASI Shim | Rust `std::fs` works | High |
| **7** | Event Bridge | Rust emits to JS | Medium |
| **8** | Tauri API Layer | Full Tauri compatibility | High |
| **9** | Window Manager | OS-accurate UI | Medium |
| **10** | Service Worker | Images and assets load | Low |
| **11** | Vite Plugin | One-line developer setup | Medium |

**Complexity key**: Low = 2–4 days, Medium = 1–2 weeks, High = 2–3 weeks.

---

## What "Done" Looks Like

A developer with a working Tauri notes app:

1. Adds `r1Plugin()` to `vite.config.ts`
2. Runs `npm run build`
3. Uploads the `dist/` folder to Vercel
4. Sends the URL to a friend
5. The friend visits the URL — no install, no download
6. They see the notes app in a macOS window in their browser
7. They create a note — it saves to the VFS
8. They close and reopen the tab — the note is still there

**That is the finish line.**

---

## Risk Register

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| WASI shim missing a needed syscall | High | High | Implement all stubs (ERRNO_NOSYS) in Phase 6 |
| Rust WASM binary too large (>5MB) | Medium | Medium | Enable `wasm-opt` in wasm-pack, use `--release` |
| Service Worker not registering on first load | Medium | Medium | Show "please refresh" banner if SW fails |
| OPFS quota exceeded on large apps | Low | High | Implement quota warnings + graceful degradation |
| Kernel Worker crashing silently | Medium | High | `onerror` + `onmessageerror` handlers from Phase 1 |
| Tauri v1 vs v2 API differences | Medium | Medium | Test against both versions from Phase 2 |

---

## Glossary

| Term | Plain English Meaning |
|---|---|
| **WASM** | WebAssembly — a binary format that runs in browsers at near-native speed |
| **WASI** | A standard for WASM to call "OS" functions like reading files |
| **OPFS** | The browser's built-in persistent filesystem — survives page refreshes |
| **IPC** | How the JS frontend and Rust backend talk to each other in Tauri |
| **Kernel Worker** | A background Web Worker that runs all heavy operations |
| **Module Registry** | A `Map<name, WasmInstance>` tracking all loaded WASM modules |
| **Serde** | A Rust library that converts Rust structs to/from JSON |
| **wasm-pack** | A tool that compiles Rust → `.wasm` + JS glue automatically |
| **VFS** | Virtual File System — an in-browser filesystem backed by OPFS |
| **ERRNO_NOSYS** | Error code 52 in WASI — "this syscall is not implemented" |

---

*R1 TauriWeb Runtime — From-Scratch Roadmap*
*Architecture: serverless, end-user focused, strong fundamentals first*