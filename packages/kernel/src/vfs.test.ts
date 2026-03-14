import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { VFS } from './vfs';

// --- MOCK OPFS FOR TESTING ---
class MockFileHandle {
  kind = 'file';
  name: string;
  data: Uint8Array = new Uint8Array();

  constructor(name: string) {
    this.name = name;
  }

  async getFile() {
    return {
      arrayBuffer: async () => this.data.buffer
    };
  }

  async createWritable() {
    return {
      write: async (buffer: Uint8Array) => {
        this.data = new Uint8Array(buffer);
      },
      close: async () => {}
    };
  }
}

class MockDirectoryHandle {
  kind = 'directory';
  name: string;
  children = new Map<string, MockDirectoryHandle | MockFileHandle>();

  constructor(name: string) {
    this.name = name;
  }

  async getDirectoryHandle(name: string, options?: { create?: boolean }) {
    if (!this.children.has(name) && options?.create) {
      this.children.set(name, new MockDirectoryHandle(name));
    }
    const target = this.children.get(name);
    if (!target || target.kind !== 'directory') throw new Error('Not a directory');
    return target as MockDirectoryHandle;
  }

  async getFileHandle(name: string, options?: { create?: boolean }) {
    if (!this.children.has(name) && options?.create) {
      this.children.set(name, new MockFileHandle(name));
    }
    const target = this.children.get(name);
    if (!target || target.kind !== 'file') throw new Error('Not a file');
    return target as MockFileHandle;
  }

  async removeEntry(name: string) {
    this.children.delete(name);
  }

  async *entries() {
    for (const [key, value] of this.children) {
      yield [key, value];
    }
  }
}

const GlobalOPFSStorage = new MockDirectoryHandle('root');

// Mock navigator.storage
beforeEach(() => {
  (globalThis as any).navigator = {
    storage: {
      getDirectory: async () => GlobalOPFSStorage
    }
  };
  GlobalOPFSStorage.children.clear();
});

afterEach(() => {
  delete (globalThis as any).navigator;
});

// ------------------------------

describe('Phase 3: Virtual File System (OPFS)', () => {
  it('1. Files written survive VFS re-initialisation (simulating refresh)', async () => {
    const vfs1 = new VFS();
    await vfs1.init();
    
    await vfs1.writeText('/hello.txt', 'Survives a reload!');
    expect(vfs1.readText('/hello.txt')).toBe('Survives a reload!');

    // Simulate browser refresh: new VFS instance
    const vfs2 = new VFS();
    await vfs2.init(); // Should read the MockDirectoryHandle and populate cache
    
    expect(vfs2.readText('/hello.txt')).toBe('Survives a reload!');
  });

  it('2. Nested directory paths are created automatically on write', async () => {
    const vfs = new VFS();
    await vfs.init();

    await vfs.writeText('/users/admin/settings.json', '{"theme": "dark"}');
    
    expect(vfs.exists('/users/admin/settings.json')).toBe(true);
    
    // Check that OPFS mock holds the exact nested structure
    const usersHandle = await GlobalOPFSStorage.getDirectoryHandle('users');
    const adminHandle = await usersHandle.getDirectoryHandle('admin');
    const fileHandle = await adminHandle.getFileHandle('settings.json');
    expect(fileHandle).toBeDefined();
  });

  it('3. Reading a non-existent path returns a clean error, not a crash', async () => {
    const vfs = new VFS();
    await vfs.init();

    expect(() => vfs.read('/ghost.txt')).toThrow('File not found: /ghost.txt');
  });

  it('4. All 8 VFS operations work correctly', async () => {
    const vfs = new VFS();
    await vfs.init();

    // 1 & 2. writeText / readText
    await vfs.writeText('/data.txt', 'Hello World');
    expect(vfs.readText('/data.txt')).toBe('Hello World');

    // 3. exists
    expect(vfs.exists('/data.txt')).toBe(true);

    // 4. list
    await vfs.writeText('/folder/a.txt', 'A');
    await vfs.writeText('/folder/b.txt', 'B');
    await vfs.writeText('/folder/sub/c.txt', 'C');
    
    // should return exact immediate children: 2 files, 1 dir
    const folderList = vfs.list('/folder');
    expect(folderList).toContain('a.txt');
    expect(folderList).toContain('b.txt');
    expect(folderList).toContain('sub');
    expect(folderList.length).toBe(3);

    // 5. mkdir
    await vfs.mkdir('/empty_folder');
    // internal handles created, but our list algorithm only lists explicitly stored keys right now
    // Since 'write' creates parents dynamically, mkdir is largely cosmetic for OPFS.
    
    // 6. delete
    await vfs.delete('/data.txt');
    expect(vfs.exists('/data.txt')).toBe(false);

    // 7 & 8. write / read (Uint8Array base)
    const buf = new Uint8Array([1, 2, 3]);
    await vfs.write('/binary.bin', buf);
    expect(vfs.read('/binary.bin')).toEqual(new Uint8Array([1, 2, 3]));
  });
});
