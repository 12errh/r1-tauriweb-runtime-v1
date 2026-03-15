use wasm_bindgen::prelude::*;
use serde::{Deserialize, Serialize};

#[no_mangle]
pub fn add(a: i32, b: i32) -> i32 {
    a + b
}

#[no_mangle]
pub fn multiply(a: i32, b: i32) -> i32 {
    a * b
}

#[no_mangle]
pub fn force_panic() {
    panic!("Simulated Rust Panic");
}

/* --- PHASE 5: SERDE JSON BRIDGE --- */

#[derive(Serialize, Deserialize)]
struct EchoArgs {
    name: String,
    count: usize,
}

#[derive(Serialize, Deserialize)]
struct EchoResult {
    name: String,
    count: usize,
    doubled: usize,
}

#[wasm_bindgen]
pub fn echo_object(payload: &str) -> String {
    let args: EchoArgs = match serde_json::from_str(payload) {
        Ok(a) => a,
        Err(_) => return r#"{"error": "Missing required fields or malformed JSON"}"#.to_string(),
    };

    let result = EchoResult {
        name: args.name,
        count: args.count,
        doubled: args.count * 2,
    };

    match serde_json::to_string(&result) {
        Ok(json) => format!(r#"{{"ok": {}}}"#, json),
        Err(e) => format!(r#"{{"error": "serialization failed: {}"}}"#, e),
    }
}

/* --- PHASE 6: WASI FILE I/O --- */

#[derive(Serialize, Deserialize)]
struct WasiArgs {
    path: String,
    content: String,
}

#[wasm_bindgen]
pub fn write_and_read(payload: &str) -> String {
    let args: WasiArgs = match serde_json::from_str(payload) {
        Ok(a) => a,
        Err(_) => return r#"{"error": "invalid wasi payload"}"#.to_string(),
    };

    // USES STANDARD std::fs (this becomes WASI syscalls)
    if let Err(e) = std::fs::write(&args.path, &args.content) {
        return format!(r#"{{"error": "write failed: {}"}}"#, e);
    }

    match std::fs::read_to_string(&args.path) {
        Ok(content) => format!(r#"{{"ok": "{}"}}"#, content),
        Err(e) => format!(r#"{{"error": "read failed: {}"}}"#, e),
    }
}

#[no_mangle]
pub extern "C" fn test_wasi_write() -> i32 {
    let path = "/wasi-test.txt";
    let content = "WASI IS WORKING";
    match std::fs::write(path, content) {
        Ok(_) => 1,
        Err(_) => 0,
    }
}
