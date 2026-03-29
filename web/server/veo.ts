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

  const video = operation.response?.generatedVideos?.[0]?.video;
  const uri = video?.uri;
  if (!uri) {
    return { done: true };
  }

  // Fetch the video from the URI
  const resp = await fetch(uri);
  const arrayBuf = await resp.arrayBuffer();
  const base64 = Buffer.from(arrayBuf).toString("base64");

  return {
    done: true,
    video: { base64, mimeType: "video/mp4" },
  };
}
