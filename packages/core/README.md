# @r1-runtime/core

Main thread runtime for R1 — IPC bridge, EventBus, and boot synchronization.

## Features

- **IPC Bridge**: Patches `window.__TAURI_INTERNALS__` for seamless `invoke()` calls
- **Event System**: Full Tauri event bridge (emit/listen)
- **Boot Orchestration**: Manages Worker initialization and WASM loading
- **Zero Frontend Changes**: Your existing Tauri frontend code works unchanged

## Installation

```bash
npm install @r1-runtime/core @r1-runtime/apis
```

## Usage

```typescript
import { R1Runtime } from '@r1-runtime/core';

// Initialize runtime
const runtime = new R1Runtime();
await runtime.boot();

// Your existing Tauri code now works:
import { invoke } from '@tauri-apps/api/core';
const result = await invoke('greet', { name: 'World' });
```

## API

### R1Runtime

- `boot()` - Initialize runtime and load WASM backend
- `invoke(cmd, args)` - Call Rust command
- `emit(event, payload)` - Emit event to Rust
- `listen(event, handler)` - Listen for events from Rust

## How It Works

The runtime:
1. Registers a Service Worker for `asset://` protocol
2. Spawns a Worker for WASM execution
3. Patches `window.__TAURI_INTERNALS__` for IPC
4. Loads your Rust backend as WASM
5. Bridges all `invoke()` calls to the Worker

## License

MIT © 2026 R1 Runtime Team
