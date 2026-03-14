# Contributing to R1 TauriWeb Runtime

Thank you for your interest in contributing to the R1 TauriWeb Runtime! This project aims to bring native Rust/Tauri applications seamlessly to the browser environment.

## Monorepo Architecture

This project is structured as a TypeScript monorepo using standard NPM workspaces:
- `@r1/core`: The main thread IPC bridge mapping Tauri `invoke` objects over to the web worker thread.
- `@r1/kernel`: The Web Worker sandbox environment housing the Virtual File System (VFS) and the `WasmOrchestrator`.
- `@r1/sw`: The Service Worker hijacking the local browser asset protocol so static frontends can be served internally without remote servers.
- `@r1/window`: A virtual window mapping suite intercepting OS-level calls natively to DOM HTML windows.
- `@r1/vite-plugin`: The bundler compiling Rust applications directly into our `.wasm` schema.

## Development Setup

1. **Install Node dependencies:**
   ```bash
   npm install
   ```
2. **Setup Rust Toolchain:**
   Ensure you have Rust installed. We compile to WebAssembly natively.
   ```bash
   rustup target add wasm32-unknown-unknown
   ```
3. **Run local demo:**
   ```bash
   npm run dev -w apps/demo
   ```
4. **Run Tests:**
   We enforce strict unit coverage testing mock bounds perfectly utilizing `happy-dom`.
   ```bash
   npm test
   ```

## Contribution Rules

- ALL WebAssembly execution must happen strictly inside the Kernel Worker. Never run WASM on the main DOM thread.
- JS to WASM communication strictly travels as JSON strings.
- Please test rigorously via Vitest suites before pushing PRs.
