import { GoogleGenAI } from "@google/genai";

let _client: GoogleGenAI | null = null;

function getClient(): GoogleGenAI {
  if (!_client) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error("GEMINI_API_KEY environment variable is required");
    _client = new GoogleGenAI({ apiKey });
  }
  return _client;
}

export interface VideoOperation {
  operationName: string;
  done: boolean;
  video?: { base64: string; mimeType: string };
}

const activeOperations = new Map<string, VideoOperation>();

export async function startVideoGeneration(
  prompt: string,
  referenceImageBase64?: string,
): Promise<string> {
  const client = getClient();

  const config: Record<string, unknown> = {
    numberOfVideos: 1,
    durationSeconds: 4,
    fps: 24,
    personGeneration: "allow_all" as const,
  };

  if (referenceImageBase64) {
    config.image = {
      image: { imageBytes: referenceImageBase64 },
      mimeType: "image/png",
    };
  }

  const operation = await client.models.generateVideos({
    model: "veo-3.1-fast-generate-preview",
    prompt,
    config: config as never,
  });

  const opName = operation.name ?? `op-${Date.now()}`;
  activeOperations.set(opName, { operationName: opName, done: false });
  return opName;
}

export async function pollVideoOperation(
  operationName: string,
): Promise<VideoOperation> {
  const client = getClient();

  const cached = activeOperations.get(operationName);
  if (cached?.done) return cached;

  const op = await client.operations.get({ operation: operationName } as never);

  if (op.done) {
    const video = (op as unknown as Record<string, unknown>).response as
      | { generatedVideos?: Array<{ video?: { videoBytes?: string } }> }
      | undefined;
    const videoBytes = video?.generatedVideos?.[0]?.video?.videoBytes;

    const result: VideoOperation = {
      operationName,
      done: true,
      video: videoBytes
        ? { base64: videoBytes, mimeType: "video/mp4" }
        : undefined,
    };
    activeOperations.set(operationName, result);
    return result;
  }

  return { operationName, done: false };
}

export async function waitForVideo(
  operationName: string,
  intervalMs = 5000,
  maxAttempts = 60,
): Promise<VideoOperation> {
  for (let i = 0; i < maxAttempts; i++) {
    const result = await pollVideoOperation(operationName);
    if (result.done) return result;
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  throw new Error(`Video generation timed out after ${maxAttempts} attempts`);
}

export function getOperation(name: string): VideoOperation | undefined {
  return activeOperations.get(name);
}
