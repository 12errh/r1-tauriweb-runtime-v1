import { describe, it, expect, beforeEach } from 'vitest';
import { WasiShim } from './wasi-shim';
import { VFS } from './vfs';

describe('WasiShim SQLite Syscall Completion', () => {
  let vfs: VFS;
  let shim: WasiShim;
  let memory: WebAssembly.Memory;

  beforeEach(async () => {
    vfs = new VFS();
    await vfs.init();
    shim = new WasiShim(vfs);
    memory = new WebAssembly.Memory({ initial: 2, maximum: 10 });
    shim.setMemory(memory);
  });

  it('1. fd_seek SEEK_CUR advances position correctly', async () => {
    const path = '/test.txt';
    await vfs.writeText(path, 'hello world');
    
    const imports = shim.getImports();
    const syscalls = imports.wasi_snapshot_preview1 as any;
    
    // Open file
    const opened_fd_ptr = 0;
    const path_ptr = 4;
    new Uint8Array(memory.buffer).set(new TextEncoder().encode(path), path_ptr);
    syscalls.path_open(3, 0, path_ptr, path.length, 0, 0n, 0n, 0, opened_fd_ptr);
    
    const fd = new DataView(memory.buffer).getUint32(opened_fd_ptr, true);
    
    // Seek CUR + 6
    const new_offset_ptr = 8;
    syscalls.fd_seek(fd, 6n, 1, new_offset_ptr);
    
    const newPos = new DataView(memory.buffer).getBigUint64(new_offset_ptr, true);
    expect(newPos).toBe(6n);

    // Read 5 bytes
    const iovs_ptr = 16;
    const buf_ptr = 24;
    const nread_ptr = 32;
    new DataView(memory.buffer).setUint32(iovs_ptr, buf_ptr, true);
    new DataView(memory.buffer).setUint32(iovs_ptr + 4, 5, true);
    
    syscalls.fd_read(fd, iovs_ptr, 1, nread_ptr);
    
    const nread = new DataView(memory.buffer).getUint32(nread_ptr, true);
    expect(nread).toBe(5);
    const result = new TextDecoder().decode(new Uint8Array(memory.buffer, buf_ptr, 5));
    expect(result).toBe('world');
  });

  it('2. fd_filestat_get returns correct file size', async () => {
    const path = '/size.txt';
    const data = new TextEncoder().encode('1234567890');
    await vfs.write(path, data);

    const imports = shim.getImports();
    const syscalls = imports.wasi_snapshot_preview1 as any;

    const opened_fd_ptr = 0;
    const path_ptr = 4;
    new Uint8Array(memory.buffer).set(new TextEncoder().encode(path), path_ptr);
    syscalls.path_open(3, 0, path_ptr, path.length, 0, 0n, 0n, 0, opened_fd_ptr);
    const fd = new DataView(memory.buffer).getUint32(opened_fd_ptr, true);

    const buf_ptr = 64;
    const res = syscalls.fd_filestat_get(fd, buf_ptr);
    expect(res).toBe(0);

    const view = new DataView(memory.buffer);
    const size = view.getBigUint64(buf_ptr + 32, true);
    expect(size).toBe(10n);
  });

  it('3. path_filestat_get returns correct metadata', async () => {
    const path = '/meta.txt';
    await vfs.writeText(path, 'data');

    const imports = shim.getImports();
    const syscalls = imports.wasi_snapshot_preview1 as any;

    const path_ptr = 0;
    const buf_ptr = 64;
    new Uint8Array(memory.buffer).set(new TextEncoder().encode(path), path_ptr);
    
    const res = syscalls.path_filestat_get(3, 0, path_ptr, path.length, buf_ptr);
    expect(res).toBe(0);

    const size = new DataView(memory.buffer).getBigUint64(buf_ptr + 32, true);
    expect(size).toBe(4n);
  });

  it('4. path_rename moves file correctly', async () => {
    const oldPath = '/old.txt';
    const newPath = '/new.txt';
    await vfs.writeText(oldPath, 'content');

    const imports = shim.getImports();
    const syscalls = imports.wasi_snapshot_preview1 as any;

    const old_path_ptr = 0;
    const new_path_ptr = 32;
    new Uint8Array(memory.buffer).set(new TextEncoder().encode(oldPath), old_path_ptr);
    new Uint8Array(memory.buffer).set(new TextEncoder().encode(newPath), new_path_ptr);

    const res = syscalls.path_rename(3, old_path_ptr, oldPath.length, 3, new_path_ptr, newPath.length);
    expect(res).toBe(0);

    // Wait a bit for the async write/delete (though VFS cache is sync)
    // In our simplified path_rename, we clear old file text
    expect(vfs.exists(newPath)).toBe(true);
    const newData = vfs.read(newPath);
    expect(new TextDecoder().decode(newData)).toBe('content');
  });
});
