/**
 * WASI (WebAssembly System Interface) Shim for R1 Runtime.
 * 
 * Maps standard Rust `std::fs` and `println!` calls to our VFS and Kernel loggers.
 * Follows the `wasi_snapshot_preview1` specification.
 */

import { VFS } from './vfs';

// --- WASI Constants (Snapshot Preview 1) ---
const ERRNO_SUCCESS = 0;
const ERRNO_BADF = 8;      // Bad file descriptor
const ERRNO_INVAL = 28;    // Invalid argument
const ERRNO_NOSYS = 52;    // Function not implemented

export class WasiShim {
  private vfs: VFS;
  private fds: Map<number, { path: string; pos: number }> = new Map();
  private nextFd = 3;
  private memory?: WebAssembly.Memory;

  constructor(vfs: VFS) {
    this.vfs = vfs;
    // Standard I/O (stubs)
    this.fds.set(0, { path: '<stdin>', pos: 0 });
    this.fds.set(1, { path: '<stdout>', pos: 0 });
    this.fds.set(2, { path: '<stderr>', pos: 0 });
    // Preopened root
    this.fds.set(3, { path: '/', pos: 0 });
    this.nextFd = 4;
  }

  setMemory(memory: WebAssembly.Memory) {
    this.memory = memory;
  }

  getImports(): WebAssembly.Imports {
    return {
      wasi_snapshot_preview1: {
        fd_write: this.fd_write.bind(this),
        fd_read: this.fd_read.bind(this),
        fd_close: this.fd_close.bind(this),
        fd_seek: this.fd_seek.bind(this),
        path_open: this.path_open.bind(this),
        proc_exit: (code: number) => {
          throw new Error(`WASI proc_exit called with code ${code}`);
        },
        fd_prestat_get: (fd: number, bufPtr: number) => {
            if (fd !== 3) return ERRNO_BADF;
            if (!this.memory) return ERRNO_NOSYS;
            const view = new DataView(this.memory.buffer);
            // Prestat type 0 = dir
            view.setUint8(bufPtr, 0); 
            // Name length for "/"
            view.setUint32(bufPtr + 4, 1, true);
            return ERRNO_SUCCESS;
        },
        fd_prestat_dir_name: (fd: number, pathPtr: number, pathLen: number) => {
            if (fd !== 3) return ERRNO_BADF;
            if (!this.memory) return ERRNO_NOSYS;
            const buffer = new Uint8Array(this.memory.buffer, pathPtr, pathLen);
            buffer[0] = "/".charCodeAt(0);
            return ERRNO_SUCCESS;
        },
        // --- STUBS ---
        args_get: () => ERRNO_NOSYS,
        args_sizes_get: () => ERRNO_NOSYS,
        environ_get: () => ERRNO_NOSYS,
        environ_sizes_get: () => ERRNO_NOSYS,
        clock_res_get: () => ERRNO_NOSYS,
        clock_time_get: (clockId: number, precision: bigint, timePtr: number) => {
          if (!this.memory) return ERRNO_NOSYS;
          const view = new DataView(this.memory.buffer);
          // BigInt(Date.now() * 1_000_000) for nanoseconds
          view.setBigUint64(timePtr, BigInt(Date.now()) * 1000000n, true);
          return ERRNO_SUCCESS;
        },
        fd_advise: () => ERRNO_NOSYS,
        fd_allocate: () => ERRNO_NOSYS,
        fd_datasync: () => ERRNO_NOSYS,
        fd_fdstat_get: () => ERRNO_NOSYS,
        fd_fdstat_set_flags: () => ERRNO_NOSYS,
        fd_fdstat_set_rights: () => ERRNO_NOSYS,
        fd_filestat_get: () => ERRNO_NOSYS,
        fd_filestat_set_size: () => ERRNO_NOSYS,
        fd_filestat_set_times: () => ERRNO_NOSYS,
        fd_pread: () => ERRNO_NOSYS,
        fd_pwrite: () => ERRNO_NOSYS,
        fd_readdir: () => ERRNO_NOSYS,
        fd_renumber: () => ERRNO_NOSYS,
        fd_sync: () => ERRNO_NOSYS,
        fd_tell: () => ERRNO_NOSYS,
        path_create_directory: () => ERRNO_NOSYS,
        path_filestat_get: () => ERRNO_NOSYS,
        path_filestat_set_times: () => ERRNO_NOSYS,
        path_link: () => ERRNO_NOSYS,
        path_readlink: () => ERRNO_NOSYS,
        path_remove_directory: () => ERRNO_NOSYS,
        path_rename: () => ERRNO_NOSYS,
        path_symlink: () => ERRNO_NOSYS,
        path_unlink_file: () => ERRNO_NOSYS,
        poll_oneoff: () => ERRNO_NOSYS,
        random_get: (bufPtr: number, bufLen: number) => {
          if (!this.memory) return ERRNO_NOSYS;
          const buffer = new Uint8Array(this.memory.buffer, bufPtr, bufLen);
          crypto.getRandomValues(buffer);
          return ERRNO_SUCCESS;
        },
        sched_yield: () => ERRNO_NOSYS,
        sock_recv: () => ERRNO_NOSYS,
        sock_send: () => ERRNO_NOSYS,
        sock_shutdown: () => ERRNO_NOSYS,
      }
    };
  }

  // --- Syscall Implementations ---

  private fd_write(fd: number, iovs_ptr: number, iovs_len: number, nwritten_ptr: number): number {
    if (!this.memory) return ERRNO_BADF;
    
    const view = new DataView(this.memory.buffer);
    let totalWritten = 0;

    for (let i = 0; i < iovs_len; i++) {
        const ptr = view.getUint32(iovs_ptr + i * 8, true);
        const len = view.getUint32(iovs_ptr + i * 8 + 4, true);
        const data = new Uint8Array(this.memory.buffer, ptr, len);

        if (fd === 1 || fd === 2) {
            // Stdout/Stderr - log to kernel console
            const text = new TextDecoder().decode(data);
            if (fd === 1) console.log(`[WASI stdout] ${text}`);
            else console.error(`[WASI stderr] ${text}`);
        } else {
            // Real file write
            const file = this.fds.get(fd);
            if (!file) return ERRNO_BADF;
            
            let existing: Uint8Array;
            try {
                existing = this.vfs.read(file.path);
            } catch {
                existing = new Uint8Array(0);
            }

            const newSize = Math.max(existing.length, file.pos + len);
            const merged = new Uint8Array(newSize);
            merged.set(existing);
            merged.set(data, file.pos);

            // fire and forget disk sync, but VFS cache is updated synchronously
            this.vfs.write(file.path, merged).catch(e => console.error(`[WasiShim] VFS write failed`, e));
            file.pos += len;
        }
        totalWritten += len;
    }

    view.setUint32(nwritten_ptr, totalWritten, true);
    return ERRNO_SUCCESS;
  }

  private fd_read(fd: number, iovs_ptr: number, iovs_len: number, nread_ptr: number): number {
    if (!this.memory) return ERRNO_BADF;
    const file = this.fds.get(fd);
    if (!file) return ERRNO_BADF;

    try {
      const data = this.vfs.read(file.path);
      const view = new DataView(this.memory.buffer);
      let totalRead = 0;

      for (let i = 0; i < iovs_len; i++) {
        const ptr = view.getUint32(iovs_ptr + i * 8, true);
        const len = view.getUint32(iovs_ptr + i * 8 + 4, true);
        
        const remaining = data.length - file.pos;
        const toRead = Math.min(len, remaining);

        if (toRead > 0) {
          const buffer = new Uint8Array(this.memory.buffer, ptr, toRead);
          buffer.set(data.subarray(file.pos, file.pos + toRead));
          file.pos += toRead;
          totalRead += toRead;
        }

        if (toRead < len) break; // EOF or buffer full
      }

      view.setUint32(nread_ptr, totalRead, true);
      return ERRNO_SUCCESS;
    } catch (e) {
      return ERRNO_BADF;
    }
  }

  private fd_close(fd: number): number {
    if (fd < 3) return ERRNO_SUCCESS;
    if (this.fds.has(fd)) {
      this.fds.delete(fd);
      return ERRNO_SUCCESS;
    }
    return ERRNO_BADF;
  }

  private fd_seek(fd: number, offset: bigint, whence: number, new_offset_ptr: number): number {
    if (!this.memory) return ERRNO_BADF;
    const file = this.fds.get(fd);
    if (!file) return ERRNO_BADF;

    try {
      const data = this.vfs.read(file.path);
      let newPos = 0;
      const off = Number(offset);

      if (whence === 0) newPos = off; // SET
      else if (whence === 1) newPos = file.pos + off; // CUR
      else if (whence === 2) newPos = data.length + off; // END
      else return ERRNO_INVAL;

      if (newPos < 0) return ERRNO_INVAL;
      file.pos = newPos;

      const view = new DataView(this.memory.buffer);
      view.setBigUint64(new_offset_ptr, BigInt(newPos), true);
      return ERRNO_SUCCESS;
    } catch (e) {
      return ERRNO_BADF;
    }
  }

  private path_open(dirfd: number, dirflags: number, path_ptr: number, path_len: number, oflags: number, fs_rights_base: bigint, fs_rights_inheriting: bigint, fdflags: number, opened_fd_ptr: number): number {
    if (!this.memory) return ERRNO_BADF;

    const view = new DataView(this.memory.buffer);
    const pathBytes = new Uint8Array(this.memory.buffer, path_ptr, path_len);
    const path = new TextDecoder().decode(pathBytes);

    // TODO: Handle oflags (create if not exists, etc.)
    // For now, we assume simple path resolution
    if (this.vfs.exists(path)) {
      const fd = this.nextFd++;
      this.fds.set(fd, { path, pos: 0 });
      view.setUint32(opened_fd_ptr, fd, true);
      return ERRNO_SUCCESS;
    }

    // If it doesn't exist but we want to create it
    if (oflags & 1) { // WASI_O_CREAT
        const fd = this.nextFd++;
        this.fds.set(fd, { path, pos: 0 });
        // We initialize the file in VFS if it doesn't exist
        this.vfs.writeText(path, "").catch(e => console.error(`[WasiShim] Failed to create ${path}`, e));
        view.setUint32(opened_fd_ptr, fd, true);
        return ERRNO_SUCCESS;
    }

    return ERRNO_BADF;
  }
}

export function createWasiImports(vfs: VFS): WebAssembly.Imports {
  const shim = new WasiShim(vfs);
  return shim.getImports();
}
