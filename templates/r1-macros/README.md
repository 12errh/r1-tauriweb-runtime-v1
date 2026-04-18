# r1-macros

Procedural macros for R1 TauriWeb Runtime.

## Overview

This crate provides the `#[r1::command]` macro that transforms Tauri-style command functions into WASM-compatible functions with automatic JSON serialization/deserialization.

## Usage

```rust
use r1_macros::command;

#[command]
pub fn greet(name: String) -> String {
    format!("Hello, {}!", name)
}

#[command]
pub fn add(a: f64, b: f64) -> f64 {
    a + b
}

#[command]
pub fn get_status() -> bool {
    true
}
```

## What the Macro Does

The `#[command]` macro automatically:

1. **Wraps the function signature** to accept a JSON payload string
2. **Generates an Args struct** with proper Deserialize traits
3. **Deserializes the payload** into typed arguments
4. **Executes the function body** with the typed arguments
5. **Serializes the result** back to JSON
6. **Handles errors** gracefully with JSON error responses

## Example Expansion

```rust
// You write:
#[command]
pub fn greet(name: String) -> String {
    format!("Hello, {}!", name)
}

// Macro expands to:
#[wasm_bindgen]
pub fn greet(payload: &str) -> String {
    #[derive(serde::Deserialize)]
    struct __R1Args {
        name: String
    }
    
    let args: __R1Args = match serde_json::from_str(payload) {
        Ok(a) => a,
        Err(e) => return serde_json::json!({ "error": format!("Deserialization error: {}", e) }).to_string(),
    };
    
    let name = args.name;
    
    let __r1_result = (|| {
        format!("Hello, {}!", name)
    })();
    
    match serde_json::to_string(&__r1_result) {
        Ok(s) => s,
        Err(e) => serde_json::json!({ "error": format!("Serialization error: {}", e) }).to_string(),
    }
}
```

## Requirements

Your return type must implement `serde::Serialize`.
Your parameter types must implement `serde::Deserialize`.

## License

MIT
