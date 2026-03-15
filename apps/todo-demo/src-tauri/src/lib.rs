use wasm_bindgen::prelude::*;
use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Clone)]
pub struct Todo {
    id: u64,
    text: String,
    completed: bool,
}

#[derive(Serialize, Deserialize)]
pub struct TodoState {
    todos: Vec<Todo>,
}

#[wasm_bindgen]
pub fn process_todos(payload: &str) -> String {
    let state: TodoState = serde_json::from_str(payload).unwrap_or(TodoState { todos: vec![] });
    
    // Simulate some backend logic: count completed
    let completed_count = state.todos.iter().filter(|t| t.completed).count();
    
    let result = serde_json::json!({
        "total": state.todos.len(),
        "completed": completed_count,
        "msg": format!("Backend processed {} todos", state.todos.len())
    });

    result.to_string()
}
