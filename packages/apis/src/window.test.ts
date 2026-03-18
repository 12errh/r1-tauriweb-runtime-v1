import { describe, it, expect, vi, beforeEach } from 'vitest';
import { appWindow, WebviewWindow } from './window';

describe('Window API', () => {
  beforeEach(() => {
    // Mock the global window object for Node environment
    vi.stubGlobal('window', {
      __TAURI_INTERNALS__: {
        invoke: vi.fn().mockResolvedValue(undefined),
        listen: vi.fn().mockResolvedValue(() => {})
      }
    });
  });

  it('appWindow is instance of WebviewWindow', () => {
    expect(appWindow).toBeInstanceOf(WebviewWindow);
    expect(appWindow.label).toBe('main');
  });

  it('appWindow.setTitle sends correct IPC message', async () => {
    await appWindow.setTitle('New Title');
    expect((window as any).__TAURI_INTERNALS__.invoke).toHaveBeenCalledWith('window:set_title', {
      label: 'main',
      title: 'New Title'
    });
  });
});
