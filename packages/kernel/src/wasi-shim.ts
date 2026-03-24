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
const ERRNO_EXIST = 20;    // File exists
const ERRNO_NOSYS = 52;    // Function not implemented
const ERRNO_NOTDIR = 54;   // Not a directory
const ERRNO_ISDIR = 31;    // Is a directory

export class WasiShim {
  private vfs: VFS;
  private fds: Map<number, { path: string; pos: number }> = new Map();
  private nextFd = 3;
  private memory?: WebAssembly.Memory;
  private heapStart: number = 0;
  private heapPtr: number = 0;
  private heapLimit: number = 0;

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

  // Capability rights (simplified - allow everything for virtual VFS)
  private static ALL_RIGHTS = 0xFFFFFFFFFFFFFFFFn;

  setMemory(memory: WebAssembly.Memory) {
    this.memory = memory;
    // Initialize heap at the current end of memory to avoid conflicts
    const initialPages = memory.grow(0); // get current size
    this.heapStart = initialPages * 64 * 1024;
    this.heapPtr = this.heapStart;
    this.heapLimit = this.heapStart;
    console.log(`[WasiShim] Heap initialized at 0x${this.heapStart.toString(16)}`);
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
        fd_fdstat_get: this.fd_fdstat_get.bind(this),
        fd_fdstat_set_flags: () => ERRNO_NOSYS,
        fd_fdstat_set_rights: () => ERRNO_NOSYS,
        fd_filestat_get: this.fd_filestat_get.bind(this),
        fd_filestat_set_size: this.fd_filestat_set_size.bind(this),
        fd_filestat_set_times: () => ERRNO_NOSYS,
        fd_pread: () => ERRNO_NOSYS,
        fd_pwrite: () => ERRNO_NOSYS,
        fd_readdir: () => ERRNO_NOSYS,
        fd_renumber: () => ERRNO_NOSYS,
        fd_sync: this.fd_sync.bind(this),
        fd_tell: this.fd_tell.bind(this),
        path_create_directory: this.path_create_directory.bind(this),
        path_filestat_get: this.path_filestat_get.bind(this),
        path_filestat_set_times: () => ERRNO_NOSYS,
        path_link: () => ERRNO_NOSYS,
        path_readlink: () => ERRNO_NOSYS,
        path_remove_directory: () => ERRNO_NOSYS,
        path_rename: this.path_rename.bind(this),
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
        // --- C Standard Library Helpers (Commonly requested by C-dependent libs in 'env') ---
        strcmp: this.strcmp.bind(this),
        strlen: this.strlen.bind(this),
        memmove: this.memmove.bind(this),
        memset: this.memset.bind(this),
        memcpy: this.memcpy.bind(this),
        memcmp: this.memcmp.bind(this),
        strncmp: this.strncmp.bind(this),
        strcspn: this.strcspn.bind(this),
        strspn: this.strspn.bind(this),
        strrchr: this.strrchr.bind(this),
        memchr: this.memchr.bind(this),
        localtime_r: this.localtime_r.bind(this),
        malloc: (size: number) => {
          console.warn("[WasiShim] C code tried to call imported malloc. This should be resolved by Rust instead.");
          return 0;
        },
        free: (ptr: number) => {},
        realloc: (ptr: number, size: number) => 0,
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

  private fd_fdstat_get(fd: number, bufPtr: number): number {
    if (!this.memory) return ERRNO_NOSYS;
    if (!this.fds.has(fd)) return ERRNO_BADF;

    const view = new DataView(this.memory.buffer);
    
    // filetype: 2=char, 3=dir, 4=reg
    let type = 4; 
    if (fd <= 2) type = 2;
    else if (fd === 3) type = 3;

    view.setUint8(bufPtr, type); 
    view.setUint16(bufPtr + 2, 0, true); // fs_flags
    view.setBigUint64(bufPtr + 8, WasiShim.ALL_RIGHTS, true); // base
    view.setBigUint64(bufPtr + 16, WasiShim.ALL_RIGHTS, true); // inheriting
    
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
    if (!this.memory) return ERRNO_INVAL;
    const file = this.fds.get(fd);
    if (!file) return ERRNO_BADF;

    try {
      let len = 0;
      try {
        const data = this.vfs.read(file.path);
        len = data.length;
      } catch {
        len = 0;
      }

      let newPos = BigInt(0);
      const off = offset; // Already BigInt

      if (whence === 0) newPos = off; // SET
      else if (whence === 1) newPos = BigInt(file.pos) + off; // CUR
      else if (whence === 2) newPos = BigInt(len) + off; // END
      else return ERRNO_INVAL;

      if (newPos < 0n) return ERRNO_INVAL;
      file.pos = Number(newPos);

      const view = new DataView(this.memory.buffer);
      view.setBigUint64(new_offset_ptr, newPos, true);
      return ERRNO_SUCCESS;
    } catch (e) {
      return ERRNO_BADF;
    }
  }

  private fd_tell(fd: number, offset_ptr: number): number {
    if (!this.memory) return ERRNO_INVAL;
    const file = this.fds.get(fd);
    if (!file) return ERRNO_BADF;
    
    const view = new DataView(this.memory.buffer);
    view.setBigUint64(offset_ptr, BigInt(file.pos), true);
    return ERRNO_SUCCESS;
  }

  private fd_filestat_get(fd: number, buf_ptr: number): number {
    if (!this.memory) return ERRNO_INVAL;
    const file = this.fds.get(fd);
    if (!file) return ERRNO_BADF;

    try {
      const data = this.vfs.read(file.path);
      const view = new DataView(this.memory.buffer);
      // struct filestat: dev (u64), ino (u64), filetype (u8), nlink (u64), size (u64), atim (u64), mtim (u64), ctim (u64)
      view.setBigUint64(buf_ptr + 0, 0n, true); // dev
      view.setBigUint64(buf_ptr + 8, BigInt(fd), true); // ino
      view.setUint8(buf_ptr + 16, 4); // filetype: regular_file
      view.setBigUint64(buf_ptr + 24, 1n, true); // nlink
      view.setBigUint64(buf_ptr + 32, BigInt(data.length), true); // size
      const now = BigInt(Date.now()) * 1_000_000n;
      view.setBigUint64(buf_ptr + 40, now, true); // atim
      view.setBigUint64(buf_ptr + 48, now, true); // mtim
      view.setBigUint64(buf_ptr + 56, now, true); // ctim
      return ERRNO_SUCCESS;
    } catch (e) {
      return ERRNO_BADF;
    }
  }

  private fd_filestat_set_size(fd: number, size: bigint): number {
    const file = this.fds.get(fd);
    if (!file) return ERRNO_BADF;
    
    try {
        let existing: Uint8Array;
        try {
            existing = this.vfs.read(file.path);
        } catch {
            existing = new Uint8Array(0);
        }

        const newSize = Number(size);
        const newData = new Uint8Array(newSize);
        newData.set(existing.subarray(0, Math.min(existing.length, newSize)));
        
        this.vfs.write(file.path, newData).catch(e => console.error(`[WasiShim] fd_filestat_set_size write failed`, e));
        return ERRNO_SUCCESS;
    } catch (e) {
        return ERRNO_INVAL;
    }
  }

  private fd_sync(fd: number): number {
    const file = this.fds.get(fd);
    if (!file) return ERRNO_BADF;
    // VFS write is already fire-and-forget in fd_write, but here it's explicit
    // Since our VFS is in-memory (indexedDB backed), sync is mostly a no-op 
    // but we can ensure the latest data is written.
    return ERRNO_SUCCESS;
  }

  private path_filestat_get(dirfd: number, flags: number, path_ptr: number, path_len: number, buf_ptr: number): number {
    if (!this.memory) return ERRNO_INVAL;
    const pathBytes = new Uint8Array(this.memory.buffer, path_ptr, path_len);
    const path = VFS.normalize(new TextDecoder().decode(pathBytes));

    if (!this.vfs.exists(path)) return ERRNO_BADF; // Should be ERRNO_NOENT but we use BADF for now as per current shim style

    try {
      const data = this.vfs.read(path);
      const view = new DataView(this.memory.buffer);
      view.setBigUint64(buf_ptr + 0, 0n, true);
      view.setBigUint64(buf_ptr + 8, 0n, true);
      view.setUint8(buf_ptr + 16, 4); // regular_file
      view.setBigUint64(buf_ptr + 24, 1n, true);
      view.setBigUint64(buf_ptr + 32, BigInt(data.length), true);
      const now = BigInt(Date.now()) * 1_000_000n;
      view.setBigUint64(buf_ptr + 40, now, true);
      view.setBigUint64(buf_ptr + 48, now, true);
      view.setBigUint64(buf_ptr + 56, now, true);
      return ERRNO_SUCCESS;
    } catch (e) {
      return ERRNO_BADF;
    }
  }

  private path_rename(old_fd: number, old_path_ptr: number, old_path_len: number, new_fd: number, new_path_ptr: number, new_path_len: number): number {
    if (!this.memory) return ERRNO_INVAL;
    const oldPath = VFS.normalize(new TextDecoder().decode(new Uint8Array(this.memory.buffer, old_path_ptr, old_path_len)));
    const newPath = VFS.normalize(new TextDecoder().decode(new Uint8Array(this.memory.buffer, new_path_ptr, new_path_len)));

    try {
      const data = this.vfs.read(oldPath);
      this.vfs.write(newPath, data).catch(e => console.error(`[WasiShim] path_rename: write failed`, e));
      // path_unlink_file not implemented yet, but we swap it here
      this.vfs.writeText(oldPath, "").catch(e => console.error(`[WasiShim] path_rename: clear old failed`, e)); 
      // Note: Full path_unlink_file should be used when available
      return ERRNO_SUCCESS;
    } catch (e) {
      return ERRNO_BADF;
    }
  }

  private path_open(dirfd: number, dirflags: number, path_ptr: number, path_len: number, oflags: number, fs_rights_base: bigint, fs_rights_inheriting: bigint, fdflags: number, opened_fd_ptr: number): number {
    if (!this.memory) return ERRNO_BADF;

    const view = new DataView(this.memory.buffer);
    const pathBytes = new Uint8Array(this.memory.buffer, path_ptr, path_len);
    const path = VFS.normalize(new TextDecoder().decode(pathBytes));

    const O_CREAT = 1;
    const O_TRUNC = 8;

    const exists = this.vfs.exists(path);

    if (exists) {
        // If it exists, but we want to truncate it
        if (oflags & O_TRUNC) {
            this.vfs.writeText(path, "").catch(e => console.error(`[WasiShim] Failed to truncate ${path}`, e));
        }

        const fd = this.nextFd++;
        this.fds.set(fd, { path, pos: 0 });
        view.setUint32(opened_fd_ptr, fd, true);
        return ERRNO_SUCCESS;
    }

    // If it doesn't exist but we want to create it
    if (oflags & O_CREAT) {
        const fd = this.nextFd++;
        this.fds.set(fd, { path, pos: 0 });
        
        // Ensure parent directories exist
        const parts = path.split('/');
        for(let i=2; i<parts.length; i++){
            const subpath = parts.slice(0, i).join('/');
            if(subpath && !this.vfs.exists(subpath)){
                this.vfs.writeText(subpath + '/.keep', "").catch(() => {});
            }
        }

        // We initialize the file in VFS if it doesn't exist
        this.vfs.writeText(path, "").catch(e => console.error(`[WasiShim] Failed to create ${path}`, e));
        view.setUint32(opened_fd_ptr, fd, true);
        return ERRNO_SUCCESS;
    }

    return ERRNO_BADF;
  }

  private path_create_directory(dirfd: number, path_ptr: number, path_len: number): number {
    if (!this.memory) return ERRNO_INVAL;
    const pathBytes = new Uint8Array(this.memory.buffer, path_ptr, path_len);
    const path = VFS.normalize(new TextDecoder().decode(pathBytes));
    
    // In our simplified VFS, we can "create a directory" by writing a marker file
    this.vfs.writeText(path + '/.keep', "").catch(e => console.error(`[WasiShim] path_create_directory failed`, e));
    return ERRNO_SUCCESS;
  }

  private strcmp(s1: number, s2: number): number {
    if (!this.memory) return 0;
    const view = new Uint8Array(this.memory.buffer);
    const readStr = (ptr: number) => {
        let str = "";
        for (let i = 0; view[ptr + i] !== 0 && i < 1024; i++) {
            str += String.fromCharCode(view[ptr + i]);
        }
        return str;
    };
    const str1 = readStr(s1);
    const str2 = readStr(s2);
    
    let i = 0;
    while (view[s1 + i] !== 0 && view[s1 + i] === view[s2 + i]) {
      i++;
    }
    const res = view[s1 + i] - view[s2 + i];
    
    // Deep tracing for VFS debugging
    if (str1.includes("mem") || str2.includes("mem") || str1.includes("vfs") || str2.includes("vfs")) {
        console.log(`[R1 env] strcmp("${str1}", "${str2}") -> ${res} (VFS Match Attempt)`);
    } else {
        console.log(`[R1 env] strcmp("${str1}", "${str2}") -> ${res}`);
    }
    
    return res;
  }

  private strlen(s: number): number {
    if (!this.memory) return 0;
    const view = new Uint8Array(this.memory.buffer);
    let i = 0;
    while (view[s + i] !== 0) {
      i++;
    }
    return i;
  }

  private memmove(dest: number, src: number, n: number): number {
    if (!this.memory) return dest;
    const buffer = new Uint8Array(this.memory.buffer);
    buffer.copyWithin(dest, src, src + n);
    return dest;
  }

  private memset(s: number, c: number, n: number): number {
    if (!this.memory) return s;
    const buffer = new Uint8Array(this.memory.buffer);
    buffer.fill(c, s, s + n);
    return s;
  }

  private memcpy(dest: number, src: number, n: number): number {
    if (!this.memory) return dest;
    const buffer = new Uint8Array(this.memory.buffer);
    const srcView = buffer.subarray(src, src + n);
    buffer.set(srcView, dest);
    return dest;
  }

  private memcmp(s1: number, s2: number, n: number): number {
    if (!this.memory) return 0;
    const view = new Uint8Array(this.memory.buffer);
    for (let i = 0; i < n; i++) {
        const diff = view[s1 + i] - view[s2 + i];
        if (diff !== 0) return diff;
    }
    return 0;
  }

  private strncmp(s1: number, s2: number, n: number): number {
    if (!this.memory) return 0;
    const view = new Uint8Array(this.memory.buffer);
    for (let i = 0; i < n; i++) {
        const c1 = view[s1 + i];
        const c2 = view[s2 + i];
        if (c1 === 0 || c1 !== c2) return c1 - c2;
    }
    return 0;
  }

  private strcspn(s: number, reject: number): number {
    if (!this.memory) return 0;
    const view = new Uint8Array(this.memory.buffer);
    let i = 0;
    while (view[s + i] !== 0) {
        let j = 0;
        let found = false;
        while (view[reject + j] !== 0) {
            if (view[s + i] === view[reject + j]) {
                found = true;
                break;
            }
            j++;
        }
        if (found) break;
        i++;
    }
    return i;
  }

  private strspn(s: number, accept: number): number {
    if (!this.memory) return 0;
    const view = new Uint8Array(this.memory.buffer);
    let i = 0;
    while (view[s + i] !== 0) {
        let j = 0;
        let found = false;
        while (view[accept + j] !== 0) {
            if (view[s + i] === view[accept + j]) {
                found = true;
                break;
            }
            j++;
        }
        if (!found) break;
        i++;
    }
    return i;
  }

  private strrchr(s: number, c: number): number {
    if (!this.memory) return 0;
    const view = new Uint8Array(this.memory.buffer);
    let last = 0;
    let i = 0;
    while (true) {
        if (view[s + i] === (c & 0xFF)) last = s + i;
        if (view[s + i] === 0) break;
        i++;
    }
    return last;
  }

  private memchr(s: number, c: number, n: number): number {
    if (!this.memory) return 0;
    const view = new Uint8Array(this.memory.buffer);
    for (let i = 0; i < n; i++) {
        if (view[s + i] === (c & 0xFF)) return s + i;
    }
    return 0;
  }

  private localtime_r(timer_ptr: number, result_ptr: number): number {
    if (!this.memory) return 0;
    const view = new DataView(this.memory.buffer);
    // WASI i64 is two i32 in some contexts, but usually transmitted as BigInt or single number
    // For simplicity, we assume BigInt or number.
    const timeInSeconds = Number(view.getBigInt64(timer_ptr, true));
    const date = new Date(timeInSeconds * 1000);

    // struct tm layout (usually):
    // 0: tm_sec (i32)
    // 4: tm_min (i32)
    // 8: tm_hour (i32)
    // 12: tm_mday (i32)
    // 16: tm_mon (i32)
    // 20: tm_year (i32)
    // 24: tm_wday (i32)
    // 28: tm_yday (i32)
    // 32: tm_isdst (i32)
    // 36: tm_gmtoff (i32)
    // 40: tm_zone (i32 pointer)
    
    view.setInt32(result_ptr + 0, date.getSeconds(), true);
    view.setInt32(result_ptr + 4, date.getMinutes(), true);
    view.setInt32(result_ptr + 8, date.getHours(), true);
    view.setInt32(result_ptr + 12, date.getDate(), true);
    view.setInt32(result_ptr + 16, date.getMonth(), true);
    view.setInt32(result_ptr + 20, date.getFullYear() - 1900, true);
    view.setInt32(result_ptr + 24, date.getDay(), true);
    // yday is more complex, we'll skip for now or use 0
    view.setInt32(result_ptr + 28, 0, true);
    view.setInt32(result_ptr + 32, -1, true); // Unknown DST
    
    return result_ptr;
  }

  private realloc(ptr: number, size: number): number {
    return 0;
  }
}

export function createWasiImports(vfs: VFS): WebAssembly.Imports {
  const shim = new WasiShim(vfs);
  return shim.getImports();
}
