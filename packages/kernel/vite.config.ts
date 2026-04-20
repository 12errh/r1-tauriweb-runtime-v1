import { defineConfig, mergeConfig } from 'vite';
import dts from 'vite-plugin-dts';
import { baseLibConfig } from '../../vite.config.base.ts';

export default mergeConfig(baseLibConfig, defineConfig({
  plugins: [
    dts({ 
      rollupTypes: false,
      skipDiagnostics: true,
      exclude: ['**/*.test.ts', '**/*.spec.ts']
    })
  ],
}));
