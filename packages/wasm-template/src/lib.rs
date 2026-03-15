use wasm_bindgen::prelude::*;
use serde::{Deserialize, Serialize};

mod r1;

#[derive(Serialize, Deserialize)]
struct GreetArgs { 
    name: String 
}

#[derive(Serialize, Deserialize)]
struct GreetResult { 
    message: String, 
    length: usize 
}

/// The R1 Contract dictates all complex Rust web functions take a single string mapping `payload`
/// and return a serialized `{ "ok": ... }` or `{ "error": ... }` JSON structure natively.
#[wasm_bindgen]
pub fn greet(payload: &str) -> String {
    let args: GreetArgs = match serde_json::from_str(payload) {
        Ok(a) => a,
        Err(e) => return format!(r#"{{"error": "invalid payload: {}"}}"#, e),
    };

    let result = GreetResult {
        message: format!("Hello, {}!", args.name),
        length: args.name.len(),
    };
    
    match serde_json::to_string(&result) {
        Ok(json) => format!(r#"{{"ok": {}}}"#, json),
        Err(e) => format!(r#"{{"error": "serialization failed: {}"}}"#, e),
    }
}
