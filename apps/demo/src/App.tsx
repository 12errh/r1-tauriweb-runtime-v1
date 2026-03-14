import { useState } from 'react';

export default function App() {
  const [response, setResponse] = useState<string>('');

  const testIpc = async () => {
    try {
      // Simulate Tauri v2 JS API call
      const res = await (window as any).__TAURI_INTERNALS__.invoke('test_command', { value: 42 });
      setResponse(`Success: ${res}`);
    } catch (e) {
      setResponse(`Error: ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', padding: '2rem' }}>
      <h1>R1 TauriWeb Runtime</h1>
      <p>Phase 2 — IPC Bridge is Active.</p>
      
      <button onClick={testIpc} style={{ padding: '0.5rem 1rem', cursor: 'pointer' }}>
        Test Tauri IPC Bridge
      </button>

      {response && (
        <div style={{ marginTop: '1rem', padding: '1rem', background: '#333', color: '#0f0', borderRadius: '4px' }}>
          <code>{response}</code>
        </div>
      )}
    </div>
  );
}
