# R1 SQLite Migration Prompt (v0.3.0)

> This prompt is for AI agents to migrate an existing Tauri + SQLite app to the R1 Runtime.

## Context
The user wants to migrate their Tauri application which uses `rusqlite` to the R1 Runtime. R1 runs the Rust backend in a WASM environment (WASI) in the browser.

## Step 1: LLVM & WASI-SDK Verification
Ensure the user has LLVM 18+ and WASI SDK 24+ installed on their system (e.g., `C:\LLVM` and `C:\wasi-sdk`). If not, provide the download links.

## Step 2: Build Script (`build.ps1`)
Create a PowerShell build script in the app root to manage environment variables required for SQLite WASM compilation:
```powershell
$env:CC_wasm32_unknown_unknown = "C:\LLVM\bin\clang.exe"
$env:AR_wasm32_unknown_unknown = "C:\LLVM\bin\llvm-ar.exe"
$env:CFLAGS_wasm32_unknown_unknown = "--sysroot=C:\wasi-sdk\share\wasi-sysroot -I C:\wasi-sdk\share\wasi-sysroot\include\wasm32-wasi -DSQLITE_OS_OTHER=1"
$env:LIBSQLITE3_FLAGS = "-DSQLITE_THREADSAFE=0 -DSQLITE_OS_OTHER=1 -DSQLITE_OMIT_WAL=1"
wasm-pack build --target web --release
```

## Step 3: Cargo.toml Restructuring
1. Replace `build.rs` with `fn main() {}`.
2. Move `tauri` and native deps to `[target.'cfg(not(target_arch = "wasm32"))'.dependencies]`.
3. Upgrade `rusqlite` to `0.31` with `bundled` feature.
4. Disable `wasm-opt`:
```toml
[package.metadata.wasm-pack.profile.release]
wasm-opt = false
```

## Step 4: Rust Source Migration
1. Create/Update `lib.rs`:
   - Implement commands using the **JSON Contract** (`payload: &str -> String`).
   - Use `#[wasm_bindgen]` for all exported functions.
   - Gate `AppHandle` and `tauri::State` with `#[cfg(not(target_arch = "wasm32"))]`.
2. Initialize SQLite:
   - For WASM, use path `/app/data/app.db` (redirected to OPFS).
   - Use `once_cell` for a global connection if needed.

## Step 5: Vite Integration
Add `r1Plugin({ rustSrc: './src-tauri' })` to `vite.config.ts`.
