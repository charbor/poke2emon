import { GoogleGenAI, type GenerateImagesResponse } from "@google/genai";

let _client: GoogleGenAI | null = null;

function getClient(): GoogleGenAI {
  if (!_client) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error("GEMINI_API_KEY environment variable is required");
    _client = new GoogleGenAI({ apiKey });
  }
  return _client;
}

export async function analyzeImage(
  imageBase64: string,
  mimeType: string,
  prompt: string,
): Promise<string> {
  const client = getClient();
  const response = await client.models.generateContent({
    model: "gemini-2.5-flash",
    contents: [
      {
        role: "user",
        parts: [
          { inlineData: { data: imageBase64, mimeType } },
          { text: prompt },
        ],
      },
    ],
  });
  return response.text ?? "";
}

export async function generateText(prompt: string): Promise<string> {
  const client = getClient();
  const response = await client.models.generateContent({
    model: "gemini-2.5-flash",
    contents: prompt,
  });
  return response.text ?? "";
}

export async function generateTextStream(
  prompt: string,
  onChunk: (chunk: string, accumulated: string) => void,
  options?: { useSearch?: boolean },
): Promise<string> {
  const client = getClient();
  const response = await client.models.generateContentStream({
    model: "gemini-2.5-flash",
    contents: prompt,
    config: options?.useSearch
      ? { tools: [{ googleSearch: {} }] }
      : undefined,
  });

  let accumulated = "";
  for await (const chunk of response) {
    const text = chunk.text ?? "";
    if (text) {
      accumulated += text;
      onChunk(text, accumulated);
    }
  }
  return accumulated;
}

export async function generateImage(
  prompt: string,
): Promise<{ base64: string; mimeType: string } | null> {
  const client = getClient();
  const response: GenerateImagesResponse = await client.models.generateImages({
    model: "imagen-4.0-generate-001",
    prompt,
    config: {
      numberOfImages: 1,
    },
  });

  const image = response.generatedImages?.[0];
  if (!image?.image?.imageBytes) return null;

  return {
    base64: image.image.imageBytes,
    mimeType: "image/png",
  };
}
