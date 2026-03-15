use wasm_bindgen::prelude::*;
use serde::Deserialize;

#[derive(Deserialize)]
struct GreetArgs {
    name: String,
}

#[wasm_bindgen]
pub fn greet(payload: &str) -> String {
    let args: GreetArgs = serde_json::from_str(payload).unwrap_or_else(|_| GreetArgs { name: "Guest".into() });
    let message = format!("Hello, {}! You've been greeted from Rust (via R1)!", args.name);
    serde_json::to_string(&message).unwrap_or_else(|_| "\"Error\"".into())
}

// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[cfg(not(target_arch = "wasm32"))]
#[tauri::command]
fn greet_native(name: &str) -> String {
    greet(&format!("{{\"name\": \"{}\"}}", name))
}

#[cfg(not(target_arch = "wasm32"))]
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![greet_native])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
