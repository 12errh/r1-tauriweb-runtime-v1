import { describe, it, expect, beforeEach, vi } from 'vitest';
import { WindowManager } from './window-manager';

describe('Phase 9: Window Manager & Virtual Window', () => {
    // Mocking DOM globals for Node environment if needed, 
    // but Vitest usually runs with JSDOM or HappyDOM if configured
    
    beforeEach(() => {
        document.body.innerHTML = '';
        // Reset singleton if possible, or just clear container
        const container = document.getElementById('r1-window-container');
        if (container) document.body.removeChild(container);
    });

    it('1. WindowManager creates a window with correct ID and title', () => {
        const wm = WindowManager.getInstance();
        const win = wm.open({
            id: 'test-win',
            title: 'Test Window',
            url: 'about:blank'
        });

        expect(win.element.id).toBe('window-test-win');
        expect(win.element.querySelector('.r1-window-title')?.textContent).toBe('Test Window');
    });

    it('2. Focusing a window brings it to the top (increases z-index)', () => {
        const wm = WindowManager.getInstance();
        const win1 = wm.open({ id: 'win1', title: 'Win 1', url: '' });
        const win2 = wm.open({ id: 'win2', title: 'Win 2', url: '' });

        wm.focus('win1');
        const z1 = parseInt(win1.element.style.zIndex);
        const z2 = parseInt(win2.element.style.zIndex);
        
        expect(z1).toBeGreaterThan(z2);
    });

    it('3. Closing a window removes it from the DOM', () => {
        const wm = WindowManager.getInstance();
        wm.open({ id: 'to-close', title: 'Closing', url: '' });
        
        expect(document.getElementById('window-to-close')).not.toBeNull();
        
        wm.close('to-close');
        expect(document.getElementById('window-to-close')).toBeNull();
    });

    it('4. setTitle updates the chrome title', () => {
        const wm = WindowManager.getInstance();
        const win = wm.open({ id: 'title-test', title: 'Old Title', url: '' });
        
        win.setTitle('New Title');
        expect(win.element.querySelector('.r1-window-title')?.textContent).toBe('New Title');
    });
});
