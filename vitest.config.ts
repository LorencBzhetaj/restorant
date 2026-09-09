import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
      "server-only": path.resolve(__dirname, "tests/stubs/server-only.ts"),
    },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    // Hard guard: refuse to run against anything but the local test DB.
    setupFiles: ["tests/setup/guard-db.ts"],
    fileParallelism: false,
    testTimeout: 40000,
    hookTimeout: 60000,
  },
});
