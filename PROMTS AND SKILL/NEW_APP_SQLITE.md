# New R1 App with SQLite Support Guide (v0.3.0)

> Official guide for developers starting a new R1 project with persistent SQLite storage.

## 1. No C-Compilers Needed!
**DO NOT use LLVM or WASI SDK.** R1 leverages the official `@sqlite.org/sqlite-wasm` module over OPFS, entirely eliminating the need for `rusqlite` or C code compilation.

## 2. Project Initialization
```bash
npm create tauri-app@latest my-sqlite-app -- --template react-ts --yes
cd my-sqlite-app
npm install
```

## 3. Configure R1 + SQLite
1. **Link R1 Packages**: Add `@r1/core` and `@r1/apis` to dependencies, and `@r1/vite-plugin` to devDependencies.
2. **Install Tauri SQL Frontend**:
```bash
npm install @tauri-apps/plugin-sql
```
**(DO NOT add `rusqlite` or `tauri-plugin-sql` to your `Cargo.toml`. Native Rust DB plugins are mechanically restricted by the WASM sandbox).**

3. **Vite Config**: Add `r1Plugin()` to `vite.config.ts`.

## 4. Implement SQLite Queries
Do all SQLite operations directly in your Javascript/Typescript frontend:

In `src/App.tsx`:
```typescript
import Database from '@tauri-apps/plugin-sql';
import { useEffect, useState } from 'react';

export default function App() {
  const [db, setDb] = useState<Database | null>(null);

  useEffect(() => {
    async function init() {
      const dbInstance = await Database.load('sqlite:myapp.db');
      await dbInstance.execute('CREATE TABLE IF NOT EXISTS data (val TEXT)');
      setDb(dbInstance);
    }
    init();
  }, []);

  async function saveData() {
    if (!db) return;
    await db.execute('INSERT INTO data (val) VALUES (?)', ['hello from R1 OPFS!']);
  }

  return <button onClick={saveData}>Save SQLite Data</button>;
}
```

## 5. Build and Run
```bash
npm run build
npx serve dist -l 3000
```
Check the browser console to see `[R1 SQLite] Ready.` Everything persists on refresh magically via OPFS.
