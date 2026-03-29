import type { GenerateRequest, SSEEvent } from "./types";

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

/**
 * Chroma key magenta (#FF00FF) background to transparent.
 * Uses color distance to handle anti-aliased edges gracefully.
 */
export async function chromaKey(spriteUrl: string): Promise<string> {
  const img = await loadImage(spriteUrl);

  const w = img.width;
  const h = img.height;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;

  ctx.drawImage(img, 0, 0, w, h);
  const data = ctx.getImageData(0, 0, w, h);

  // Magenta key color: R=255, G=0, B=255
  const KEY_R = 255, KEY_G = 0, KEY_B = 255;
  const THRESHOLD = 100; // max distance to count as key color

  for (let i = 0; i < data.data.length; i += 4) {
    const r = data.data[i];
    const g = data.data[i + 1];
    const b = data.data[i + 2];

    // Color distance from magenta
    const dr = r - KEY_R;
    const dg = g - KEY_G;
    const db = b - KEY_B;
    const dist = Math.sqrt(dr * dr + dg * dg + db * db);

    if (dist < THRESHOLD) {
      // Fully transparent for near-magenta pixels
      data.data[i + 3] = 0;
    } else if (dist < THRESHOLD * 2) {
      // Smooth falloff for anti-aliased edges
      const alpha = Math.min(255, ((dist - THRESHOLD) / THRESHOLD) * 255);
      data.data[i + 3] = alpha;
    }
  }

  ctx.putImageData(data, 0, 0);

  return new Promise((resolve) => {
    canvas.toBlob((blob) => {
      resolve(URL.createObjectURL(blob!));
    }, "image/png");
  });
}

export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.split(",")[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export async function startGeneration(
  request: GenerateRequest,
  onEvent: (event: SSEEvent) => void,
): Promise<void> {
  const response = await fetch("/api/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    const error = await response.json();
    onEvent({ type: "error", data: { message: error.error || "Request failed" } });
    return;
  }

  const reader = response.body?.getReader();
  if (!reader) {
    onEvent({ type: "error", data: { message: "No response stream" } });
    return;
  }

  const decoder = new TextDecoder();
  let buffer = "";
  let currentEvent = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });

    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      if (line.startsWith("event: ")) {
        currentEvent = line.slice(7);
      } else if (line.startsWith("data: ") && currentEvent) {
        try {
          const data = JSON.parse(line.slice(6));
          onEvent({ type: currentEvent as SSEEvent["type"], data });
        } catch {
          // skip malformed events
        }
        currentEvent = "";
      }
    }
  }
}
