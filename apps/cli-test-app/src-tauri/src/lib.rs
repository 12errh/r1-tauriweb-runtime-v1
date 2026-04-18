use serde::{Serialize, Deserialize};
use wasm_bindgen::prelude::*;
// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[wasm_bindgen]
pub fn greet(payload: &str) -> String {
    #[derive(Deserialize)]
    struct Args {
        name: &str,
    }

    let args: Args = match serde_json::from_str(payload) {
        Ok(a) => a,
        Err(e) => return serde_json::json!({ "error": e.to_string() }).to_string(),
    };

    let name = args.name;


    format!("Hello, {}! You've been greeted from Rust!", name)
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
