import React, { useEffect, useState, useRef } from 'react';
import { R1Runtime } from '@r1/core';
import './index.css';
import workerUrl from './sw?worker&url';

const PHASES = [
  { id: 'foundation', icon: '⚡', label: 'Foundation (P1-P2)', title: 'Kernel & IPC Protocol' },
  { id: 'vfs', icon: '📂', label: 'Filesystem (P3)', title: 'Virtual File System (OPFS)' },
  { id: 'wasm', icon: '🦀', label: 'WASM & WASI (P4-P7)', title: 'Rust Orchestration' },
  { id: 'apis', icon: '🛠️', label: 'Tauri APIs (P8)', title: 'Tauri Compatibility Layer' },
  { id: 'window', icon: '🪟', label: 'Windowing (P9)', title: 'Virtual Desktop & Themes' },
];

export default function App() {
  const [activePhase, setActivePhase] = useState('foundation');
  const [isBooted, setIsBooted] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [vfsFiles, setVfsFiles] = useState<string[]>([]);
  const [osInfo, setOsInfo] = useState<any>(null);
  const r1 = useRef<R1Runtime | null>(null);

  const addLog = (msg: any) => {
      const text = typeof msg === 'string' ? msg : JSON.stringify(msg);
      setLogs(p => [text, ...p].slice(0, 50));
  };

  useEffect(() => {
    const bootR1 = async () => {
      try {
        addLog('Booting R1 Runtime...');
        r1.current = new R1Runtime();
        await r1.current.boot(workerUrl);
        setIsBooted(true);
        addLog('R1 Kernel connected and active.');
      } catch (e) {
        addLog(`Boot failed: ${e}`);
      }
    };
    bootR1();
  }, []);

  const handlePing = async () => {
    if (!r1.current) return;
    addLog('Sending PING...');
    const res = await r1.current.invoke('PING', {});
    addLog(`Received PONG: ${JSON.stringify(res)}`);
  };

  const refreshFiles = async () => {
    if (!r1.current) return;
    const res = await r1.current.invoke('VFS_LIST', { dir: '/' });
    setVfsFiles(res.paths);
    addLog(`VFS Listed: ${res.paths.length} items`);
  };

  const createTestFile = async () => {
    if (!r1.current) return;
    addLog('Writing /hello.txt...');
    await r1.current.invoke('VFS_WRITE', { path: '/hello.txt', data: Array.from(new TextEncoder().encode('Hello from Showcase!')) });
    addLog('File written successfully.');
    refreshFiles();
  };

  const getOsInfo = async () => {
    if (!r1.current) return;
    const res = await r1.current.invoke('os:platform', {});
    const arch = await r1.current.invoke('os:arch', {});
    setOsInfo({ platform: res, arch });
    addLog(`OS Info: ${res} ${arch}`);
  };

  const spawnWindow = async () => {
    if (!r1.current) return;
    addLog('Spawning new Virtual Window...');
    // We can reach out to the main thread Window Manager via invoke if registered, 
    // or just use the bridge logic. In Phase 9 we added it to KernelProxy.
    // The bridge command is 'window:open' or similar if we exposed it. 
    // Actually the proxy handles it.
    (window as any).__R1_WM__?.open({
        id: 'child-' + Math.random().toString(36).slice(2, 5),
        title: 'Dynamic Guest',
        url: 'https://vite.dev',
        x: Math.random() * 500,
        y: Math.random() * 300
    });
  };

  return (
    <>
      <div className="sidebar">
        <div className="brand">
          <span>R1</span> Runtime
        </div>
        <nav className="nav-list">
          {PHASES.map(p => (
            <div 
              key={p.id} 
              className={`nav-item ${activePhase === p.id ? 'active' : ''}`}
              onClick={() => setActivePhase(p.id)}
            >
              <span>{p.icon}</span> {p.label}
            </div>
          ))}
        </nav>
        <div style={{ marginTop: 'auto' }}>
          <div className={`status-badge ${isBooted ? 'status-online' : 'status-offline'}`}>
            {isBooted ? 'Kernel Online' : 'Booting...'}
          </div>
        </div>
      </div>

      <main className="main-content">
        <header className="header">
          <h1>{PHASES.find(p => p.id === activePhase)?.title}</h1>
          <p>Verifying implementation integrity for all building blocks.</p>
        </header>

        <div className="grid">
          {activePhase === 'foundation' && (
            <>
              <div className="panel">
                <div className="panel-header">Protocol Health</div>
                <p>Verify full-duplex communication between Main Thread and Kernel Worker.</p>
                <button className="btn" onClick={handlePing}>Send PING Request</button>
              </div>
              <div className="panel">
                <div className="panel-header">IPC Logs</div>
                <div className="log-area">
                  {logs.map((l, i) => <div key={i} className="log-entry">{'> '}{l}</div>)}
                </div>
              </div>
            </>
          )}

          {activePhase === 'vfs' && (
            <>
              <div className="panel">
                <div className="panel-header">File Operations</div>
                <div style={{ display: 'flex', gap: '10px' }}>
                    <button className="btn" onClick={createTestFile}>Write Test File</button>
                    <button className="btn btn-secondary" onClick={refreshFiles}>Refresh List</button>
                </div>
                <div className="file-list">
                  {vfsFiles.map(f => (
                    <div key={f} className="file-item">
                      <span>📄 {f}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="panel">
                <div className="panel-header">Persistence Store</div>
                <p>Data written here survives browser refreshes via OPFS.</p>
                <div className="log-area">
                  VFS Root is mounted at browser origin storage.
                </div>
              </div>
            </>
          )}

          {activePhase === 'apis' && (
            <>
              <div className="panel">
                <div className="panel-header">OS Plugin</div>
                <button className="btn" onClick={getOsInfo}>Query OS Info</button>
                {osInfo && (
                  <div style={{ marginTop: '10px' }}>
                    <strong>Platform:</strong> {osInfo.platform}<br/>
                    <strong>Arch:</strong> {osInfo.arch}
                  </div>
                )}
              </div>
              <div className="panel">
                <div className="panel-header">Main Thread Bridge</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                    <button className="btn" onClick={async () => {
                        await r1.current?.invoke('clipboard:write_text', { text: 'Hello from R1!' });
                        addLog('Clipboard updated via main-thread bridge.');
                    }}>Copy "Hello from R1!"</button>
                    <button className="btn btn-secondary" onClick={async () => {
                        const res = await r1.current?.invoke('dialog:ask', { message: 'Do you like the new R1 UI?', title: 'User Survey' });
                        addLog(`User said: ${res ? 'YES' : 'NO'}`);
                    }}>Ask for opinion</button>
                </div>
              </div>
              <div className="panel">
                <div className="panel-header">Persistent settings</div>
                <p>Using the hierarchical <code>store:set</code> plugin.</p>
                <button className="btn" onClick={async () => {
                    await r1.current?.invoke('store:set', { name: 'demo', key: 'ver', value: '1.0' });
                    addLog('Settings persisted to VFS.');
                }}>Save Version to Store</button>
              </div>
            </>
          )}

          {activePhase === 'window' && (
            <>
              <div className="panel">
                <div className="panel-header">Virtual Windows</div>
                <p>Spawn sandboxed iframes as native-looking windows.</p>
                <button className="btn" onClick={spawnWindow}>Open New Window</button>
              </div>
              <div className="panel">
                <div className="panel-header">Theme Controls</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                    <button className="btn btn-secondary" onClick={() => (window as any).__R1_WM__?.setTheme('macos')}>macOS</button>
                    <button className="btn btn-secondary" onClick={() => (window as any).__R1_WM__?.setTheme('windows')}>Windows 11</button>
                    <button className="btn btn-secondary" onClick={() => (window as any).__R1_WM__?.setTheme('linux')}>GNOME</button>
                </div>
              </div>
            </>
          )}
          {activePhase === 'wasm' && (
            <>
              <div className="panel">
                <div className="panel-header">WASM Lab</div>
                <button className="btn" onClick={async () => {
                    addLog('Loading my-wasm module...');
                    await r1.current?.invoke('WASM_LOAD', { name: 'my-wasm', url: '/test-module.wasm' });
                    addLog('Module loaded & commands registered.');
                }}>Load Rust Module</button>
                <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
                    <button className="btn btn-secondary" onClick={async () => {
                        const res = await r1.current?.invoke('my-wasm:add', [10, 20]);
                        addLog(`Rust result (10+20): ${res}`);
                    }}>Call my-wasm:add</button>
                </div>
              </div>
              <div className="panel">
                <div className="panel-header">WASI & Events</div>
                <p>Verify that Rust can talk back to JS and the VFS.</p>
                <div className="log-area">
                  Listen for 'js-event' in the Protocol tab after calling Rust.
                </div>
              </div>
            </>
          )}
        </div>
      </main>
    </>
  );
}
