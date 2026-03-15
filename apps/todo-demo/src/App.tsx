import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/tauri';
import { readTextFile, writeTextFile, exists } from '@tauri-apps/api/fs';
import { ask, message } from '@tauri-apps/api/dialog';
import { Plus, Trash2, CheckCircle2, Circle, ListTodo, MoreVertical, Search, Zap } from 'lucide-react';

interface Todo {
  id: number;
  text: string;
  completed: boolean;
}

const STORAGE_PATH = '/todos.json';

const App: React.FC = () => {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [newTodo, setNewTodo] = useState('');
  const [loading, setLoading] = useState(true);
  const [backendStats, setBackendStats] = useState<any>(null);

  useEffect(() => {
    loadTodos();
  }, []);

  const loadTodos = async () => {
    try {
      const hasFile = await exists(STORAGE_PATH);
      if (hasFile) {
        const content = await readTextFile(STORAGE_PATH);
        setTodos(JSON.parse(content));
      }
    } catch (e) {
      console.error('Failed to load todos', e);
    } finally {
      setLoading(false);
    }
  };

  const saveTodos = async (newTodos: Todo[]) => {
    try {
      await writeTextFile(STORAGE_PATH, JSON.stringify(newTodos));
      
      // Call Rust backend to process stats
      const result = await invoke('process_todos', { todos: newTodos });
      setBackendStats(result);
    } catch (e) {
      console.error('Failed to save todos', e);
    }
  };

  const addTodo = () => {
    if (!newTodo.trim()) return;
    const updated = [...todos, { id: Date.now(), text: newTodo, completed: false }];
    setTodos(updated);
    setNewTodo('');
    saveTodos(updated);
  };

  const toggleTodo = (id: number) => {
    const updated = todos.map(t => t.id === id ? { ...t, completed: !t.completed } : t);
    setTodos(updated);
    saveTodos(updated);
  };

  const deleteTodo = async (id: number) => {
    const confirmed = await ask('Are you sure you want to delete this todo?', { title: 'Confirm Delete', type: 'warning' });
    if (confirmed) {
      const updated = todos.filter(t => t.id !== id);
      setTodos(updated);
      saveTodos(updated);
      await message('Todo deleted successfully!', 'Success');
    }
  };

  return (
    <div className="min-h-screen bg-slate-50/50 p-6 font-sans">
      <div className="max-w-2xl mx-auto">
        <header className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent font-outfit">
              R1 Todo Pro
            </h1>
            <p className="text-slate-500 text-sm mt-1">Experimental Runtime POC</p>
          </div>
          <div className="flex items-center gap-3">
             {backendStats && (
               <div className="bg-white/80 border border-slate-200 px-3 py-1.5 rounded-full flex items-center gap-2 text-xs font-medium text-slate-600 shadow-sm animate-in fade-in slide-in-from-right-4">
                  <Zap className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
                  <span>{backendStats.msg}</span>
               </div>
             )}
             <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-500 shadow-lg shadow-indigo-200 flex items-center justify-center text-white">
               <ListTodo className="w-5 h-5" />
             </div>
          </div>
        </header>

        <main className="space-y-6">
          {/* Stats Bar */}
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex flex-col gap-1">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Total Tasks</span>
              <span className="text-2xl font-bold text-slate-800">{todos.length}</span>
            </div>
            <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex flex-col gap-1">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Completed</span>
              <span className="text-2xl font-bold text-emerald-600">{todos.filter(t => t.completed).length}</span>
            </div>
            <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex flex-col gap-1">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Pending</span>
              <span className="text-2xl font-bold text-indigo-600">{todos.filter(t => !t.completed).length}</span>
            </div>
          </div>

          {/* Input Area */}
          <div className="relative group">
            <input
              type="text"
              value={newTodo}
              onChange={(e) => setNewTodo(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addTodo()}
              placeholder="What needs to be done?"
              className="w-full bg-white border border-slate-200 rounded-2xl py-4 pl-12 pr-16 shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all text-slate-700 placeholder:text-slate-400"
            />
            <Plus className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors w-5 h-5" />
            <button
              onClick={addTodo}
              disabled={!newTodo.trim()}
              className="absolute right-2 top-1/2 -translate-y-1/2 bg-indigo-600 text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md shadow-indigo-100"
            >
              Add
            </button>
          </div>

          {/* List Area */}
          <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
            {loading ? (
              <div className="p-12 text-center text-slate-400 flex flex-col items-center gap-3">
                 <div className="w-8 h-8 border-4 border-slate-200 border-t-indigo-500 rounded-full animate-spin"></div>
                 <span>Syncing with VFS...</span>
              </div>
            ) : todos.length === 0 ? (
              <div className="p-12 text-center">
                <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Search className="w-8 h-8 text-slate-300" />
                </div>
                <h3 className="text-slate-800 font-semibold mb-1">No tasks yet</h3>
                <p className="text-slate-400 text-sm">Add your first task above to get started.</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-50">
                {todos.map(todo => (
                  <div key={todo.id} className="group p-4 flex items-center gap-4 hover:bg-slate-50/50 transition-colors">
                    <button
                      onClick={() => toggleTodo(todo.id)}
                      className="transition-transform active:scale-90"
                    >
                      {todo.completed ? (
                        <CheckCircle2 className="w-6 h-6 text-emerald-500 fill-emerald-50" />
                      ) : (
                        <Circle className="w-6 h-6 text-slate-300 group-hover:text-slate-400" />
                      )}
                    </button>
                    <span className={`flex-1 text-slate-700 transition-all ${todo.completed ? 'line-through text-slate-400 scale-[0.98]' : 'font-medium'}`}>
                      {todo.text}
                    </span>
                    <button
                      onClick={() => deleteTodo(todo.id)}
                      className="opacity-0 group-hover:opacity-100 p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </main>

        <footer className="mt-8 text-center">
           <p className="text-slate-400 text-xs flex items-center justify-center gap-1.5 leading-relaxed">
             <span>Powered by R1 TauriWeb Runtime</span>
             <span className="w-1 h-1 bg-slate-200 rounded-full"></span>
             <span>WASM Backend Isolated</span>
             <span className="w-1 h-1 bg-slate-200 rounded-full"></span>
             <span>OPFS Persistent Storage</span>
           </p>
        </footer>
      </div>
    </div>
  );
};

export default App;
