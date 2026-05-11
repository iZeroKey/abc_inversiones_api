import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["src/tests/**/*.test.ts"],
    globalSetup: ["src/tests/setup.ts"],
    testTimeout: 20000,
    fileParallelism: false,
    sequence: {
      concurrent: false,
      shuffle: false,
    },
  },
});
