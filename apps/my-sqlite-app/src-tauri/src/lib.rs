use wasm_bindgen::prelude::*;
use rusqlite::Connection;
// use once_cell::sync::Lazy;
// use std::sync::Mutex;

// Global state for SQLite connection. 
// Note: Mutex in wasm32-unknown-unknown can panic on "recursive" access (e.g. from React double-mount)
// instead of blocking. Since WASM is single-threaded here, we use a simple static.
static mut DB: Option<Connection> = None;

// --- UNIFIED ALLOCATOR EXPORTS ---
// These ensure that C code (wasm_vfs.c) uses the SAME allocator as Rust (dlmalloc).
// This prevents "memory access out of bounds" when passing pointers between C and Rust.

#[no_mangle]
pub unsafe extern "C" fn malloc(size: usize) -> *mut u8 {
    let layout = std::alloc::Layout::from_size_align(size, 16).unwrap_or(
        std::alloc::Layout::from_size_align_unchecked(size, 1)
    );
    std::alloc::alloc(layout)
}

#[no_mangle]
pub unsafe extern "C" fn free(_ptr: *mut u8) {
    // Note: Rust dealloc needs the original layout (size). 
    // In WASM, since we use dlmalloc, we can often just provide a dummy size 0 
    // but better to just use a custom allocator if we really need full free support.
    // For now, we provide the symbol so linking succeeds and it's safer than JS-stub.
}

#[no_mangle]
pub unsafe extern "C" fn realloc(ptr: *mut u8, old_size: usize, new_size: usize) -> *mut u8 {
    let layout = std::alloc::Layout::from_size_align(old_size, 16).unwrap_or(
        std::alloc::Layout::from_size_align_unchecked(old_size, 1)
    );
    std::alloc::realloc(ptr, layout, new_size)
}

#[wasm_bindgen(start)]
pub fn start() {
    #[cfg(target_arch = "wasm32")]
    console_error_panic_hook::set_once();
}

#[wasm_bindgen]
pub fn init_sync(_payload: &str) -> String {
    #[cfg(target_arch = "wasm32")]
    {
        unsafe {
            if DB.is_some() {
                return serde_json::json!({ "status": "already_init" }).to_string();
            }
        }

        // 1. Try to open the connection with the custom VFS
        let conn = match Connection::open_with_flags_and_vfs(
            "/app/data/my.db",
            rusqlite::OpenFlags::SQLITE_OPEN_READ_WRITE | rusqlite::OpenFlags::SQLITE_OPEN_CREATE,
            "wasm-mem"
        ) {
            Ok(c) => c,
            Err(e) => return serde_json::json!({ "error": format!("Failed to open DB: {}", e) }).to_string(),
        };

        // 2. Initialize the table
        if let Err(e) = conn.execute("CREATE TABLE IF NOT EXISTS data (val TEXT)", []) {
            return serde_json::json!({ "error": format!("Failed to create table: {}", e) }).to_string();
        }

        unsafe {
            DB = Some(conn);
        }
        serde_json::json!({ "status": "ok", "message": "SQLite Init Success" }).to_string()
    }
    #[cfg(not(target_arch = "wasm32"))]
    {
        serde_json::json!({ "status": "not_wasm" }).to_string()
    }
}

#[wasm_bindgen]
pub fn save_data(payload: &str) -> String {
    #[cfg(target_arch = "wasm32")]
    {
        let db = unsafe {
            match DB.as_ref() {
                Some(d) => d,
                None => return serde_json::json!({ "error": "DB not initialized. Call init_sync first." }).to_string(),
            }
        };

        if let Err(e) = db.execute("INSERT INTO data (val) VALUES (?1)", [payload]) {
            return serde_json::json!({ "error": format!("Insert failed: {}", e) }).to_string();
        }
        
        let mut stmt = db.prepare("SELECT val FROM data").unwrap();
        let rows = stmt.query_map([], |row| row.get::<_, String>(0)).unwrap();
        let results: Vec<String> = rows.map(|r| r.unwrap()).collect();
        
        serde_json::json!({ "status": "saved", "items": results }).to_string()
    }
    #[cfg(not(target_arch = "wasm32"))]
    {
        serde_json::json!({ "status": "not_wasm" }).to_string()
    }
}

#[cfg(not(target_arch = "wasm32"))]
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
