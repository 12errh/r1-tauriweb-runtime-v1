import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import Database from '@tauri-apps/plugin-sql';
import { Save, RefreshCw, Trash2, Database as DbIcon, BrainCircuit } from 'lucide-react';

interface Note {
  id: number;
  content: string;
  created_at: string;
}

interface RustStats {
  length: number;
  word_count: number;
  timestamp: string;
}

export default function App() {
  const [db, setDb] = useState<Database | null>(null);
  const [content, setContent] = useState('');
  const [notes, setNotes] = useState<Note[]>([]);
  const [rustStats, setRustStats] = useState<RustStats | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // 1. Initialize DB and Load Notes
  useEffect(() => {
    async function init() {
      try {
        console.log('[E2E] Loading Database...');
        const dbInstance = await Database.load('sqlite:notes_v1.db');
        await dbInstance.execute(
          'CREATE TABLE IF NOT EXISTS notes (id INTEGER PRIMARY KEY AUTOINCREMENT, content TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)'
        );
        setDb(dbInstance);
        
        // Initial Fetch
        const rows = await dbInstance.select<Note[]>('SELECT * FROM notes ORDER BY id DESC');
        setNotes(rows);
        console.log('[E2E] DB Initialized and notes loaded.');
      } catch (err) {
        console.error('[E2E] DB Init Error:', err);
      }
    }
    init();
  }, []);

  // 2. Call Rust Backend when Content Changes
  useEffect(() => {
    if (!content.trim()) {
      setRustStats(null);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        console.log('[E2E] Invoking Rust backend...');
        const stats = await invoke<RustStats>('process_note_text', { text: content });
        setRustStats(stats);
      } catch (err) {
        console.error('[E2E] Rust Invoke Error:', err);
      }
    }, 300); // Debounce

    return () => clearTimeout(timer);
  }, [content]);

  // 3. Save to SQL
  const saveNote = async () => {
    if (!db || !content.trim()) return;
    setIsSaving(true);
    try {
      console.log('[E2E] Saving note to SQL...');
      await db.execute('INSERT INTO notes (content) VALUES (?)', [content]);
      
      // Refresh List
      const rows = await db.select<Note[]>('SELECT * FROM notes ORDER BY id DESC');
      setNotes(rows);
      setContent('');
      console.log('[E2E] Note saved and list refreshed.');
    } catch (err) {
      console.error('[E2E] Save Error:', err);
    } finally {
      setIsSaving(false);
    }
  };

  // 4. Delete Note
  const deleteNote = async (id: number) => {
    if (!db) return;
    try {
      await db.execute('DELETE FROM notes WHERE id = ?', [id]);
      setNotes(prev => prev.filter(n => n.id !== id));
    } catch (err) {
      console.error('[E2E] Delete Error:', err);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 p-8">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Header */}
        <header className="flex items-center justify-between border-b border-zinc-800 pb-6">
          <div>
            <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-blue-400 to-indigo-500 bg-clip-text text-transparent">
              R1 Notes E2E
            </h1>
            <p className="text-zinc-500 text-sm mt-1">Verifying Rust WASM + SQL Persistence</p>
          </div>
          <div className="flex gap-4">
            <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium ${db ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/10 text-amber-400'}`}>
              <DbIcon size={14} />
              {db ? 'SQLite: Ready (OPFS)' : 'SQLite: Initializing...'}
            </div>
          </div>
        </header>

        <main className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Editor Section */}
          <div className="space-y-4">
            <div className="relative group">
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Start writing your note..."
                className="w-full h-64 bg-zinc-900 border border-zinc-800 rounded-xl p-4 text-zinc-200 placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all resize-none"
              />
              <button
                onClick={saveNote}
                disabled={!db || !content.trim() || isSaving}
                className="absolute bottom-4 right-4 bg-blue-600 hover:bg-blue-500 disabled:bg-zinc-800 disabled:text-zinc-600 px-4 py-2 rounded-lg font-medium flex items-center gap-2 transition-colors"
              >
                {isSaving ? <RefreshCw className="animate-spin" size={18} /> : <Save size={18} />}
                Save to SQL
              </button>
            </div>

            {/* Rust Stats Card */}
            <div className="bg-indigo-500/5 border border-indigo-500/10 rounded-xl p-4 flex items-start gap-4">
              <div className="p-2 bg-indigo-500/10 rounded-lg text-indigo-400">
                <BrainCircuit size={20} />
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-semibold text-indigo-300">WASM Backend (Rust)</h3>
                <div className="mt-2 grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-[10px] text-zinc-500 uppercase tracking-wider">Word Count</p>
                    <p className="text-lg font-mono text-zinc-300">{rustStats?.word_count ?? 0}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-zinc-500 uppercase tracking-wider">Length</p>
                    <p className="text-lg font-mono text-zinc-300">{rustStats?.length ?? 0}</p>
                  </div>
                </div>
                {rustStats && (
                  <p className="mt-2 text-[10px] text-indigo-400 italic">
                    {rustStats.timestamp}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* List Section */}
          <div className="space-y-4">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <DbIcon size={18} className="text-zinc-500" />
              Saved Notes
            </h2>
            <div className="space-y-3 h-[420px] overflow-y-auto pr-2 custom-scrollbar">
              {notes.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-zinc-600 border-2 border-dashed border-zinc-900 rounded-xl">
                  <DbIcon size={32} className="mb-2 opacity-20" />
                  <p>No notes in database yet</p>
                </div>
              ) : (
                notes.map((note) => (
                  <div key={note.id} className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 hover:border-zinc-700 transition-colors group">
                    <div className="flex justify-between items-start">
                      <p className="text-sm text-zinc-300 whitespace-pre-wrap">{note.content}</p>
                      <button
                        onClick={() => deleteNote(note.id)}
                        className="text-zinc-600 hover:text-red-400 p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                    <p className="text-[10px] text-zinc-600 mt-2 font-mono">{note.created_at}</p>
                  </div>
                ))
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
