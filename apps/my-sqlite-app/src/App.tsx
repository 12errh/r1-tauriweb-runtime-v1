import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import reactLogo from "./assets/react.svg";
import "./App.css";

function App() {
  const [name, setName] = useState("");
  const [items, setItems] = useState<string[]>([]);
  const [status, setStatus] = useState("Initializing SQLite...");

  useEffect(() => {
    async function init() {
      // Wait for R1 to be ready (it might already be ready if we refreshed)
      if (!(window as any).r1?.isReady) {
          console.log("Waiting for R1 to be ready...");
          await new Promise(resolve => {
              window.addEventListener('r1-ready', resolve, { once: true });
              // Safety timeout
              setTimeout(resolve, 3000);
          });
      }

      try {
        console.log("Calling init_sync...");
        const result = await invoke<string>("init_sync", { payload: "" });
        const parsed = JSON.parse(result);
        if (parsed.error) {
          setStatus(`Init Error: ${parsed.error}`);
        } else {
          setStatus("SQLite Ready");
        }
      } catch (e) {
        console.error("Init failed:", e);
        setStatus("Waiting for WASM module...");
        // Re-try once after a delay if the module wasn't ready
        setTimeout(init, 2000);
      }
    }
    init();
  }, []);

  async function handleSave() {
    try {
      const result = await invoke<string>("save_data", { payload: name });
      const parsed = JSON.parse(result);
      if (parsed.status === "saved") {
        setItems(parsed.items);
        setStatus("Data saved to SQLite!");
      }
    } catch (e) {
      console.error(e);
      setStatus("Error saving data");
    }
  }

  return (
    <div className="container">
      <h1>R1 SQLite Guide Test</h1>

      <div className="row">
        <a href="https://vitejs.dev" target="_blank">
          <img src="/vite.svg" className="logo" alt="Vite logo" />
        </a>
        <a href="https://reactjs.org" target="_blank">
          <img src={reactLogo} className="logo react" alt="React logo" />
        </a>
      </div>

      <p>Enter a name to save into the WASM SQLite database (/app/data/my.db)</p>

      <form
        className="row"
        onSubmit={(e) => {
          e.preventDefault();
          handleSave();
        }}
      >
        <input
          id="name-input"
          onChange={(e) => setName(e.currentTarget.value)}
          placeholder="Enter a name..."
          value={name}
        />
        <button type="submit">Save to DB</button>
      </form>

      <p>{status}</p>

      {items.length > 0 && (
        <div style={{ marginTop: "20px", textAlign: "left" }}>
          <h3>Database Items:</h3>
          <ul>
            {items.map((item: string, i: number) => (
              <li key={i}>{item}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export default App;
