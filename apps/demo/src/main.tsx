import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { R1Runtime } from '@r1/core';

// Boot the Kernel Worker and install the IPC Bridge
const r1 = new R1Runtime();
// For Vite dev, we point to the compiled worker module
// Later this might be a static sw.js URL
import KernelWorkerUrl from '../../../packages/kernel/src/kernel.worker.ts?url';

r1.boot(KernelWorkerUrl).then(() => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>
  );
});
