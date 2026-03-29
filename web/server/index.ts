import { runPipeline } from "./pipeline";
import type { GenerateRequest } from "../src/types";
import { join } from "path";
import { existsSync } from "fs";

const PORT = Number(process.env.PORT) || 3001;
const DIST_DIR = join(import.meta.dir, "..", "dist");

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function sseResponse(handler: (write: (event: string, data: unknown) => void) => Promise<void>): Response {
  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      const write = (event: string, data: unknown) => {
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      };
      try {
        await handler(write);
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      "Connection": "keep-alive",
      "X-Accel-Buffering": "no",
      "Content-Encoding": "none",
    },
  });
}

async function handleGenerate(req: Request): Promise<Response> {
  const body = (await req.json()) as GenerateRequest;

  if (!body.prompt && !body.imageBase64) {
    return jsonResponse({ error: "Either prompt or image is required" }, 400);
  }

  return sseResponse((write) =>
    runPipeline(write, {
      prompt: body.prompt,
      imageBase64: body.imageBase64,
      imageMimeType: body.imageMimeType,
    }),
  );
}

function serveStatic(path: string): Response {
  const filePath = join(DIST_DIR, path === "/" ? "index.html" : path);
  const file = Bun.file(filePath);
  return new Response(file);
}

const server = Bun.serve({
  port: PORT,
  idleTimeout: 255, // max; pipeline can take minutes for video gen
  async fetch(req) {
    const url = new URL(req.url);
    const path = url.pathname;

    // API routes
    if (path === "/api/generate" && req.method === "POST") {
      return handleGenerate(req);
    }

    // In production, serve static files
    if (existsSync(DIST_DIR)) {
      return serveStatic(path);
    }

    return jsonResponse({ error: "Not found" }, 404);
  },
});

console.log(`Poke2emon API server running on http://localhost:${server.port}`);
