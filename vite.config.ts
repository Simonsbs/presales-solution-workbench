import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { readFile } from "node:fs/promises";
export default defineConfig({
  plugins: [
    react(),
    {
      name: "local-workbench-docs",
      configureServer(server) {
        server.middlewares.use(async (request, response, next) => {
          const path = (request.url ?? "").split("?")[0],
            allowed = new Map([
              ["/docs/README.md", "README.md"],
              ["/docs/BUILD_NOTES.md", "BUILD_NOTES.md"],
              ["/docs/VALIDATION.md", "VALIDATION.md"],
            ]);
          const file = allowed.get(path);
          if (!file || request.method !== "GET") return next();
          try {
            response.setHeader("Content-Type", "text/markdown; charset=utf-8");
            response.end(await readFile(file));
          } catch {
            next();
          }
        });
      },
    },
  ],
  server: { port: 5176, strictPort: true },
  build: { outDir: ".runtime/client", emptyOutDir: true, sourcemap: true },
});
