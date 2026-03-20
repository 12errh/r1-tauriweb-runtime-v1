import React, { useEffect, useState, useRef, useCallback } from 'react';
import { R1Runtime } from '@r1/core';
import './index.css';

// ─── Web-native dialog shims (inline, no dynamic import needed) ────────────────
function r1Message(msg: string, opts?: { title?: string }) {
  return new Promise<void>(resolve => {
    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;z-index:999999;background:rgba(0,0,0,0.7);display:flex;align-items:center;justify-content:center;font-family:JetBrains Mono,monospace';
    overlay.innerHTML = `<div style="background:#1f1f26;border:1px solid #f59e0b;padding:28px 32px;max-width:420px;min-width:320px;display:flex;flex-direction:column;gap:16px"><div style="color:#f59e0b;font-size:13px;font-weight:700">${opts?.title ?? 'Message'}</div><p style="color:#9898a8;font-size:12px;line-height:1.6">${msg}</p><button id="r1ok" style="align-self:flex-end;background:#f59e0b;border:none;color:#000;font-family:inherit;font-size:12px;font-weight:700;padding:8px 20px;cursor:pointer">OK</button></div>`;
    document.body.appendChild(overlay);
    overlay.querySelector('#r1ok')!.addEventListener('click', () => { document.body.removeChild(overlay); resolve(); });
  });
}

function r1Confirm(msg: string, opts?: { title?: string }) {
  return new Promise<boolean>(resolve => {
    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;z-index:999999;background:rgba(0,0,0,0.7);display:flex;align-items:center;justify-content:center;font-family:JetBrains Mono,monospace';
    overlay.innerHTML = `<div style="background:#1f1f26;border:1px solid #f59e0b;padding:28px 32px;max-width:420px;min-width:320px;display:flex;flex-direction:column;gap:16px"><div style="color:#f59e0b;font-size:13px;font-weight:700">${opts?.title ?? 'Confirm'}</div><p style="color:#9898a8;font-size:12px;line-height:1.6">${msg}</p><div style="display:flex;gap:10px;justify-content:flex-end"><button id="r1no" style="background:transparent;border:1px solid #3a3a45;color:#9898a8;font-family:inherit;font-size:12px;padding:8px 16px;cursor:pointer">Cancel</button><button id="r1yes" style="background:#f59e0b;border:none;color:#000;font-family:inherit;font-size:12px;font-weight:700;padding:8px 20px;cursor:pointer">Confirm</button></div></div>`;
    document.body.appendChild(overlay);
    const cleanup = (v: boolean) => { document.body.removeChild(overlay); resolve(v); };
    overlay.querySelector('#r1yes')!.addEventListener('click', () => cleanup(true));
    overlay.querySelector('#r1no')!.addEventListener('click', () => cleanup(false));
  });
}

// ─── Types ──────────────────────────────────────────────────────────────────
type BootStatus = 'idle' | 'booting' | 'ready' | 'error';
type ToastType  = 'info' | 'success' | 'error';
interface Toast  { id: number; msg: string; type: ToastType; }
interface LogLine { ts: string; tag: 'ok' | 'err' | 'info' | 'warn'; text: string; }
interface VWin    { id: string; title: string; x: number; y: number; w: number; h: number; }

type Tab = 'kernel' | 'vfs' | 'wasm' | 'wasi' | 'events' | 'window' | 'apis' | 'sw';
const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'kernel', label: 'KERN',   icon: '⚡' },
  { id: 'vfs',    label: 'VFS',    icon: '💾' },
  { id: 'wasm',   label: 'WASM',   icon: '🦀' },
  { id: 'wasi',   label: 'WASI',   icon: '📂' },
  { id: 'events', label: 'EVTS',   icon: '📡' },
  { id: 'window', label: 'WIN',    icon: '🪟' },
  { id: 'apis',   label: 'APIS',   icon: '🔌' },
  { id: 'sw',     label: 'SW',     icon: '🌐' },
];

function now() {
  return new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

// ─── Terminal component ──────────────────────────────────────────────────────
const Terminal: React.FC<{ lines: LogLine[] }> = ({ lines }) => (
  <div className="terminal">
    {lines.length === 0
      ? <span className="terminal-empty">// awaiting output...</span>
      : lines.map((l, i) => (
        <div key={i} className="terminal-line">
          <span className="ts">{l.ts}</span>
          <span className={`tag-${l.tag}`}>[{l.tag.toUpperCase()}]</span>
          {' '}{l.text}
        </div>
      ))
    }
  </div>
);

// ─── Main App ────────────────────────────────────────────────────────────────
export default function App() {
  const [tab, setTab] = useState<Tab>('kernel');
  const [bootStatus, setBootStatus] = useState<BootStatus>('idle');
  const [bootError, setBootError] = useState('');
  const [toasts, setToasts] = useState<Toast[]>([]);

  // shared log stream
  const [logs, setLogs] = useState<LogLine[]>([]);

  // kernel metrics
  const [latency, setLatency] = useState('—');
  const [msgCount, setMsgCount] = useState(0);
  const [pongPayload, setPongPayload] = useState('—');

  // vfs state
  const [vfsFiles, setVfsFiles] = useState<string[]>([]);
  const [vfsInput, setVfsInput] = useState('');
  const [vfsContent, setVfsContent] = useState('Hello from R1 VFS!');
  const [vfsReadResult, setVfsReadResult] = useState('');

  // wasm state
  const [wasmLoaded, setWasmLoaded] = useState(false);
  const [wasmResult, setWasmResult] = useState('');
  const [wasmA, setWasmA] = useState('3');
  const [wasmB, setWasmB] = useState('4');
  const [wasmName, setWasmName] = useState('Alice');
  const [wasmCount, setWasmCount] = useState('5');

  // wasi state
  const [wasiPath, setWasiPath] = useState('/wasi-demo.txt');
  const [wasiContent, setWasiContent] = useState('Written by Rust via WASI!');
  const [wasiResult, setWasiResult] = useState('');

  // events state
  const [eventLog, setEventLog] = useState<LogLine[]>([]);
  const [listenActive, setListenActive] = useState(false);

  // window manager
  const [vWindows, setVWindows] = useState<VWin[]>([]);
  const [winTitle, setWinTitle] = useState('My R1 App');
  
  // apis
  const [clipText, setClipText] = useState('R1 Runtime — Copy Me!');
  const [clipReadResult, setClipReadResult] = useState('');
  const [osResult, setOsResult] = useState('');
  const [storeKey, setStoreKey] = useState('theme');
  const [storeVal, setStoreVal] = useState('dark');
  const [storeGetResult, setStoreGetResult] = useState('');
  const [storeKeys, setStoreKeys] = useState<string[]>([]);
  const [dialogResult, setDialogResult] = useState('');
  const [shellUrl, setShellUrl] = useState('https://github.com/12errh/r1-tauriweb-runtime-v1');

  // sw
  const [swHtml, setSwHtml] = useState(`<!DOCTYPE html>
<html>
<head><title>R1 Asset</title></head>
<body style="background:#0d0d0f;color:#f59e0b;font-family:monospace;display:flex;align-items:center;justify-content:center;height:100vh;margin:0">
  <div style="text-align:center">
    <h2>Served by R1 Service Worker</h2>
    <p style="color:#9898a8;margin-top:8px">This HTML lives in the OPFS Virtual Filesystem</p>
  </div>
</body>
</html>`);
  const [swPreviewSrc, setSwPreviewSrc] = useState('');

  const r1 = useRef<R1Runtime | null>(null);
  const toastId = useRef(0);
  const unlistenRef = useRef<(() => void) | null>(null);

  // ── Helpers ────────────────────────────────────────────────────────────────
  const toast = useCallback((msg: string, type: ToastType = 'info') => {
    const id = toastId.current++;
    setToasts(p => [...p, { id, msg, type }]);
    setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 4000);
  }, []);

  const log = useCallback((tag: LogLine['tag'], text: string) => {
    setLogs(p => [{ ts: now(), tag, text }, ...p].slice(0, 80));
  }, []);

  const eLog = useCallback((tag: LogLine['tag'], text: string) => {
    setEventLog(p => [{ ts: now(), tag, text }, ...p].slice(0, 80));
  }, []);

  // ── Boot ───────────────────────────────────────────────────────────────────
  useEffect(() => {
    const onReady = () => {
      setBootStatus('ready');
      r1.current = new R1Runtime();
      log('ok', 'R1 Kernel booted — worker online');
      toast('Kernel online', 'success');
    };
    const onError = (e: any) => {
      setBootStatus('error');
      setBootError(e.detail || 'Unknown boot error');
      log('err', `Boot failed: ${e.detail}`);
    };
    window.addEventListener('r1:ready', onReady);
    window.addEventListener('r1:error', onError as any);
    const s = (window as any).__R1_BOOT_STATUS__;
    if (s === 'ready' && !r1.current) { onReady(); }
    else if (s === 'error') { onError({ detail: (window as any).__R1_BOOT_ERROR__ }); }
    return () => {
      window.removeEventListener('r1:ready', onReady);
      window.removeEventListener('r1:error', onError as any);
    };
  }, []);

  // ── KERNEL ─────────────────────────────────────────────────────────────────
  const handlePing = async () => {
    if (!r1.current) return;
    const t0 = performance.now();
    log('info', 'PING → Kernel Worker');
    try {
      const res = await r1.current.invoke('PING', {});
      const lat = `${(performance.now() - t0).toFixed(2)}ms`;
      setLatency(lat);
      setMsgCount(c => c + 1);
      setPongPayload(JSON.stringify(res));
      log('ok', `PONG ← ${JSON.stringify(res)} [${lat}]`);
    } catch (e: any) {
      log('err', e.message);
      toast(e.message, 'error');
    }
  };

  // ── VFS ────────────────────────────────────────────────────────────────────
  const vfsRefresh = async () => {
    if (!r1.current) return;
    try {
      const res: any = await r1.current.invoke('VFS_LIST', { dir: '/' });
      const paths = Array.isArray(res) ? res : (res.paths || []);
      setVfsFiles(paths);
      log('ok', `VFS list: ${paths.length} entries`);
    } catch (e: any) { log('err', e.message); }
  };

  const vfsWrite = async () => {
    if (!r1.current) return;
    const path = vfsInput || '/demo/hello.txt';
    const data = Array.from(new TextEncoder().encode(vfsContent));
    await r1.current.invoke('VFS_WRITE', { path, data });
    log('ok', `Written: ${path} (${data.length}B)`);
    toast(`Wrote ${path}`, 'success');
    vfsRefresh();
  };

  const vfsRead = async () => {
    if (!r1.current) return;
    const path = vfsInput || '/demo/hello.txt';
    try {
      const res: any = await r1.current.invoke('VFS_READ', { path });
      const bytes: number[] = res.data || res;
      const text = new TextDecoder().decode(new Uint8Array(bytes));
      setVfsReadResult(text);
      log('ok', `Read ${path}: "${text.slice(0, 60)}"`);
    } catch (e: any) {
      log('err', e.message);
      setVfsReadResult('Error: ' + e.message);
    }
  };

  const vfsDelete = async () => {
    if (!r1.current) return;
    const path = vfsInput || '/demo/hello.txt';
    await r1.current.invoke('VFS_DELETE', { path });
    log('warn', `Deleted: ${path}`);
    toast(`Deleted ${path}`);
    vfsRefresh();
  };

  // ── WASM ───────────────────────────────────────────────────────────────────
  const wasmLoad = async () => {
    if (!r1.current) return;
    log('info', 'Loading WASM module my-wasm...');
    setWasmResult('Loading...');
    try {
      await r1.current.invoke('WASM_LOAD', { name: 'my-wasm', url: '/wasm/test_module.js' });
      setWasmLoaded(true);
      log('ok', 'WASM module "my-wasm" loaded and registered');
      toast('WASM module loaded', 'success');
      setWasmResult('Module ready. Invoke a function below.');
    } catch (e: any) {
      log('err', e.message);
      setWasmResult('Error: ' + e.message);
    }
  };

  const wasmEcho = async () => {
    if (!r1.current) return;
    log('info', `Calling echo_object({ name: "${wasmName}", count: ${wasmCount} })`);
    try {
      const res = await r1.current.invoke('my-wasm:echo_object', { name: wasmName, count: parseInt(wasmCount) });
      setWasmResult(JSON.stringify(res, null, 2));
      log('ok', `echo_object → ${JSON.stringify(res)}`);
    } catch (e: any) { log('err', e.message); setWasmResult('Error: ' + e.message); }
  };

  const wasmAdd = async () => {
    if (!r1.current) return;
    log('info', `Calling add(${wasmA}, ${wasmB})`);
    try {
      const res = await r1.current.invoke('my-wasm:add', [parseInt(wasmA), parseInt(wasmB)]);
      setWasmResult(`add(${wasmA}, ${wasmB}) = ${res}`);
      log('ok', `add → ${res}`);
    } catch (e: any) { log('err', e.message); setWasmResult('Error: ' + e.message); }
  };

  const wasmMultiply = async () => {
    if (!r1.current) return;
    log('info', `Calling multiply(${wasmA}, ${wasmB})`);
    try {
      const res = await r1.current.invoke('my-wasm:multiply', [parseInt(wasmA), parseInt(wasmB)]);
      setWasmResult(`multiply(${wasmA}, ${wasmB}) = ${res}`);
      log('ok', `multiply → ${res}`);
    } catch (e: any) { log('err', e.message); setWasmResult('Error: ' + e.message); }
  };

  // ── WASI ───────────────────────────────────────────────────────────────────
  const wasiWriteRead = async () => {
    if (!r1.current) return;
    log('info', `WASI: write_and_read({ path: "${wasiPath}" })`);
    setWasiResult('Executing...');
    try {
      const res: any = await r1.current.invoke('my-wasm:write_and_read', { path: wasiPath, content: wasiContent });
      setWasiResult(JSON.stringify(res, null, 2));
      log('ok', `WASI write_and_read → ${JSON.stringify(res)}`);
      toast('WASI file I/O success', 'success');
    } catch (e: any) {
      setWasiResult('Error: ' + e.message);
      log('err', e.message);
    }
  };

  const wasiVerifyVfs = async () => {
    if (!r1.current) return;
    try {
      const exists: any = await r1.current.invoke('VFS_EXISTS', { path: wasiPath });
      const isExists = exists === true || exists?.exists === true;
      setWasiResult(`VFS.exists("${wasiPath}") = ${isExists}`);
      log(isExists ? 'ok' : 'warn', `VFS exists check: ${isExists}`);
    } catch (e: any) { log('err', e.message); }
  };

  // ── EVENTS ─────────────────────────────────────────────────────────────────
  const eventsSubscribe = async () => {
    if (!r1.current) return;
    if (unlistenRef.current) {
      unlistenRef.current();
      unlistenRef.current = null;
      setListenActive(false);
      return;
    }
    
    eLog('info', 'Subscribing to "download-progress" events...');
    try {
      const listen = (window as any).__TAURI_INTERNALS__?.listen;
      if (!listen) {
        eLog('err', 'Tauri Internals not found');
        return;
      }

      const unlisten = await listen('download-progress', (e: any) => {
        eLog('ok', `event: download-progress → ${JSON.stringify(e)}`);
      });

      unlistenRef.current = unlisten;
      setListenActive(true);
      eLog('ok', 'Subscribed. Waiting for Rust emissions...');
      toast('Event listener active', 'success');
    } catch (e: any) {
      eLog('err', `Subscription failed: ${e.message}`);
    }
  };

  const emitTestEvent = () => {
    // Manually fire a synthetic event so user can see the listener in action
    const bus = (window as any).__R1_EVENT_BUS__;
    if (bus) {
      bus.emit('download-progress', { percent: Math.floor(Math.random() * 100), file: 'demo.zip' });
      eLog('info', 'Fired synthetic download-progress event');
    } else {
      eLog('warn', 'Event bus not exposed on window — emit from WASM module instead');
    }
  };

  // ── WINDOW ─────────────────────────────────────────────────────────────────
  const spawnWindow = () => {
    const id = Math.random().toString(36).slice(2, 6);
    const idx = vWindows.length;
    setVWindows(p => [...p, {
      id, title: `R1 Window [${id}]`,
      x: 120 + idx * 40, y: 120 + idx * 40,
      w: 480, h: 300
    }]);
    log('ok', `Spawned virtual window ${id}`);
    toast(`Window ${id} spawned`, 'success');
  };

  const closeVWin = (id: string) => {
    setVWindows(p => p.filter(w => w.id !== id));
    log('warn', `Closed window ${id}`);
  };

  const setAppTitle = () => {
    document.title = winTitle;
    log('ok', `appWindow.setTitle("${winTitle}")`);
    toast('Title updated');
  };

  // ── APIS — Clipboard ───────────────────────────────────────────────────────
  const clipWrite = async () => {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(clipText);
        log('ok', `clipboard.writeText("${clipText}")`);
        toast('Copied to clipboard!', 'success');
      } else {
        log('warn', 'Clipboard API requires HTTPS or localhost');
        toast('Clipboard requires HTTPS', 'error');
      }
    } catch (e: any) { log('err', e.message); }
  };

  const clipRead = async () => {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        const text = await navigator.clipboard.readText();
        setClipReadResult(text);
        log('ok', `clipboard.readText() = "${text.slice(0, 60)}"`);
      } else {
        log('warn', 'Clipboard API requires HTTPS or localhost');
      }
    } catch (e: any) { log('err', e.message); setClipReadResult('Error: ' + e.message); }
  };

  // ── APIS — OS ──────────────────────────────────────────────────────────────
  const queryOs = () => {
    const ua = navigator.userAgent.toLowerCase();
    let plat = 'web';
    if (ua.includes('win')) plat = 'win32';
    else if (ua.includes('mac')) plat = 'darwin';
    else if (ua.includes('linux')) plat = 'linux';

    const result = [
      `platform:  ${plat}`,
      `arch:      wasm32`,
      `type:      Web`,
      `locale:    ${navigator.language}`,
      `hostname:  ${window.location.hostname}`,
      `version:   R1 Browser Runtime`,
    ].join('\n');
    setOsResult(result);
    log('ok', `os.platform() = ${plat}`);
  };

  // ── APIS — Store ───────────────────────────────────────────────────────────
  const storeSet = async () => {
    if (!r1.current) return;
    await r1.current.invoke('store:set', { name: 'demo', key: storeKey, value: storeVal });
    log('ok', `store.set("${storeKey}", "${storeVal}")`);
    toast('Store value saved', 'success');
  };

  const storeGet = async () => {
    if (!r1.current) return;
    const res: any = await r1.current.invoke('store:get', { name: 'demo', key: storeKey });
    setStoreGetResult(String(res));
    log('ok', `store.get("${storeKey}") = ${JSON.stringify(res)}`);
  };

  const storeListKeys = async () => {
    if (!r1.current) return;
    const res: any = await r1.current.invoke('store:keys', { name: 'demo' });
    setStoreKeys(Array.isArray(res) ? res : []);
    log('ok', `store.keys() = [${(Array.isArray(res) ? res : []).join(', ')}]`);
  };

  // ── APIS — Dialog ──────────────────────────────────────────────────────────
  const showMessage = () => {
    const msg = 'Hello from R1 Dialog API! This runs in the browser without a native backend.';
    log('info', 'dialog.message() invoked');
    r1Message(msg, { title: 'R1 Message' }).then(() => {
      setDialogResult('User dismissed message dialog');
      log('ok', 'dialog.message() resolved');
    });
  };

  const showConfirm = () => {
    log('info', 'dialog.confirm() invoked');
    r1Confirm('Do you want to proceed with the R1 demo?', { title: 'R1 Confirm' }).then((res: boolean) => {
      setDialogResult(`confirm() → ${res}`);
      log('ok', `dialog.confirm() = ${res}`);
    });
  };

  // ── APIS — Shell ───────────────────────────────────────────────────────────
  const shellOpen = () => {
    window.open(shellUrl, '_blank');
    log('ok', `shell.open("${shellUrl}")`);
    toast('Opened in new tab');
  };

  // ── SW ─────────────────────────────────────────────────────────────────────
  const swWrite = async () => {
    if (!r1.current) return;
    const data = Array.from(new TextEncoder().encode(swHtml));
    await r1.current.invoke('VFS_WRITE', { path: '/demo.html', data });
    log('ok', 'Wrote /demo.html to VFS (4096B max)');
    toast('HTML written to VFS', 'success');
  };

  const swMount = () => {
    const src = '/r1-asset/demo.html?t=' + Date.now();
    setSwPreviewSrc(src);
    log('info', `iframe.src = ${src}`);
    toast('Service Worker intercept requested');
  };

  // ─── RENDER ─────────────────────────────────────────────────────────────────
  return (
    <>
      {/* Toast stack */}
      <div className="toast-stack">
        {toasts.map(t => (
          <div key={t.id} className={`toast ${t.type}`}>
            <span className="dot" />
            {t.msg}
          </div>
        ))}
      </div>

      {/* Virtual Window Overlay */}
      <div className="vw-overlay">
        {vWindows.map(w => (
          <div key={w.id} className="vw-frame"
            style={{ left: w.x, top: w.y, width: w.w, height: w.h }}>
            <div className="vw-chrome">
              <span className="vw-title">{w.title}</span>
              <div className="vw-controls">
                <button className="vw-btn min" title="Minimize" />
                <button className="vw-btn max" title="Maximize" />
                <button className="vw-btn close" onClick={() => closeVWin(w.id)} title="Close" />
              </div>
            </div>
            <div className="vw-body">
              <div>
                <div style={{ color: 'var(--amber)', fontFamily: 'var(--font-mono)', marginBottom: 8 }}>Window ID: {w.id}</div>
                <div style={{ color: 'var(--text-muted)', fontSize: 11 }}>@r1/window · Virtual Window Manager</div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* App Shell */}
      <div className="app-shell">
        {/* Sidebar */}
        <aside className="sidebar">
          <div className="sidebar-logo">R1</div>
          <nav className="sidebar-nav">
            {TABS.map(t => (
              <div key={t.id}
                className={`nav-tab ${tab === t.id ? 'active' : ''}`}
                onClick={() => setTab(t.id)}
                title={t.id.toUpperCase()}>
                <span style={{ fontSize: 16 }}>{t.icon}</span>
                <span>{t.label}</span>
              </div>
            ))}
          </nav>
          <div className="sidebar-footer">
            <div
              title={`Kernel: ${bootStatus}`}
              className={`status-led ${bootStatus === 'ready' ? 'online' : bootStatus === 'error' ? 'error' : bootStatus === 'booting' ? 'booting' : 'idle'}`}
              style={{ margin: '8px auto' }}
            />
          </div>
        </aside>

        {/* Panel area */}
        <div className="panel-area">

          {/* Panel Header */}
          <header className="panel-header">
            <div className="panel-header-title">
              <span>{TABS.find(t => t.id === tab)?.icon}</span>
              <span>{tab.toUpperCase()} — {
                { kernel: 'Kernel Protocol & IPC', vfs: 'Virtual Filesystem (OPFS)', wasm: 'WASM Orchestrator + Serde', wasi: 'WASI Shim · Rust File I/O', events: 'Rust → JS Event Bridge', window: 'Virtual Window Manager', apis: 'OS / Clipboard / Store / Dialog', sw: 'Service Worker Asset Protocol' }[tab]
              }</span>
            </div>
            <div className="panel-header-sub">
              R1 Runtime v0.2 &nbsp;·&nbsp;
              <span style={{ color: bootStatus === 'ready' ? 'var(--green)' : 'var(--amber)' }}>{bootStatus.toUpperCase()}</span>
            </div>
          </header>

          <div className="panel-body">

            {/* ── KERNEL TAB ─────────────────────────────────────────── */}
            {tab === 'kernel' && (
              <div className="panel-split">
                <div className="section">
                  <div className="section-label">IPC Health Check</div>
                  <div className="metrics-row">
                    <div className="metric-cell">
                      <div className="metric-label">Roundtrip</div>
                      <div className="metric-value">{latency}</div>
                    </div>
                    <div className="metric-cell">
                      <div className="metric-label">Packets</div>
                      <div className="metric-value green">{msgCount}</div>
                    </div>
                    <div className="metric-cell">
                      <div className="metric-label">Kernel</div>
                      <div className={`metric-value ${bootStatus === 'ready' ? 'green' : 'red'}`} style={{ fontSize: 14 }}>{bootStatus.toUpperCase()}</div>
                    </div>
                  </div>
                  <div className="btn-row">
                    <button className="btn primary" onClick={handlePing}>⚡ PING</button>
                  </div>
                  <div className="section-label" style={{ marginTop: 8 }}>Last PONG Payload</div>
                  <div className="api-card-result">{pongPayload}</div>
                  <div className="section-label" style={{ marginTop: 8 }}>How It Works</div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.8 }}>
                    1. R1Runtime boots a <span style={{ color: 'var(--amber)' }}>Web Worker</span> (Kernel Worker)<br/>
                    2. KernelProxy.send('PING') creates a UUID-tagged message<br/>
                    3. Worker router matches type → calls handler → returns PONG<br/>
                    4. Promise resolves with matched response ID
                  </div>
                </div>
                <div className="section">
                  <div className="section-label">Live IPC Stream</div>
                  <Terminal lines={logs} />
                </div>
              </div>
            )}

            {/* ── VFS TAB ────────────────────────────────────────────── */}
            {tab === 'vfs' && (
              <div className="panel-split">
                <div className="section">
                  <div className="section-label">OPFS Operations</div>
                  <div className="input-row">
                    <input className="input" placeholder="/path/to/file.txt" value={vfsInput} onChange={e => setVfsInput(e.target.value)} />
                  </div>
                  <div>
                    <div className="section-label" style={{ marginBottom: 6 }}>File Content</div>
                    <textarea className="input" rows={3} value={vfsContent} onChange={e => setVfsContent(e.target.value)}
                      style={{ width: '100%', resize: 'vertical', fontFamily: 'var(--font-mono)', fontSize: 12 }} />
                  </div>
                  <div className="btn-row">
                    <button className="btn primary" onClick={vfsWrite}>💾 Write</button>
                    <button className="btn" onClick={vfsRead}>📖 Read</button>
                    <button className="btn danger" onClick={vfsDelete}>🗑 Delete</button>
                    <button className="btn" onClick={vfsRefresh}>🔄 List</button>
                  </div>
                  {vfsReadResult && (
                    <>
                      <div className="section-label">Read Result</div>
                      <div className="api-card-result">{vfsReadResult}</div>
                    </>
                  )}
                </div>
                <div className="section">
                  <div className="section-label">VFS Directory ({vfsFiles.length} entries)</div>
                  {vfsFiles.length === 0
                    ? <div style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: 12 }}>Empty — write a file then click List</div>
                    : (
                      <div className="file-list">
                        {vfsFiles.map((f, i) => (
                          <div key={i} className="file-entry" onClick={() => setVfsInput(f)}>
                            <span className="file-icon">📄</span>{f}
                          </div>
                        ))}
                      </div>
                    )
                  }
                  <div className="section-label" style={{ marginTop: 8 }}>How It Works</div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.8 }}>
                    <span style={{ color: 'var(--amber)' }}>Memory cache</span> = instant reads (microseconds)<br/>
                    <span style={{ color: 'var(--green)' }}>OPFS backend</span> = survives page refresh<br/>
                    Nested paths auto-created on write<br/>
                    Runs entirely in Kernel Worker (off main thread)
                  </div>
                </div>
              </div>
            )}

            {/* ── WASM TAB ───────────────────────────────────────────── */}
            {tab === 'wasm' && (
              <div className="panel-split">
                <div className="section">
                  <div className="section-label">Module Control</div>
                  <div className="btn-row">
                    <button className="btn primary" onClick={wasmLoad}>🔗 Load Module</button>
                    {wasmLoaded && <span className="tag green">● LOADED</span>}
                  </div>
                  <div className="section-label">Numeric: add / multiply</div>
                  <div className="input-row">
                    <input className="input" placeholder="A" value={wasmA} onChange={e => setWasmA(e.target.value)} style={{ maxWidth: 80 }} />
                    <input className="input" placeholder="B" value={wasmB} onChange={e => setWasmB(e.target.value)} style={{ maxWidth: 80 }} />
                    <button className="btn" onClick={wasmAdd}>add(A,B)</button>
                    <button className="btn" onClick={wasmMultiply}>×  multiply</button>
                  </div>
                  <div className="section-label">Serde JSON: echo_object</div>
                  <div className="input-row">
                    <input className="input" placeholder="name" value={wasmName} onChange={e => setWasmName(e.target.value)} />
                    <input className="input" placeholder="count" value={wasmCount} onChange={e => setWasmCount(e.target.value)} style={{ maxWidth: 90 }} />
                    <button className="btn primary" onClick={wasmEcho}>▶ echo</button>
                  </div>
                  <div className="section-label">Result</div>
                  <div className="api-card-result" style={{ whiteSpace: 'pre', minHeight: 60 }}>{wasmResult}</div>
                </div>
                <div className="section">
                  <div className="section-label">IPC Stream</div>
                  <Terminal lines={logs} />
                </div>
              </div>
            )}

            {/* ── WASI TAB ───────────────────────────────────────────── */}
            {tab === 'wasi' && (
              <div className="panel-split">
                <div className="section">
                  <div className="section-label">Rust File I/O via WASI Shim</div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.8, marginBottom: 4 }}>
                    When Rust calls <span style={{ color: 'var(--amber)' }}>std::fs::write()</span>, the WASI shim intercepts<br/>
                    and redirects to the R1 VFS. Rust never knows it's in a browser.
                  </div>
                  <div className="input-row">
                    <input className="input" placeholder="/path/to/file.txt" value={wasiPath} onChange={e => setWasiPath(e.target.value)} />
                  </div>
                  <div>
                    <div className="section-label" style={{ marginBottom: 6 }}>Content for Rust to write</div>
                    <textarea className="input" rows={2} value={wasiContent} onChange={e => setWasiContent(e.target.value)}
                      style={{ width: '100%', fontFamily: 'var(--font-mono)', fontSize: 12 }} />
                  </div>
                  <div className="btn-row">
                    <button className="btn primary" onClick={wasiWriteRead}>🦀 write_and_read</button>
                    <button className="btn" onClick={wasiVerifyVfs}>🔍 Verify in VFS</button>
                  </div>
                  <div className="section-label">Result</div>
                  <div className="api-card-result" style={{ whiteSpace: 'pre', minHeight: 60 }}>{wasiResult}</div>
                  <div className="section-label" style={{ marginTop: 8 }}>Architecture</div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.8 }}>
                    Rust → <span style={{ color: 'var(--amber)' }}>wasm32-wasi compile target</span><br/>
                    → wasi_snapshot_preview1 imports (fd_read, fd_write, path_open...)<br/>
                    → <span style={{ color: 'var(--green)' }}>R1 WASI shim catches them</span><br/>
                    → Redirects to VFS.read() / VFS.write()
                  </div>
                </div>
                <div className="section">
                  <div className="section-label">IPC Stream</div>
                  <Terminal lines={logs} />
                </div>
              </div>
            )}

            {/* ── EVENTS TAB ─────────────────────────────────────────── */}
            {tab === 'events' && (
              <div className="panel-split">
                <div className="section">
                  <div className="section-label">Rust → JS Event Bridge</div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.8, marginBottom: 4 }}>
                    Rust calls <span style={{ color: 'var(--amber)' }}>r1::emit("download-progress", payload)</span><br/>
                    The env.r1_emit import fires the R1 EventBus<br/>
                    JS listen() handlers receive structured payloads
                  </div>
                  <div className="btn-row">
                    <button className={`btn ${listenActive ? 'danger' : 'primary'}`} onClick={eventsSubscribe}>
                      {listenActive ? '⛔ Unlisten' : '📡 Listen: download-progress'}
                    </button>
                    {listenActive && <span className="tag green">● ACTIVE</span>}
                  </div>
                  <div className="section-label">Synthetic Fire (Dev Tool)</div>
                  <div className="btn-row">
                    <button className="btn" onClick={emitTestEvent}>🔥 Fire Synthetic Event</button>
                  </div>
                  <div className="section-label" style={{ marginTop: 8 }}>How It Works</div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.8 }}>
                    1. WasmOrchestrator injects <span style={{ color: 'var(--amber)' }}>env.r1_emit</span> at module load<br/>
                    2. Rust calls extern fn r1_emit(name_ptr, name_len, payload_ptr, len)<br/>
                    3. JS reads WASM linear memory at the pointer<br/>
                    4. EventBus fires → all matching listen() handlers called
                  </div>
                </div>
                <div className="section">
                  <div className="section-label">Event Stream</div>
                  <Terminal lines={eventLog} />
                </div>
              </div>
            )}

            {/* ── WINDOW TAB ─────────────────────────────────────────── */}
            {tab === 'window' && (
              <div className="panel-split">
                <div className="section">
                  <div className="section-label">Virtual Window Manager</div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.8, marginBottom: 4 }}>
                    Tauri apps call <span style={{ color: 'var(--amber)' }}>appWindow.setTitle()</span>, minimize(), maximize().<br/>
                    R1 intercepts these via IPC and controls the virtual chrome.
                  </div>
                  <div className="btn-row">
                    <button className="btn primary" onClick={spawnWindow}>🪟 Spawn Window</button>
                  </div>
                  {vWindows.length > 0 && (
                    <>
                      <div className="section-label">Open Windows ({vWindows.length})</div>
                      <div className="file-list">
                        {vWindows.map(w => (
                          <div key={w.id} className="file-entry">
                            <span className="file-icon">🪟</span>
                            <span style={{ flex: 1 }}>{w.title}</span>
                            <button className="btn sm danger" onClick={() => closeVWin(w.id)}>✕</button>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                  <div className="section-label">appWindow.setTitle()</div>
                  <div className="input-row">
                    <input className="input" value={winTitle} onChange={e => setWinTitle(e.target.value)} placeholder="Window title" />
                    <button className="btn primary" onClick={setAppTitle}>Set</button>
                  </div>
                  <div className="section-label" style={{ marginTop: 8 }}>API Surface</div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.8 }}>
                    <span style={{ color: 'var(--amber)' }}>@tauri-apps/api/window</span> imports are resolvedimport<br/>
                    appWindow · WebviewWindow · setTitle · minimize<br/>
                    maximize · close · setFocus · innerSize · outerSize
                  </div>
                </div>
                <div className="section">
                  <div className="section-label">IPC Stream</div>
                  <Terminal lines={logs} />
                </div>
              </div>
            )}

            {/* ── APIS TAB ───────────────────────────────────────────── */}
            {tab === 'apis' && (
              <div className="panel-full">
                <div className="section">
                  <div className="api-grid">
                    {/* Clipboard */}
                    <div className="api-card">
                      <div className="api-card-title">📋 Clipboard API</div>
                      <div className="input-row">
                        <input className="input" value={clipText} onChange={e => setClipText(e.target.value)} />
                      </div>
                      <div className="btn-row">
                        <button className="btn sm primary" onClick={clipWrite}>writeText</button>
                        <button className="btn sm" onClick={clipRead}>readText</button>
                      </div>
                      {clipReadResult && <div className="api-card-result">{clipReadResult}</div>}
                    </div>
                    {/* OS */}
                    <div className="api-card">
                      <div className="api-card-title">🖥 OS API</div>
                      <div className="btn-row">
                        <button className="btn sm primary" onClick={queryOs}>Query System</button>
                      </div>
                      {osResult && <div className="api-card-result">{osResult}</div>}
                    </div>
                    {/* Store */}
                    <div className="api-card">
                      <div className="api-card-title">🗄 Store API (VFS-backed)</div>
                      <div className="input-row">
                        <input className="input" placeholder="key" value={storeKey} onChange={e => setStoreKey(e.target.value)} style={{ maxWidth: 100 }} />
                        <input className="input" placeholder="value" value={storeVal} onChange={e => setStoreVal(e.target.value)} />
                      </div>
                      <div className="btn-row">
                        <button className="btn sm primary" onClick={storeSet}>set</button>
                        <button className="btn sm" onClick={storeGet}>get</button>
                        <button className="btn sm" onClick={storeListKeys}>keys</button>
                      </div>
                      {storeGetResult && <div className="api-card-result">get("{storeKey}") = {storeGetResult}</div>}
                      {storeKeys.length > 0 && <div className="api-card-result">[{storeKeys.join(', ')}]</div>}
                    </div>
                    {/* Dialog */}
                    <div className="api-card">
                      <div className="api-card-title">💬 Dialog API</div>
                      <div className="btn-row">
                        <button className="btn sm primary" onClick={showMessage}>message()</button>
                        <button className="btn sm" onClick={showConfirm}>confirm()</button>
                      </div>
                      {dialogResult && <div className="api-card-result">{dialogResult}</div>}
                    </div>
                    {/* Shell */}
                    <div className="api-card">
                      <div className="api-card-title">🐚 Shell API</div>
                      <div className="input-row">
                        <input className="input" value={shellUrl} onChange={e => setShellUrl(e.target.value)} />
                      </div>
                      <div className="btn-row">
                        <button className="btn sm primary" onClick={shellOpen}>shell.open()</button>
                      </div>
                    </div>
                    {/* Notification */}
                    <div className="api-card">
                      <div className="api-card-title">🔔 Notification API</div>
                      <div className="btn-row">
                        <button className="btn sm" onClick={async () => {
                          const perm = await Notification.requestPermission();
                          log('info', `Notification.requestPermission() = ${perm}`);
                          if (perm === 'granted') {
                            new Notification('R1 Runtime', { body: 'Notification API works in the browser!' });
                            log('ok', 'Notification fired');
                            toast('Notification sent!', 'success');
                          } else {
                            toast('Permission denied', 'error');
                          }
                        }}>requestPermission + send</button>
                      </div>
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)' }}>
                        Uses browser Notification API
                      </div>
                    </div>
                  </div>
                  <div className="section-label" style={{ marginTop: 16 }}>IPC Stream</div>
                  <div style={{ height: 180 }}>
                    <Terminal lines={logs} />
                  </div>
                </div>
              </div>
            )}

            {/* ── SW TAB ─────────────────────────────────────────────── */}
            {tab === 'sw' && (
              <div className="panel-split">
                <div className="section">
                  <div className="section-label">Service Worker Asset Protocol</div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.8, marginBottom: 4 }}>
                    Requests to <span style={{ color: 'var(--amber)' }}>/r1-asset/*</span> are intercepted by<br/>
                    the Service Worker and served from VFS OPFS blobs.
                  </div>
                  <div>
                    <div className="section-label" style={{ marginBottom: 6 }}>HTML to write into VFS</div>
                    <textarea className="input" rows={8} value={swHtml} onChange={e => setSwHtml(e.target.value)}
                      style={{ width: '100%', resize: 'vertical', fontFamily: 'var(--font-mono)', fontSize: 11 }} />
                  </div>
                  <div className="btn-row">
                    <button className="btn primary" onClick={swWrite}>💾 Write to VFS</button>
                    <button className="btn" onClick={swMount}>▶ Preview via SW</button>
                  </div>
                </div>
                <div className="section" style={{ padding: 0 }}>
                  <div className="section-label" style={{ padding: '12px 20px 8px' }}>Sandboxed Preview</div>
                  <iframe
                    src={swPreviewSrc || 'about:blank'}
                    style={{ flex: 1, border: 'none', background: 'var(--bg-input)', width: '100%', minHeight: 0 }}
                    title="SW Preview"
                    sandbox="allow-scripts"
                  />
                </div>
              </div>
            )}

          </div>
        </div>
      </div>

      {/* Boot overlay */}
      {bootStatus !== 'ready' && (
        <div className="boot-overlay">
          <div className="boot-logo">R1</div>
          {bootStatus === 'booting' || bootStatus === 'idle' ? (
            <>
              <div className="boot-message">Initializing R1 Runtime Kernel...</div>
              <div className="progress-bar"><div className="progress-bar-inner" /></div>
            </>
          ) : (
            <>
              <div className="boot-message" style={{ color: 'var(--red)' }}>Kernel Boot Failed</div>
              <div className="boot-error-box">{bootError}</div>
              <button className="btn primary" onClick={() => window.location.reload()}>🔄 Reload</button>
            </>
          )}
        </div>
      )}
    </>
  );
}
