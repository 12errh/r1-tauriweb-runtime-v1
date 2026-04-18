# Phase 6: Vibe App Analysis

## Project Overview

**Repository:** `thewh1teagle/vibe`  
**Description:** Free, open-source speech-to-text application (offline transcription)  
**Tech Stack:** Tauri v2 + React + TypeScript + Rust  
**Stars:** Popular production app  
**Status:** Actively maintained

## Why Vibe is Perfect for Phase 6

1. ✅ **Production-ready** — Real users, active development
2. ✅ **Complex Rust backend** — 30+ commands across 7 modules
3. ✅ **Heavy file I/O** — Perfect for testing VFS
4. ✅ **Multiple Tauri plugins** — Tests plugin compatibility
5. ✅ **Real-world use case** — Audio transcription with Whisper AI
6. ✅ **Well-structured** — Clean codebase, good documentation

## Rust Commands Found (30+)

### App Commands (`cmd/app.rs`) - 12 commands
- `is_online()` — Network check
- `get_commit_hash()` — Version info
- `is_avx2_enabled()` — CPU features
- `track_analytics_event()` — Analytics
- `get_logs_folder()` — File paths
- `show_log_path()` — File operations
- `show_temp_path()` — Temp folder
- `get_models_folder()` — Model storage
- `get_logs()` — Log reading
- `is_crashed_recently()` — Crash detection
- `rename_crash_file()` — File operations
- `type_text()` — Keyboard automation
- `get_cargo_features()` — Build info

### Audio Commands (`cmd/audio.rs`) - 2 commands
- `get_audio_devices()` — Device enumeration
- `start_record()` — Audio recording

### Download Commands (`cmd/download.rs`) - 2 commands
- `download_model()` — Large file downloads
- `download_file()` — HTTP downloads

### File Commands (`cmd/files.rs`) - 7 commands
- `glob_files()` — File pattern matching
- `get_path_dst()` — Path manipulation
- `get_save_path()` — Save dialogs
- `get_argv()` — CLI arguments
- `get_default_recording_path()` — Path resolution
- `open_path()` — File manager integration
- `get_ffmpeg_path()` — Binary detection

### Permission Commands (`cmd/permissions.rs`) - 2 commands
- `request_system_audio_permission()` — macOS permissions
- `open_system_audio_settings()` — System settings

### Sona Commands (`cmd/sona_cmd.rs`) - 5 commands
- `load_model()` — AI model loading
- `get_gpu_devices()` — GPU detection
- `get_api_base_url()` — API configuration
- `start_api_server()` — HTTP server
- `stop_api_server()` — Server management

### Transcribe Commands (`cmd/transcribe.rs`) - 1 command
- `transcribe()` — Main transcription function

### YouTube-DL Commands (`cmd/ytdlp.rs`) - 3 commands
- `get_latest_ytdlp_version()` — Version check
- `get_temp_path()` — Temp file management
- `download_audio()` — YouTube audio download

## Tauri Plugins Used

- `tauri-plugin-window-state` — Window persistence
- `tauri-plugin-fs` — File system ✅ R1 supports
- `tauri-plugin-updater` — Auto-updates ⚠️ May need adaptation
- `tauri-plugin-dialog` — Dialogs ✅ R1 supports
- `tauri-plugin-process` — Process management ⚠️ Limited in browser
- `tauri-plugin-os` — OS info ✅ R1 supports
- `tauri-plugin-deep-link` — URL schemes ⚠️ Browser limitation
- `tauri-plugin-store` — Key-value storage ✅ R1 supports
- `tauri-plugin-single-instance` — Single instance ⚠️ Browser limitation
- `tauri-plugin-clipboard-manager` — Clipboard ✅ R1 supports
- `tauri-plugin-global-shortcut` — Shortcuts ⚠️ Browser limitation
- `tauri-plugin-notification` — Notifications ✅ R1 supports (Web API)
- `tauri-plugin-http` — HTTP client ✅ R1 supports
- `tauri-plugin-opener` — Open URLs ✅ R1 supports

## R1 Compatibility Assessment

### ✅ Will Work (Core Features)
- File system operations (VFS)
- HTTP downloads
- Path manipulation
- Store/settings
- Dialogs
- Clipboard
- Notifications (Web API)
- Most Rust commands

### ⚠️ Needs Adaptation
- Audio recording (Web Audio API)
- GPU detection (WebGPU)
- Process spawning (limited)
- Global shortcuts (focus-only)
- Single instance (browser tabs)
- Auto-updates (manual)

### ❌ Won't Work (Browser Limitations)
- System audio permission (macOS specific)
- Deep linking (desktop-only)
- Keyboard automation (`enigo` crate)
- FFmpeg binary execution

## Migration Strategy

### Phase 1: Basic Setup
1. Run `npx r1 sync` on Vibe
2. Add `r1-macros` dependency
3. Convert commands to `#[r1::command]` macro
4. Fix build.rs and Cargo.toml

### Phase 2: Command Migration
1. Start with simple commands (get_commit_hash, is_avx2_enabled)
2. Test file operations (get_logs, glob_files)
3. Test HTTP operations (download_file)
4. Test store operations

### Phase 3: Complex Features
1. Adapt audio recording for Web Audio API
2. Stub out unsupported features (FFmpeg, enigo)
3. Test transcription flow (if possible)

### Phase 4: Testing
1. Build for web
2. Test each command category
3. Document what works vs. what doesn't
4. Create compatibility report

## Expected Challenges

1. **FFmpeg dependency** — Binary execution not possible in browser
   - Solution: Use WASM-compiled FFmpeg or stub out
   
2. **Audio recording** — Uses `cpal` crate (system audio)
   - Solution: Adapt to Web Audio API or stub out
   
3. **GPU detection** — Native GPU APIs
   - Solution: Use WebGPU API or return mock data
   
4. **Binary downloads** — Large model files
   - Solution: Test with smaller files first

5. **30+ commands** — Large migration effort
   - Solution: Prioritize core commands, stub others

## Success Criteria

### Minimum (Phase 6 Pass)
- ✅ App builds with R1
- ✅ 10+ commands work correctly
- ✅ File operations work (VFS)
- ✅ HTTP downloads work
- ✅ Store/settings work
- ✅ UI renders correctly

### Ideal (Full Migration)
- ✅ 20+ commands work
- ✅ Audio recording adapted
- ✅ Transcription flow works (with limitations)
- ✅ All file operations work
- ✅ Comprehensive compatibility report

## Timeline Estimate

- **Setup & Basic Commands:** 2-3 hours
- **File & HTTP Operations:** 2-3 hours
- **Complex Features:** 4-6 hours
- **Testing & Documentation:** 2-3 hours
- **Total:** 10-15 hours

## Next Steps

1. Run `npx r1 sync` on Vibe
2. Review generated changes
3. Add `r1-macros` to Cargo.toml
4. Start converting commands
5. Build and test incrementally
6. Document findings

---

**Status:** Ready to begin Phase 6 migration
**Date:** April 18, 2026
