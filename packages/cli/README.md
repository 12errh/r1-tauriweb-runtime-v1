# @r1-runtime/cli

R1 TauriWeb Runtime CLI — migrate Tauri apps to the browser with one command.

## Usage

```bash
# In your Tauri app directory
npx @r1-runtime/cli sync
```

## What It Does

The CLI automatically migrates your Tauri app to work with R1:

1. ✅ **Patches `build.rs`** - Disables Tauri's native build process
2. ✅ **Updates `Cargo.toml`** - Adds WASM dependencies and configures library
3. ✅ **Adds `r1-macros`** - Enables `#[r1::command]` proc macro
4. ✅ **Updates `vite.config.ts`** - Adds R1 Vite plugin
5. ✅ **Updates `package.json`** - Installs R1 packages
6. ✅ **Converts SQL imports** - Patches Tauri SQL imports to R1 format
7. ✅ **Creates backups** - All modified files are backed up with `.r1-backup` extension

## Example

```bash
# Create a Tauri app
npm create tauri-app@latest my-app -- --template react-ts --yes

# Migrate to R1
cd my-app
npx @r1-runtime/cli sync

# Build and run
npm install
npm run build
npx serve dist
```

## Output

```
🚀 R1 TauriWeb Runtime — Sync

✓ Detecting project...
  Found: Tauri v2, React + TypeScript, 3 commands

✓ Patching build.rs...
✓ Updating Cargo.toml...
✓ Adding r1-macros dependency...
✓ Updating vite.config.ts...
✓ Updating package.json...
✓ Converting SQL imports...
✓ Rewriting 3 Rust commands...

Done! Next steps:
  npm install
  npm run build
  npx serve dist -l 3000

Then open http://localhost:3000 and press Ctrl+F5.
```

## What Gets Changed

### `build.rs`
```rust
// Before: Complex Tauri build script
// After:
fn main() {}
```

### `Cargo.toml`
```toml
# Adds:
[lib]
name = "your_app"
crate-type = ["cdylib", "rlib"]

[dependencies]
wasm-bindgen = "0.2"
serde = { version = "1", features = ["derive"] }
serde_json = "1"
r1-macros = "0.3.0"

# Moves native deps to:
[target.'cfg(not(target_arch = "wasm32"))'.dependencies]
tauri = "..."
```

### `vite.config.ts`
```typescript
import { r1Plugin } from '@r1-runtime/vite-plugin';

export default defineConfig({
  plugins: [
    r1Plugin({ rustSrc: './src-tauri' }),
    // ... other plugins
  ]
});
```

### `package.json`
```json
{
  "dependencies": {
    "@r1-runtime/core": "^0.3.0",
    "@r1-runtime/apis": "^0.3.0"
  },
  "devDependencies": {
    "@r1-runtime/vite-plugin": "^0.3.0"
  }
}
```

### SQL Imports (if using SQL)
```typescript
// Before:
import Database from "@tauri-apps/plugin-sql";

// After:
import { Database } from "@r1-runtime/apis/sql";
```

## Backups

All modified files are backed up with `.r1-backup` extension:
- `build.rs.r1-backup`
- `Cargo.toml.r1-backup`
- `vite.config.ts.r1-backup`
- `package.json.r1-backup`

## Requirements

- Node.js 18+
- Existing Tauri v1 or v2 project
- Rust toolchain (for building)

## Troubleshooting

### "No src-tauri/Cargo.toml found"
Make sure you're running the command in your Tauri app root directory (where `package.json` is).

### "Command not found: r1"
Use `npx @r1-runtime/cli sync` instead of just `r1 sync`.

### Build errors after migration
1. Run `npm install` to install R1 packages
2. Clear build cache: `rm -rf target/ dist/`
3. Rebuild: `npm run build`

## License

MIT © 2026 R1 Runtime Team
