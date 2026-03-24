# New R1 App with SQLite Support Guide (v0.3.0)

> Official guide for developers starting a new R1 project with persistent SQLite storage.

## 1. Prerequisites
- **LLVM 18+**: For compiling SQLite C code.
- **WASI SDK 24+**: For WASM syscall headers.
- **wasm-pack**: `npm install -g wasm-pack`.

## 2. Project Initialization
```bash
npm create tauri-app@latest my-sqlite-app -- --template react-ts --yes
cd my-sqlite-app
```

## 3. Configure R1 + SQLite
1. **Patch `Cargo.toml`**:
   - Add `rusqlite = { version = "0.31", features = ["bundled"] }`.
   - Add `wasm-bindgen`, `serde`, `serde_json`.
   - Set crate-type to `["cdylib", "rlib"]`.
2. **Setup Build Config**:
   Create `src-tauri/.cargo/config.toml`:
```toml
[env]
CC_wasm32_unknown_unknown = "C:\\LLVM\\bin\\clang.exe"
CFLAGS_wasm32_unknown_unknown = "--sysroot=C:\\wasi-sdk\\share\\wasi-sysroot -I C:\\wasi-sdk\\share\\wasi-sysroot\\include\\wasm32-wasi -DSQLITE_OS_OTHER=1"
```

## 4. Implement SQLite Command
In `src-tauri/src/lib.rs`:
```rust
use wasm_bindgen::prelude::*;
use rusqlite::Connection;

#[wasm_bindgen]
pub fn save_data(payload: &str) -> String {
    let conn = Connection::open("/app/data/my.db").unwrap();
    conn.execute("CREATE TABLE IF NOT EXISTS data (val TEXT)", []).unwrap();
    conn.execute("INSERT INTO data (val) VALUES (?1)", [payload]).unwrap();
    serde_json::json!({ "status": "saved" }).to_string()
}
```

## 5. Build and Run
Create `build.ps1`:
```powershell
$env:LIBSQLITE3_FLAGS = "-DSQLITE_THREADSAFE=0 -DSQLITE_OS_OTHER=1 -DSQLITE_OMIT_WAL=1"
wasm-pack build --target web --release
```
Then run:
```powershell
powershell -File .\build.ps1
npm run build
npx serve dist -l 3000
```
Check the browser console to see R1 loading your SQLite-enabled backend!
