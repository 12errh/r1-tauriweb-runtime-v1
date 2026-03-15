/**
 * R1 Frontend Shim for @tauri-apps/api/window
 */
import { invoke } from '../tauri';

export const appWindow = {
  setTitle: async (title: string) => invoke('window:set_title', { title }),
  close: async () => invoke('window:close'),
  maximize: async () => invoke('window:maximize'),
  minimize: async () => invoke('window:minimize'),
  focus: async () => invoke('window:focus'),
};

export const getCurrent = () => appWindow;

export const getAll = async () => {
  const ids = await invoke<string[]>('window:get_all');
  return ids.map(id => ({ id }));
};
