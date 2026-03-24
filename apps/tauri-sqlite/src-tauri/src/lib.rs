use wasm_bindgen::prelude::*;
use serde::{Serialize, Deserialize};

mod database;
mod state;

#[cfg(not(target_arch = "wasm32"))]
use state::{AppState, ServiceAccess};
#[cfg(not(target_arch = "wasm32"))]
use tauri::{State, Manager, AppHandle};

#[cfg(target_arch = "wasm32")]
use once_cell::sync::Lazy;
#[cfg(target_arch = "wasm32")]
use std::sync::Mutex;
#[cfg(target_arch = "wasm32")]
use rusqlite::Connection;

#[cfg(target_arch = "wasm32")]
static DB: Lazy<Mutex<Connection>> = Lazy::new(|| {
    let conn = database::initialize_database(None).expect("Failed to initialize database in WASM");
    Mutex::new(conn)
});

#[derive(Deserialize)]
struct GreetArgs {
    name: String,
}

#[wasm_bindgen]
pub fn greet(payload: &str) -> String {
    let args: GreetArgs = match serde_json::from_str(payload) {
        Ok(a) => a,
        Err(e) => return serde_json::json!({ "error": e.to_string() }).to_string(),
    };

    #[cfg(target_arch = "wasm32")]
    {
        let db = DB.lock().unwrap();
        database::add_item(&args.name, &db).unwrap();
        let items = database::get_all(&db).unwrap();
        let items_string = items.join(" | ");
        let result = format!("Your name log (WASM): {}", items_string);
        serde_json::to_string(&result).unwrap()
    }

    #[cfg(not(target_arch = "wasm32"))]
    {
        "This function is only for WASM".to_string()
    }
}

#[cfg(not(target_arch = "wasm32"))]
#[tauri::command]
fn native_greet(app_handle: AppHandle, name: &str) -> String {
    // Should handle errors instead of unwrapping here
    app_handle.db(|db| database::add_item(name, db)).unwrap();

    let items = app_handle.db(|db| database::get_all(db)).unwrap();

    let items_string = items.join(" | ");

    format!("Your name log: {}", items_string)
}

#[cfg(not(target_arch = "wasm32"))]
pub fn run() {
    tauri::Builder::default()
        .manage(AppState { db: Default::default() })
        .invoke_handler(tauri::generate_handler![native_greet])
        .setup(|app| {
            let handle = app.handle();

            let app_state: State<AppState> = handle.state();
            let db = database::initialize_database(Some(&handle)).expect("Database initialize should succeed");
            *app_state.db.lock().unwrap() = Some(db);

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
