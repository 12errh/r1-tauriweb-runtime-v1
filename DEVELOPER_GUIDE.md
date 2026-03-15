# R1 Developer Guide

This guide explains how the R1 Runtime works and how you can build complex, native-grade applications for the web.

## 🧠 Philosophy

R1 is built on the principle of **"Web-Native Parity"**. We believe that web applications should have access to the same powerful abstractions as native apps—isolated backends, persistent filesystems, and window management—without compromising on the security and ease of deployment of the web.

## 🏗️ Core Components

### 1. The Kernel Worker (`@r1/kernel`)
The heart of the system. It runs in a Web Worker and manages:
*   **Routing**: Directing `invoke` calls to the right handler.
*   **WASM Orchestration**: Loading and executing Rust binaries.
*   **VFS**: Interfacing with the browser's disk storage.

### 2. The IPC Bridge (`@r1/core`)
Patches the global `window.__TAURI_IPC__` to redirect native calls to our Kernel Worker. This is why standard `@tauri-apps/api` imports just work.

### 3. The Vite Plugin (`@r1/vite-plugin`)
The easiest way to use R1. It automates:
*   Detection of Rust source code (`src-tauri`).
*   Compilation to WASM using `wasm-pack`.
*   Injection of the `r1-boot.js` script into your `index.html`.

## 🛠️ Building an App

### 1. Structure
Your project should follow the standard Tauri layout:
```text
my-app/
├── src/           # React/Vue/Frontend source
├── src-tauri/     # Rust source (Cargo.toml, src/lib.rs)
├── index.html
├── package.json
└── vite.config.ts
```

### 2. Configuration
In your `vite.config.ts`:
```typescript
import { defineConfig } from 'vite';
import { r1Plugin } from '@r1/vite-plugin';

export default defineConfig({
  plugins: [
    r1Plugin({
      rustSrc: './src-tauri'
    })
  ]
});
```

### 3. Rust Backend
Export your functions using `wasm-bindgen`. R1 uses a **JSON Serialized Bridge**:
```rust
use wasm_bindgen::prelude::*;

#[wasm_bindgen]
pub fn process_data(payload: &str) -> String {
    // payload is the JSON string from JS
    // return a JSON string back to JS
    format!(r#"{{"ok": "Processed {}"}}"#, payload)
}
```

## 🚀 Supported Complexity

How much can you run in R1?

| Feature | Supported? | Details |
| :--- | :--- | :--- |
| **Rust Standard Library** | Partial | Most of `std` is supported via WASI shim. |
| **Filesystem (std::fs)** | Yes | Fully mapped to browser OPFS. Persistent. |
| **Async Rust** | Yes | Supported via `wasm-bindgen-futures`. |
| **External Crates** | Most | Any crate that compiles to `wasm32-unknown-unknown` works. |
| **Multi-threading** | Experimental | Currently single-threaded worker with async support. |
| **Networking** | Yes | Mapped to browser `fetch`. |

### Performance Considerations
*   **VFS Speed**: OPFS is very fast, but calls are async.
*   **WASM Overhead**: There is a small overhead for JSON serialization between JS and Rust (usually <1ms for small payloads).

## ⚠️ Limitations

1.  **Shared Memory**: Since it's a worker-backend, you can't share complex memory objects with the UI thread directly; data must be serializable.
2.  **OS-Specific APIs**: R1 provides shims for `dialog`, `clipboard`, and `notification`, but they use browser fallbacks.
3.  **WASI Maturity**: We use a custom WASI shim; highly complex system calls (like raw sockets or Unix signals) are not supported.

## 🤝 Contributing

We welcome contributions to the VFS, WASM Orchestrator, or API shims. See `CONTRIBUTING.md` for more details.
