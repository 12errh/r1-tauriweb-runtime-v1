use wasm_bindgen::prelude::*;
use serde::{Deserialize, Serialize};

#[derive(Deserialize)]
pub struct ProcessRequest {
    pub text: String,
}

#[derive(Serialize)]
pub struct ProcessResponse {
    pub length: usize,
    pub word_count: usize,
    pub timestamp: String,
}

#[wasm_bindgen]
pub fn process_note_text(payload: &str) -> String {
    let req: ProcessRequest = serde_json::from_str(payload).unwrap_or(ProcessRequest { text: "".into() });
    
    let length = req.text.len();
    let word_count = req.text.split_whitespace().count();
    
    // We can use standard rust but date/time in WASM/WASI requires special crates or JS interop.
    // For this minimal test, we'll just return counts to prove Rust execution.
    let res = ProcessResponse {
        length,
        word_count,
        timestamp: "2026-04-17 (Rust Processed)".into(),
    };
    
    serde_json::to_string(&res).unwrap()
}
