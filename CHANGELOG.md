# Changelog

All notable changes to R1 TauriWeb Runtime will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.3.7] - 2026-04-20

### Fixed
- **core**: `@r1-runtime/window` is now a dynamic import in `kernel-proxy.ts` instead of a static import. This fixes `Uncaught TypeError: Failed to resolve module specifier "@r1-runtime/window"` in production builds (`dist/`). The static import was being left as a bare specifier in the esbuild boot script bundle. The dynamic import is resolved correctly by Vite/Rollup at build time.

### Packages
- `@r1-runtime/core` → **0.3.4**
- `@r1-runtime/cli` → **0.3.7**



### Fixed
- **vite-plugin**: `sw.js` (Kernel Worker) and `r1-sw.js` (Service Worker) are now pre-built and shipped inside the npm package. Previously the plugin tried to build them from TypeScript source at the user's build time, which failed when installed from npm (source files not included). Now the pre-built files are loaded from `dist/` automatically — fixes the 404 errors that caused `[R1] Kernel Worker crashed` and `[R1] Boot failed`.
- **vite-plugin**: Dev server middleware also uses pre-built workers when source isn't available.
- **cli**: Now injects `^0.3.5` for `@r1-runtime/vite-plugin`.

### Packages
- `@r1-runtime/vite-plugin` → **0.3.5**
- `@r1-runtime/cli` → **0.3.6**

## [0.3.5] - 2026-04-20

### Fixed
- **core**: Added `@r1-runtime/window` to `dependencies` — npm now installs it automatically when you install `@r1-runtime/core`. Previously users had to run `npm install @r1-runtime/window` manually, causing `Could not resolve "@r1-runtime/window"` build errors.
- **cli**: `patch-package.ts` now explicitly adds `@r1-runtime/window` to the user's `package.json` when running `npx @r1-runtime/cli sync`.

### Packages
- `@r1-runtime/core` → **0.3.3**
- `@r1-runtime/cli` → **0.3.5**

## [0.3.4] - 2026-04-20

### Fixed
- **core**: `kernel-proxy.ts` was importing `@r1/window` and `@r1/kernel` (old names) — fixed to `@r1-runtime/window` and `@r1-runtime/kernel`. This caused the `Could not resolve "@r1/window"` build error in user apps.
- **core**: `ipc-bridge.ts` was importing `@r1/apis/window` — fixed to `@r1-runtime/apis/window`
- **kernel**: `kernel.worker.ts` was importing `@r1/apis` — fixed to `@r1-runtime/apis`
- **apis**: All source files importing `@r1/kernel` — fixed to `@r1-runtime/kernel`
- **vite-plugin**: SQLite proxy/wasm file search now also looks inside `@r1-runtime/kernel/node_modules` and the hoisted npm path — fixes "sqlite3-opfs-async-proxy.js not found" when installed from npm
- **vite-plugin**: `peerDependencies` accepts `vite ^5 || ^6 || ^7`

### Packages
- `@r1-runtime/kernel` → **0.3.2**
- `@r1-runtime/apis` → **0.3.2**
- `@r1-runtime/core` → **0.3.2**
- `@r1-runtime/vite-plugin` → **0.3.4**
- `@r1-runtime/cli` → **0.3.4**
- `@r1-runtime/window` — no source change, stays at **0.3.1**
- `@r1-runtime/sw` — no source change, stays at **0.3.1**

## [0.3.3] - 2026-04-20

### Fixed
- **cli**: `rewrite-rust.ts` now uses `#[r1::command]` macro instead of manual JSON rewriting — no more TODO comments in generated code
- **cli**: Rust commands are now correctly made `pub fn` (required by wasm_bindgen)
- **cli**: `patch-cargo.ts` now strips `staticlib` from `crate-type` (Tauri v2 templates include it; wasm-pack rejects it)
- **cli**: Fixed double `#[cfg(not(target_arch = "wasm32"))]` on `run()` when `#[cfg_attr(mobile,...)]` was present
- **vite-plugin**: `peerDependencies` now accepts `vite ^5 || ^6 || ^7` (Tauri v2 templates ship with vite 7)

### Packages
- `@r1-runtime/cli` → **0.3.3**
- `@r1-runtime/vite-plugin` → **0.3.3**
- All other packages remain at **0.3.1**

## [0.3.2] - 2026-04-20

### Fixed
- **vite-plugin**: Import map now correctly maps `@tauri-apps/api/*` to `@r1-runtime/apis/*` (was incorrectly using old `@r1/apis/*` names)
- **vite-plugin**: Boot scripts now import from `@r1-runtime/core` and `@r1-runtime/apis` (was `@r1/core`, `@r1/apis`)
- **cli**: SQL import patcher now rewrites to `@r1-runtime/apis/sql` (was `@r1/apis/sql`)
- **cli**: `patch-package.ts` now injects correct versions — `^0.3.1` for core/apis, `^0.3.2` for vite-plugin

### Packages
- `@r1-runtime/vite-plugin` → **0.3.2**
- `@r1-runtime/cli` → **0.3.2**
- All other packages remain at **0.3.1**

## [0.3.0] - 2026-04-20

### Added
- **SQLite Support**: Full integration via `@sqlite.org/sqlite-wasm` with OPFS persistence
  - Data persists across page refreshes
  - Zero-config setup - just use `rusqlite` in Rust code
  - Complete WASI syscall support for database operations
- **CLI Tool**: `npx @r1-runtime/cli sync` for automatic Tauri app migration
  - Automatic project detection
  - File patching (build.rs, Cargo.toml, vite.config.ts, package.json)
  - SQL import patching (converts Tauri SQL imports to R1 format)
  - Backup creation for safety
  - Zero manual editing required
- **Proc Macro**: `#[r1::command]` for automatic JSON serialization in Rust
  - Published as `r1-macros` on crates.io
  - Eliminates boilerplate serialization code
  - Drop-in replacement for `#[tauri::command]`
- **TaskFlow Demo App**: Complete SQLite CRUD application
  - 13 Rust commands using `#[r1::command]` macro
  - Full CRUD operations with SQLite
  - Search, filter, and statistics
  - CSV/JSON export functionality
  - Real-time persistence demonstration
- **Data Loss Prevention**: Automatic storage persistence requests and quota monitoring
- **npm Publishing**: All 7 packages published to `@r1-runtime/*` scope
  - `@r1-runtime/kernel` - WASM orchestration & VFS
  - `@r1-runtime/core` - IPC bridge & runtime
  - `@r1-runtime/apis` - Tauri API shims
  - `@r1-runtime/sw` - Service Worker
  - `@r1-runtime/window` - Virtual Window Manager
  - `@r1-runtime/vite-plugin` - Vite integration
  - `@r1-runtime/cli` - Migration tool

### Changed
- **Package Names**: Renamed from `@r1/*` to `@r1-runtime/*` for npm publishing
- **Improved WASI Shim**: Complete SQLite syscall support
  - `fd_seek` with SEEK_SET, SEEK_CUR, SEEK_END
  - `fd_filestat_get` for file metadata
  - `fd_fdstat_get` for file descriptor status
  - `fd_sync` for flushing to storage
  - `path_filestat_get` for stat by path
  - `path_rename` for atomic file operations
- **Enhanced VFS**: Better OPFS integration and error handling
- **CLI Build System**: Excludes test files from dist/ folder
- **Test Coverage**: Expanded to 105+ tests across all packages

### Fixed
- Race condition with r1:ready event
- SQLite persistence across page refreshes
- TypeScript type errors in boolean/integer conversions
- CLI build including test files in published package
- Repository URLs in package.json files

### Testing
- 105+ tests passing across all packages
- 29 CLI tests including SQL import patching
- Comprehensive SQLite integration tests
- Real-world app validation (TaskFlow)

### Documentation
- Complete API reference
- Migration guide
- SQLite usage examples
- Troubleshooting guide
- Phase 7 publishing checklist

## [0.2.0] - 2026-03-15

### Added
- Complete Tauri API implementations
  - `fs` - File system operations
  - `path` - Path utilities
  - `event` - Event system
  - `dialog` - File dialogs
  - `clipboard` - Clipboard access
  - `os` - OS information
  - `window` - Window management
  - `store` - Key-value storage
- Barrel exports for direct imports
- Vite plugin for automatic Rust compilation
- Virtual Window Manager with OS themes (macOS, Windows 11, Linux)
- 63 unit tests

### Changed
- Improved error handling
- Better TypeScript types
- Enhanced documentation

## [0.1.0] - 2026-02-01

### Added
- Initial release
- Basic WASM orchestration
- VFS with OPFS support
- WASI shim
- IPC bridge
- Event system
- Service Worker for asset:// protocol

---

## Links

- [npm packages](https://www.npmjs.com/~r1-runtime)
- [crates.io package](https://crates.io/crates/r1-macros)
- [GitHub repository](https://github.com/12errh/r1-tauriweb-runtime-v1)
- [Live Demo](https://todo-demo-by-r1-runtime.netlify.app/)
