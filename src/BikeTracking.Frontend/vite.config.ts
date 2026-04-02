import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vite.dev/config/
export default defineConfig({
  server: {
    host: true,
    open: !process.env.CI,
    port: 5173,
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
