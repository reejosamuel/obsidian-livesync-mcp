import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: [
      { find: "@lib/worker/bgWorker.ts", replacement: path.resolve(__dirname, "lib/src/worker/bgWorker.mock.ts") },
      { find: "@lib", replacement: path.resolve(__dirname, "lib/src") },
    ],
  },
  test: {
    globals: true,
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
