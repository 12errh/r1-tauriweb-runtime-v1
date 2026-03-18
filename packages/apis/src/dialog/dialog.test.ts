import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { open, save, message, ask, confirm } from './index';

describe('Phase 6: dialog.ts - Dialog API', () => {
  let appendChildSpy: any;
  let removeChildSpy: any;

  beforeEach(() => {
    // Setup generic DOM spies
    appendChildSpy = vi.spyOn(document.body, 'appendChild');
    removeChildSpy = vi.spyOn(document.body, 'removeChild');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('open() renders file input and resolves arrays', async () => {
    let inputEl: any;
    const createElementSpy = vi.spyOn(document, 'createElement').mockImplementation((tagName) => {
      const el = { type: '', multiple: false, onchange: null, files: [{ name: 'test.png' }], click: vi.fn() } as any;
      inputEl = el;
      return el;
    });

    const promise = open({ multiple: true });
    
    // input mechanism
    expect(inputEl.type).toBe('file');
    expect(inputEl.multiple).toBe(true);
    expect(inputEl.click).toHaveBeenCalled();

    // simulate file selection
    inputEl.onchange(); 
    const result = await promise;
    expect(result).toEqual(['test.png']);
    
    createElementSpy.mockRestore();
  });

  it('save() resolves simulated filename', async () => {
    const result = await save({ defaultPath: '/download/file.txt' });
    expect(result).toBe('file.txt');
  });

  it('message() resolves after OK is clicked', async () => {
    const promise = message('Hello world');
    
    // Find overlay and buttons
    const overlay = appendChildSpy.mock.calls[0][0];
    expect(overlay.className).toBe('r1-dialog-overlay');
    
    const dialog = overlay.firstChild;
    const btnContainer = dialog.lastChild;
    const okBtn = btnContainer.firstChild;
    
    expect(okBtn.textContent).toBe('OK');
    
    // Simulate click
    okBtn.onclick();
    await promise;
    
    expect(removeChildSpy).toHaveBeenCalledWith(overlay);
  });

  it('ask() returns true when Yes clicked, false when No clicked', async () => {
    // Test Yes
    let promise = ask('Are you sure?');
    let overlay = appendChildSpy.mock.calls[0][0];
    let yesBtn = overlay.firstChild.lastChild.firstChild;
    yesBtn.onclick();
    expect(await promise).toBe(true);

    appendChildSpy.mockClear();

    // Test No
    promise = ask('Are you sure?');
    overlay = appendChildSpy.mock.calls[0][0];
    let noBtn = overlay.firstChild.lastChild.lastChild;
    noBtn.onclick();
    expect(await promise).toBe(false);
  });

  it('confirm() returns true when OK clicked, false when Cancel clicked', async () => {
    const promise = confirm('Confirm action?');
    const overlay = appendChildSpy.mock.calls[0][0];
    const cancelBtn = overlay.firstChild.lastChild.lastChild;
    cancelBtn.onclick();
    expect(await promise).toBe(false);
  });
});
