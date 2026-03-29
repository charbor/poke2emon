import { runPipeline } from "./pipeline";
import { pollVideoOperation, getOperation } from "./veo";
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
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
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

async function handleVideoStatus(operationName: string): Promise<Response> {
  try {
    const result = await pollVideoOperation(operationName);
    return jsonResponse({
      done: result.done,
      hasVideo: !!result.video,
    });
  } catch {
    return jsonResponse({ error: "Operation not found" }, 404);
  }
}

function handleVideoDownload(operationName: string): Response {
  const op = getOperation(operationName);
  if (!op?.video) {
    return jsonResponse({ error: "Video not ready or not found" }, 404);
  }

  const buffer = Buffer.from(op.video.base64, "base64");
  return new Response(buffer, {
    headers: {
      "Content-Type": op.video.mimeType,
      "Content-Disposition": `attachment; filename="pokemon-idle.mp4"`,
    },
  });
}

function serveStatic(path: string): Response {
  const filePath = join(DIST_DIR, path === "/" ? "index.html" : path);
  const file = Bun.file(filePath);
  return new Response(file);
}

const server = Bun.serve({
  port: PORT,
  async fetch(req) {
    const url = new URL(req.url);
    const path = url.pathname;

    // API routes
    if (path === "/api/generate" && req.method === "POST") {
      return handleGenerate(req);
    }

    if (path.startsWith("/api/video/") && path.endsWith("/download")) {
      const opName = path.slice("/api/video/".length, -"/download".length);
      return handleVideoDownload(decodeURIComponent(opName));
    }

    if (path.startsWith("/api/video/")) {
      const opName = path.slice("/api/video/".length);
      return handleVideoStatus(decodeURIComponent(opName));
    }

    // In production, serve static files
    if (existsSync(DIST_DIR)) {
      return serveStatic(path);
    }

    return jsonResponse({ error: "Not found" }, 404);
  },
});

console.log(`Poke2emon API server running on http://localhost:${server.port}`);
