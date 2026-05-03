# R1 Usage Guide

> Complete reference for building apps with R1 — commands, APIs, events, filesystem, SQLite, and deployment.

This guide assumes you have a working R1 app. If you haven't set one up yet, start with [GETTING_STARTED.md](./GETTING_STARTED.md).

---

## Table of Contents

- [Writing Rust Commands](#writing-rust-commands)
- [Advanced Tauri Type Support](#advanced-tauri-type-support)
- [Calling Rust from JavaScript](#calling-rust-from-javascript)
- [Events — Rust to JavaScript](#events--rust-to-javascript)
- [Filesystem](#filesystem)
- [SQLite](#sqlite)
- [Store Plugin](#store-plugin)
- [Dialog](#dialog)
- [Clipboard](#clipboard)
- [OS Info](#os-info)
- [Window Manager](#window-manager)
- [Deploying](#deploying)
- [Supported APIs](#supported-apis)
- [Limitations](#limitations)

---

## Writing Rust Commands

### Using `#[r1::command]` (Recommended)

The `r1-macros` crate provides a `#[command]` attribute that handles all JSON serialization automatically. Add it to `Cargo.toml`:

```toml
[dependencies]
r1-macros = "0.4.0"
wasm-bindgen = "0.2"
serde = { version = "1", features = ["derive"] }
serde_json = "1"
```

Then write commands exactly like standard Tauri:

```rust
use r1_macros::command;
use serde::{Serialize, Deserialize};

#[command]
pub fn greet(name: String) -> String {
    format!("Hello, {}!", name)
}

#[command]
pub fn add(a: f64, b: f64) -> f64 {
    a + b
}

#[derive(Serialize, Deserialize)]
pub struct User {
    pub id: u32,
    pub name: String,
}

#[command]
pub fn get_user(id: u32) -> User {
    User { id, name: "Alice".to_string() }
}
```

### Advanced Tauri Type Support

R1 v0.4.0+ automatically handles common Tauri-injected types. You can keep your desktop signatures unchanged:

```rust
use tauri::{State, Window, AppHandle};

#[command]
pub fn complex_cmd(
    state: State<'_, MyState>,
    window: Window,
    _app: AppHandle,
    payload: MyData
) -> Result<String, String> {
    // In the browser, 'state' and 'window' are automatically stubbed.
    // Methods like window.label() return default values (e.g., "main").
    Ok(format!("Processed for {}", window.label()))
}
```

Supported injected types:
- `tauri::State`
- `tauri::Window` / `tauri::WebviewWindow`
- `tauri::AppHandle`
- `tauri::Runtime`

---

## Manual JSON Contract

If you prefer not to use the macro, every command follows this exact signature:

```rust
#[wasm_bindgen]
pub fn my_command(payload: &str) -> String
```

One JSON string in. One JSON string out.

**Error handling convention:**

```rust
// Success — invoke() resolves with the value
serde_json::json!({ "ok": your_value }).to_string()

// Error — invoke() rejects with the message
serde_json::json!({ "error": "something went wrong" }).to_string()
```

---

## Calling Rust from JavaScript

Your frontend code is identical to standard Tauri. R1 intercepts the calls automatically.

```typescript
import { invoke } from '@tauri-apps/api/core';

// Basic call
const message = await invoke<string>('greet', { name: 'Alice' });

// With error handling
try {
    const user = await invoke<User>('create_user', { name: '' });
} catch (error) {
    console.error(error); // "Name cannot be empty"
}
```

---

## Filesystem

R1 implements the standard Tauri filesystem API, including directory traversal which was added in v0.4.0.

### From Rust

```rust
use std::fs;

// List directory (v0.4.0+)
for entry in fs::read_dir("/app/").unwrap() {
    let entry = entry.unwrap();
    println!("{}", entry.file_name().to_string_lossy());
}

// Delete file (v0.4.0+)
fs::remove_file("/app/old.txt").unwrap();
```

---

## Deploying

`npm run build` produces a static folder. Deploy it anywhere that serves static files.

> **Crucial:** Press `Ctrl+F5` (Windows/Linux) or `Cmd+Shift+R` (Mac) on first load to register the Service Worker. Subsequent loads are normal.

---

## Limitations

- **Multi-threading** — WASM workers are single-threaded.
- **Native OS libraries** — Crates depending on C system libraries may not compile.
- **Raw sockets** — Not available in browser.
- **Child processes** — `shell::execute` is stubbed.
