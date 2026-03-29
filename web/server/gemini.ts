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
  maxRetries = 3,
): Promise<{ base64: string; mimeType: string } | null> {
  const client = getClient();

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
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
    } catch (err) {
      const isRetryable =
        err instanceof Error &&
        (err.message.includes("503") ||
          err.message.includes("UNAVAILABLE") ||
          err.message.includes("timeout"));
      if (!isRetryable || attempt === maxRetries - 1) throw err;
      const delay = (attempt + 1) * 5000;
      console.log(`[imagen] attempt ${attempt + 1} failed, retrying in ${delay / 1000}s...`);
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  return null;
}

export async function editImage(
  prompt: string,
  referenceBase64: string,
  referenceMimeType: string,
): Promise<{ base64: string; mimeType: string } | null> {
  const client = getClient();
  const response = await client.models.generateContent({
    model: "gemini-2.0-flash-exp-image-generation",
    contents: [
      {
        role: "user",
        parts: [
          { inlineData: { data: referenceBase64, mimeType: referenceMimeType } },
          { text: prompt },
        ],
      },
    ],
    config: {
      responseModalities: ["IMAGE"],
    } as never,
  });

  const part = response.candidates?.[0]?.content?.parts?.find(
    (p) => p.inlineData,
  );
  if (!part?.inlineData?.data) return null;

  return {
    base64: part.inlineData.data,
    mimeType: part.inlineData.mimeType || "image/png",
  };
}
