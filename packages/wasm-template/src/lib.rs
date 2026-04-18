use r1_macros::command;
use serde::{Deserialize, Serialize};

mod r1;

/// Example command using the #[command] macro
/// This is the new recommended way to write R1 commands
#[command]
pub fn greet(name: String) -> String {
    format!("Hello, {}!", name)
}

/// Example with multiple parameters
#[command]
pub fn add(a: f64, b: f64) -> f64 {
    a + b
}

/// Example with custom struct return type
#[derive(Serialize, Deserialize)]
pub struct GreetResult {
    message: String,
    length: usize,
}

#[command]
pub fn greet_detailed(name: String) -> GreetResult {
    GreetResult {
        message: format!("Hello, {}!", name),
        length: name.len(),
    }
}

/// Example with no parameters
#[command]
pub fn get_version() -> String {
    "0.3.0".to_string()
}

// Legacy manual JSON contract example (still supported but not recommended)
// use wasm_bindgen::prelude::*;
// 
// #[wasm_bindgen]
// pub fn legacy_greet(payload: &str) -> String {
//     #[derive(Deserialize)]
//     struct Args { name: String }
//     let args: Args = match serde_json::from_str(payload) {
//         Ok(a) => a,
//         Err(e) => return format!(r#"{{"error": "{}"}}"#, e),
//     };
//     serde_json::to_string(&format!("Hello, {}!", args.name)).unwrap()
// }
