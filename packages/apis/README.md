# @r1-runtime/apis

Tauri API shims for R1 — drop-in replacements for `@tauri-apps/api`.

## Features

Complete implementations of Tauri APIs that work in the browser:
- File System (`fs`)
- SQL Database (`sql`)
- Events (`event`)
- Dialogs (`dialog`)
- Path utilities (`path`)
- OS information (`os`)
- Clipboard (`clipboard`)
- Window management (`window`)
- Key-value store (`store`)
- Notifications (`notification`)
- Shell (`shell`)
- HTTP (`http`)

## Installation

```bash
npm install @r1-runtime/apis
```

## Usage

### File System

```typescript
import { readTextFile, writeTextFile, readDir } from '@r1-runtime/apis/fs';

await writeTextFile('notes.txt', 'Hello World');
const content = await readTextFile('notes.txt');
const files = await readDir('/app/data');
```

### SQL Database

```typescript
import { Database } from '@r1-runtime/apis/sql';

const db = await Database.load('sqlite:app.db');
await db.execute('CREATE TABLE users (id INTEGER, name TEXT)');
await db.execute('INSERT INTO users VALUES (?, ?)', [1, 'Alice']);
const rows = await db.select('SELECT * FROM users');
```

### Events

```typescript
import { listen, emit } from '@r1-runtime/apis/event';

// Listen for events from Rust
await listen('update', (event) => {
  console.log('Received:', event.payload);
});

// Emit events to Rust
await emit('button-clicked', { id: 123 });
```

### Dialog

```typescript
import { open, save, message } from '@r1-runtime/apis/dialog';

const file = await open({ multiple: false });
const savePath = await save({ defaultPath: 'document.txt' });
await message('Operation complete!', { title: 'Success' });
```

### Path Utilities

```typescript
import { appDataDir, join, basename } from '@r1-runtime/apis/path';

const dataDir = await appDataDir();
const filePath = await join(dataDir, 'config.json');
const name = await basename(filePath);
```

### OS Information

```typescript
import { platform, arch, version } from '@r1-runtime/apis/os';

const os = await platform(); // 'linux', 'darwin', 'windows'
const architecture = await arch(); // 'x86_64', 'aarch64'
const osVersion = await version();
```

### Clipboard

```typescript
import { writeText, readText } from '@r1-runtime/apis/clipboard';

await writeText('Hello from R1!');
const text = await readText();
```

### Store (Key-Value)

```typescript
import { Store } from '@r1-runtime/apis/store';

const store = new Store('settings.json');
await store.set('theme', 'dark');
const theme = await store.get('theme');
await store.save();
```

## Available Exports

All APIs support direct imports:

```typescript
import { ... } from '@r1-runtime/apis/fs';
import { ... } from '@r1-runtime/apis/sql';
import { ... } from '@r1-runtime/apis/event';
import { ... } from '@r1-runtime/apis/dialog';
import { ... } from '@r1-runtime/apis/path';
import { ... } from '@r1-runtime/apis/os';
import { ... } from '@r1-runtime/apis/clipboard';
import { ... } from '@r1-runtime/apis/window';
import { ... } from '@r1-runtime/apis/store';
import { ... } from '@r1-runtime/apis/notification';
import { ... } from '@r1-runtime/apis/shell';
import { ... } from '@r1-runtime/apis/http';
```

## Compatibility

These APIs are designed to be drop-in replacements for `@tauri-apps/api`. Your existing Tauri frontend code should work without changes.

## License

MIT © 2026 R1 Runtime Team
