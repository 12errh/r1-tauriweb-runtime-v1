/**
 * A Virtual File System wrapper combining an instant synchronous memory cache
 * with asynchronous background OPFS (Origin Private File System) persistence.
 * Designed purely for the Kernel Web Worker.
 */
export class VFS {
  private cache = new Map<string, Uint8Array>();
  private rootHandle?: FileSystemDirectoryHandle;
  private isInit = false;

  /**
   * Must be called exactly once before any VFS operations.
   * Acquires the OPFS root and deeply scans it to pre-warm the memory cache.
   */
  async init(): Promise<void> {
    if (this.isInit) return;
    
    try {
      this.rootHandle = await navigator.storage.getDirectory();
      await this.scanDirectory(this.rootHandle, '/');
      this.isInit = true;
    } catch (e) {
      console.error('[R1 VFS] Failed to initialize OPFS. Falling back to memory-only mode.', e);
      // We will still work (in RAM), but writes won't persist across reloads.
      this.isInit = true; // Mark True so the API works in RAM degraded mode
    }
  }

  // ------------------------------------------------------------------------
  // CACHE-FIRST / SYNCHRONOUS READ OPERATIONS
  // Operations below resolve instantly using the in-memory Map layer.
  // ------------------------------------------------------------------------

  /** Check if a file exists */
  exists(path: string): boolean {
    this.assertInit();
    return this.cache.has(this.normalize(path));
  }

  /** Read bytes instantly from cache. Throws if not found. */
  read(path: string): Uint8Array {
    this.assertInit();
    const p = this.normalize(path);
    const data = this.cache.get(p);
    if (!data) throw new Error(`File not found: ${p}`);
    return data;
  }

  /** Helper to read UTF-8 strings */
  readText(path: string): string {
    const data = this.read(path);
    return new TextDecoder().decode(data);
  }

  /** List all absolute file or directory paths immediately under a given directory */
  list(dir: string): string[] {
    this.assertInit();
    const p = this.normalize(dir);
    // ensure trailing slash so we only match exactly inside this folder
    const prefix = p === '/' ? p : `${p}/`;
    
    const results = new Set<string>();
    
    for (const key of this.cache.keys()) {
      if (key.startsWith(prefix)) {
        const remainder = key.slice(prefix.length);
        const parts = remainder.split('/');
        
        if (parts.length === 1) {
          if (parts[0]) results.add(parts[0]); // File
        } else {
          if (parts[0]) results.add(parts[0]); // Sub-directory
        }
      }
    }
    
    return Array.from(results);
  }

  // ------------------------------------------------------------------------
  // MUTATING / COMBO OPERATIONS (SYNC RAM + ASYNC OPFS)
  // ------------------------------------------------------------------------

  /**
   * Writes data. Updates in-memory immediately, writes to disk async.
   * Automatically resolves missing parent directories.
   */
  async write(path: string, data: Uint8Array): Promise<void> {
    this.assertInit();
    const p = this.normalize(path);

    // 1. Sync update Memory Cache
    this.cache.set(p, new Uint8Array(data));

    // 2. Async update OPFS (fire & wait)
    if (this.rootHandle) {
      try {
        const parentHandle = await this.resolvePath(p, true);
        const filename = p.split('/').pop()!;
        const fileHandle = await parentHandle.getFileHandle(filename, { create: true });
        
        // OPFS write (cast buffer as exact ArrayBuffer so TS doesn't complain about SharedArrayBuffer overlaps)
        const writable = await fileHandle.createWritable();
        await writable.write(new Uint8Array(data.buffer as ArrayBuffer, data.byteOffset, data.byteLength));
        await writable.close();
      } catch (e) {
        console.error(`[R1 VFS] OPFS Write Failed for ${p}:`, e);
      }
    }
  }

  /** Helper to write UTF-8 strings */
  async writeText(path: string, text: string): Promise<void> {
    const data = new TextEncoder().encode(text);
    await this.write(path, data);
  }

  /** Emulates directory creation. In this architecture, writes auto-create parents, so this is just for strict APIs. */
  async mkdir(dir: string): Promise<void> {
    this.assertInit();
    const p = this.normalize(dir);
    if (this.rootHandle && p !== '/') {
      await this.resolvePath(p + '/dummy', true); // Force parent creation
    }
  }

  /** Deletes a file. Removes from cache immediately, deletes from OPFS async. */
  async delete(path: string): Promise<void> {
    this.assertInit();
    const p = this.normalize(path);
    
    if (!this.cache.has(p)) throw new Error(`File not found: ${p}`);
    this.cache.delete(p);

    if (this.rootHandle) {
      try {
        const parentHandle = await this.resolvePath(p, false);
        const filename = p.split('/').pop()!;
        await parentHandle.removeEntry(filename);
        
        // Remove empty directories recursively upward could go here, omitting for simplicity
      } catch (e) {
        console.error(`[R1 VFS] OPFS Delete Failed for ${p}:`, e);
      }
    }
  }


  // ------------------------------------------------------------------------
  // PRIVATE INTERNALS
  // ------------------------------------------------------------------------

  private assertInit() {
    if (!this.isInit) throw new Error('[R1 VFS] Cannot perform operations: VFS is not initialized. Call init() first.');
  }

  private normalize(path: string): string {
    let p = path.replace(/\\/g, '/'); // normalize backslashes
    if (!p.startsWith('/')) p = '/' + p; // ensure leading root
    if (p.endsWith('/') && p !== '/') p = p.slice(0, -1); // prevent trailing slashes
    return p;
  }

  /**
   * Deep scans an OPFS DirectoryHandle and populates the Memory Cache recursively.
   */
  private async scanDirectory(dirHandle: FileSystemDirectoryHandle, currentPath: string) {
    // @ts-ignore - The iterators exist on OPFS handles
    for await (const [name, handle] of dirHandle.entries()) {
      const fullPath = currentPath === '/' ? `/${name}` : `${currentPath}/${name}`;
      
      if (handle.kind === 'file') {
        const file = await (handle as FileSystemFileHandle).getFile();
        const buffer = await file.arrayBuffer();
        this.cache.set(fullPath, new Uint8Array(buffer));
      } else if (handle.kind === 'directory') {
        await this.scanDirectory(handle as FileSystemDirectoryHandle, fullPath);
      }
    }
  }

  /**
   * Traverses segment path to get the *parent directory* FileSystemDirectoryHandle.
   * Required because OPFS works rigidly hierarchy-by-hierarchy.
   * e.g., for `/docs/text/abc.txt`, returns the handle for `/docs/text/`.
   */
  private async resolvePath(path: string, createDirectories: boolean): Promise<FileSystemDirectoryHandle> {
    const parts = path.split('/').filter(Boolean);
    parts.pop(); // remove the filename segment
    
    let current = this.rootHandle!;
    
    for (const folder of parts) {
      current = await current.getDirectoryHandle(folder, { create: createDirectories });
    }
    
    return current;
  }
}
