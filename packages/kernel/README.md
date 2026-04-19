# @r1-runtime/kernel

Core OS-like kernel for R1 TauriWeb Runtime — WASM orchestration, VFS, and WASI shim.

## Features

- **WASM Orchestration**: Load and execute WebAssembly modules in a dedicated Worker
- **Virtual File System (VFS)**: OPFS-backed file system with full persistence
- **WASI Shim**: Complete WASI `snapshot_preview1` implementation for Rust `std::fs`
- **SQLite Support**: Full syscall support for `rusqlite` with bundled feature

## Installation

```bash
npm install @r1-runtime/kernel
```

## Usage

```typescript
import { VFS, WasmOrchestrator } from '@r1-runtime/kernel';

// Initialize VFS
const vfs = new VFS();
await vfs.init();

// Create orchestrator
const orchestrator = new WasmOrchestrator(vfs);

// Load WASM module
await orchestrator.loadModule('app', '/wasm/app.wasm');

// Call Rust functions
const result = await orchestrator.callFunction('app', 'greet', { name: 'World' });
```

## API

### VFS

- `init()` - Initialize OPFS storage
- `read(path)` - Read file as Uint8Array
- `write(path, data)` - Write file
- `exists(path)` - Check if file exists
- `delete(path)` - Delete file
- `readdir(path)` - List directory contents

### WasmOrchestrator

- `loadModule(name, url)` - Load WASM module
- `callFunction(module, fn, args)` - Call Rust function
- `unloadModule(name)` - Unload module

## License

MIT © 2026 R1 Runtime Team
