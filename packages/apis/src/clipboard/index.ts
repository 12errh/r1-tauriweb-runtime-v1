/**
 * R1 Frontend Shim for @tauri-apps/api/clipboard
 */
import { invoke } from '../tauri';

export const writeText = async (text: string): Promise<void> => {
  return invoke('clipboard:write_text', { text });
};

export const readText = async (): Promise<string | null> => {
  return invoke('clipboard:read_text');
};
