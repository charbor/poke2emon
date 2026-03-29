import { defineConfig } from "vite";
import solidPlugin from "vite-plugin-solid";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [solidPlugin(), tailwindcss()],
  server: {
    port: 3000,
    proxy: {
      "/api": {
        target: "http://localhost:3001",
        configure: (proxy) => {
          // Flush SSE responses immediately instead of buffering
          proxy.on("proxyRes", (proxyRes, _req, res) => {
            if (proxyRes.headers["content-type"]?.includes("text/event-stream")) {
              proxyRes.on("data", (chunk: Buffer) => {
                (res as import("http").ServerResponse).write(chunk);
              });
              proxyRes.on("end", () => {
                (res as import("http").ServerResponse).end();
              });
            }
          });
        },
      },
    },
  },
  build: {
    target: "esnext",
    outDir: "dist",
  },
});
