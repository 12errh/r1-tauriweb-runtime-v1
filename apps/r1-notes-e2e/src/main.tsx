import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

// Wait for R1 to initialize the WASM backend and plugins before rendering
window.addEventListener('r1:ready', () => {
  console.log('[R1 E2E] Runtime ready, rendering app.');
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  );
});
