import { fileURLToPath, URL } from "url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

// Test-runner config for the frontend suite. It mirrors the aliases from
// vite.config.js so tests resolve `@/` and `declarations/` the same way the
// app does, and excludes @caffeineai/object-storage from esbuild pre-bundling:
// that package ships extensionless ESM relative imports ("./blob") that esbuild
// cannot resolve during optimization, while Vite's own resolver handles them
// fine when the package is served as-is.
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: [
      {
        find: "declarations",
        replacement: fileURLToPath(new URL("../declarations", import.meta.url)),
      },
      {
        find: "@",
        replacement: fileURLToPath(new URL("./src", import.meta.url)),
      },
    ],
  },
  optimizeDeps: {
    exclude: ["@caffeineai/object-storage"],
  },
  test: {
    environment: "jsdom",
  },
});
