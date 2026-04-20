# Getting Started with R1

> Build your first R1 app — or migrate an existing Tauri app — and run it in the browser.

---

## Prerequisites

| Tool | Version | Install |
|---|---|---|
| **Node.js** | 18+ | [nodejs.org](https://nodejs.org) |
| **Rust** | 1.75+ | [rustup.rs](https://rustup.rs) |
| **wasm-pack** | 0.12+ | `cargo install wasm-pack` |

Verify everything is ready:

```bash
node --version      # v18.0.0 or higher
rustc --version     # rustc 1.75.0 or higher
wasm-pack --version # wasm-pack 0.12.0 or higher
```

---

## Option A — Migrate an Existing Tauri App (Recommended)

If you already have a Tauri app, the CLI handles everything automatically.

```bash
cd your-tauri-app
npx @r1-runtime/cli sync
```

You'll see:

```
🚀 R1 TauriWeb Runtime — Sync

✓ Detected: Tauri v2, react, 5 commands
✓ Patching build.rs
✓ Updating Cargo.toml
✓ Updating vite.config.ts
✓ Updating package.json
✓ Patching SQL imports
✓ Rewriting 5 Rust commands
✓ Done! Your app is ready for R1.

Next steps:
  npm install
  npm run build
  npx serve dist -l 3000
```

Then:

```bash
npm install
npm run build
npx serve dist -l 3000
```

Open **http://localhost:3000** and press `Ctrl+F5` on first load.

> The CLI creates `.r1-backup` copies of every file it modifies. If something goes wrong, your originals are safe.

---

## Option B — Start a New App from Scratch

### Step 1 — Create a Tauri app

```bash
npm create tauri-app@latest my-app -- --template react-ts --yes
cd my-app
```

### Step 2 — Run the R1 CLI

```bash
npx @r1-runtime/cli sync
```

### Step 3 — Install and build

```bash
npm install
npm run build
npx serve dist -l 3000
```

Open **http://localhost:3000** and press `Ctrl+F5` on first load.

---

## Option C — Manual Setup

If you prefer to understand every change, here's what the CLI does manually.

### 1. Install R1 packages

```bash
npm install @r1-runtime/core @r1-runtime/apis
npm install --save-dev @r1-runtime/vite-plugin
```

### 2. Update `vite.config.ts`

```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { r1Plugin } from '@r1-runtime/vite-plugin';

export default defineConfig({
  plugins: [
    react(),
    r1Plugin({ rustSrc: './src-tauri' }),
  ],
});
```

### 3. Update `src-tauri/build.rs`

Replace the entire file with:

```rust
fn main() {}
```

This prevents native Tauri build logic from running when compiling to WASM.

### 4. Update `src-tauri/Cargo.toml`

```toml
[package]
name = "my-app"
version = "0.1.0"
edition = "2021"

# WASM dependencies — always compiled
[dependencies]
wasm-bindgen = "0.2"
serde = { version = "1", features = ["derive"] }
serde_json = "1"
r1-macros = "0.3.0"

# Native-only dependencies — only compiled for desktop
[target.'cfg(not(target_arch = "wasm32"))'.dependencies]
tauri = { version = "2", features = [] }
tauri-plugin-opener = "2"

[lib]
name = "my_app"                    # snake_case — no hyphens
crate-type = ["cdylib", "rlib"]
```

> The `[lib] name` must use underscores, not hyphens. `my-app` → `my_app`.

### 5. Update `src-tauri/src/lib.rs`

Using the `#[r1::command]` macro (recommended):

```rust
use r1_macros::command;

#[command]
pub fn greet(name: String) -> String {
    format!("Hello, {}! You're running Rust in the browser.", name)
}

// Gate the native entry point so it doesn't compile to WASM
#[cfg(not(target_arch = "wasm32"))]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![greet])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

Or manually, without the macro:

```rust
use wasm_bindgen::prelude::*;
use serde::Deserialize;

#[derive(Deserialize)]
struct GreetArgs {
    name: String,
}

#[wasm_bindgen]
pub fn greet(payload: &str) -> String {
    let args: GreetArgs = serde_json::from_str(payload)
        .unwrap_or(GreetArgs { name: "World".into() });
    let message = format!("Hello, {}! You're running Rust in the browser.", args.name);
    serde_json::to_string(&message).unwrap()
}

#[cfg(not(target_arch = "wasm32"))]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![greet])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

### 6. Build and run

```bash
npm run build
npx serve dist -l 3000
```

---

## Verifying It Works

Open DevTools → Console. You should see:

```
[R1] Booting Kernel...
[R1] Boot complete.
```

Type a name into the greet input and click the button. The response comes from your Rust code running as WebAssembly.

To confirm WASM is actually running (not a JS fallback), open DevTools → Sources and look for `wasm` files in the sources panel.

---

## Adding SQLite

R1 supports SQLite out of the box. Use `@tauri-apps/plugin-sql` exactly as you would in a native Tauri app.

**Install the frontend package:**

```bash
npm install @tauri-apps/plugin-sql
```

**Use it in your frontend:**

```typescript
import Database from '@tauri-apps/plugin-sql';

const db = await Database.load('sqlite:myapp.db');
await db.execute('CREATE TABLE IF NOT EXISTS items (id INTEGER PRIMARY KEY, name TEXT)');
await db.execute('INSERT INTO items (name) VALUES (?)', ['hello']);
const items = await db.select<{ id: number; name: string }[]>('SELECT * FROM items');
```

R1 automatically rewrites the import to `@r1-runtime/apis/sql` at build time. Your data is stored in OPFS and persists across page refreshes.

**Add `rusqlite` to your Rust backend if you need SQL from Rust:**

```toml
[dependencies]
rusqlite = { version = "0.31", features = ["bundled"] }
```

```rust
use rusqlite::Connection;

#[command]
pub fn get_items() -> Vec<String> {
    let conn = Connection::open("/app/data.db").unwrap();
    // ... query and return
}
```

---

## Deploying

The output of `npm run build` is a plain static folder. Deploy it anywhere:

```bash
# Vercel
npx vercel dist --prod

# Netlify
npx netlify deploy --dir=dist --prod

# GitHub Pages — push dist/ to gh-pages branch

# Any static server
npx serve dist -l 3000
```

### Required headers for SQLite / OPFS

If your app uses SQLite or OPFS persistence, your hosting provider must send these headers:

```
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Embedder-Policy: require-corp
Cross-Origin-Resource-Policy: cross-origin
```

**Netlify** — add a `netlify.toml` to your project root:

```toml
[[headers]]
  for = "/*"
  [headers.values]
    Cross-Origin-Opener-Policy = "same-origin"
    Cross-Origin-Embedder-Policy = "require-corp"
    Cross-Origin-Resource-Policy = "cross-origin"
```

**Vercel** — add a `vercel.json`:

```json
{
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        { "key": "Cross-Origin-Opener-Policy", "value": "same-origin" },
        { "key": "Cross-Origin-Embedder-Policy", "value": "require-corp" },
        { "key": "Cross-Origin-Resource-Policy", "value": "cross-origin" }
      ]
    }
  ]
}
```

Without these headers, SQLite falls back to in-memory mode and data is lost on refresh.

---

## Troubleshooting

**`wasm-pack: command not found`**
```bash
cargo install wasm-pack
```

**Build fails: `error: failed to run custom build command for tauri-build`**

Your `build.rs` still has the original Tauri build logic. Replace the entire file with:
```rust
fn main() {}
```

**Build fails: `error[E0432]: unresolved import`**

The `tauri` crate is being compiled into WASM. Move it to the native-only section in `Cargo.toml`:
```toml
[target.'cfg(not(target_arch = "wasm32"))'.dependencies]
tauri = { version = "2", features = [] }
```

**`invoke()` never resolves (hangs forever)**

The Service Worker isn't registered. Press `Ctrl+F5` (Windows/Linux) or `Cmd+Shift+R` (Mac) to force a hard refresh. You only need to do this once.

**`invoke()` returns `undefined`**

Your Rust function isn't returning a JSON string. Every function must end with:
```rust
serde_json::to_string(&your_value).unwrap()
```

**App loads but commands do nothing**

Check the `[lib] name` in `Cargo.toml`. It must use underscores, not hyphens. `my-app` → `my_app`.

**SQLite data lost on refresh**

Your hosting provider isn't sending the required COOP/COEP/CORP headers. See the deployment section above.

**Page is blank after deploy**

Press `Ctrl+F5` on first load. The Service Worker needs a clean registration.

---

## Next Steps

- [USAGE_GUIDE.md](./USAGE_GUIDE.md) — complete API reference and patterns
- [DEVELOPER_GUIDE.md](./DEVELOPER_GUIDE.md) — how R1 works internally
- [apps/todo-demo](./apps/todo-demo) — a complete working example to read and run
