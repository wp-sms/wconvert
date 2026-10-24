import { cpSync } from "node:fs";
import { defineConfig } from "vite";
import { fileURLToPath } from "node:url";
export default defineConfig({
  plugins: [
    {
      name: "prototype-artwork",
      closeBundle() {
        cpSync(
          fileURLToPath(new URL("./assets", import.meta.url)),
          fileURLToPath(
            new URL("../out/fresh-50-prototype/assets", import.meta.url),
          ),
          { recursive: true },
        );
      },
    },
  ],
  root: fileURLToPath(new URL(".", import.meta.url)),
  server: {
    host: "127.0.0.1",
    port: 5195,
    strictPort: true,
    fs: { allow: [fileURLToPath(new URL("../../..", import.meta.url))] },
  },
  build: { outDir: "../out/fresh-50-prototype", emptyOutDir: true },
});
