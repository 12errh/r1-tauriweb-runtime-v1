import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as pathUtil from './path_util';
import * as event from './event';
import * as windowApi from './window';
import * as os from './os';
import * as store from './store';

describe('v0.2 API Gaps Verification', () => {
  
  describe('Path API', () => {
    it('exports all special directory functions', () => {
      expect(pathUtil.runtimeDir).toBeDefined();
      expect(pathUtil.configDir).toBeDefined();
      expect(pathUtil.dataDir).toBeDefined();
      expect(pathUtil.cacheDir).toBeDefined();
      expect(pathUtil.logDir).toBeDefined();
      
      // Aliases
      expect(pathUtil.configDir).toBeDefined();
      expect(pathUtil.dataDir).toBeDefined();
    });

    it('directory functions return promises', async () => {
      expect(await pathUtil.runtimeDir()).toBe('/tmp/runtime');
      expect(await pathUtil.configDir()).toBe('/app/config');
    });

    it('relative() calculates path correctly', async () => {
      expect(await pathUtil.relative('/a/b', '/a/c')).toBe('../c');
      expect(await pathUtil.relative('/a/b/c', '/a')).toBe('../..');
      expect(await pathUtil.relative('/a', '/a/b/c')).toBe('b/c');
      expect(await pathUtil.relative('/a', '/a')).toBe('.');
    });

    it('resolve() handles relative and absolute segments', async () => {
      expect(await pathUtil.resolve('/a', 'b', 'c')).toBe('/a/b/c');
      expect(await pathUtil.resolve('/a', '/b', 'c')).toBe('/b/c');
      expect(await pathUtil.resolve('a', 'b')).toBe('a/b');
    });

    it('basename() handles trailing slashes', async () => {
      expect(await pathUtil.basename('/a/b/')).toBe('b');
      expect(await pathUtil.basename('/a/b')).toBe('b');
      expect(await pathUtil.basename('/')).toBe('');
    });
  });

  describe('Event API', () => {
    it('exports top-level named functions', () => {
      expect(event.listen).toBeDefined();
      expect(event.once).toBeDefined();
      expect(event.emit).toBeDefined();
    });

    it('exports TauriEvent enum', () => {
      expect(event.TauriEvent).toBeDefined();
      expect(event.TauriEvent.WINDOW_RESIZED).toBe('tauri://resize');
    });
  });

  describe('Window API', () => {
    it('exports appWindow and WebviewWindow', () => {
      expect(windowApi.appWindow).toBeDefined();
      expect(windowApi.WebviewWindow).toBeDefined();
      expect(windowApi.appWindow.label).toBe('main');
    });
  });

  describe('OS API', () => {
    it('exports top-level named functions', () => {
      expect(os.platform).toBeDefined();
      expect(os.arch).toBeDefined();
      expect(os.version).toBeDefined();
      expect(os.locale).toBeDefined();
      expect(os.hostname).toBeDefined();
    });
  });

  describe('Store API', () => {
    it('exports Store class', () => {
      expect(store.Store).toBeDefined();
      const s = new store.Store('test');
      expect(s.path).toBe('test');
    });
  });
});
