/**
 * R1 Frontend Shim for @tauri-apps/api/dialog
 */
import { invoke } from '../tauri';

export const message = async (msg: string, opts?: any): Promise<void> => {
  return invoke('dialog:message', { message: msg, ...opts });
};

export const ask = async (msg: string, opts?: any): Promise<boolean> => {
  return invoke('dialog:ask', { message: msg, ...opts });
};

export const confirm = async (msg: string, opts?: any): Promise<boolean> => {
  return invoke('dialog:confirm', { message: msg, ...opts });
};
