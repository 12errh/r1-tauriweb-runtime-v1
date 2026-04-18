# R1 Usage Guide

> A complete reference for building apps with R1 — from project setup to advanced patterns.

This guide assumes you have already completed [GETTING_STARTED.md](./GETTING_STARTED.md) and have a working R1 app. If you haven't done that yet, start there.

**Quick Migration:** If you have an existing Tauri app, you can use `npx r1 sync` to automatically apply all required changes. See the CLI section below for details.

---

## Project Structure

R1 expects the standard Tauri directory layout. Every file has a specific role:

```
my-r1-app/
├── src/                   ← Your frontend. Unchanged from standard Tauri.
│   ├── App.tsx
│   └── main.tsx
├── src-tauri/             ← Your Rust backend. Three files need R1 changes.
│   ├── src/
│   │   └── lib.rs         ← Your commands. Must use the R1 JSON contract.
│   ├── Cargo.toml         ← Dependencies. Native deps must be gated.
│   └── build.rs           ← Build script. Must have the WASM guard.
├── index.html
├── package.json           ← Must reference R1 packages.
└── vite.config.ts         ← Must include r1Plugin().
```

---

## Using the R1 CLI

**v0.3 Phase 4+** includes `npx r1 sync` — a CLI tool that automatically migrates existing Tauri apps to R1.

### What the CLI Does

```bash
cd your-tauri-app
node /path/to/r1/packages/cli/dist/index.js

# Output:
🚀 R1 TauriWeb Runtime — Sync
√ Detected: Tauri v2, react, 3 commands
√ Patching build.rs
√ Updating Cargo.toml
√ Updating vite.config.ts
√ Updating package.json
√ Rewriting 3 Rust commands
✓ Done! Your app is ready for R1.
```

### What Gets Changed

1. **build.rs** — Emptied to `fn main() {}`
2. **Cargo.toml** — Adds WASM dependencies, moves native deps to cfg target
3. **vite.config.ts** — Adds `r1Plugin()`
4. **package.json** — Adds R1 dependencies
5. **Rust commands** — Converts `#[tauri::command]` to R1 JSON contract (partial)

### Backup Files

The CLI creates `.r1-backup` files for everything it modifies. If something goes wrong, you can restore from these backups.

### Current Limitations

The CLI handles 90% of migration automatically. You may need to manually:
- Wrap Rust function return values in `serde_json::to_string()`
- Adjust complex async functions
- Review custom build scripts

**Phase 5** will add the `#[r1::command]` macro to eliminate these manual steps.

---

## The R1 JSON Contract

Every Rust function that receives data from or sends data to JavaScript must follow this contract:

```
JavaScript → JSON string → Rust function → JSON string → JavaScript
```

**Function signature in Rust — always this shape:**
```rust
#[wasm_bindgen]
pub fn my_command(payload: &str) -> String
```

**Why JSON strings and not native types?**
WASM and JavaScript have incompatible type systems. Strings are the common language both sides understand natively. The overhead is under 1ms for typical payloads.

---

## Writing Rust Commands

### Basic Command

```rust
use wasm_bindgen::prelude::*;
use serde::{Serialize, Deserialize};

#[derive(Deserialize)]
struct GreetArgs {
    name: String,
}

#[derive(Serialize)]
struct GreetResult {
    message: String,
}

#[wasm_bindgen]
pub fn greet(payload: &str) -> String {
    let args: GreetArgs = serde_json::from_str(payload).unwrap();

    let result = GreetResult {
        message: format!("Hello, {}!", args.name),
    };

    serde_json::to_string(&result).unwrap()
}
```

### Command With Error Handling

Never use `.unwrap()` in production. Return errors as JSON so JavaScript receives a clean error instead of a WASM panic:

```rust
#[wasm_bindgen]
pub fn divide(payload: &str) -> String {
    #[derive(Deserialize)]
    struct Args { a: f64, b: f64 }

    let args: Args = match serde_json::from_str(payload) {
        Ok(a) => a,
        Err(e) => return serde_json::json!({ "error": e.to_string() }).to_string(),
    };

    if args.b == 0.0 {
        return serde_json::json!({ "error": "cannot divide by zero" }).to_string();
    }

    serde_json::json!({ "ok": args.a / args.b }).to_string()
}
```

R1 checks the response: if it has an `"error"` key, the `invoke()` Promise rejects. If it has an `"ok"` key, it resolves with the value.

### Command That Reads and Writes Files

`std::fs` calls are automatically redirected to the browser's VFS (OPFS) via R1's WASI shim. No special setup required:

```rust
use std::fs;

#[wasm_bindgen]
pub fn save_note(payload: &str) -> String {
    #[derive(Deserialize)]
    struct Args { path: String, content: String }

    let args: Args = match serde_json::from_str(payload) {
        Ok(a) => a,
        Err(e) => return serde_json::json!({ "error": e.to_string() }).to_string(),
    };

    match fs::write(&args.path, &args.content) {
        Ok(_) => serde_json::json!({ "ok": true }).to_string(),
        Err(e) => serde_json::json!({ "error": e.to_string() }).to_string(),
    }
}

#[wasm_bindgen]
pub fn load_note(payload: &str) -> String {
    #[derive(Deserialize)]
    struct Args { path: String }

    let args: Args = match serde_json::from_str(payload) {
        Ok(a) => a,
        Err(e) => return serde_json::json!({ "error": e.to_string() }).to_string(),
    };

    match fs::read_to_string(&args.path) {
        Ok(content) => serde_json::json!({ "ok": content }).to_string(),
        Err(e) => serde_json::json!({ "error": e.to_string() }).to_string(),
    }
}
```

### Command That Emits Events

Rust can push events to JavaScript at any point during execution. Useful for progress reporting, background tasks, and real-time updates:

```rust
// This extern declaration is provided by R1's wasm-template (src/r1.rs)
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
pub fn process_items(payload: &str) -> String {
    #[derive(Deserialize)]
    struct Args { count: u32 }

    let args: Args = serde_json::from_str(payload).unwrap();

    for i in 0..args.count {
        let progress = (i * 100) / args.count;
        emit("progress", &format!(r#"{{"percent": {}, "item": {}}}"#, progress, i));
    }

    serde_json::json!({ "ok": "complete" }).to_string()
}
```

---

## Calling Rust From JavaScript

Your frontend code is identical to standard Tauri. R1 intercepts the calls automatically.

### Basic Invoke

```typescript
import { invoke } from '@tauri-apps/api/core';

// Call a Rust command
const result = await invoke('greet', { name: 'Alice' });
console.log(result.message); // "Hello, Alice!"
```

### Handling Errors

```typescript
try {
    const result = await invoke('divide', { a: 10, b: 0 });
    console.log(result); // never reached — throws instead
} catch (error) {
    console.error(error); // "cannot divide by zero"
}
```

### Listening for Events

```typescript
import { listen } from '@tauri-apps/api/event';

// Subscribe to events emitted by Rust
const unlisten = await listen('progress', (event) => {
    console.log(`Progress: ${event.payload.percent}%`);
    updateProgressBar(event.payload.percent);
});

// Start the Rust operation
await invoke('process_items', { count: 100 });

// Clean up the listener when done
unlisten();
```

---

## Using the Filesystem From JavaScript

R1 implements the standard Tauri filesystem API. Data is stored in OPFS and persists across page refreshes.

```typescript
import {
    writeTextFile,
    readTextFile,
    exists,
    removeFile,
    createDir,
    readDir,
} from '@tauri-apps/api/fs';

// Write a text file
await writeTextFile('/app/settings.json', JSON.stringify({ theme: 'dark' }));

// Read it back
const content = await readTextFile('/app/settings.json');
const settings = JSON.parse(content);

// Check if a file exists
const fileExists = await exists('/app/settings.json');

// List files in a directory
const entries = await readDir('/app/');

// Delete a file
await removeFile('/app/old-data.json');

// Create a directory
await createDir('/app/backups/', { recursive: true });
```

> Files stored here are private to your app's origin. Users cannot access them from other websites.

---

## Using the Store Plugin

The Store plugin is a simple key-value database backed by the VFS. It's easier than managing JSON files directly for settings and small data:

```typescript
import { invoke } from '@tauri-apps/api/core';

// Set a value
await invoke('plugin:store|set', { store: 'settings', key: 'theme', value: 'dark' });

// Get a value
const theme = await invoke('plugin:store|get', { store: 'settings', key: 'theme' });

// Check if a key exists
const hasKey = await invoke('plugin:store|has', { store: 'settings', key: 'theme' });

// Delete a key
await invoke('plugin:store|delete', { store: 'settings', key: 'theme' });

// List all keys
const keys = await invoke('plugin:store|keys', { store: 'settings' });
```

Each store is saved as a JSON file at `/.r1-store/<store-name>.json` in the VFS.

---

## Using Dialog

Dialogs are rendered as OS-themed modals that match the active window theme (macOS, Windows, or Linux).

```typescript
import { message, ask, confirm, open, save } from '@tauri-apps/api/dialog';

// Show a message
await message('File saved successfully.', { title: 'Saved', type: 'info' });

// Ask a yes/no question — returns boolean
const shouldDelete = await ask('Delete this file?', { title: 'Confirm', type: 'warning' });

// Confirm dialog — returns boolean
const confirmed = await confirm('Are you sure?');

// Open file picker — returns selected file path(s)
const filePath = await open({ multiple: false, filters: [{ name: 'JSON', extensions: ['json'] }] });

// Save file dialog — returns chosen save path
const savePath = await save({ defaultPath: '/app/export.json' });
```

---

## Using the Window Manager

The Virtual Window Manager renders your app inside a native-looking OS window.

```typescript
import { appWindow } from '@tauri-apps/api/window';

// Set the window title
await appWindow.setTitle('My App — Untitled Document');

// Resize the window
await appWindow.setSize({ width: 1024, height: 768 });

// Minimise
await appWindow.minimize();

// Maximise / restore
await appWindow.toggleMaximize();

// Close
await appWindow.close();
```

**Setting the OS theme** in `vite.config.ts`:
```typescript
r1Plugin({
    rustSrc: './src-tauri',
    os: 'macos'          // 'macos' | 'windows' | 'linux' | 'auto'
})
```

`'auto'` (the default) detects the user's operating system and uses the matching theme.

---

## Making Your App Work on Both Desktop and Web

If you want your app to run as both a native Tauri desktop app and a browser app via R1, use conditional compilation to gate native-only code.

### `Cargo.toml`

```toml
[dependencies]
wasm-bindgen = "0.2"
serde = { version = "1", features = ["derive"] }
serde_json = "1"

# Only compiled for native desktop targets
[target.'cfg(not(target_arch = "wasm32"))'.dependencies]
tauri = { version = "2", features = [] }
tauri-plugin-opener = "2"

[lib]
name = "my_app"
crate-type = ["cdylib", "rlib"]
```

### `lib.rs`

```rust
// WASM commands — compiled for both targets
use wasm_bindgen::prelude::*;

#[wasm_bindgen]
pub fn greet(payload: &str) -> String {
    // ... your command
}

// Native entry point — only compiled for desktop
#[cfg(not(target_arch = "wasm32"))]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![greet])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

### `build.rs`

```rust
fn main() {
    let target = std::env::var("TARGET").unwrap_or_default();
    if target.contains("wasm32") { return; }

    #[cfg(not(target_arch = "wasm32"))]
    tauri_build::build();
}
```

With this setup, `cargo build` produces a native desktop app and `wasm-pack build` (run automatically by R1's Vite plugin) produces the browser version.

---

## Deploying

The output of `npm run build` is a static folder. Deploy it anywhere that serves static files:

```bash
# Vercel
npx vercel dist --prod

# Netlify
npx netlify deploy --dir=dist --prod

# GitHub Pages
# Push the contents of dist/ to the gh-pages branch

# Any static file server
npx serve dist -l 3000
```

> **First load**: Press `Ctrl+F5` (Windows/Linux) or `Cmd+Shift+R` (Mac) on the first visit to ensure the Service Worker registers correctly. Subsequent loads are normal.

---

## Troubleshooting

**Build fails: `error: failed to run custom build command for tauri-build`**
Your `build.rs` is missing the WASM guard. Replace it with the version from the Getting Started guide.

**Build fails: `error[E0432]: unresolved import`**
The `tauri` crate is being compiled into WASM. Your `Cargo.toml` native dependencies need to be inside the `[target.'cfg(not(target_arch = "wasm32"))'.dependencies]` block.

**`invoke()` never resolves (hangs forever)**
Open DevTools → Application → Service Workers. Check if the Service Worker is registered. If not, hard refresh with `Ctrl+F5`.

**`invoke()` returns `undefined`**
Your Rust function is not returning a valid JSON string. Every function must end with `serde_json::to_string(&your_value).unwrap()`.

**WASM panic in console**
Your Rust function called `.unwrap()` on a failed parse. Add proper error handling using the error convention shown in the "Command With Error Handling" section above.

**Files not persisting after refresh**
OPFS requires the page to be served over HTTPS or `localhost`. If you're serving over plain HTTP on a non-localhost address, OPFS will not work.

**`wasm-pack: command not found`**
```bash
cargo install wasm-pack
```

---

## What R1 Supports

| Feature | Supported | Notes |
|---|---|---|
| `std::fs` read/write | ✅ | Redirected to OPFS |
| `serde` / `serde_json` | ✅ | Required for JSON contract |
| Async Rust | ✅ | Via `wasm-bindgen-futures` |
| External crates | ✅ Most | Must compile to `wasm32-wasi` |
| HTTP requests | ✅ | Mapped to browser `fetch` |
| `std::time` | ✅ | Via WASI `clock_time_get` |
| Random (`rand`) | ✅ | Via `crypto.getRandomValues()` |
| Multi-threading | ❌ | WASM workers are single-threaded |
| Raw sockets | ❌ | Not available in browser |
| Child processes | ❌ | `shell::execute` is stubbed |
| System tray | ❌ | Not a browser concept |
| Global shortcuts | ❌ | Not available outside focus |
| OS notifications | ⚠️ | Uses Web Notifications API |

---

## Next Steps

- Read the **[Developer Guide](./DEVELOPER_GUIDE.md)** for a deep dive into R1's internal architecture
- Look at the **[Todo Demo](./apps/todo-demo)** source code for a complete working example
- Test R1 with your own Tauri app and open an issue if something breaks