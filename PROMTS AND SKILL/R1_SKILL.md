# R1 TauriWeb Runtime — AI Agent Skill

> This file is the complete knowledge base for any AI agent working with R1.
> Read this entire file before making any changes to any project.
> Every decision you make must be consistent with the rules in this document.

---

## What R1 Is

R1 is a browser-native runtime for Tauri applications. It compiles a Tauri
app's Rust backend to WebAssembly and runs it entirely in the browser — no
server, no installer, no native binary. The end user visits a URL and the
full Tauri app works in their browser tab.

```
Developer's Tauri App (Rust + React/Svelte/Vue)
         ↓  npm run build  (with R1 Vite plugin)
         ↓
Static folder (HTML + JS + .wasm)
         ↓  deploy to Vercel / Netlify / GitHub Pages
         ↓
End user visits URL → full app runs in browser
```

---

## Architecture (Memorise This)

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
│   ├── WASI Shim → redirects std::fs to OPFS
│   └── Event Bridge → Rust can emit to JS
└── VFS (Virtual File System)
    ├── Memory cache (fast reads)
    └── OPFS backend (persistent writes)

Service Worker
└── Intercepts asset:// URLs → serves from VFS
```

**Critical rules the agent must never violate:**
1. WASM never runs on the main thread — always in the Kernel Worker
2. All JS↔WASM data travels as JSON strings — no raw pointers
3. Every Rust panic must be caught at the JS boundary
4. WASI syscalls always redirect to OPFS — never real filesystem
5. Module Registry uses `Map<string, WasmModule>` — no global variables

---

## Package Structure

```
r1-tauriweb-runtime-v1/
├── packages/
│   ├── @r1/core/          ← IPC bridge, EventBus, R1Runtime, KernelProxy
│   ├── @r1/kernel/        ← Kernel Worker, WasmOrchestrator, VFS, WASI shim
│   ├── @r1/apis/          ← All Tauri API implementations (fs, path, event…)
│   ├── @r1/window/        ← Virtual Window Manager + OS themes
│   ├── @r1/sw/            ← Service Worker (asset:// protocol)
│   └── @r1/vite-plugin/   ← Build tooling, import patcher, WASM compiler
├── apps/
│   ├── todo-demo/         ← Reference working app
│   └── demo/              ← Technical showcase
└── tests/fixtures/wasm/   ← Pre-compiled test binaries
```

---

## The 3 Setup Changes Required For Any Tauri App

Every Tauri app needs exactly these 3 changes to work with R1.
The agent must apply all 3. Never skip any of them.

### Change 1 — `src-tauri/build.rs`
Replace the ENTIRE file with:
```rust
fn main() {}
```
Reason: `tauri-build` cannot compile to WASM. An empty main() is always correct for web builds.

### Change 2 — `src-tauri/Cargo.toml`
Remove the `[build-dependencies]` section entirely:
```toml
# DELETE this entire block:
[build-dependencies]
tauri-build = { version = "X", features = [] }
```

Add WASM dependencies and gate native deps:
```toml
[lib]
name = "your_app_name"   # snake_case, matches crate name
crate-type = ["cdylib", "rlib"]

[dependencies]
wasm-bindgen = "0.2"
serde = { version = "1", features = ["derive"] }
serde_json = "1"

# Gate ALL native-only deps behind this cfg
[target.'cfg(not(target_arch = "wasm32"))'.dependencies]
tauri = { version = "X", features = [] }
# add other native deps here too
```

### Change 3 — `vite.config.ts`
Add the R1 plugin:
```typescript
import { r1Plugin } from '@r1/vite-plugin';

// In plugins array, add:
r1Plugin({ rustSrc: './src-tauri' })
```

And update `package.json` dependencies:
```json
{
  "dependencies": {
    "@r1/core": "file:../r1-tauriweb-runtime-v1/packages/core",
    "@r1/apis": "file:../r1-tauriweb-runtime-v1/packages/apis"
  },
  "devDependencies": {
    "@r1/vite-plugin": "file:../r1-tauriweb-runtime-v1/packages/vite-plugin"
  }
}
```

---

## The Rust JSON Contract

Every Rust function that communicates with JavaScript must follow this pattern.
The agent must apply this when creating or modifying `lib.rs`.

```rust
use wasm_bindgen::prelude::*;
use serde::{Serialize, Deserialize};

// Input struct — matches what JS passes
#[derive(Deserialize)]
struct MyArgs {
    name: String,
    count: u32,
}

// Output struct — what JS receives back
#[derive(Serialize)]
struct MyResult {
    message: String,
    doubled: u32,
}

// The command — always takes &str, always returns String
#[wasm_bindgen]
pub fn my_command(payload: &str) -> String {
    // Step 1: Decode input — return error if invalid
    let args: MyArgs = match serde_json::from_str(payload) {
        Ok(a) => a,
        Err(e) => return serde_json::json!({ "error": e.to_string() }).to_string(),
    };

    // Step 2: Your logic here
    let result = MyResult {
        message: format!("Hello, {}!", args.name),
        doubled: args.count * 2,
    };

    // Step 3: Always return JSON — never a raw value
    serde_json::to_string(&result).unwrap_or_else(|e| {
        serde_json::json!({ "error": e.to_string() }).to_string()
    })
}
```

**Rules the agent must follow:**
- Every `#[wasm_bindgen]` function takes `payload: &str` and returns `String`
- Always use `serde_json::from_str` to decode input — never manual parsing
- Always wrap output in `serde_json::to_string` — never return raw strings
- Never use `.unwrap()` without a fallback — always handle errors
- Error response shape: `{ "error": "message" }`
- Success response shape: `{ "ok": value }` OR the value directly

---

## How `lib.rs` Must Be Structured

When modifying an existing app's `lib.rs`, the agent must follow this structure:

```rust
use wasm_bindgen::prelude::*;
use serde::{Serialize, Deserialize};

// ── WASM commands (compiled for both web and desktop) ──────────────────────

#[wasm_bindgen]
pub fn command_one(payload: &str) -> String {
    // ... implementation
}

#[wasm_bindgen]
pub fn command_two(payload: &str) -> String {
    // ... implementation
}

// ── Native desktop entry point (only for non-WASM builds) ──────────────────

#[cfg(not(target_arch = "wasm32"))]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            // list native commands here
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

If the app only has `main.rs` and no `lib.rs`, the agent must:
1. Create `src-tauri/src/lib.rs` with the above structure
2. Update `src-tauri/src/main.rs` to call `lib::run()`

---

## Supported Tauri APIs (v0.2)

The agent must know which APIs R1 supports in v0.2 and which it does not.

### ✅ Fully Supported — Direct import works
```typescript
import { invoke } from '@tauri-apps/api/core'           // Tauri v2
import { invoke } from '@tauri-apps/api/tauri'          // Tauri v1
import { readDir, readTextFile, writeTextFile,
         exists, createDir, removeFile,
         copyFile, renameFile } from '@tauri-apps/api/fs'
import { homeDir, appDataDir, documentDir, downloadDir,
         join, resolve, basename, dirname,
         extname, normalize } from '@tauri-apps/api/path'
import { listen, emit, once, unlisten } from '@tauri-apps/api/event'
import { appWindow, WebviewWindow } from '@tauri-apps/api/window'
import { message, ask, confirm, open, save } from '@tauri-apps/api/dialog'
import { readText, writeText } from '@tauri-apps/api/clipboard'
import { platform, arch, version, locale } from '@tauri-apps/api/os'
import { Store } from '@tauri-apps/plugin-store'
import { Connection } from 'rusqlite'                     // Supported via bundled feature
```

### ⚠️ Partially Supported — Works with limitations
```typescript
import { sendNotification } from '@tauri-apps/api/notification'
// Works but uses Web Notifications API — requires HTTPS + user permission

import { open } from '@tauri-apps/api/shell'
// Only window.open(url) works — shell.execute() is stubbed
```

### ❌ Not Supported — Agent must warn the user
```typescript
// These will NOT work — explain why to the user
import { execute } from '@tauri-apps/api/shell'    // can't spawn processes
// System tray APIs                                 // not a browser concept
// Global shortcuts                                 // not available outside focus
// Native window vibrancy/blur effects              // GPU compositing not available
// Raw TCP/UDP sockets                              // browser sandbox
```

---

## Import Patcher Map

The R1 Vite plugin automatically rewrites these imports at build time.
The agent does NOT need to change frontend import statements — they stay as-is.

```
@tauri-apps/api/core         → @r1/apis/core
@tauri-apps/api/tauri        → @r1/apis/core
@tauri-apps/api/fs           → @r1/apis/fs
@tauri-apps/api/path         → @r1/apis/path
@tauri-apps/api/event        → @r1/apis/event
@tauri-apps/api/window       → @r1/apis/window
@tauri-apps/api/dialog       → @r1/apis/dialog
@tauri-apps/api/clipboard    → @r1/apis/clipboard
@tauri-apps/api/os           → @r1/apis/os
@tauri-apps/api/notification → @r1/apis/notification
@tauri-apps/api/shell        → @r1/apis/shell
@tauri-apps/api/http         → @r1/apis/http
@tauri-apps/api/app          → @r1/apis/app
@tauri-apps/plugin-store     → @r1/apis/store
@tauri-apps/api              → @r1/apis
```

---

## VFS Path Mapping

When Rust code uses `std::fs`, R1 redirects to these VFS paths.
The agent must use these paths when seeding test data or configuring storage.

```
OS path                              VFS path
~/ or $HOME                    →    /home/user/
~/Documents                    →    /home/user/Documents/
~/Downloads                    →    /home/user/Downloads/
~/.local/share/<app>           →    /app/data/
%APPDATA%\<app>                →    /app/data/
~/Library/Application Support  →    /app/data/
/tmp                           →    /tmp/
```

---

## Common Error Patterns and Fixes

The agent must recognise these errors and apply the correct fix immediately.

### Error: `tauri_build` unresolved
```
error[E0433]: failed to resolve: use of unresolved module tauri_build
```
**Fix**: Replace `src-tauri/build.rs` with `fn main() {}`
Also remove `[build-dependencies]` from `Cargo.toml`

### Error: `"functionName" is not exported`
```
"readDir" is not exported by "../../packages/apis/src/fs.ts"
```
**Fix**: The R1 packages need to be rebuilt.
Run `npm run build` from the R1 monorepo root, then rebuild the app.

### Error: `WebAssembly.instantiate(): Argument 0 must be a buffer source`
**Fix**: The vite-plugin is loading `.js` instead of `_bg.wasm`.
Check `packages/vite-plugin/src/index.ts` — the WASM path must end in `_bg.wasm`.

### Error: `VFS is not initialized`
```
[R1 VFS] Cannot perform operations: VFS is not initialized. Call init() first.
```
**Fix**: The VFS singleton has a race condition.
The `getVfs()` function in `fs.ts` must use a promise lock pattern.

### Error: `Config is not defined` (blank screen)
**Fix**: The app uses `@tauri-apps/api/app` which is not in the import patcher.
Create `packages/apis/src/app.ts` and add the mapping to the vite-plugin.

### Error: TypeScript `importsNotUsedAsValues` deprecated
**Fix**: The app's `tsconfig.json` extends `@tsconfig/svelte` which has old options.
Remove the `extends` line and write a standalone `tsconfig.json` without deprecated options.

### Error: SvelteKit adapter conflict
**Fix**: SvelteKit's `transformIndexHtml` behaves differently.
Add the R1 boot script manually via `svelte.config.js` head injection instead.

---

## Build Verification Checklist

After applying R1 configuration, the agent must verify these outputs:

**Build output must contain:**
```
[R1] Found Rust source at ./src-tauri. Building WASM...
[INFO]: :-) Done in Xs
✓ built in Xs
```

**`dist/` folder must contain:**
```
dist/
├── index.html        ← must include r1-boot.js script tag
├── r1-boot.js        ← R1 runtime boot
├── sw.js             ← Service Worker
├── r1-sw.js          ← R1 Service Worker helper
└── wasm/
    ├── <app>_bg.wasm ← the binary (this is what R1 loads)
    └── <app>.js      ← JS glue (not directly loaded by R1)
```

**Browser console on load must show:**
```
[R1] Booting Runtime...
[R1] Booting Kernel...
[R1] Service Worker registered.
[R1] Loading WASM from /wasm/<app>_bg.wasm...
[R1] Boot complete.
```

**Must NOT appear:**
```
❌ Loading WASM from /wasm/<app>.js    (wrong file)
❌ VFS is not initialized
❌ WebAssembly.instantiate() Argument 0 must be buffer
❌ is not exported by
```

---

## What The Agent Must Never Do

1. **Never change frontend `invoke()` calls** — the IPC bridge handles them
2. **Never change `import` statements in the frontend** — the Vite plugin patches them
3. **Never put WASM execution on the main thread** — always in Kernel Worker
4. **Never use raw memory pointers** in the Rust/JS bridge — always JSON strings
5. **Never use `.unwrap()` in WASM functions** without error handling
6. **Never commit `.npmrc`** — it contains auth tokens
7. **Never rebuild CI with Rust** — commit pre-compiled `.wasm` binaries to fixtures
8. **Never skip rebuilding R1 packages** after editing them — always run `npm run build`
   from the monorepo root before rebuilding the app

---

## Rebuild Order (Always Follow This)

```bash
# 1. Always rebuild R1 first when any R1 package is changed
cd r1-tauriweb-runtime-v1
npm run build

# 2. Then rebuild the app
cd apps/your-app
npm run build

# 3. Then serve
npx serve dist -l 3000
```

---

## SQLite Support (v0.3+)

R1 supports SQLite via the official pre-built WASM module
(@sqlite.org/sqlite-wasm). This works on all platforms without
any C compiler, LLVM, or WASI SDK.

### What developers use (unchanged from native Tauri):
import Database from '@tauri-apps/plugin-sql';
const db = await Database.load('sqlite:myapp.db');
await db.execute('CREATE TABLE IF NOT EXISTS items (id INTEGER PRIMARY KEY, name TEXT)');
const rows = await db.select('SELECT * FROM items');

### What R1 does automatically:
- Import patcher rewrites @tauri-apps/plugin-sql → @r1/apis/sql
- Database.load() opens an OPFS-backed SQLite database
- Data persists across page refreshes via OPFS
- No rusqlite in Cargo.toml needed
- No C compilation needed
- No LLVM or WASI SDK needed

### What developers must NOT do (And Why):
- **Do NOT add `rusqlite` to `Cargo.toml`.** (C-compilation inside WASM is unstable).
- **Do NOT use `sqlx`, `diesel`, or native Postgres/MySQL drivers.** (WebAssembly running inside a web browser is strictly blocked from opening raw TCP sockets due to the browser's security model. You cannot connect to a remote database natively from Rust in R1).
- **You MUST manage your SQLite database strictly through the JS frontend** via `Database.load()`.

Skipping step 1 is the most common mistake. Any change to `@r1/apis`,
`@r1/core`, `@r1/kernel`, or `@r1/vite-plugin` requires a full R1 rebuild
before the app can see the changes.
