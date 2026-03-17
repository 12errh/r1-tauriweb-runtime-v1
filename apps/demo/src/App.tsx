import React, { useEffect, useState, useRef } from 'react';
import { R1Runtime } from '@r1/core';
import { 
  Zap, FolderArchive, Binary, Settings, AppWindow, FileCode2, Activity,
  CheckCircle2, XCircle, Info, ClipboardCopy, Play, Save, MonitorDot, X, Maximize2, Minus, Sun, Moon
} from 'lucide-react';
import './index.css';

const PHASES = [
  { id: 'foundation', icon: Zap, label: 'Foundation', title: 'Kernel Protocol' },
  { id: 'vfs', icon: FolderArchive, label: 'Filesystem', title: 'Virtual Filesystem' },
  { id: 'wasm', icon: Binary, label: 'WebAssembly', title: 'Rust Orchestrator' },
  { id: 'apis', icon: Settings, label: 'Bridged APIs', title: 'OS Integration' },
  { id: 'window', icon: AppWindow, label: 'Windowing', title: 'Virtual Displays' },
  { id: 'assets', icon: FileCode2, label: 'Assets', title: 'Service Worker Proxy' },
  { id: 'diag', icon: Activity, label: 'Diagnostics', title: 'Thread Health' },
];

export default function App() {
  const [activePhase, setActivePhase] = useState('foundation');
  const [bootStatus, setBootStatus] = useState<'idle' | 'booting' | 'ready' | 'error'>((window as any).__R1_BOOT_STATUS__ || 'idle');
  const [bootError, setBootError] = useState<string>((window as any).__R1_BOOT_ERROR__ || '');
  
  // Data States
  const [logs, setLogs] = useState<string[]>([]);
  const [toasts, setToasts] = useState<{id: number, msg: string, type: 'info' | 'success' | 'error'}[]>([]);
  const [metrics, setMetrics] = useState({ latency: '0ms', messages: 0 });
  const [vfsFiles, setVfsFiles] = useState<string[]>([]);
  const [wasmResult, setWasmResult] = useState<string>('Ready.');
  const [apiResult, setApiResult] = useState<string>('Query system APIs below.');
  const [windows, setWindows] = useState<{id: string, title: string, x: number, y: number}[]>([]);
  
  // Custom OS-like Modal State
  const [modalConfig, setModalConfig] = useState<{title: string, message: string, resolve: (b: boolean) => void} | null>(null);

  // Theme State
  const [theme, setTheme] = useState<'light' | 'dark'>('dark');

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  const r1 = useRef<R1Runtime | null>(null);
  let toastCounter = useRef(0);

  const addToast = (msg: string, type: 'info' | 'success' | 'error' = 'info') => {
    const id = toastCounter.current++;
    setToasts(p => [...p, { id, msg, type }]);
    setTimeout(() => {
      setToasts(p => p.filter(t => t.id !== id));
    }, 4000);
  };

  const addLog = (msg: any) => {
    const text = typeof msg === 'string' ? msg : JSON.stringify(msg);
    setLogs(p => [text, ...p].slice(0, 50));
  };

  useEffect(() => {
    const handleReady = () => {
        setBootStatus('ready');
        addToast('Kernel securely booted.');
        r1.current = new R1Runtime(); 
    };

    const handleError = (e: any) => {
        setBootStatus('error');
        setBootError(e.detail || 'Unknown boot error');
        addToast('Boot Sequence Failed', 'error');
    };

    window.addEventListener('r1:ready', handleReady);
    window.addEventListener('r1:error', handleError as any);
    
    const status = (window as any).__R1_BOOT_STATUS__;
    if (status === 'ready' && !r1.current) {
        setBootStatus('ready');
        r1.current = new R1Runtime();
    } else if (status === 'error') {
        setBootStatus('error');
        setBootError((window as any).__R1_BOOT_ERROR__);
    }

    return () => {
        window.removeEventListener('r1:ready', handleReady);
        window.removeEventListener('r1:error', handleError as any);
    };
  }, []);

  // --- Foundation ---
  const handlePing = async () => {
    if (!r1.current) return;
    const start = performance.now();
    addLog('Pkt: PING -> Worker');
    const res = await r1.current.invoke('PING', {});
    const end = performance.now();
    const lat = (end - start).toFixed(2) + 'ms';
    setMetrics(m => ({ ...m, latency: lat, messages: m.messages + 1 }));
    addLog(`Pkt: PONG <- ${JSON.stringify(res)} [${lat}]`);
    if (activePhase !== 'foundation') addToast(`IPC Ping: ${lat}`);
  };

  // --- VFS ---
  const refreshFiles = async () => {
    if (!r1.current) return;
    try {
      const res = await r1.current.invoke('VFS_LIST', { dir: '/' });
      const files = Array.isArray(res) ? res : (res.paths || []);
      setVfsFiles(files);
      addToast(`Scanned VFS: ${files.length} items.`, 'success');
      addLog(`VFS read operation completed`);
    } catch (err: any) {
      addToast(`VFS Error: ${err.message}`, 'error');
    }
  };

  const createTestFile = async () => {
    if (!r1.current) return;
    await r1.current.invoke('VFS_WRITE', { path: '/hello.txt', data: Array.from(new TextEncoder().encode('R1 V3 UI Content')) });
    addToast('File "hello.txt" written to OPFS', 'success');
    refreshFiles();
  };

  // --- WASM ---
  const loadWasm = async () => {
     if (!r1.current) return;
     setWasmResult('Initializing WASM Component...');
     addToast('Fetching WASM binary...', 'info');
     try {
       await r1.current.invoke('WASM_LOAD', { name: 'my-wasm', url: '/wasm/test_module.js' });
       addToast('Rust Module "my-wasm" Mounted', 'success');
       setWasmResult('Module Activated. Awaiting invocation.');
     } catch (err: any) {
       addToast(`WASM Error: ${err.message}`, 'error');
       setWasmResult(`Error linking module: ${err.message}`);
     }
  };

  const callWasm = async () => {
    if (!r1.current) return;
    setWasmResult('Executing...');
    try {
      const res = await r1.current.invoke('my-wasm:echo_object', { name: 'Designer UI', count: 3 });
      setWasmResult(JSON.stringify(res, null, 2));
      addToast('Rust echo successful', 'success');
    } catch (err: any) {
      setWasmResult(`Execution failed: ${err.message}`);
    }
  };

  // --- APIs ---
  const queryPlatform = async () => {
    if (!r1.current) return;
    try {
      const plat = await r1.current.invoke('os:platform', {});
      const arch = await r1.current.invoke('os:arch', {});
      const type = await r1.current.invoke('os:type', {});
      setApiResult(`Platform: ${plat}\nArchitecture: ${arch}\nKernel Type: ${type}`);
      addToast('OS details retrieved', 'success');
    } catch (err: any) {
      setApiResult(`Error querying platform: ${err.message}`);
    }
  };

  const copyText = async () => {
    if (!r1.current) return;
    await r1.current.invoke('clipboard:write_text', { text: 'R1 Designer UI V3' });
    addToast('Text copied to system clipboard!', 'success');
  };

  const showModal = async () => {
    addToast('Intercepting System Dialog Request...', 'info');
    // Using our custom React Designer Modal instead of window.confirm
    setModalConfig({
        title: 'System Dialog Intercepted',
        message: 'You have triggered a native dialog. This is our heavily stylized React overlay catching the intent. Proceed?',
        resolve: (res) => {
            addToast(`Dialog Response: ${res ? 'Confirmed' : 'Cancelled'}`, res ? 'success' : 'error');
            setApiResult(`Dialog User Intent: ${res}`);
            setModalConfig(null);
        }
    });
  };

  // --- Assets ---
  const generateHtml = async () => {
    if (!r1.current) return;
    const content = `
      <html>
        <body style="background: transparent; color: #f8fafc; font-family: 'Outfit', sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0;">
          <h2 style="text-shadow: 0 0 20px rgba(16,185,129, 0.4); text-align: center;">Securely Served via R1 Service Worker<br/><small style="color: #06b6d4">No external network requests</small></h2>
        </body>
      </html>
    `;
    await r1.current.invoke('fs:write_text_file', { path: '/demo.html', contents: content });
    addToast('Internal resource generated inside VFS.', 'success');
  };

  const mountIframe = () => {
    const frame = document.getElementById('asset-preview') as HTMLIFrameElement;
    if (frame) {
        frame.src = '/r1-asset/demo.html?t=' + Date.now();
        addToast('Iframe requested /r1-asset/ bypass route.', 'info');
    }
  };

  // --- Windowing ---
  const spawnVirtualWindow = () => {
    const id = Math.random().toString(36).slice(2, 6);
    setWindows(p => [...p, { id, title: `Sandboxed Instance [${id}]`, x: 150 + p.length * 40, y: 150 + p.length * 40 }]);
  };

  const closeWindow = (id: string) => {
    setWindows(p => p.filter(w => w.id !== id));
  };

  const activePhaseData = PHASES.find(p => p.id === activePhase);

  return (
    <>
      <div className="toast-container">
        {toasts.map(t => (
          <div key={t.id} className={`toast ${t.type}`}>
            {t.type === 'success' && <CheckCircle2 size={18} />}
            {t.type === 'error' && <XCircle size={18} />}
            {t.type === 'info' && <Info size={18} />}
            <span>{t.msg}</span>
          </div>
        ))}
      </div>

      {/* Floating System Level Modal Interceptor */}
      {modalConfig && (
          <div className="modal-overlay">
              <div className="modal-content">
                  <div className="modal-title">
                      <Zap size={24} style={{color: 'var(--accent-emerald)'}} />
                      {modalConfig.title}
                  </div>
                  <p style={{ color: 'var(--text-muted)', lineHeight: 1.5 }}>{modalConfig.message}</p>
                  <div className="modal-actions">
                      <button className="btn btn-secondary" onClick={() => modalConfig.resolve(false)}>Dismiss</button>
                      <button className="btn btn-primary" onClick={() => modalConfig.resolve(true)}>Accept</button>
                  </div>
              </div>
          </div>
      )}

      {/* Virtual Desktop Layer */}
      {windows.map(w => (
        <div key={w.id} className="master-window" style={{ position: 'absolute', width: 600, height: 400, left: w.x, top: w.y, zIndex: 50, flexDirection: 'column' }}>
          <div style={{ height: 40, background: 'rgba(0,0,0,0.3)', borderBottom: '1px solid var(--glass-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 16px' }}>
             <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontFamily: 'Outfit' }}>{w.title}</div>
             <div style={{ display: 'flex', gap: 12, color: 'var(--text-muted)' }}>
                <Minus size={14} style={{cursor: 'pointer'}} />
                <Maximize2 size={14} style={{cursor: 'pointer'}} />
                <X size={14} style={{cursor: 'pointer', color: 'var(--danger)'}} onClick={() => closeWindow(w.id)} />
             </div>
          </div>
          <iframe style={{ flex: 1, border: 'none', background: '#fff' }} src="https://vite.dev" title={w.id}></iframe>
        </div>
      ))}

      {/* Primary Master Application Window */}
      <div className="master-window">
        {/* Sleek Vertical Icon Sidebar */}
        <aside className="slim-sidebar">
          <div className="logo-orb">R1</div>
          
          <nav className="nav-icons">
            {PHASES.map(p => (
              <div 
                key={p.id} 
                className={`nav-icon ${activePhase === p.id ? 'active' : ''}`}
                onClick={() => setActivePhase(p.id)}
                title={p.label}
              >
                <p.icon />
              </div>
            ))}
          </nav>

          <div className="bottom-actions">
            <div 
              className="nav-icon" 
              onClick={() => setTheme(t => t === 'dark' ? 'light' : 'dark')}
              title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} Mode`}
            >
              {theme === 'dark' ? <Sun /> : <Moon />}
            </div>
            <div className="status-dot-container" title={bootStatus}>
               <div className={`status-dot ${bootStatus === 'ready' ? 'online' : (bootStatus === 'error' ? 'error' : 'booting')}`} />
            </div>
          </div>
        </aside>

        <main className="content-area">
          <header className="topbar">
            <div className="topbar-title">
              {activePhaseData && <activePhaseData.icon size={26} strokeWidth={2.5} />}
              {activePhaseData?.title}
            </div>
            <div className="topbar-desc">R1 Runtime Environment</div>
          </header>

          <div className="scroll-container">
            <div className="bento-grid">
              
              {activePhase === 'foundation' && (
                <>
                  <div className="bento-card">
                    <div className="card-header"><Activity /> Core Bridge Health</div>
                    <p className="card-desc">The IPC Protocol handles cross-thread communication between the UI and Kernel with near-native performance.</p>
                    
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', background: 'rgba(0,0,0,0.2)', padding: '20px', borderRadius: '14px' }}>
                        <div>
                            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: 8 }}>Kernel Roundtrip</div>
                            <div className="brand-font" style={{ fontSize: '2rem', color: 'var(--accent-cyan)' }}>{metrics.latency}</div>
                        </div>
                        <div>
                            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: 8 }}>IPC Packets</div>
                            <div className="brand-font" style={{ fontSize: '2rem' }}>{metrics.messages}</div>
                        </div>
                    </div>
                    
                    <div className="btn-group">
                      <button className="btn btn-primary" onClick={handlePing}><Zap /> Publish Packet</button>
                    </div>
                  </div>
                  
                  <div className="bento-card">
                    <div className="card-header"><Settings /> Data Stream</div>
                    <div className="output-pane scrollable mono-font">
                      {logs.length === 0 ? <span style={{opacity: 0.5}}>Awaiting kernel...</span> : logs.map((l, i) => <div key={i} className="output-line">~$ {l}</div>)}
                    </div>
                  </div>
                </>
              )}

              {activePhase === 'vfs' && (
                <div className="bento-card" style={{ gridColumn: '1 / -1' }}>
                  <div className="card-header"><FolderArchive /> Persistent OPFS Sandbox</div>
                  <p className="card-desc">The virtual file system stores files in a deeply sandboxed browser partition, instantly available without Node.js.</p>
                  
                  <div className="output-pane scrollable mono-font" style={{ minHeight: '150px' }}>
                     {vfsFiles.length > 0 ? vfsFiles.map((f, i) => (
                        <div key={i} style={{ display: 'flex', gap: 10, color: 'var(--text-main)' }}>
                           <span style={{ color: 'var(--accent-emerald)' }}>➜</span> {f}
                        </div>
                     )) : <span style={{ opacity: 0.4 }}>No allocated inodes found.</span>}
                  </div>

                  <div className="btn-group">
                    <button className="btn btn-primary" onClick={createTestFile}><Save /> Serialize Buffer</button>
                    <button className="btn btn-secondary" onClick={refreshFiles}><Activity /> Sync Trees</button>
                  </div>
                </div>
              )}

              {activePhase === 'wasm' && (
                <>
                  <div className="bento-card">
                    <div className="card-header"><Binary /> Execution Environment</div>
                    <p className="card-desc">Load and compile intensive Rust algorithms at runtime locally.</p>
                    <div className="btn-group" style={{ flexDirection: 'column' }}>
                      <button className="btn btn-secondary" style={{width: '100%'}} onClick={loadWasm}><FolderArchive /> Bootstrap Linker</button>
                      <button className="btn btn-primary" style={{width: '100%'}} onClick={callWasm}><Play /> Execute Target</button>
                    </div>
                  </div>
                  <div className="bento-card">
                    <div className="card-header"><MonitorDot /> Virtual Display</div>
                    <div className="output-pane scrollable mono-font" style={{ flex: 1 }}>{wasmResult}</div>
                  </div>
                </>
              )}

              {activePhase === 'apis' && (
                <>
                  <div className="bento-card">
                    <div className="card-header"><Settings /> Deep Integration</div>
                    <p className="card-desc">Securely intercepted APIs proxied from native OS environments.</p>
                    <div className="btn-group">
                      <button className="btn btn-secondary" onClick={queryPlatform}><Info /> Probe Sys</button>
                      <button className="btn btn-secondary" onClick={copyText}><ClipboardCopy /> Clipboard</button>
                      <button className="btn btn-primary" onClick={showModal}><AppWindow /> UI Dialog</button>
                    </div>
                  </div>
                  <div className="bento-card">
                    <div className="card-header"><Terminal /> System Diagnostics</div>
                    <div className="output-pane scrollable mono-font" style={{ flex: 1, whiteSpace: 'pre-wrap' }}>{apiResult}</div>
                  </div>
                </>
              )}

              {activePhase === 'window' && (
                <div className="bento-card">
                  <div className="card-header"><AppWindow /> Window Composer</div>
                  <p className="card-desc">Generate floating components completely outside the traditional DOM flow mimicking desktop managers.</p>
                  <div className="btn-group">
                     <button className="btn btn-primary" onClick={spawnVirtualWindow}><Zap /> Fork Display Instance</button>
                  </div>
                </div>
              )}

              {activePhase === 'assets' && (
                <>
                  <div className="bento-card">
                    <div className="card-header"><FileCode2 /> Dynamic Assets</div>
                    <p className="card-desc">Service Worker proxies requests targeting `r1-asset://` to physical OPFS blobs.</p>
                    <div className="btn-group">
                      <button className="btn btn-secondary" onClick={generateHtml}><Save /> Hydrate Payload</button>
                      <button className="btn btn-primary" onClick={mountIframe}><Play /> Execute in Sandbox</button>
                    </div>
                  </div>
                  <div className="bento-card" style={{ padding: 0 }}>
                     <iframe id="asset-preview" style={{ width: '100%', height: '100%', minHeight: 200, border: 'none', background: 'transparent' }} />
                  </div>
                </>
              )}

              {activePhase === 'diag' && (
                <div className="bento-card" style={{ gridColumn: '1 / -1' }}>
                  <div className="card-header"><Activity /> Diagnostics & Thread State</div>
                  <p className="card-desc">Low-level metrics regarding the R1 Kernel worker instance and boot phases.</p>
                  
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                    <div style={{ background: 'var(--bg-pre)', border: '1px solid var(--border-subtle)', padding: 16, borderRadius: 'var(--radius-md)' }}>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: 8 }}>Kernel Boot Status</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div className={`status-dot ${bootStatus === 'ready' ? 'online' : (bootStatus === 'error' ? 'error' : 'booting')}`} />
                        <span style={{ fontWeight: 500 }}>{bootStatus.toUpperCase()}</span>
                      </div>
                    </div>
                    
                    <div style={{ background: 'var(--bg-pre)', border: '1px solid var(--border-subtle)', padding: 16, borderRadius: 'var(--radius-md)' }}>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: 8 }}>VFS Sandboxing</div>
                      <div style={{ fontWeight: 500, color: 'var(--success)' }}>Isolated (OPFS Enabled)</div>
                    </div>
                  </div>

                  {bootError && (
                    <div style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid var(--danger)', padding: 16, borderRadius: 'var(--radius-md)', color: 'var(--danger)', marginTop: 16 }}>
                       <strong>Boot Error Log:</strong><br/>
                       {bootError}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </main>
      </div>

       {/* Boot Error Fallback */}
       {bootStatus !== 'ready' && (
          <div style={{ position: 'fixed', inset: 0, zIndex: 999999, background: 'var(--app-bg)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 30 }}>
            <div className="logo-orb" style={{ width: 80, height: 80, fontSize: '2rem' }}>R1</div>
            <div style={{ maxWidth: 400, textAlign: 'center' }}>
              <h2 className="brand-font" style={{ marginBottom: 12 }}>{bootStatus === 'booting' ? 'Synthesizing...' : 'Architecture Fault'}</h2>
              {bootStatus === 'error' && (
                 <>
                   <div style={{ background: 'var(--danger)', color: 'white', padding: 16, borderRadius: 12, marginBottom: 20, fontSize: '0.85rem' }}>{bootError}</div>
                   <button className="btn btn-primary" onClick={() => window.location.reload()}>Emergency Reboot</button>
                 </>
              )}
            </div>
          </div>
       )}
    </>
  );
}

const Terminal = (props: any) => <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="4 17 10 11 4 5"/><line x1="12" y1="19" x2="20" y2="19"/></svg>;
