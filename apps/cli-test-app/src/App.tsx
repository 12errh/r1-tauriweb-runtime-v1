import { useState } from "react";
import reactLogo from "./assets/react.svg";
import { invoke } from "@tauri-apps/api/core";
import "./App.css";

function App() {
  const [greetMsg, setGreetMsg] = useState("");
  const [name, setName] = useState("");
  const [addResult, setAddResult] = useState("");
  const [userInfo, setUserInfo] = useState("");
  const [version, setVersion] = useState("");

  async function greet() {
    setGreetMsg(await invoke("greet", { name }));
  }

  async function testAdd() {
    const result = await invoke("add", { a: 5.5, b: 3.2 });
    setAddResult(`5.5 + 3.2 = ${result}`);
  }

  async function testGetUserInfo() {
    const info = await invoke("get_user_info", { name: "Alice", age: 30 });
    setUserInfo(JSON.stringify(info, null, 2));
  }

  async function testGetVersion() {
    const ver = await invoke("get_version", {});
    setVersion(`Version: ${ver}`);
  }

  return (
    <main className="container">
      <h1>R1 Macro Test App</h1>

      <div className="row">
        <div>
          <input
            id="greet-input"
            onChange={(e) => setName(e.currentTarget.value)}
            placeholder="Enter a name..."
          />
          <button type="button" onClick={() => greet()}>
            Test greet()
          </button>
        </div>
        <p>{greetMsg}</p>
      </div>

      <div className="row">
        <button type="button" onClick={() => testAdd()}>
          Test add(5.5, 3.2)
        </button>
        <p>{addResult}</p>
      </div>

      <div className="row">
        <button type="button" onClick={() => testGetUserInfo()}>
          Test get_user_info("Alice", 30)
        </button>
        <pre>{userInfo}</pre>
      </div>

      <div className="row">
        <button type="button" onClick={() => testGetVersion()}>
          Test get_version()
        </button>
        <p>{version}</p>
      </div>

      <p className="read-the-docs">
        Testing #[r1::command] macro with 4 different command types
      </p>
    </main>
  );
}

export default App;
