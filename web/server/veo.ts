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

export interface VideoResult {
  done: boolean;
  video?: { base64: string; mimeType: string };
}

export async function generateVideo(
  prompt: string,
  _referenceImageBase64?: string,
): Promise<VideoResult> {
  const client = getClient();

  let operation = await client.models.generateVideos({
    model: "veo-3.1-fast-generate-preview",
    prompt,
    config: {
      numberOfVideos: 1,
      durationSeconds: 4,
      personGeneration: "allow_all",
    } as never,
  });

  // Poll until done
  while (!operation.done) {
    await new Promise((r) => setTimeout(r, 10000));
    operation = await client.operations.getVideosOperation({
      operation: operation,
    });
  }

  const generatedVideo = operation.response?.generatedVideos?.[0];
  const video = generatedVideo?.video;
  console.log("[veo] operation response keys:", Object.keys(operation.response ?? {}));
  console.log("[veo] generatedVideo keys:", Object.keys(generatedVideo ?? {}));
  console.log("[veo] video object:", JSON.stringify(video, null, 2)?.slice(0, 500));

  const uri = video?.uri;
  if (!uri) {
    console.log("[veo] no video URI found, returning empty result");
    return { done: true };
  }

  console.log("[veo] fetching video from URI:", uri.slice(0, 100));
  const resp = await fetch(uri);
  console.log("[veo] fetch status:", resp.status, "content-type:", resp.headers.get("content-type"));
  const arrayBuf = await resp.arrayBuffer();
  console.log("[veo] video size:", arrayBuf.byteLength, "bytes");
  const base64 = Buffer.from(arrayBuf).toString("base64");

  return {
    done: true,
    video: { base64, mimeType: resp.headers.get("content-type") || "video/mp4" },
  };
}
