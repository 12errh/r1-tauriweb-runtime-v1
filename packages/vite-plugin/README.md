# @r1-runtime/vite-plugin

Official Vite plugin for R1 — automates Rust→WASM compilation and Tauri import patching.

## Features

- **Automatic WASM Compilation**: Compiles your `src-tauri/` Rust code to WASM during build
- **Import Patching**: Rewrites Tauri API imports to use R1 shims
- **Boot Script Injection**: Automatically injects R1 runtime initialization
- **Zero Config**: Works out of the box with standard Tauri projects

## Installation

```bash
npm install --save-dev @r1-runtime/vite-plugin
```

## Usage

Add to your `vite.config.ts`:

```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { r1Plugin } from '@r1-runtime/vite-plugin';

export default defineConfig({
  plugins: [
    r1Plugin({ rustSrc: './src-tauri' }),
    react(),
  ],
});
```

## Options

```typescript
interface R1PluginOptions {
  /**
   * Path to Rust source directory
   * @default './src-tauri'
   */
  rustSrc?: string;

  /**
   * WASM output directory (relative to project root)
   * @default './public/wasm'
   */
  wasmOut?: string;

  /**
   * Enable debug logging
   * @default false
   */
  debug?: boolean;
}
```

## What It Does

### 1. Rust → WASM Compilation

During build, the plugin:
1. Runs `wasm-pack build <rustSrc> --target web --out-dir <wasmOut>`
2. Copies the generated WASM and JS glue files to the output directory

### 2. Import Patching

Rewrites Tauri imports to use R1 shims:

```typescript
// Before:
import { invoke } from '@tauri-apps/api/core';
import { readTextFile } from '@tauri-apps/api/fs';

// After (automatically):
import { invoke } from '@r1-runtime/apis/core';
import { readTextFile } from '@r1-runtime/apis/fs';
```

### 3. Boot Script Injection

Injects R1 runtime initialization into your HTML:

```html
<script type="module">
  import { R1Runtime } from '@r1-runtime/core';
  const runtime = new R1Runtime();
  await runtime.boot();
  await runtime.loadBackend('/wasm/your_app.wasm');
  window.dispatchEvent(new Event('r1:ready'));
</script>
```

## Build Output

After running `npm run build`, your `dist/` folder will contain:

```
dist/
├── index.html
├── assets/
│   ├── index-[hash].js
│   └── index-[hash].css
└── wasm/
    ├── your_app_bg.wasm
    └── your_app.js
```

Deploy this folder to any static hosting service!

## Supported Tauri APIs

The plugin automatically patches imports for:
- `@tauri-apps/api/core`
- `@tauri-apps/api/fs`
- `@tauri-apps/api/path`
- `@tauri-apps/api/event`
- `@tauri-apps/api/dialog`
- `@tauri-apps/api/os`
- `@tauri-apps/api/clipboard`
- `@tauri-apps/api/window`
- `@tauri-apps/plugin-store`
- `@tauri-apps/plugin-sql`

## Requirements

- Vite 5.0+ (also supports Vite 6 and 7)
- Rust toolchain with `wasm-pack` installed

## Troubleshooting

### "wasm-pack: command not found"
Install it:
```bash
cargo install wasm-pack
```

### WASM file not found in build
Check that:
1. Your `Cargo.toml` has `crate-type = ["cdylib"]`
2. Rust code compiles without errors
3. `rustSrc` option points to correct directory

## License

MIT © 2026 R1 Runtime Team
