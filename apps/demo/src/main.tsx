import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { WindowManager } from '@r1/window';

// Expose Window Manager globally for the showcase to demonstrate it
(window as any).__R1_WM__ = WindowManager.getInstance();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
