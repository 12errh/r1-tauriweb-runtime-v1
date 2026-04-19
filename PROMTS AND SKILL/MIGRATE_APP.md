# R1 Migration Prompt (v0.3.1)

**Instructions for the user**: Copy everything below the line and paste it to your AI agent (Claude, Cursor, Copilot, etc.). The agent will automatically configure your Tauri app to run with R1.

---

## PROMPT — Migrate My Tauri App to R1

```
You are configuring a Tauri application to run in the browser using the R1 TauriWeb Runtime v0.3.1.

Before making any changes, read the skill file at:
PROMTS AND SKILL/R1_SKILL.md

This file contains everything you need to know about R1 — the architecture,
the required changes, supported APIs, and common error patterns.

After reading the skill file, do the following:

STEP 1 — USE THE CLI (RECOMMENDED)
R1 v0.3+ includes an automatic migration CLI. Run this first:

```bash
npx @r1-runtime/cli sync
```

The CLI will:
- Detect your project configuration
- Patch all required files automatically
- Create backups with .r1-backup extension
- Install R1 packages
- Convert SQL imports if needed

After running the CLI, skip to STEP 3 (Verify).

STEP 2 — MANUAL MIGRATION (Only if CLI fails)

If the CLI doesn't work, apply these changes manually:

2.1 — Install R1 Packages
```bash
npm install @r1-runtime/core @r1-runtime/apis
npm install --save-dev @r1-runtime/vite-plugin
```

2.2 — Replace src-tauri/build.rs with:
```rust
fn main() {}
```

2.3 — Update src-tauri/Cargo.toml:
```toml
[lib]
name = "your_app_name"  # Use your crate name in snake_case
crate-type = ["cdylib", "rlib"]

[dependencies]
wasm-bindgen = "0.2"
serde = { version = "1", features = ["derive"] }
serde_json = "1"
r1-macros = "0.3.0"  # For #[r1::command] macro

# Move tauri and native deps here:
[target.'cfg(not(target_arch = "wasm32"))'.dependencies]
tauri = { version = "...", features = [...] }
# ... other native deps

# Remove this section:
# [build-dependencies]
```

2.4 — Update vite.config.ts:
```typescript
import { r1Plugin } from '@r1-runtime/vite-plugin';

export default defineConfig({
  plugins: [
    r1Plugin({ rustSrc: './src-tauri' }),
    // ... your other plugins
  ],
});
```

2.5 — Update Rust Commands to use #[r1::command]:
```rust
use r1_macros::command;

// Before:
#[tauri::command]
fn greet(name: String) -> String {
    format!("Hello, {}!", name)
}

// After:
#[command]
fn greet(name: String) -> String {
    format!("Hello, {}!", name)
}
```

2.6 — If using SQL, update imports:
```typescript
// Before:
import Database from "@tauri-apps/plugin-sql";

// After:
import { Database } from "@r1-runtime/apis/sql";
```

STEP 3 — VERIFY THE MIGRATION

Check these files were modified correctly:

1. src-tauri/build.rs — Should be empty: `fn main() {}`
2. src-tauri/Cargo.toml — Should have [lib], r1-macros, and gated native deps
3. vite.config.ts — Should import and use r1Plugin
4. package.json — Should have @r1-runtime/core and @r1-runtime/apis
5. Rust commands — Should use #[r1::command] or #[command]

STEP 4 — BUILD AND TEST

```bash
# Install dependencies
npm install

# Build (Vite plugin compiles Rust→WASM automatically)
npm run build

# Test locally
npx serve dist -l 3000
```

Open http://localhost:3000 and test your app.

STEP 5 — TROUBLESHOOTING

If you see errors:

**"Module not loaded"**
- Check that Rust compiled successfully
- Look for .wasm files in dist/wasm/
- Check browser console for WASM loading errors

**"Command not found"**
- Verify Rust functions use #[r1::command] or #[command]
- Check function names match invoke() calls
- Ensure functions are public (pub fn)

**"JSON parse error"**
- Verify Rust functions return serializable types
- Check that r1-macros is in Cargo.toml
- Ensure serde Serialize/Deserialize traits are implemented

**"OPFS not available"**
- Use Chrome, Edge, or another Chromium browser
- OPFS is not supported in Firefox yet

**SQL errors**
- Verify imports use @r1-runtime/apis/sql
- Check that rusqlite has "bundled" feature
- Ensure database path starts with /

STEP 6 — REPORT RESULTS

Tell me:
1. Did the CLI work? If not, what error did you see?
2. Did the manual migration work?
3. Does the app build successfully?
4. Does the app run in the browser?
5. Are there any features that don't work?

If something doesn't work, show me the error messages and I'll help debug.
```

---

## What R1 Supports (v0.3.1)

✅ **Fully Supported:**
- File system operations (fs)
- Path utilities (path)
- Events (event)
- Dialogs (dialog)
- Clipboard (clipboard)
- OS information (os)
- Window management (window)
- Key-value store (store)
- SQLite database (sql)
- HTTP requests (http)
- Notifications (notification)

❌ **Not Supported (Browser Limitations):**
- Shell execution (shell)
- System tray
- Global shortcuts
- Raw sockets
- Child processes
- Direct filesystem access outside OPFS

---

## Quick Reference

### Package Names
- `@r1-runtime/core` - Runtime and IPC bridge
- `@r1-runtime/apis` - Tauri API implementations
- `@r1-runtime/vite-plugin` - Build tooling
- `@r1-runtime/cli` - Migration CLI
- `r1-macros` - Rust proc macro (crates.io)

### CLI Command
```bash
npx @r1-runtime/cli sync
```

### Rust Macro
```rust
use r1_macros::command;

#[command]
fn my_function(param: String) -> String {
    // ... implementation
}
```

### SQL Import
```typescript
import { Database } from '@r1-runtime/apis/sql';
```

---

## Links

- **npm packages:** https://www.npmjs.com/~r1-runtime
- **crates.io:** https://crates.io/crates/r1-macros
- **GitHub:** https://github.com/12errh/r1-tauriweb-runtime-v1
- **Documentation:** See R1_SKILL.md for complete reference
