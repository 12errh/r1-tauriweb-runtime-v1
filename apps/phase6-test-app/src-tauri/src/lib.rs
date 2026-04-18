use r1_macros::command;
use serde::{Deserialize, Serialize};
use chrono::Utc;

// ============================================================================
// Data Structures
// ============================================================================

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Task {
    pub id: Option<i64>,
    pub title: String,
    pub description: String,
    pub category: String,
    pub completed: bool,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Note {
    pub id: Option<i64>,
    pub title: String,
    pub content: String,
    pub task_id: Option<i64>,
    pub created_at: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct TaskStats {
    pub total: i64,
    pub completed: i64,
    pub pending: i64,
    pub by_category: Vec<CategoryCount>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CategoryCount {
    pub category: String,
    pub count: i64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SystemInfo {
    pub app_version: String,
    pub platform: String,
    pub arch: String,
}

// ============================================================================
// Simple Info Commands
// ============================================================================

#[command]
pub fn get_app_version() -> String {
    env!("CARGO_PKG_VERSION").to_string()
}

#[command]
pub fn get_app_name() -> String {
    "TaskFlow - R1 Test App".to_string()
}

#[command]
pub fn get_system_info() -> SystemInfo {
    SystemInfo {
        app_version: env!("CARGO_PKG_VERSION").to_string(),
        platform: std::env::consts::OS.to_string(),
        arch: std::env::consts::ARCH.to_string(),
    }
}

// ============================================================================
// Task Commands (will use SQLite via JS)
// ============================================================================

#[command]
pub fn create_task_data(title: String, description: String, category: String) -> Task {
    let now = Utc::now().to_rfc3339();
    Task {
        id: None,
        title,
        description,
        category,
        completed: false,
        created_at: now.clone(),
        updated_at: now,
    }
}

#[command]
pub fn validate_task(title: String, description: String) -> Result<bool, String> {
    if title.trim().is_empty() {
        return Err("Title cannot be empty".to_string());
    }
    if title.len() > 200 {
        return Err("Title too long (max 200 characters)".to_string());
    }
    if description.len() > 5000 {
        return Err("Description too long (max 5000 characters)".to_string());
    }
    Ok(true)
}

// ============================================================================
// Export/Import Commands
// ============================================================================

#[command]
pub fn tasks_to_json(tasks: Vec<Task>) -> Result<String, String> {
    serde_json::to_string_pretty(&tasks)
        .map_err(|e| format!("Failed to serialize tasks: {}", e))
}

#[command]
pub fn tasks_to_csv(tasks: Vec<Task>) -> Result<String, String> {
    let mut wtr = csv::Writer::from_writer(vec![]);
    
    // Write header
    wtr.write_record(&["ID", "Title", "Description", "Category", "Completed", "Created", "Updated"])
        .map_err(|e| format!("Failed to write CSV header: {}", e))?;
    
    // Write tasks
    for task in tasks {
        wtr.write_record(&[
            task.id.map(|i| i.to_string()).unwrap_or_default(),
            task.title,
            task.description,
            task.category,
            task.completed.to_string(),
            task.created_at,
            task.updated_at,
        ]).map_err(|e| format!("Failed to write task: {}", e))?;
    }
    
    let data = wtr.into_inner()
        .map_err(|e| format!("Failed to finalize CSV: {}", e))?;
    
    String::from_utf8(data)
        .map_err(|e| format!("Failed to convert CSV to string: {}", e))
}

#[command]
pub fn parse_json_tasks(json: String) -> Result<Vec<Task>, String> {
    serde_json::from_str::<Vec<Task>>(&json)
        .map_err(|e| format!("Failed to parse JSON: {}", e))
}

// ============================================================================
// Statistics Commands
// ============================================================================

#[command]
pub fn calculate_stats(tasks: Vec<Task>) -> TaskStats {
    let total = tasks.len() as i64;
    let completed = tasks.iter().filter(|t| t.completed).count() as i64;
    let pending = total - completed;
    
    // Count by category
    let mut category_map: std::collections::HashMap<String, i64> = std::collections::HashMap::new();
    for task in tasks {
        *category_map.entry(task.category).or_insert(0) += 1;
    }
    
    let by_category: Vec<CategoryCount> = category_map
        .into_iter()
        .map(|(category, count)| CategoryCount { category, count })
        .collect();
    
    TaskStats {
        total,
        completed,
        pending,
        by_category,
    }
}

// ============================================================================
// Utility Commands
// ============================================================================

#[command]
pub fn format_task_summary(task: Task) -> String {
    format!(
        "Task: {}\nCategory: {}\nStatus: {}\nCreated: {}",
        task.title,
        task.category,
        if task.completed { "✓ Completed" } else { "○ Pending" },
        task.created_at
    )
}

#[command]
pub fn search_tasks_by_keyword(tasks: Vec<Task>, keyword: String) -> Vec<Task> {
    let keyword_lower = keyword.to_lowercase();
    tasks.into_iter()
        .filter(|task| {
            task.title.to_lowercase().contains(&keyword_lower) ||
            task.description.to_lowercase().contains(&keyword_lower) ||
            task.category.to_lowercase().contains(&keyword_lower)
        })
        .collect::<Vec<Task>>()
}

#[command]
pub fn filter_tasks_by_category(tasks: Vec<Task>, category: String) -> Vec<Task> {
    tasks.into_iter()
        .filter(|task| task.category == category)
        .collect::<Vec<Task>>()
}

#[command]
pub fn filter_tasks_by_status(tasks: Vec<Task>, completed: bool) -> Vec<Task> {
    tasks.into_iter()
        .filter(|task| task.completed == completed)
        .collect::<Vec<Task>>()
}

// ============================================================================
// Main Entry Point
// ============================================================================

#[cfg(not(target_arch = "wasm32"))]
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_sql::Builder::default().build())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .invoke_handler(tauri::generate_handler![
            get_app_version,
            get_app_name,
            get_system_info,
            create_task_data,
            validate_task,
            tasks_to_json,
            tasks_to_csv,
            parse_json_tasks,
            calculate_stats,
            format_task_summary,
            search_tasks_by_keyword,
            filter_tasks_by_category,
            filter_tasks_by_status,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[cfg(target_arch = "wasm32")]
pub fn run() {
    // WASM build - functions are exported via #[r1::command] macro
    // No Tauri runtime needed
}
