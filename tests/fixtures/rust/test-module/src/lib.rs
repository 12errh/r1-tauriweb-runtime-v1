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
