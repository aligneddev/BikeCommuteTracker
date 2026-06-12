import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vite.dev/config/
// Note: Tauri 2 integrates via tauri.conf.json (beforeDevCommand, devUrl, frontendDist).
// No separate @tauri-apps/vite-plugin package exists for Tauri 2; these two settings
// are the only Tauri-required additions to vite.config.ts.
export default defineConfig({
  // Required by Tauri: prevents Vite from clearing the terminal
  clearScreen: false,
  server: {
    host: true,
    open: !process.env.CI,
    port: 5173,
    // Required by Tauri: dev server must bind to the exact port (no fallback)
    strictPort: true,
    hmr: {
      overlay: true, // Show error overlay
    },
  },
  plugins: [react()],

  optimizeDeps: {
    // Use rollupOptions instead of esbuildOptions for Vite 8
    rollupOptions: {
      plugins: [
        // Optional: if you need additional rollup plugins
      ],
    },
  },
  resolve: {
    alias: {
      "@": "/src", // Path aliasing
    },
  },
  css: {
    modules: {
      localsConvention: "camelCase", // CSS Modules support
    },
  },
});
