# @r1-runtime/sw

Service Worker for R1 — handles `asset://` URL interception and VFS asset loading.

## Features

- **Asset Protocol**: Intercepts `asset://` URLs and serves files from VFS
- **OPFS Integration**: Reads files from Origin Private File System
- **Automatic Registration**: Registered automatically by `@r1-runtime/core`

## Installation

```bash
npm install @r1-runtime/sw
```

## Usage

This package is automatically used by `@r1-runtime/core`. You don't need to import or configure it manually.

The Service Worker is registered when you call:

```typescript
import { R1Runtime } from '@r1-runtime/core';

const runtime = new R1Runtime();
await runtime.boot(); // Registers the Service Worker
```

## What It Does

The Service Worker intercepts requests to the `asset://` protocol and serves files from the Virtual File System:

```typescript
// In your Rust code:
let content = std::fs::read_to_string("/app/assets/logo.png")?;

// In your frontend:
<img src="asset://localhost/app/assets/logo.png" />
```

The Service Worker:
1. Intercepts the `asset://` request
2. Reads the file from OPFS at `/app/assets/logo.png`
3. Returns the file content with correct MIME type

## Supported Protocols

- `asset://localhost/*` - Maps to VFS root `/`
- `asset://embedded/*` - Maps to embedded resources

## MIME Types

The Service Worker automatically detects MIME types based on file extensions:
- `.html` → `text/html`
- `.css` → `text/css`
- `.js` → `application/javascript`
- `.json` → `application/json`
- `.png` → `image/png`
- `.jpg`, `.jpeg` → `image/jpeg`
- `.svg` → `image/svg+xml`
- `.wasm` → `application/wasm`
- And more...

## Debugging

To see Service Worker logs, open DevTools → Application → Service Workers and check "Show console logs".

## License

MIT © 2026 R1 Runtime Team
