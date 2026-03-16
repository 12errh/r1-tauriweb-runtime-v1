# R1 Runtime: 5-Minute Migration Guide

This guide shows you how to take a **fresh Tauri project** and run it perfectly in the web using the R1 Runtime.

---

## Step 1: Create a Fresh Tauri App
If you don't have one, create a standard Tauri project:
```bash
npm create tauri-app@latest my-r1-app -- --template react-ts --yes
cd my-r1-app
npm install
```

---

## Step 2: Configure `package.json`
Link the R1 Runtime packages to your project:

```json
"dependencies": {
  "@tauri-apps/api": "^2.0.0",
  "@r1/apis": "file:../r1-tauriweb-runtime-v1/packages/apis",
  "@r1/core": "file:../r1-tauriweb-runtime-v1/packages/core"
},
"devDependencies": {
  "@r1/vite-plugin": "file:../r1-tauriweb-runtime-v1/packages/vite-plugin"
}
```
*Replace `../r1-tauriweb-runtime-v1` with the actual path to your R1 clone.*

---

## Step 3: Configure `vite.config.ts`
Add the R1 Plugin to your Vite setup:

```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { r1Plugin } from '@r1/vite-plugin';

export default defineConfig({
  plugins: [
    react(),
    r1Plugin({ rustSrc: './src-tauri' })
  ]
});
```

---

## Step 4: Fix `src-tauri/Cargo.toml`
Make your Rust dependencies "WASM-Safe":

```toml
[dependencies]
wasm-bindgen = "0.2"
serde = { version = "1", features = ["derive"] }
serde_json = "1"

[target.'cfg(not(target_arch = "wasm32"))'.dependencies]
tauri = { version = "2", features = [] }
tauri-plugin-opener = "2"

[lib]
name = "my_app_lib" # Use snake_case
crate-type = ["cdylib", "rlib"]
```

---

## Step 5: Fix `src-tauri/build.rs`
Gate the Tauri build script to prevent WASM panics:

```rust
fn main() {
    let target = std::env::var("TARGET").unwrap_or_default();
    if target.contains("wasm32") { return; }

    #[cfg(not(target_arch = "wasm32"))]
    tauri_build::build();
}
```

---

## Step 6: Fix `src-tauri/src/lib.rs` (The JSON Bridge)
Update your commands to return JSON strings instead of raw types:

```rust
use wasm_bindgen::prelude::*;
use serde::Deserialize;

#[derive(Deserialize)]
struct GreetArgs { name: String }

#[wasm_bindgen]
pub fn greet(payload: &str) -> String {
    let args: GreetArgs = serde_json::from_str(payload).unwrap();
    let res = format!("Hello, {}! This is Rust in the Browser.", args.name);
    serde_json::to_string(&res).unwrap() // MANDATORY: Return JSON
}
```

---

## Step 7: Build & Run!
Now build your project and serve it:

```bash
npm run build
npx serve dist -l 3000
```
Open **http://localhost:3000** and refresh with **Ctrl+F5**. Your Rust code is now running in the browser! 🚀
