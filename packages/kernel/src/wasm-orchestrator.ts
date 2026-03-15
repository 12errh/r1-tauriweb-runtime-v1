import { VFS } from './vfs';
import { WasiShim } from './wasi-shim';
import type { Router } from './router';

interface WasmModule {
  instance?: WebAssembly.Instance;
  exports: any;
  wasi?: WasiShim;
}

/**
 * WasmOrchestrator runs exclusively inside the Kernel Web Worker.
 * It is responsible for fetching, evaluating, holding, and gracefully proxying 
 * executions into `.wasm` modules deployed via the Module Registry mapping.
 */
export class WasmOrchestrator {
  private modules: Map<string, WasmModule> = new Map();
  private vfs: VFS;
  private router: Router;
  private onEvent: (event: string, payload: any) => void;

  constructor(vfs: VFS, router: Router, onEvent: (event: string, payload: any) => void) {
    this.vfs = vfs;
    this.router = router;
    this.onEvent = onEvent;
  }

  private readString(memory: WebAssembly.Memory, ptr: number, len: number): string {
    const buffer = new Uint8Array(memory.buffer, ptr, len);
    return new TextDecoder().decode(buffer);
  }

  /**
   * Instantiates a WASM module and caches it in memory under `name`.
   * Unloads any currently mapped instance holding that `name`.
   * @param name - Module identifier string mapping (e.g. 'my-app')
   * @param url - URL to either raw `.wasm` (Phase 4) or `.js` glue (Phase 5)
   */
  async loadModule(name: string, url: string): Promise<void> {
    if (this.modules.has(name)) {
      this.unloadModule(name);
    }

    try {
      const wasi = new WasiShim(this.vfs);
      
      const createEnv = (instanceGetter: () => WebAssembly.Instance | undefined) => ({
        r1_emit: (namePtr: number, nameLen: number, payloadPtr: number, payloadLen: number) => {
          const instance = instanceGetter();
          if (!instance) return;
          const memory = instance.exports.memory as WebAssembly.Memory;
          const eventName = this.readString(memory, namePtr, nameLen);
          const payloadString = this.readString(memory, payloadPtr, payloadLen);
          
          let payload;
          try {
            payload = JSON.parse(payloadString);
          } catch {
            payload = payloadString;
          }
          this.onEvent(eventName, payload);
        }
      });

      if (url.endsWith('.js')) {
        // Phase 5: Advanced `wasm-bindgen` JS glue module
        const jsModule = await import(/* @vite-ignore */ url);
        
        const wasmUrl = url.replace('.js', '_bg.wasm');
        const response = await fetch(wasmUrl);
        if (!response.ok) throw new Error(`HTTP ${response.status} fetching ${wasmUrl}`);
        const buffer = await response.arrayBuffer();

        // For wasm-bindgen, we might need to satisfy its imports.
        // Usually, wasm-bindgen's load script handles imports.
        // But if we want to inject OUR imports into it, we might need to wrap the instantiation.
        // However, standard wasm-bindgen (target web) doesn't use extern "C" imports directly easily 
        // without some glue. 
        // For Phase 7, we'll focus on the raw WASM case and assume wasm-bindgen can use it too 
        // if we merge the import objects.
        
        let instanceRef: WebAssembly.Instance | undefined;
        const imports = {
            ...wasi.getImports(),
            env: createEnv(() => instanceRef)
        };

        // Note: jsModule.default usually takes (buffer, imports)
        const wasmInstance = await jsModule.default(buffer, imports);
        instanceRef = wasmInstance; // capturing for the closure

        if (wasmInstance && wasmInstance.memory) {
            wasi.setMemory(wasmInstance.memory);
        }

        this.modules.set(name, { exports: jsModule, wasi });
        this.registerModuleCommands(name, jsModule);

      } else {
        // Phase 4 & 6: Raw WASI compilation payloads
        const response = await fetch(url);
        if (!response.ok) throw new Error(`HTTP ${response.status} fetching ${url}`);

        let instanceRef: WebAssembly.Instance | undefined;
        const importObject = {
            ...wasi.getImports(),
            env: createEnv(() => instanceRef)
        };

        const buffer = await response.arrayBuffer();
        const result = await WebAssembly.instantiate(buffer, importObject);

        const instance = result.instance;
        instanceRef = instance;

        if (instance.exports.memory instanceof WebAssembly.Memory) {
            wasi.setMemory(instance.exports.memory);
        }

        this.modules.set(name, {
          instance: instance,
          exports: instance.exports,
          wasi
        });

        this.registerModuleCommands(name, instance.exports);
      }
    } catch (error) {
       throw new Error(`[WasmOrchestrator] Failed to load module '${name}': ${(error as Error).message}`);
    }
  }

  /**
   * Auto-discovers exported functions and registers them in the kernel router.
   */
  private registerModuleCommands(moduleName: string, exports: any) {
    for (const [fnName, func] of Object.entries(exports)) {
      if (typeof func === 'function' && !fnName.startsWith('__') && fnName !== 'default') {
        const fullCmdName = `${moduleName}:${fnName}`;
        this.router.register(fullCmdName, async (payload: any) => {
          // If payload is an array, assume positional arguments. 
          // If it's a single value/object, wrap it.
          const args = Array.isArray(payload) ? payload : [payload];
          return this.callFunction(moduleName, fnName, args);
        });
      }
    }
  }

  /**
   * Evaluates an exported WebAssembly function and wraps panics cleanly.
   * If invoking using complex JS Objects, the Serde JSON contract automatically translates strings seamlessly.
   */
  callFunction(moduleName: string, fnName: string, args: unknown[] = []): any {
    const wasm = this.modules.get(moduleName);
    if (!wasm) throw new Error(`[WasmOrchestrator] Module '${moduleName}' is not loaded.`);

    const func = wasm.exports[fnName];
    if (typeof func !== 'function') throw new Error(`[WasmOrchestrator] Function '${fnName}' not exported by '${moduleName}'.`);

    try {
      // JSON Contract Rule: If the first argument is an Object (not an array/primitive),
      // stringify it inherently and unpack the '{ ok, error }' response securely.
      if (args.length === 1 && typeof args[0] === 'object' && !Array.isArray(args[0]) && args[0] !== null) {
        const jsonString = JSON.stringify(args[0]);
        const responseString = (func as Function)(jsonString);
        
        let parsed;
        try {
          parsed = JSON.parse(responseString);
        } catch (e) {
          throw new Error(`Invalid JSON syntax returned from WASM: ${responseString}`);
        }

        if (parsed.error !== undefined) {
          throw new Error(parsed.error);
        }
        return parsed.ok;
      }

      // Raw array / primitives evaluation mapping (Phase 4)
      return (func as Function)(...args);
    } catch (e) {
      // WASM trap errors surface into Javascript here perfectly. 
      // Wrapping this cleanly means the entire Kernel thread doesn't destruct wildly.
      const msg = e instanceof Error ? e.message : String(e);
      throw new Error(`[WasmOrchestrator] WASM Panic in ${moduleName}::${fnName}: ${msg}`);
    }
  }

  /**
   * Dropping references allows the V8 garbage collector to evict WebAssembly memory.
   */
  unloadModule(name: string): void {
    if (!this.modules.has(name)) {
      console.warn(`[WasmOrchestrator] unloadModule called for unknown module '${name}'`);
      return;
    }
    this.modules.delete(name);
  }
}
