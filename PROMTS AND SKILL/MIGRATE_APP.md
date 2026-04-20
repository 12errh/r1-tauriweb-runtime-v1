# R1 Migration Prompt (v0.3.2)

**Instructions for the user**: Copy the prompt block below and paste it to your AI agent (Claude, Cursor, Copilot, etc.). The agent will automatically configure your Tauri app to run with R1.

---

## PROMPT — Migrate My Tauri App to R1

You are configuring a Tauri application to run in the browser using the R1 TauriWeb Runtime v0.3.2.

Before making any changes, read the skill file at:
`PROMTS AND SKILL/R1_SKILL.md`

This file contains everything you need to know about R1 — the architecture, the required changes, supported APIs, and common error patterns.

After reading the skill file, do the following:

---

### STEP 1 — USE THE CLI (RECOMMENDED)

R1 v0.3+ includes an automatic migration CLI. Run this first:

    npx @r1-runtime/cli sync

The CLI will:
- Detect your project configuration (Tauri version, frontend framework, commands)
- Patch all required files automatically
- Create `.r1-backup` copies of every modified file
- Add R1 packages to package.json
- Convert SQL imports if needed

After running the CLI, skip to STEP 3 (Verify).

---

### STEP 2 — MANUAL MIGRATION (Only if CLI fails)

If the CLI doesn't work, apply these changes manually:

**2.1 — Install R1 packages:**

    npm install @r1-runtime/core @r1-runtime/apis
    npm install --save-dev @r1-runtime/vite-plugin

**2.2 — Replace `src-tauri/build.rs` entirely with:**

    fn main() {}

**2.3 — Update `src-tauri/Cargo.toml`:**

    [lib]
    name = "your_app_name"   # snake_case — no hyphens
    crate-type = ["cdylib", "rlib"]

    [dependencies]
    wasm-bindgen = "0.2"
    serde = { version = "1", features = ["derive"] }
    serde_json = "1"
    r1-macros = "0.3.0"

    # Move tauri and all native deps here:
    [target.'cfg(not(target_arch = "wasm32"))'.dependencies]
    tauri = { version = "...", features = [...] }
    # ... other native deps

    # Remove the [build-dependencies] section entirely.

**2.4 — Update `vite.config.ts`:**

    import { r1Plugin } from '@r1-runtime/vite-plugin';

    export default defineConfig({
      plugins: [
        r1Plugin({ rustSrc: './src-tauri' }),
        // ... your other plugins
      ],
    });

**2.5 — Update Rust commands to use `#[r1::command]`:**

    use r1_macros::command;

    // Before:
    #[tauri::command]
    fn greet(name: String) -> String {
        format!("Hello, {}!", name)
    }

    // After (no other changes needed):
    #[command]
    fn greet(name: String) -> String {
        format!("Hello, {}!", name)
    }

**2.6 — Gate the native entry point:**

    // In lib.rs — wrap the run() function so it doesn't compile to WASM
    #[cfg(not(target_arch = "wasm32"))]
    pub fn run() {
        tauri::Builder::default()
            .invoke_handler(tauri::generate_handler![greet])
            .run(tauri::generate_context!())
            .expect("error while running tauri application");
    }

**2.7 — If using SQL, install the frontend package:**

    npm install @tauri-apps/plugin-sql

No import changes needed — the Vite plugin rewrites `@tauri-apps/plugin-sql` to `@r1-runtime/apis/sql` automatically at build time.

---

### STEP 3 — VERIFY THE MIGRATION

Check these files were modified correctly:

1. `src-tauri/build.rs` — Should contain only `fn main() {}`
2. `src-tauri/Cargo.toml` — Should have `[lib]`, `r1-macros = "0.3.0"`, and native deps gated behind `cfg(not(target_arch = "wasm32"))`
3. `vite.config.ts` — Should import and use `r1Plugin`
4. `package.json` — Should have `@r1-runtime/core` and `@r1-runtime/apis` in dependencies, `@r1-runtime/vite-plugin` in devDependencies
5. Rust commands — Should use `#[command]` from `r1_macros`

---

### STEP 4 — BUILD AND TEST

    npm install
    npm run build
    npx serve dist -l 3000

Open http://localhost:3000 and press `Ctrl+F5` on first load.

In the browser console you should see:

    [R1] Booting Kernel...
    [R1] Boot complete.

---

### STEP 5 — TROUBLESHOOTING

**"Module not loaded"**
- Check that Rust compiled successfully (look for `.wasm` files in `dist/wasm/`)
- Check browser console for WASM loading errors

**"Command not found"**
- Verify Rust functions use `#[command]` and are `pub fn`
- Check function names match `invoke()` calls exactly

**"JSON parse error"**
- Verify `r1-macros = "0.3.0"` is in `Cargo.toml`
- Check that return types implement `serde::Serialize`

**"OPFS not available"**
- Use Chrome, Edge, or another Chromium-based browser
- OPFS is not supported in Firefox

**SQL errors**
- Verify `@tauri-apps/plugin-sql` is installed: `npm install @tauri-apps/plugin-sql`
- If using rusqlite in Rust, ensure it has the `"bundled"` feature
- Database paths must start with `/`

---

### STEP 6 — REPORT RESULTS

Tell me:
1. Did the CLI work? If not, what error did you see?
2. Does the app build successfully?
3. Does the app run in the browser?
4. Are there any features that don't work?

If something doesn't work, show me the error messages and I'll help debug.

---

## What R1 Supports (v0.3.2)

✅ **Fully Supported:**
- File system operations (`fs`)
- Path utilities (`path`)
- Events (`event`)
- Dialogs (`dialog`)
- Clipboard (`clipboard`)
- OS information (`os`)
- Window management (`window`)
- Key-value store (`store`)
- SQLite database (`sql`)
- HTTP requests (`http`)
- Notifications (`notification`)

❌ **Not Supported (Browser Limitations):**
- Shell execution (`shell.execute`)
- System tray
- Global shortcuts
- Raw sockets
- Child processes
- Direct filesystem access outside OPFS

---

## Quick Reference

### CLI Command
    npx @r1-runtime/cli sync

### Rust Macro
    use r1_macros::command;

    #[command]
    fn my_function(param: String) -> String {
        format!("Result: {}", param)
    }

### Package Versions
- `@r1-runtime/core` — 0.3.1
- `@r1-runtime/apis` — 0.3.1
- `@r1-runtime/vite-plugin` — 0.3.2 (required)
- `r1-macros` — 0.3.0 (crates.io)

### Links
- npm: https://www.npmjs.com/~r1-runtime
- crates.io: https://crates.io/crates/r1-macros
- GitHub: https://github.com/12errh/r1-tauriweb-runtime-v1
- Live Demo: https://todo-demo-by-r1-runtime.netlify.app/
