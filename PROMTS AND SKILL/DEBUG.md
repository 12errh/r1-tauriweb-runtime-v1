# R1 Debug Prompt (v0.3.3)

**Instructions for the user**: When your R1 app has errors, copy the prompt block below, paste it to your AI agent, and add your error output at the bottom.

---

## PROMPT — Debug My R1 App

You are debugging a Tauri application running on the R1 TauriWeb Runtime v0.3.3.

Before doing anything, read the skill file at:
`PROMTS AND SKILL/R1_SKILL.md`

The skill file has a "Common Error Patterns and Fixes" section — check that section first. The error may already be documented there with a known fix.

MY ERROR OUTPUT:
[USER: PASTE YOUR ERROR HERE — either the `npm run build` output OR the browser console output. Include the full error, not just one line.]

---

### STEP 1 — CLASSIFY THE ERROR

Look at the error and determine which category it falls into:

**A) Build-time error** (appears during `npm run build`)
- TypeScript errors
- Missing exports or unresolved imports
- Rust compile errors
- wasm-pack failures
- Package not found errors

**B) Runtime error** (appears in browser console after serving)
- VFS not initialized
- `WebAssembly.instantiate()` failed
- R1 boot sequence errors
- Module not loaded
- Command not found
- JSON parse errors

**C) Blank screen with no errors**
- R1 boot script not injected
- Service Worker not registered
- App-level crash before render

---

### STEP 2 — IDENTIFY THE ROOT CAUSE

For each error message, tell me:
1. Which file is causing it
2. Why it's happening (not just what it is)
3. Whether it's an R1 problem or the app's own problem
4. Whether it's related to package names (`@r1/*` vs `@r1-runtime/*`)

---

### STEP 3 — APPLY THE FIX

Apply the fix. Common fixes:

**"Cannot find module '@r1/...'"**
- Old package names. Update to `@r1-runtime/*`:

      npm install @r1-runtime/core @r1-runtime/apis
      npm install --save-dev @r1-runtime/vite-plugin

**"Rollup failed to resolve import '@r1/apis/core'"**
- The vite-plugin version is wrong. Ensure `@r1-runtime/vite-plugin` is at `^0.3.3`:

      npm install --save-dev @r1-runtime/vite-plugin@^0.3.3

**"Module not loaded"**
- Check that WASM compiled successfully
- Look for `.wasm` files in `dist/wasm/`
- Verify Rust functions use `#[r1::command]` or `#[command]`

**"Command not found"**
- Verify Rust functions are `pub fn`
- Check function names match `invoke()` calls exactly
- Ensure `#[command]` macro is applied

**"JSON parse error"**
- Verify `r1-macros = "0.3.0"` is in `Cargo.toml`
- Check that return types implement `serde::Serialize`
- Check that parameter types implement `serde::Deserialize`

**"OPFS not available"**
- Use Chrome, Edge, or another Chromium-based browser
- OPFS is not supported in Firefox

**SQL errors / "Cannot find module '@tauri-apps/plugin-sql'"**
- Install the package: `npm install @tauri-apps/plugin-sql`
- Use `import Database from '@tauri-apps/plugin-sql'` in source (Vite plugin rewrites it)
- If using rusqlite in Rust, ensure it has the `"bundled"` feature
- Database paths must start with `/`

**"error: can only #[wasm_bindgen] public functions"**
- Your Rust command is missing `pub`. The CLI (v0.3.3+) adds it automatically.
- Fix manually: add `pub` before `fn`:

      #[command]
      pub fn my_function(param: String) -> String { ... }

**wasm-pack fails with "staticlib is not supported"**
- Your `Cargo.toml` has `staticlib` in `crate-type` (Tauri v2 templates include it).
- The CLI (v0.3.3+) removes it automatically.
- Fix manually in `src-tauri/Cargo.toml`:

      crate-type = ["cdylib", "rlib"]   # remove "staticlib"


- Replace `src-tauri/build.rs` with just `fn main() {}`

**"error[E0432]: unresolved import" (tauri crate)**
- Move `tauri` to the native-only section in `Cargo.toml`:

      [target.'cfg(not(target_arch = "wasm32"))'.dependencies]
      tauri = { version = "2", features = [] }

**Blank screen / Service Worker not registering**
- Press `Ctrl+F5` (Windows/Linux) or `Cmd+Shift+R` (Mac) to force a hard refresh

---

### STEP 4 — VERIFY THE FIX

After applying the fix, tell me:
1. Exactly what you changed
2. Why that fixes the error
3. What command to run next

**Rebuild order:**

If you changed any R1 package file (`packages/apis/`, `packages/core/`, `packages/kernel/`, `packages/vite-plugin/`):

    npm run build --workspaces
    npm run build   # in your app directory

If you only changed the app's own files:

    npm run build   # in your app directory

**Expected console output on successful boot:**

    [R1] Booting Kernel...
    [R1] Boot complete.

**Important:** Do not change any frontend `@tauri-apps/api` import statements. The Vite plugin handles rewriting them automatically. If an import is missing from R1's API layer, the fix goes in `packages/apis/` — not in the app's frontend code.

---

## Common Quick Fixes

### Wrong package names (v0.2 → v0.3)
    # Remove old
    npm uninstall @r1/core @r1/apis @r1/vite-plugin

    # Install new
    npm install @r1-runtime/core @r1-runtime/apis
    npm install --save-dev @r1-runtime/vite-plugin@^0.3.3

### Missing r1-macros in Cargo.toml
    [dependencies]
    r1-macros = "0.3.0"

### Rust command not using macro
    use r1_macros::command;

    // Change from:
    #[tauri::command]
    fn my_function(param: String) -> String { ... }

    // To:
    #[command]
    fn my_function(param: String) -> String { ... }

### SQL import error
    # Install the package
    npm install @tauri-apps/plugin-sql

    # In your source code — use @tauri-apps/plugin-sql (NOT @r1-runtime/apis/sql)
    import Database from '@tauri-apps/plugin-sql';
    # The Vite plugin rewrites this automatically at build time.
