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
 * Composite a premultiplied-alpha sprite (on black) with a mask
 * (white = opaque, black = transparent). Returns an object URL
 * of the resulting PNG with proper transparency.
 */
export async function compositeSprite(
  spriteUrl: string,
  maskUrl: string,
): Promise<string> {
  const [sprite, mask] = await Promise.all([
    loadImage(spriteUrl),
    loadImage(maskUrl),
  ]);

  const w = sprite.width;
  const h = sprite.height;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;

  // Draw sprite to read pixel data
  ctx.drawImage(sprite, 0, 0, w, h);
  const spriteData = ctx.getImageData(0, 0, w, h);

  // Draw mask to read pixel data
  ctx.clearRect(0, 0, w, h);
  ctx.drawImage(mask, 0, 0, w, h);
  const maskData = ctx.getImageData(0, 0, w, h);

  // Apply mask luminance as alpha to the sprite (already premultiplied)
  const out = spriteData;
  for (let i = 0; i < out.data.length; i += 4) {
    // Mask luminance → alpha (use green channel, most perceptual weight)
    out.data[i + 3] = maskData.data[i + 1];
  }

  ctx.putImageData(out, 0, 0);

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
