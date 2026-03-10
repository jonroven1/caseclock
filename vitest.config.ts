import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    glob: ["**/*.test.ts", "**/*.test.tsx"],
    globals: true,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
