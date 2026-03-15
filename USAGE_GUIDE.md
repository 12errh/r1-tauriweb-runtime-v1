# R1 Usage Guide: Step-by-Step

This guide walks you through building your first application with the R1 TauriWeb Runtime.

## 1. Project Organization

R1 expects a standard Tauri-like directory structure. Even if you aren't building for native desktop yet, follow this layout:

```text
my-project/
├── src/               # Your web frontend (React/Vue/etc)
│   ├── App.tsx        # UI Logic
│   └── main.tsx       # Entry point
├── src-tauri/         # Your Rust backend
│   ├── src/
│   │   └── lib.rs     # Rust logic (WASM entry)
│   ├── Cargo.toml     # Rust dependencies
│   └── build.rs       # Build script (Requires gating!)
├── index.html         # Main entry
├── package.json       # JS dependencies
└── vite.config.ts     # Build configuration
```

---

## 2. Configuration (`vite.config.ts`)

Since the R1 packages aren't on NPM yet, you should point your configurations to the local workspace or use `npm link`.

### Basic Configuration
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

> [!IMPORTANT]
> Since the R1 Runtime replaces `@tauri-apps/api`, the plugin automatically patches your imports during build. You don't need to change `import { invoke } from '@tauri-apps/api/core'`.

---

## 3. Writing the Rust Backend (`src-tauri/src/lib.rs`)

Your Rust code will be compiled to WASM. You must use `wasm-bindgen` and follow the **JSON contract**.

### The Flow:
1. JavaScript calls `invoke('command_name', { data: ... })`.
2. R1 serializes `{ data: ... }` to a JSON string.
3. Your Rust function receives this string.
4. You return a JSON string back to JavaScript.

### Example:
```rust
use wasm_bindgen::prelude::*;
use serde::{Serialize, Deserialize};

#[derive(Deserialize)]
struct MyArgs {
    name: String,
}

#[derive(Serialize)]
struct MyResponse {
    message: String,
}

#[wasm_bindgen]
pub fn say_hello(payload: &str) -> String {
    // 1. Parse incoming JSON
    let args: MyArgs = serde_json::from_str(payload).unwrap();
    
    // 2. Logic
    let res = MyResponse {
        message: format!("Hello, {}! This is Rust speaking.", args.name)
    };
    
    // 3. Return as JSON String (MANDATORY)
    // Failure to return valid JSON will cause a "WASM Panic"
    serde_json::to_string(&res).unwrap_or_else(|_| "null".into())
}
```

> [!WARNING]
> **The JSON Return Rule**: Every Rust function exported via `wasm-bindgen` MUST return a valid JSON string. Even if you just want to return a string, use `serde_json::to_string(&my_string)`.

---

## 3.5. Making Existing Tauri Apps "Safe for WASM"

The standard `tauri` crate cannot compile to WASM because it depends on native OS features. To keep your app working for both Desktop and Web, use these patterns.

### A. Conditional `Cargo.toml`
Move native-only dependencies to a target-specific block:

```toml
[dependencies]
wasm-bindgen = "0.2"
serde = { version = "1", features = ["derive"] }
serde_json = "1"

[target.'cfg(not(target_arch = "wasm32"))'.dependencies]
tauri = { version = "2", features = [] }
```

### B. Safe `build.rs`
The `tauri-build` script will panic during WASM compilation. You MUST gate it:

```rust
fn main() {
    // Check the target environment variable
    let target = std::env::var("TARGET").unwrap_or_default();
    if target.contains("wasm32") {
        return;
    }

    #[cfg(not(target_arch = "wasm32"))]
    tauri_build::build();
}
```

### C. Conditional `lib.rs`
Gate your native entry points:

```rust
#[cfg(not(target_arch = "wasm32"))]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![greet])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

---

## 4. Writing the Frontend UI (`src/App.tsx`)

You use the standard `@tauri-apps/api` as if you were building a native app. The R1 Runtime intercepts these calls and routes them to your WASM worker or the Virtual Filesystem.

### Calling Rust
```tsx
import { invoke } from '@tauri-apps/api/tauri';

const runLogic = async () => {
    // This call is intercepted by R1 and sent to WASM lib.rs
    const result = await invoke('say_hello', { name: 'Developer' });
    console.log(result.message); // "Hello, Developer! This is Rust speaking."
}
```

### Using the Filesystem (Persistent)
Data is saved in the browser's **Origin Private File System (OPFS)**. It survives page refreshes.
```tsx
import { writeTextFile, readTextFile } from '@tauri-apps/api/fs';

const saveSettings = async (data: string) => {
    await writeTextFile('/settings.json', data);
};
```

---

## 5. How to use R1 *Currently* (Local Setup)

Until we publish to NPM, follow these steps to use R1 in a new app:

1.  **Clone the Runtime**:
    `git clone https://github.com/12errh/r1-tauriweb-runtime-v1.git`
2.  **Install & Build**:
    ```bash
    cd r1-tauriweb-runtime-v1
    npm install
    npm run build
    ```
3.  **Link your project**:
    In your new app's `package.json`, point the R1 dependencies to the local paths:
    ```json
    "dependencies": {
      "@tauri-apps/api": "^1.5.0",
      "@r1/apis": "file:../path-to-r1/packages/apis",
      "@r1/core": "file:../path-to-r1/packages/core"
    },
    "devDependencies": {
      "@r1/vite-plugin": "file:../path-to-r1/packages/vite-plugin"
    }
    ```
4.  **Run with Vite**:
    Just run `npm run dev` or `npm run build`. The `@r1/vite-plugin` handles the rest!

## 6. How Complex can the App be?

*   **100+ Rust functions**: Fine.
*   **Database Files**: Fine (SQLite via VFS).
*   **Complex UI**: Fine (React/Tailwind perfectly supported).
*   **Multi-Window**: Supported via `WindowManager`.

For a real-world example, see the [Todo Demo](apps/todo-demo)!
