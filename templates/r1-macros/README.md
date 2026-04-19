# r1-macros

Procedural macros for R1 TauriWeb Runtime — simplifies Rust command definitions.

## Features

- **`#[r1::command]` macro**: Drop-in replacement for `#[tauri::command]`
- **Automatic JSON serialization**: Handles input/output conversion automatically
- **Type-safe**: Preserves Rust type checking
- **Zero boilerplate**: Write clean Rust code

## Installation

Add to your `Cargo.toml`:

```toml
[dependencies]
r1-macros = "0.3.0"
wasm-bindgen = "0.2"
serde = { version = "1", features = ["derive"] }
serde_json = "1"
```

## Usage

### Before (Manual Serialization)

```rust
use wasm_bindgen::prelude::*;

#[wasm_bindgen]
pub fn greet(payload: &str) -> String {
    #[derive(serde::Deserialize)]
    struct Args {
        name: String,
    }
    
    let args: Args = match serde_json::from_str(payload) {
        Ok(a) => a,
        Err(e) => return serde_json::json!({ "error": e.to_string() }).to_string(),
    };
    
    let result = format!("Hello, {}!", args.name);
    serde_json::to_string(&result).unwrap()
}
```

### After (With `#[r1::command]`)

```rust
use r1_macros::command;

#[command]
fn greet(name: String) -> String {
    format!("Hello, {}!", name)
}
```

The macro automatically:
1. Generates the `#[wasm_bindgen]` attribute
2. Creates the input struct from parameters
3. Handles JSON deserialization
4. Wraps the return value in JSON
5. Handles errors gracefully

## Examples

### Simple Command

```rust
use r1_macros::command;

#[command]
fn add(a: i32, b: i32) -> i32 {
    a + b
}
```

### With Struct Return

```rust
use r1_macros::command;
use serde::Serialize;

#[derive(Serialize)]
struct User {
    id: u32,
    name: String,
}

#[command]
fn get_user(id: u32) -> User {
    User {
        id,
        name: "Alice".to_string(),
    }
}
```

### With Result

```rust
use r1_macros::command;

#[command]
fn divide(a: f64, b: f64) -> Result<f64, String> {
    if b == 0.0 {
        Err("Division by zero".to_string())
    } else {
        Ok(a / b)
    }
}
```

### With Multiple Parameters

```rust
use r1_macros::command;

#[command]
fn create_user(name: String, email: String, age: u32) -> String {
    format!("Created user: {} ({}, {} years old)", name, email, age)
}
```

### With Vec and Option

```rust
use r1_macros::command;

#[command]
fn process_items(items: Vec<String>, filter: Option<String>) -> Vec<String> {
    match filter {
        Some(f) => items.into_iter().filter(|item| item.contains(&f)).collect(),
        None => items,
    }
}
```

## Generated Code

The `#[command]` macro expands to:

```rust
#[wasm_bindgen]
pub fn function_name(payload: &str) -> String {
    #[derive(serde::Deserialize)]
    struct Args {
        // ... parameters as struct fields
    }
    
    let args: Args = match serde_json::from_str(payload) {
        Ok(a) => a,
        Err(e) => return serde_json::json!({ "error": e.to_string() }).to_string(),
    };
    
    // Call your original function
    let result = original_function(args.param1, args.param2, ...);
    
    // Serialize result
    serde_json::to_string(&result).unwrap()
}
```

## Requirements

- Rust 1.70+
- `wasm-bindgen` 0.2+
- `serde` 1.0+ with `derive` feature
- `serde_json` 1.0+

## Compatibility

The `#[r1::command]` macro is designed to be a drop-in replacement for `#[tauri::command]` when migrating to R1. Most Tauri commands will work without modification.

## Limitations

- Function must have named parameters (no `self`)
- All parameters must implement `serde::Deserialize`
- Return type must implement `serde::Serialize`
- Async functions are not yet supported (coming in v0.4)

## License

MIT © 2026 R1 Runtime Team
