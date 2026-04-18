import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import * as db from "./db";
import "./App.css";

interface Task {
  id?: number;
  title: string;
  description: string;
  category: string;
  completed: boolean;
  created_at: string;
  updated_at: string;
}

interface TaskStats {
  total: number;
  completed: number;
  pending: number;
  by_category: { category: string; count: number }[];
}

interface SystemInfo {
  app_version: string;
  platform: string;
  arch: string;
}

function App() {
  const [allTasks, setAllTasks] = useState<Task[]>([]); // All tasks (persisted)
  const [displayTasks, setDisplayTasks] = useState<Task[]>([]); // Filtered/searched tasks
  const [systemInfo, setSystemInfo] = useState<SystemInfo | null>(null);
  const [stats, setStats] = useState<TaskStats | null>(null);
  const [searchKeyword, setSearchKeyword] = useState("");
  const [filterCategory, setFilterCategory] = useState("");
  const [filterStatus, setFilterStatus] = useState<"all" | "completed" | "pending">("all");
  
  // Form state
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskDescription, setNewTaskDescription] = useState("");
  const [newTaskCategory, setNewTaskCategory] = useState("Work");
  
  const [message, setMessage] = useState("");
  const [r1Ready, setR1Ready] = useState(false);
  const [dbReady, setDbReady] = useState(false);

  // Wait for R1 to be ready
  useEffect(() => {
    const handleR1Ready = async () => {
      console.log("[TaskFlow] R1 ready, initializing database...");
      setR1Ready(true);
      
      try {
        await db.initDatabase();
        setDbReady(true);
        console.log("[TaskFlow] Database ready, loading data...");
        loadSystemInfo();
        loadTasks();
      } catch (error) {
        console.error("[TaskFlow] Database initialization failed:", error);
        setMessage("❌ Database initialization failed. Using fallback mode.");
      }
    };

    if ((window as any).r1Ready) {
      handleR1Ready();
    } else {
      window.addEventListener("r1:ready", handleR1Ready);
    }

    return () => window.removeEventListener("r1:ready", handleR1Ready);
  }, []);

  // Remove localStorage persistence - using SQLite now
  // useEffect(() => {
  //   if (allTasks.length >= 0) {
  //     localStorage.setItem("taskflow_tasks", JSON.stringify(allTasks));
  //   }
  // }, [allTasks]);

  // Calculate stats whenever allTasks changes
  useEffect(() => {
    if (allTasks.length > 0 && r1Ready && dbReady) {
      calculateStatsFromDB();
    }
  }, [allTasks, r1Ready, dbReady]);

  async function loadSystemInfo() {
    try {
      const info = await invoke<SystemInfo>("get_system_info");
      setSystemInfo(info);
      console.log("[TaskFlow] System info loaded:", info);
    } catch (error) {
      console.error("Failed to load system info:", error);
    }
  }

  async function loadTasks() {
    try {
      const tasks = await db.getAllTasks();
      setAllTasks(tasks);
      setDisplayTasks(tasks);
      console.log(`[TaskFlow] Loaded ${tasks.length} tasks from SQLite`);
    } catch (error) {
      console.error("Failed to load tasks:", error);
      setMessage("❌ Failed to load tasks from database");
    }
  }

  async function calculateStatsFromDB() {
    try {
      const stats = await db.getTaskStats();
      setStats(stats as any);
    } catch (error) {
      console.error("Failed to calculate stats:", error);
    }
  }

  async function addTask() {
    try {
      await invoke("validate_task", {
        title: newTaskTitle,
        description: newTaskDescription,
      });

      const taskData = await invoke<Task>("create_task_data", {
        title: newTaskTitle,
        description: newTaskDescription,
        category: newTaskCategory,
      });

      // Insert into SQLite
      const id = await db.insertTask(taskData);
      const newTask = { ...taskData, id };

      // Update UI
      const updated = [...allTasks, newTask];
      setAllTasks(updated);
      setDisplayTasks(updated);

      setNewTaskTitle("");
      setNewTaskDescription("");
      setMessage("✅ Task added successfully!");
      setTimeout(() => setMessage(""), 3000);
    } catch (error) {
      setMessage(`❌ Error: ${error}`);
      setTimeout(() => setMessage(""), 5000);
    }
  }

  async function toggleTask(task: Task) {
    try {
      const newCompleted = !task.completed;
      await db.updateTask(task.id!, { 
        completed: newCompleted,
        updated_at: new Date().toISOString()
      });

      const updated = allTasks.map((t) =>
        t.id === task.id ? { ...t, completed: newCompleted } : t
      );
      setAllTasks(updated);
      setDisplayTasks(updated);
      setMessage(newCompleted ? "✅ Task completed!" : "Task marked as pending");
      setTimeout(() => setMessage(""), 2000);
    } catch (error) {
      setMessage(`❌ Error: ${error}`);
    }
  }

  async function deleteTask(taskId: number) {
    try {
      await db.deleteTask(taskId);

      const updated = allTasks.filter((t) => t.id !== taskId);
      setAllTasks(updated);
      setDisplayTasks(updated);
      setMessage("🗑️ Task deleted!");
      setTimeout(() => setMessage(""), 2000);
    } catch (error) {
      setMessage(`❌ Error: ${error}`);
    }
  }

  async function exportToJSON() {
    try {
      const json = await invoke<string>("tasks_to_json", { tasks: allTasks });
      const blob = new Blob([json], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `tasks-${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setMessage("📥 Exported to JSON!");
      setTimeout(() => setMessage(""), 3000);
    } catch (error) {
      setMessage(`❌ Export failed: ${error}`);
    }
  }

  async function exportToCSV() {
    try {
      const csv = await invoke<string>("tasks_to_csv", { tasks: allTasks });
      const blob = new Blob([csv], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `tasks-${Date.now()}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      setMessage("📥 Exported to CSV!");
      setTimeout(() => setMessage(""), 3000);
    } catch (error) {
      setMessage(`❌ Export failed: ${error}`);
    }
  }

  async function searchTasks() {
    if (!searchKeyword.trim()) {
      setDisplayTasks(allTasks);
      setMessage("Showing all tasks");
      setTimeout(() => setMessage(""), 2000);
      return;
    }
    try {
      const results = await db.searchTasks(searchKeyword);
      setDisplayTasks(results);
      setMessage(`🔍 Found ${results.length} tasks`);
      setTimeout(() => setMessage(""), 3000);
    } catch (error) {
      setMessage(`❌ Search failed: ${error}`);
    }
  }

  async function applyFilters() {
    try {
      let filtered = [...allTasks];

      if (filterCategory && filterStatus !== "all") {
        // Both filters
        filtered = await db.filterTasksByCategory(filterCategory);
        filtered = filtered.filter(t => t.completed === (filterStatus === "completed"));
      } else if (filterCategory) {
        // Category only
        filtered = await db.filterTasksByCategory(filterCategory);
      } else if (filterStatus !== "all") {
        // Status only
        filtered = await db.filterTasksByStatus(filterStatus === "completed");
      }

      setDisplayTasks(filtered);
      setMessage(`🔍 Filtered: ${filtered.length} tasks`);
      setTimeout(() => setMessage(""), 3000);
    } catch (error) {
      setMessage(`❌ Filter failed: ${error}`);
    }
  }

  function clearFilters() {
    setSearchKeyword("");
    setFilterCategory("");
    setFilterStatus("all");
    setDisplayTasks(allTasks);
    setMessage("Filters cleared");
    setTimeout(() => setMessage(""), 2000);
  }

  const categories = ["Work", "Personal", "Shopping", "Health", "Other"];

  if (!r1Ready || !dbReady) {
    return (
      <div className="app">
        <div style={{ textAlign: "center", padding: "100px 20px" }}>
          <h1>⏳ {!r1Ready ? "Loading R1 Runtime..." : "Initializing Database..."}</h1>
          <p>{!r1Ready ? "Please wait while WASM modules are loading..." : "Setting up SQLite in OPFS..."}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="app">
      <header>
        <h1>📋 TaskFlow - R1 Test App</h1>
        {systemInfo && (
          <div className="system-info">
            <span>v{systemInfo.app_version}</span>
            <span>{systemInfo.platform}</span>
            <span>{systemInfo.arch}</span>
          </div>
        )}
      </header>

      {message && <div className="message">{message}</div>}

      {stats && (
        <div className="stats">
          <div className="stat-card">
            <h3>{stats.total}</h3>
            <p>Total Tasks</p>
          </div>
          <div className="stat-card">
            <h3>{stats.completed}</h3>
            <p>Completed</p>
          </div>
          <div className="stat-card">
            <h3>{stats.pending}</h3>
            <p>Pending</p>
          </div>
        </div>
      )}

      <div className="main-content">
        <div className="sidebar">
          <h2>Add New Task</h2>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              addTask();
            }}
          >
            <input
              type="text"
              placeholder="Task title"
              value={newTaskTitle}
              onChange={(e) => setNewTaskTitle(e.target.value)}
              required
            />
            <textarea
              placeholder="Description"
              value={newTaskDescription}
              onChange={(e) => setNewTaskDescription(e.target.value)}
              rows={4}
            />
            <select
              value={newTaskCategory}
              onChange={(e) => setNewTaskCategory(e.target.value)}
            >
              {categories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
            <button type="submit">Add Task</button>
          </form>

          <div className="actions">
            <h3>Actions</h3>
            <button onClick={exportToJSON}>📥 Export JSON</button>
            <button onClick={exportToCSV}>📥 Export CSV</button>
          </div>

          <div className="filters">
            <h3>Search & Filter</h3>
            <input
              type="text"
              placeholder="Search keywords..."
              value={searchKeyword}
              onChange={(e) => setSearchKeyword(e.target.value)}
              onKeyPress={(e) => e.key === "Enter" && searchTasks()}
            />
            <button onClick={searchTasks}>🔍 Search</button>

            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
            >
              <option value="">All Categories</option>
              {categories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>

            <select
              value={filterStatus}
              onChange={(e) =>
                setFilterStatus(e.target.value as "all" | "completed" | "pending")
              }
            >
              <option value="all">All Status</option>
              <option value="completed">Completed</option>
              <option value="pending">Pending</option>
            </select>

            <button onClick={applyFilters}>✓ Apply Filters</button>
            <button onClick={clearFilters}>✕ Clear Filters</button>
          </div>
        </div>

        <div className="task-list">
          <h2>
            Tasks ({displayTasks.length}
            {displayTasks.length !== allTasks.length && ` of ${allTasks.length}`})
          </h2>
          {displayTasks.length === 0 ? (
            <p className="empty-state">
              {allTasks.length === 0
                ? "No tasks yet. Add one to get started!"
                : "No tasks match your filters."}
            </p>
          ) : (
            <div className="tasks">
              {displayTasks.map((task) => (
                <div
                  key={task.id}
                  className={`task-card ${task.completed ? "completed" : ""}`}
                >
                  <div className="task-header">
                    <h3>{task.title}</h3>
                    <span className="category">{task.category}</span>
                  </div>
                  <p>{task.description}</p>
                  <div className="task-footer">
                    <small>Created: {new Date(task.created_at).toLocaleString()}</small>
                    <div className="task-actions">
                      <button onClick={() => toggleTask(task)}>
                        {task.completed ? "↩ Undo" : "✓ Complete"}
                      </button>
                      <button onClick={() => deleteTask(task.id!)}>🗑 Delete</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;
