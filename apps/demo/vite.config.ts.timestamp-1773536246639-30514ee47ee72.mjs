// vite.config.ts
import { defineConfig } from "file:///D:/r1tauriruntime/node_modules/vite/dist/node/index.js";
import react from "file:///D:/r1tauriruntime/node_modules/@vitejs/plugin-react/dist/index.js";
import { resolve } from "path";
import { r1VitePlugin } from "file:///D:/r1tauriruntime/packages/vite-plugin/src/index.ts";
var __vite_injected_original_dirname = "D:\\r1tauriruntime\\apps\\demo";
var vite_config_default = defineConfig({
  plugins: [react(), r1VitePlugin()],
  resolve: {
    alias: {
      "@r1/core": resolve(__vite_injected_original_dirname, "../../packages/core/src/index.ts"),
      "@r1/kernel/worker": resolve(__vite_injected_original_dirname, "../../packages/kernel/src/kernel.worker.ts"),
      "@r1/kernel": resolve(__vite_injected_original_dirname, "../../packages/kernel/src/index.ts"),
      "@r1/apis": resolve(__vite_injected_original_dirname, "../../packages/apis/src/index.ts"),
      "@r1/window": resolve(__vite_injected_original_dirname, "../../packages/window/src/index.ts"),
      "@r1/sw": resolve(__vite_injected_original_dirname, "../../packages/sw/src/index.ts"),
      "@r1/vite-plugin": resolve(__vite_injected_original_dirname, "../../packages/vite-plugin/src/index.ts")
    }
  }
});
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCJEOlxcXFxyMXRhdXJpcnVudGltZVxcXFxhcHBzXFxcXGRlbW9cIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfZmlsZW5hbWUgPSBcIkQ6XFxcXHIxdGF1cmlydW50aW1lXFxcXGFwcHNcXFxcZGVtb1xcXFx2aXRlLmNvbmZpZy50c1wiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9pbXBvcnRfbWV0YV91cmwgPSBcImZpbGU6Ly8vRDovcjF0YXVyaXJ1bnRpbWUvYXBwcy9kZW1vL3ZpdGUuY29uZmlnLnRzXCI7aW1wb3J0IHsgZGVmaW5lQ29uZmlnIH0gZnJvbSAndml0ZSc7XG5pbXBvcnQgcmVhY3QgZnJvbSAnQHZpdGVqcy9wbHVnaW4tcmVhY3QnO1xuaW1wb3J0IHsgcmVzb2x2ZSB9IGZyb20gJ3BhdGgnO1xuaW1wb3J0IHsgcjFWaXRlUGx1Z2luIH0gZnJvbSAnQHIxL3ZpdGUtcGx1Z2luJztcblxuZXhwb3J0IGRlZmF1bHQgZGVmaW5lQ29uZmlnKHtcbiAgcGx1Z2luczogW3JlYWN0KCksIHIxVml0ZVBsdWdpbigpXSxcbiAgcmVzb2x2ZToge1xuICAgIGFsaWFzOiB7XG4gICAgICAnQHIxL2NvcmUnOiByZXNvbHZlKF9fZGlybmFtZSwgJy4uLy4uL3BhY2thZ2VzL2NvcmUvc3JjL2luZGV4LnRzJyksXG4gICAgICAnQHIxL2tlcm5lbC93b3JrZXInOiByZXNvbHZlKF9fZGlybmFtZSwgJy4uLy4uL3BhY2thZ2VzL2tlcm5lbC9zcmMva2VybmVsLndvcmtlci50cycpLFxuICAgICAgJ0ByMS9rZXJuZWwnOiByZXNvbHZlKF9fZGlybmFtZSwgJy4uLy4uL3BhY2thZ2VzL2tlcm5lbC9zcmMvaW5kZXgudHMnKSxcbiAgICAgICdAcjEvYXBpcyc6IHJlc29sdmUoX19kaXJuYW1lLCAnLi4vLi4vcGFja2FnZXMvYXBpcy9zcmMvaW5kZXgudHMnKSxcbiAgICAgICdAcjEvd2luZG93JzogcmVzb2x2ZShfX2Rpcm5hbWUsICcuLi8uLi9wYWNrYWdlcy93aW5kb3cvc3JjL2luZGV4LnRzJyksXG4gICAgICAnQHIxL3N3JzogcmVzb2x2ZShfX2Rpcm5hbWUsICcuLi8uLi9wYWNrYWdlcy9zdy9zcmMvaW5kZXgudHMnKSxcbiAgICAgICdAcjEvdml0ZS1wbHVnaW4nOiByZXNvbHZlKF9fZGlybmFtZSwgJy4uLy4uL3BhY2thZ2VzL3ZpdGUtcGx1Z2luL3NyYy9pbmRleC50cycpLFxuICAgIH0sXG4gIH0sXG59KTtcbiJdLAogICJtYXBwaW5ncyI6ICI7QUFBMlEsU0FBUyxvQkFBb0I7QUFDeFMsT0FBTyxXQUFXO0FBQ2xCLFNBQVMsZUFBZTtBQUN4QixTQUFTLG9CQUFvQjtBQUg3QixJQUFNLG1DQUFtQztBQUt6QyxJQUFPLHNCQUFRLGFBQWE7QUFBQSxFQUMxQixTQUFTLENBQUMsTUFBTSxHQUFHLGFBQWEsQ0FBQztBQUFBLEVBQ2pDLFNBQVM7QUFBQSxJQUNQLE9BQU87QUFBQSxNQUNMLFlBQVksUUFBUSxrQ0FBVyxrQ0FBa0M7QUFBQSxNQUNqRSxxQkFBcUIsUUFBUSxrQ0FBVyw0Q0FBNEM7QUFBQSxNQUNwRixjQUFjLFFBQVEsa0NBQVcsb0NBQW9DO0FBQUEsTUFDckUsWUFBWSxRQUFRLGtDQUFXLGtDQUFrQztBQUFBLE1BQ2pFLGNBQWMsUUFBUSxrQ0FBVyxvQ0FBb0M7QUFBQSxNQUNyRSxVQUFVLFFBQVEsa0NBQVcsZ0NBQWdDO0FBQUEsTUFDN0QsbUJBQW1CLFFBQVEsa0NBQVcseUNBQXlDO0FBQUEsSUFDakY7QUFBQSxFQUNGO0FBQ0YsQ0FBQzsiLAogICJuYW1lcyI6IFtdCn0K
