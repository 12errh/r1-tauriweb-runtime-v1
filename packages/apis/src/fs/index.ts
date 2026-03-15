/**
 * R1 Frontend Shim for @tauri-apps/api/fs
 */
import { invoke } from '../tauri';

export const readTextFile = async (path: string): Promise<string> => {
  return invoke('fs:read_text_file', { path });
};

export const writeTextFile = async (path: string, contents: string): Promise<void> => {
  return invoke('fs:write_text_file', { path, contents });
};

export const exists = async (path: string): Promise<boolean> => {
  return invoke('fs:exists', { path });
};
