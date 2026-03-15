/**
 * R1 Frontend Shim for @tauri-apps/api/os
 */
import { invoke } from '../tauri';

export const platform = async (): Promise<string> => invoke('os:platform');
export const arch = async (): Promise<string> => invoke('os:arch');
export const version = async (): Promise<string> => invoke('os:version');
export const type = async (): Promise<string> => invoke('os:type');
export const hostname = async () => invoke('os:hostname');
