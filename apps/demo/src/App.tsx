import React, { useEffect, useState, useRef } from 'react';
import { R1Runtime } from '@r1/core';
import './index.css';

const PHASES = [
  { id: 'foundation', icon: '⚡', label: 'Foundation', title: 'Kernel & IPC Protocol' },
  { id: 'vfs', icon: '📂', label: 'Filesystem', title: 'Virtual File System (OPFS)' },
  { id: 'wasm', icon: '🦀', label: 'WASM & WASI', title: 'Rust Orchestration' },
  { id: 'apis', icon: '🛠️', label: 'Tauri APIs', title: 'Tauri Compatibility Layer' },
  { id: 'window', icon: '🪟', label: 'Windowing', title: 'Virtual Desktop & Themes' },
  { id: 'assets', icon: '🖼️', label: 'Assets', title: 'Service Worker Protocol' },
  { id: 'diag', icon: '🩺', label: 'Diagnostics', title: 'Kernel Health & Metrics' },
];

export default function App() {
  const [activePhase, setActivePhase] = useState('foundation');
  const [bootStatus, setBootStatus] = useState<'idle' | 'booting' | 'ready' | 'error'>((window as any).__R1_BOOT_STATUS__ || 'idle');
  const [bootError, setBootError] = useState<string>((window as any).__R1_BOOT_ERROR__ || '');
  const [logs, setLogs] = useState<string[]>([]);
  const [vfsFiles, setVfsFiles] = useState<string[]>([]);
  const [osInfo, setOsInfo] = useState<any>(null);
  const [metrics, setMetrics] = useState({ latency: '0ms', memory: '0MB', messages: 0 });
  const r1 = useRef<R1Runtime | null>(null);

  const addLog = (msg: any) => {
      const text = typeof msg === 'string' ? msg : JSON.stringify(msg);
      setLogs(p => [text, ...p].slice(0, 50));
  };

  useEffect(() => {
    const handleReady = () => {
        setBootStatus('ready');
        addLog('R1 Runtime signaled ready via event.');
        r1.current = new R1Runtime(); 
    };

    const handleError = (e: any) => {
        setBootStatus('error');
        setBootError(e.detail || 'Unknown boot error');
        addLog(`R1 Runtime signaled error: ${e.detail}`);
    };

    window.addEventListener('r1:ready', handleReady);
    window.addEventListener('r1:error', handleError as any);
    
    // Check current status immediately
    const status = (window as any).__R1_BOOT_STATUS__;
    if (status === 'ready' && !r1.current) {
        setBootStatus('ready');
        r1.current = new R1Runtime();
        addLog('R1 Runtime connected (already ready).');
    } else if (status === 'booting') {
        setBootStatus('booting');
        addLog('Kernel is booting, waiting for ready event...');
    } else if (status === 'error') {
        setBootStatus('error');
        setBootError((window as any).__R1_BOOT_ERROR__);
    }

    return () => {
        window.removeEventListener('r1:ready', handleReady);
        window.removeEventListener('r1:error', handleError as any);
    };
  }, []);

  const handlePing = async () => {
    if (!r1.current) return;
    const start = performance.now();
    addLog('Sending PING...');
    const res = await r1.current.invoke('PING', {});
    const end = performance.now();
    const lat = (end - start).toFixed(2) + 'ms';
    setMetrics(m => ({ ...m, latency: lat, messages: m.messages + 1 }));
    addLog(`Received PONG: ${JSON.stringify(res)} (${lat})`);
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
    await r1.current.invoke('VFS_WRITE', { path: '/hello.txt', data: Array.from(new TextEncoder().encode('Hello from R1 Glass UI!')) });
    addLog('File written successfully.');
    refreshFiles();
  };

  const spawnWindow = async () => {
    if (!(window as any).__R1_WM__) return;
    addLog('Spawning new Virtual Window...');
    (window as any).__R1_WM__.open({
        id: 'child-' + Math.random().toString(36).slice(2, 5),
        title: 'Dynamic Guest',
        url: 'https://vite.dev',
        x: 100 + Math.random() * 200,
        y: 100 + Math.random() * 200
    });
  };

  return (
    <>
      <div className="sidebar">
        <div className="brand">
          <span>R1</span> TauriWeb
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
          <div className={`status-badge ${bootStatus === 'ready' ? 'status-online' : 'status-offline'}`}>
            {bootStatus === 'ready' ? 'Kernel Online' : (bootStatus === 'error' ? 'System Error' : 'Connecting...')}
          </div>
        </div>
      </div>

      <main className="main-content">
        <header className="header">
          <h1>{PHASES.find(p => p.id === activePhase)?.title}</h1>
          <p>The mission-critical runtime for web-based desktop experiences.</p>
        </header>

        <div className="grid">
          {activePhase === 'foundation' && (
            <>
              <div className="panel">
                <div className="panel-header">⚡ Protocol Health</div>
                <p>Verify ultra-low latency IPC between Main Thread and the isolated Kernel Worker.</p>
                <button className="btn" onClick={handlePing}>Send PING Request</button>
              </div>
              <div className="panel">
                <div className="panel-header">📜 Real-time Bridge Logs</div>
                <div className="log-area">
                  {logs.map((l, i) => <div key={i} className="log-entry">{'> '}{l}</div>)}
                </div>
              </div>
            </>
          )}

          {activePhase === 'vfs' && (
            <>
              <div className="panel">
                <div className="panel-header">📂 Virtual Disk (OPFS)</div>
                <div style={{ display: 'flex', gap: '10px' }}>
                    <button className="btn" onClick={createTestFile}>Write hello.txt</button>
                    <button className="btn btn-secondary" onClick={refreshFiles}>Scan VFS</button>
                </div>
                <div className="file-list">
                  {vfsFiles.map(f => (
                    <div key={f} className="file-item">
                      <span>📄</span> {f}
                    </div>
                  ))}
                </div>
              </div>
              <div className="panel">
                <div className="panel-header">🛡️ Persistence Guarantee</div>
                <p>Data is stored in the browser's Origin Private File System, remaining persistent across sessions and isolated from regular web storage limits.</p>
              </div>
            </>
          )}

          {activePhase === 'apis' && (
            <>
              <div className="panel">
                <div className="panel-header">🛠️ Native Bridge (OS)</div>
                <div style={{ display: 'flex', gap: '8px' }}>
                    <button className="btn" onClick={async () => {
                        const res = await r1.current?.invoke('os:platform', {});
                        addLog(`OS Platform: ${res}`);
                    }}>Query Platform</button>
                </div>
              </div>
              <div className="panel">
                <div className="panel-header">📋 System Capabilities</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                    <button className="btn" onClick={async () => {
                        await r1.current?.invoke('clipboard:write_text', { text: 'Hello from R1!' });
                        addLog('Clipboard updated.');
                    }}>Copy Text</button>
                    <button className="btn btn-secondary" onClick={async () => {
                        const res = await r1.current?.invoke('dialog:ask', { message: 'Confirm R1 experience?', title: 'System' });
                        addLog(`Response: ${res}`);
                    }}>Show Modal</button>
                </div>
              </div>
            </>
          )}

          {activePhase === 'assets' && (
            <>
              <div className="panel">
                <div className="panel-header">🖼️ Custom Asset Protocol</div>
                <p>Serve local files from VFS as standard web resources using <code>r1-asset://</code></p>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button className="btn" onClick={async () => {
                    const content = `<html><body style="background: #0f172a; color: #38bdf8; font-family: sans-serif; padding: 20px;"><h1>VFS Page</h1><p>Rendered via Service Worker interception.</p></body></html>`;
                    await r1.current?.invoke('fs:write_text_file', { path: '/demo.html', contents: content });
                    addLog('Generated /demo.html');
                  }}>1. Generate HTML</button>
                  
                  <button className="btn btn-secondary" onClick={() => {
                    const frame = document.getElementById('asset-preview') as HTMLIFrameElement;
                    if (frame) frame.src = '/r1-asset/demo.html?t=' + Date.now();
                  }}>2. Mount in Frame</button>
                </div>
                <div style={{ marginTop: '16px', height: '180px', background: '#000', borderRadius: '12px', overflow: 'hidden' }}>
                    <iframe id="asset-preview" style={{ width: '100%', height: '100%', border: 'none' }}></iframe>
                </div>
              </div>
            </>
          )}

          {activePhase === 'window' && (
              <div className="panel">
                <div className="panel-header">🪟 Virtual Window Manager</div>
                <p>Full-featured windowing system inside the browser. Themes, dragging, and stacking included.</p>
                <button className="btn" onClick={spawnWindow}>New Window</button>
              </div>
          )}

          {activePhase === 'wasm' && (
            <>
              <div className="panel">
                <div className="panel-header">🦀 Rust/WASM Isolation</div>
                <button className="btn" onClick={async () => {
                    addLog('Loading Rust module...');
                    await r1.current?.invoke('WASM_LOAD', { name: 'my-wasm', url: '/wasm/test_module.js' });
                    addLog('Module initialized.');
                }}>Initialize WASM</button>
                <button className="btn btn-secondary" style={{ marginTop: '8px' }} onClick={async () => {
                    const res = await r1.current?.invoke('my-wasm:echo_object', { name: 'R1 User', count: 42 });
                    addLog(`Rust JSON Result: ${JSON.stringify(res)}`);
                }}>Call complex echo</button>
              </div>
            </>
          )}

          {activePhase === 'diag' && (
            <>
              <div className="panel">
                <div className="panel-header">🩺 Kernel Metrics</div>
                {/* Status Overlay */}
      {bootStatus !== 'ready' && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 1000,
          background: 'rgba(15, 23, 42, 0.9)',
          backdropFilter: 'blur(20px)',
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          gap: '2rem', padding: '2rem', textAlign: 'center'
        }}>
          <div className="logo-container" style={{ position: 'relative' }}>
             <div className="logo-glow" />
             <h1 style={{ fontSize: '4rem', margin: 0 }}>R1</h1>
          </div>
          
          <div style={{ maxWidth: '400px' }}>
            {bootStatus === 'booting' && (
              <>
                <h2 style={{ color: 'var(--cyan)' }}>Connecting to Kernel...</h2>
                <div className="loading-bar">
                  <div className="loading-progress" />
                </div>
                <p style={{ opacity: 0.6 }}>Initializing WASM runtime and IPC bridge</p>
              </>
            )}
            {bootStatus === 'error' && (
              <>
                <h2 style={{ color: 'var(--danger)' }}>System Malfunction</h2>
                <div style={{ 
                  background: 'rgba(239, 68, 68, 0.1)', border: '1px solid var(--danger)',
                  padding: '1rem', borderRadius: '12px', marginBottom: '1.5rem',
                  fontSize: '0.9rem', color: 'var(--danger-text)'
                }}>
                  {bootError || 'Unknown R1 Runtime error'}
                </div>
                <button onClick={() => window.location.reload()} className="btn btn-primary" style={{ width: '100%' }}>
                  Emergency Restart
                </button>
              </>
            )}
            {bootStatus === 'idle' && (
              <>
                <h2 style={{ color: 'var(--indigo)' }}>System Ready</h2>
                <button 
                  onClick={() => {
                    const r1Instance = new R1Runtime();
                    r1Instance.boot({ wasmPath: '/wasm/test_module.js' }).catch(e => {
                      setBootStatus('error');
                      setBootError(e.message);
                    });
                  }} 
                  className="btn btn-primary" 
                  style={{ width: '100%' }}
                >
                  Initiate Boot Sequence
                </button>
              </>
            )}
          </div>
        </div>
      )}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                    <div className="file-item" style={{ flexDirection: 'column', alignItems: 'flex-start' }}>
                        <small style={{ color: 'var(--text-secondary)' }}>IPC Latency</small>
                        <span style={{ fontSize: '1.2rem', fontWeight: 600 }}>{metrics.latency}</span>
                    </div>
                    <div className="file-item" style={{ flexDirection: 'column', alignItems: 'flex-start' }}>
                        <small style={{ color: 'var(--text-secondary)' }}>Total Messages</small>
                        <span style={{ fontSize: '1.2rem', fontWeight: 600 }}>{metrics.messages}</span>
                    </div>
                </div>
                <button className="btn" style={{ marginTop: '16px' }} onClick={handlePing}>Run Latency Test</button>
              </div>
              <div className="panel">
                <div className="panel-header">🔍 Thread Isolation</div>
                <p>The Kernel is currently running in an independent Worker thread with full access to WASM and VFS.</p>
                <div className={`status-badge ${bootStatus === 'ready' ? 'status-online' : 'status-offline'}`}>
                    {bootStatus === 'ready' ? 'Thread Verified' : 'Thread Offline'}
                </div>
              </div>
            </>
          )}
        </div>
      </main>
    </>
  );
}
