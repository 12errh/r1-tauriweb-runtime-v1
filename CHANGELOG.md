# Changelog

All notable changes to R1 TauriWeb Runtime will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
