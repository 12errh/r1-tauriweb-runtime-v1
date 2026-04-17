# Getting Started with R1 Runtime

> Build your first Tauri-style app and run it in the browser — no installer, no server, just a URL.

---

## What You Will Build

By the end of this guide you will have a working app with a Rust backend running as WebAssembly in the browser. The same code structure works as a native Tauri desktop app too — R1 is fully compatible.

**Live example of what this produces**: https://todo-demo-by-r1-runtime.netlify.app/

---

## Prerequisites

Make sure these are installed before starting. Each link goes to the official install page.

| Tool | Purpose | Install |
|---|---|---|
| **Node.js 18+** | JavaScript runtime | [nodejs.org](https://nodejs.org) |
| **Rust** | Compiles your backend | [rustup.rs](https://rustup.rs) |
| **wasm-pack** | Compiles Rust → WebAssembly | `cargo install wasm-pack` |

Verify everything is ready:
```bash
node --version       # Should print v18 or higher
rustc --version      # Should print rustc 1.75 or higher
wasm-pack --version  # Should print wasm-pack 0.12 or higher
```

---

## Step 1 — Install R1

R1 is available on npm. No cloning required.

```bash
npm install @r1/core @r1/apis
npm install --save-dev @r1/vite-plugin
```

That's it. Move on to Step 2.

---

## Step 2 — Create a New Tauri App

Use the official Tauri scaffolding tool to create a fresh project:

```bash
npm create tauri-app@latest my-r1-app -- --template react-ts --yes
cd my-r1-app
npm install
```

Your project structure will look like this:

```
my-r1-app/
├── src/                   ← React frontend (leave this alone for now)
│   ├── App.tsx
│   └── main.tsx
├── src-tauri/             ← Rust backend (you will edit files here)
│   ├── src/
│   │   └── lib.rs         ← Your Rust commands live here
│   ├── Cargo.toml         ← Rust dependencies
│   └── build.rs           ← Build script
├── index.html
├── package.json
└── vite.config.ts
```

---

## Step 3 — Add R1 to Your Project

R1 is on npm. Install it directly:

```bash
npm install @r1/core @r1/apis
npm install --save-dev @r1/vite-plugin
```

Your `package.json` dependencies will look like this:

```json
{
  "dependencies": {
    "@tauri-apps/api": "^2.0.0",
    "@r1/core": "^0.3.0",
    "@r1/apis": "^0.3.0"
  },
  "devDependencies": {
    "@r1/vite-plugin": "^0.3.0"
  }
}
```

---

## Step 4 — Add the R1 Vite Plugin

Open `vite.config.ts` and add the R1 plugin:

```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { r1Plugin } from '@r1/vite-plugin';

export default defineConfig({
  plugins: [
    react(),
    r1Plugin({
      rustSrc: './src-tauri'
    })
  ]
});
```

> The plugin handles everything automatically — it compiles your Rust to WASM during `npm run build` and patches all `@tauri-apps/api` imports to use R1. You do not need to change your frontend import statements.

---

## Step 5 — Make the Rust Backend WASM-Compatible

This is the only part that differs from standard Tauri. You need to make three small changes so the Rust code compiles to WebAssembly.

### 5a — Update `src-tauri/Cargo.toml`

Replace the entire contents with this:

```toml
[package]
name = "my-r1-app"
version = "0.1.0"
edition = "2021"

# WASM dependencies — always included
[dependencies]
wasm-bindgen = "0.2"
serde = { version = "1", features = ["derive"] }
serde_json = "1"

# Native-only dependencies — only included when building for desktop
[target.'cfg(not(target_arch = "wasm32"))'.dependencies]
tauri = { version = "2", features = [] }
tauri-plugin-opener = "2"

[lib]
name = "my_r1_app"          # Must be snake_case, no hyphens
crate-type = ["cdylib", "rlib"]
```

> **Important**: The `name` in `[lib]` must use underscores, not hyphens. `my-r1-app` becomes `my_r1_app`.

### 5b — Update `src-tauri/build.rs`

Replace the entire contents with this:

```rust
fn main() {
    // Standard Tauri build logic is bypassed for WASM targets 
    // to prevent native build dependencies from interfering.
}
```

### 5c — Update `src-tauri/src/lib.rs`

Replace the entire contents with this. This rewrites the default `greet` command to use R1's JSON bridge:

```rust
use wasm_bindgen::prelude::*;
use serde::Deserialize;

// The input arguments from JavaScript
#[derive(Deserialize)]
struct GreetArgs {
    name: String,
}

// Every command follows this pattern:
// - Takes a JSON string as input (&str)
// - Returns a JSON string as output (String)
#[wasm_bindgen]
pub fn greet(payload: &str) -> String {
    let args: GreetArgs = serde_json::from_str(payload)
        .unwrap_or(GreetArgs { name: "World".into() });

    let message = format!("Hello, {}! This is Rust running in your browser.", args.name);

    // Always return valid JSON — wrap your value in serde_json::to_string
    serde_json::to_string(&message).unwrap()
}

// Gate the native Tauri entry point so it doesn't compile to WASM
#[cfg(not(target_arch = "wasm32"))]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![greet])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

---

## Step 6 — Build and Run

```bash
npm run build
```

You will see output like this while it builds:
```
→ Compiling Rust to WASM...
→ Patching Tauri imports...
→ Injecting R1 boot script...
→ Build complete.
```

Now serve the output:
```bash
npx serve dist -l 3000
```

Open **http://localhost:3000** in your browser.

> **Important**: Press `Ctrl+F5` (or `Cmd+Shift+R` on Mac) on first load to force the Service Worker to register correctly. You only need to do this once.

---

## Step 7 — Verify It Works

You should see the default Tauri app UI. Type a name into the input field and click **Greet**. The response — `"Hello, [name]! This is Rust running in your browser."` — comes from your Rust code executing as WebAssembly.

To confirm Rust is actually running (not a JS fallback), open DevTools → Console. You should see:

```
[R1] Booting Kernel...
[R1] Boot complete.
[R1] Loaded WASM module: my_r1_app
```

---

## Adding Your Own Commands

Every new Rust function you want to call from JavaScript follows the same pattern:

**Rust (`src-tauri/src/lib.rs`)**:
```rust
use serde::{Serialize, Deserialize};

#[derive(Deserialize)]
struct AddArgs {
    a: f64,
    b: f64,
}

#[derive(Serialize)]
struct AddResult {
    sum: f64,
}

#[wasm_bindgen]
pub fn add_numbers(payload: &str) -> String {
    let args: AddArgs = serde_json::from_str(payload).unwrap();
    let result = AddResult { sum: args.a + args.b };
    serde_json::to_string(&result).unwrap()
}
```

**JavaScript/TypeScript (`src/App.tsx`)**:
```typescript
import { invoke } from '@tauri-apps/api/core';

const result = await invoke('add_numbers', { a: 3, b: 4 });
console.log(result.sum); // 7
```

That's the complete pattern. Input JSON → Rust processes → Output JSON.

---

## Using SQLite

R1 supports SQLite out of the box. Use @tauri-apps/plugin-sql
exactly as you would in a native Tauri app — no changes needed.

Install the plugin in your frontend:
```bash
npm install @tauri-apps/plugin-sql
```

Use it in your code:
```typescript
import Database from '@tauri-apps/plugin-sql';
const db = await Database.load('sqlite:myapp.db');
await db.execute('INSERT INTO items (name) VALUES (?)', ['hello']);
const items = await db.select('SELECT * FROM items');
```

R1 handles everything else. No C compiler. No LLVM. Just works.

> **⚠️ CRITICAL ARCHITECTURE WARNING**
> **You cannot run native Rust SQL tools** like `sqlx`, `diesel`, or `rusqlite` in R1! The browser's security sandbox fundamentally blocks WebAssembly from opening raw TCP sockets, making remote Postgres/MySQL/MSSQL connections impossible. All database logic must be executed through the `@tauri-apps/plugin-sql` JavaScript wrapper, which leverages OPFS under the hood.
---

## Using the Filesystem

Data written through R1's filesystem API is stored in the browser's Origin Private File System (OPFS). It persists across page refreshes — closing and reopening the tab will not lose your data.

```typescript
import { writeTextFile, readTextFile } from '@tauri-apps/api/fs';

// Write
await writeTextFile('/app/settings.json', JSON.stringify({ theme: 'dark' }));

// Read
const content = await readTextFile('/app/settings.json');
const settings = JSON.parse(content);
```

You can also read and write from Rust directly:

```rust
#[wasm_bindgen]
pub fn save_data(payload: &str) -> String {
    // std::fs calls are automatically redirected to OPFS by R1's WASI shim
    std::fs::write("/app/data.txt", payload).unwrap();
    serde_json::to_string(&"saved").unwrap()
}
```

---

### ⚠️ CRITICAL DEPLOYMENT NOTE: Enabling Persistence (SQLite/OPFS)

If your app uses SQLite or depends on OPFS persistence, you **MUST** configure your hosting provider to send specific security headers. Without these, the browser will block `SharedArrayBuffer` and SQLite will fall back to **in-memory mode** (data will be lost on refresh).

**Required Headers:**
```
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Embedder-Policy: require-corp
Cross-Origin-Resource-Policy: cross-origin
```

**Netlify Example (`netlify.toml`):**
```toml
[[headers]]
  for = "/*"
  [headers.values]
    Cross-Origin-Opener-Policy = "same-origin"
    Cross-Origin-Embedder-Policy = "require-corp"
    Cross-Origin-Resource-Policy = "cross-origin"
```

Anyone with the URL can now run your app. No installer. No download.


---

## Troubleshooting

**`wasm-pack: command not found`**
```bash
cargo install wasm-pack
```

**Build fails with `error: failed to run custom build command for tauri-build`**
Your `build.rs` does not have the empty `main` block from Step 5b. When building for WASM, `tauri-build` must not run its default logic because it checks for native C++ compiler tools that aren't needed for R1.

**`Error: [WasmOrchestrator] Function '...' not exported`**
Check your `src-tauri/src/lib.rs`. Ensure the function has the `#[wasm_bindgen]` attribute and handles input/output as JSON strings. Also, verify that the `[lib]` name in `Cargo.toml` uses underscores, not hyphens.

**App loads but Greet button does nothing**
Check the browser console. The most common cause is the `[lib] name` in `Cargo.toml` containing hyphens instead of underscores (e.g., `my-app` instead of `my_app`).

**Page shows blank / R1 not booting**
Press `Ctrl+F5` to force a hard refresh. The Service Worker needs a clean registration on first load.

**`invoke` returns `undefined`**
Your Rust function is not returning a JSON string. Make sure every function ends with `serde_json::to_string(&your_value).unwrap()`.

---

## Next Steps

- Read the **Developer Guide** to understand how R1 works internally
- See the [Todo Demo](apps/todo-demo) for a complete real-world example
- Join the community and share what you build