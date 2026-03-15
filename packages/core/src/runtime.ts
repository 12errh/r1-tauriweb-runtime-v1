import { KernelProxy } from './kernel-proxy';
import { installIpcBridge } from './ipc-bridge';

export class R1Runtime {
  private kernelProxy: KernelProxy | null = null;

  /**
   * Boots the R1 Runtime. Must be called before any Tauri APIs are invoked.
   * 
   * @param workerUrl - The path to the Kernel Worker script. E.g. '/sw.js' or imported worker URL.
   */
  async boot(options: { wasmPath?: string, workerUrl?: string, swUrl?: string } = {}): Promise<void> {
    const { wasmPath, workerUrl = '/sw.js', swUrl = '/r1-sw.js' } = options;
    
    if (this.kernelProxy) {
      console.warn('[R1] Runtime already booted.');
      return;
    }

    console.log('[R1] Booting Kernel...');
    
    // 1. Spawn Kernel Worker
    this.kernelProxy = new KernelProxy(workerUrl);

    // 2. Install IPC Bridge
    installIpcBridge(this.kernelProxy);

    // 3. Register Service Worker interception
    if ('serviceWorker' in navigator) {
      try {
        await navigator.serviceWorker.register(swUrl, { scope: '/' });
        console.log('[R1] Service Worker registered.');
      } catch (e) {
        console.error('[R1] SW registration failed:', e);
      }
    }

    // 4. Load developer WASM if provided
    if (wasmPath) {
      console.log(`[R1] Loading WASM from ${wasmPath}...`);
      await this.kernelProxy.send('WASM_LOAD', { name: 'main', url: wasmPath });
    }

    console.log('[R1] Boot complete.');
  }

  async invoke(type: string, payload: any): Promise<any> {
    return this.kernel.send(type, payload);
  }

  /** Get direct access to the kernel proxy if needed internally */
  get kernel(): KernelProxy {
    if (!this.kernelProxy) throw new Error('[R1] Runtime not booted.');
    return this.kernelProxy;
  }
}
