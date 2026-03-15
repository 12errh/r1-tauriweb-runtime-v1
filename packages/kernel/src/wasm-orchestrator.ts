interface WasmModule {
  instance?: WebAssembly.Instance;
  exports: any;
}

/**
 * WasmOrchestrator runs exclusively inside the Kernel Web Worker.
 * It is responsible for fetching, evaluating, holding, and gracefully proxying 
 * executions into `.wasm` modules deployed via the Module Registry mapping.
 */
export class WasmOrchestrator {
  private modules: Map<string, WasmModule> = new Map();

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
      if (url.endsWith('.js')) {
        // Phase 5: Advanced `wasm-bindgen` JS glue module
        // Import the glue module dynamically
        const jsModule = await import(/* @vite-ignore */ url);
        
        // The WASM binary is natively placed as _bg.wasm adjacent to the bindings file
        const wasmUrl = url.replace('.js', '_bg.wasm');
        const response = await fetch(wasmUrl);
        if (!response.ok) throw new Error(`HTTP ${response.status} fetching ${wasmUrl}`);
        const buffer = await response.arrayBuffer();

        // Instantiate the module seamlessly
        await jsModule.default(buffer);

        this.modules.set(name, { exports: jsModule });

      } else {
        // Phase 4: Raw mathematical compilation payloads
        const response = await fetch(url);
        if (!response.ok) throw new Error(`HTTP ${response.status} fetching ${url}`);

        const importObject = {};
        const buffer = await response.arrayBuffer();
        const result = await WebAssembly.instantiate(buffer, importObject);

        this.modules.set(name, {
          instance: result.instance,
          exports: result.instance.exports
        });
      }
    } catch (error) {
       throw new Error(`[WasmOrchestrator] Failed to load module '${name}': ${(error as Error).message}`);
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
