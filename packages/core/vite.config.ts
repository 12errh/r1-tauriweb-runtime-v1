import { defineConfig, mergeConfig } from 'vite';
import { baseLibConfig } from '../../vite.config.base.ts';

export default mergeConfig(baseLibConfig, defineConfig({}));
