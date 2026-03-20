import { KernelProxy } from './kernel-proxy';
import { installIpcBridge } from './ipc-bridge';

export class R1Runtime {
  private kernelProxy: KernelProxy | null = null;

  /**
   * Boots the R1 Runtime. Must be called before any Tauri APIs are invoked.
   * 
   * @param options - Boot options including WASM and Worker paths.
   */
  async boot(options: { wasmPath?: string, workerUrl?: string, swUrl?: string } = {}): Promise<void> {
    // Step 1 — Request persistent storage
    // Without this, the browser can silently delete OPFS data when
    // the device runs low on storage. This call prevents eviction.
    await this.requestPersistentStorage();

    const { wasmPath, workerUrl = '/sw.js', swUrl = '/r1-sw.js' } = options;
    
    // Check if another instance (possibly from a duplicated module) is already booting
    const win = window as any;
    if (this.kernelProxy || win.__R1_KERNEL_PROXY__) {
      this.kernelProxy = this.kernelProxy || win.__R1_KERNEL_PROXY__;
      return;
    }

    try {
      // Set global booting state immediately
      win.__R1_BOOT_STATUS__ = 'booting';
      console.log('[R1] Booting Kernel...');
      
      // 1. Spawn Kernel Worker
      this.kernelProxy = new KernelProxy(workerUrl);
      win.__R1_KERNEL_PROXY__ = this.kernelProxy;

      // 2. Install IPC Bridge
      installIpcBridge(this.kernelProxy);

      // 3. Register Service Worker interception
      if ('serviceWorker' in navigator) {
        try {
          // Add a timeout to SW registration to prevent hangs
          const swPromise = navigator.serviceWorker.register(swUrl, { scope: '/' });
          const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('SW registration timeout')), 3000));
          
          await Promise.race([swPromise, timeoutPromise]);
          console.log('[R1] Service Worker registered.');
        } catch (e) {
          console.warn('[R1] SW registration skipped or failed:', e);
          // Non-fatal, but we should track it
        }
      }

      // 4. Load developer WASM if provided
      if (wasmPath) {
        console.log(`[R1] Loading WASM from ${wasmPath}...`);
        await this.kernelProxy.send('WASM_LOAD', { name: 'main', url: wasmPath });
      }

      win.__R1_BOOT_STATUS__ = 'ready';
      console.log('[R1] Boot complete.');
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      win.__R1_BOOT_STATUS__ = 'error';
      win.__R1_BOOT_ERROR__ = msg;
      console.error('[R1] Boot failed:', err);
      window.dispatchEvent(new CustomEvent('r1:error', { detail: msg }));
      throw err;
    }
  }

  isBooted(): boolean {
    return (window as any).__R1_BOOT_STATUS__ === 'ready';
  }

  async invoke(type: string, payload: any): Promise<any> {
    return this.kernel.send(type, payload);
  }

  /** Get direct access to the kernel proxy if needed internally */
  get kernel(): KernelProxy {
    const proxy = this.kernelProxy || (window as any).__R1_KERNEL_PROXY__;
    if (!proxy) throw new Error('[R1] Runtime not booted.');
    return proxy;
  }

  private async requestPersistentStorage(): Promise<void> {
    if (!navigator.storage) return;

    try {
      // Check if already persisted
      const alreadyPersisted = await navigator.storage.persisted();
      if (alreadyPersisted) {
        console.log('[R1] Storage: persistent ✓');
        return;
      }

      // Request persistence
      const granted = await navigator.storage.persist();

      if (granted) {
        console.log('[R1] Storage: persistent ✓');
      } else {
        console.warn(
          '[R1] Storage: best-effort only. ' +
          'Data may be cleared by the browser when storage is low. ' +
          'Bookmark this page or install it as a PWA for reliable storage.'
        );
      }
    } catch (err) {
      // Silently fail — browser may not support the API
      console.warn('[R1] Storage: persistence API not available', err);
    }
  }

  /** @internal FOR TESTING ONLY */
  static __TEST_RESET__() {
    const win = window as any;
    delete win.__R1_KERNEL_PROXY__;
    delete win.__R1_BOOT_STATUS__;
  }
}
