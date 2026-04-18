use r1_macros::command;
use serde::{Serialize, Deserialize};

// Learn more about R1 commands at https://github.com/yourusername/r1tauriruntime

// Simple command with one parameter using the #[command] macro
#[command]
pub fn greet(name: String) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

// Example with multiple parameters
#[command]
pub fn add(a: f64, b: f64) -> f64 {
    a + b
}

// Example with custom struct return type
#[derive(Serialize, Deserialize)]
pub struct UserInfo {
    name: String,
    age: u32,
    greeting: String,
}

#[command]
pub fn get_user_info(name: String, age: u32) -> UserInfo {
    UserInfo {
        name: name.clone(),
        age,
        greeting: format!("Hello, {}! You are {} years old.", name, age),
    }
}

// Example with no parameters
#[command]
pub fn get_version() -> String {
    "0.1.0".to_string()
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
#[cfg(not(target_arch = "wasm32"))]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![greet])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
