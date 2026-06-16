import { defineConfig } from "vite";
import path from "node:path";

const nodeBuiltins = new Set([
  "fs", "path", "crypto", "events", "async_hooks", "stream", "buffer",
  "string_decoder", "util", "assert", "tty", "os", "url", "http", "https",
  "http2",
  "net", "tls", "zlib", "querystring", "punycode", "child_process",
  "cluster", "dgram", "dns", "domain", "module", "process", "readline",
  "repl", "timers", "tls", "v8", "vm", "worker_threads", "perf_hooks",
  "diagnostics_channel",
]);

export default defineConfig({
  resolve: {
    alias: [
      { find: "@lib/worker/bgWorker.ts", replacement: path.resolve(__dirname, "lib/src/worker/bgWorker.mock.ts") },
      { find: "@lib", replacement: path.resolve(__dirname, "lib/src") },
      { find: "@", replacement: path.resolve(__dirname, "lib/src") },
    ],
  },
  build: {
    outDir: "dist",
    lib: {
      entry: path.resolve(__dirname, "src/index.ts"),
      formats: ["cjs"],
      fileName: "index",
    },
    rollupOptions: {
      external: (id) => {
        if (id.startsWith(".") || id.startsWith("/")) return false;
        if (id.startsWith("@lib/") || id.startsWith("@/")) return false;
        if (nodeBuiltins.has(id)) return true;
        if (id.startsWith("node:")) return true;
        return false;
      },
    },
    minify: false,
  },
  define: {
    self: "globalThis",
    global: "globalThis",
  },
});
