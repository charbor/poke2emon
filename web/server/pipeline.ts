import type { PokemonConcept, PipelineStep, StepStatus } from "../src/types";
import { analyzeImage, generateTextStream, generateImage } from "./gemini";
import { generateVideo } from "./veo";
import { storeMedia } from "./media";
import {
  ANALYZE_IMAGE_PROMPT,
  buildDesignPrompt,
  buildSpritePrompt,
  buildMaskPrompt,
  buildVideoPrompt,
} from "./prompts";

type SSEWriter = (event: string, data: unknown) => void;

function emitStep(write: SSEWriter, step: PipelineStep, status: StepStatus, message?: string) {
  write("step", { step, status, message });
}

export async function runPipeline(
  write: SSEWriter,
  opts: { prompt?: string; imageBase64?: string; imageMimeType?: string },
) {
  let context = "";

  try {
    // Step 1: Analyze (only if image provided)
    if (opts.imageBase64 && opts.imageMimeType) {
      emitStep(write, "analyze", "active", "Analyzing your image...");
      const analysis = await analyzeImage(
        opts.imageBase64,
        opts.imageMimeType,
        ANALYZE_IMAGE_PROMPT,
      );
      context = `The user uploaded an image. Here's what the image shows:\n${analysis}`;
      if (opts.prompt) {
        context += `\n\nThe user also provided this guidance: "${opts.prompt}"`;
      }
      emitStep(write, "analyze", "complete", "Image analyzed");
    } else if (opts.prompt) {
      emitStep(write, "analyze", "complete", "Using text prompt");
      context = `The user wants a Pokemon based on this description: "${opts.prompt}"`;
    } else {
      throw new Error("Either a prompt or an image is required");
    }

    // Step 2: Design Pokemon concept (streamed, with web search for research)
    emitStep(write, "design", "active", "Researching & designing your Pokemon...");
    const designPrompt = buildDesignPrompt(context);
    const conceptRaw = await generateTextStream(
      designPrompt,
      (_chunk, accumulated) => {
        write("stream", { step: "design", text: accumulated });
      },
      { useSearch: true },
    );

    let concept: PokemonConcept;
    try {
      const cleaned = conceptRaw.replace(/```json?\n?/g, "").replace(/```\n?/g, "").trim();
      concept = JSON.parse(cleaned);
    } catch {
      throw new Error("Failed to parse Pokemon concept from AI response");
    }

    write("concept", concept);
    emitStep(write, "design", "complete", `${concept.name} designed!`);

    // Step 3: Generate sprite (on black) + alpha mask in parallel
    emitStep(write, "illustrate", "active", "Drawing sprite & mask...");
    const spritePrompt = buildSpritePrompt(concept);
    const maskPrompt = buildMaskPrompt(concept);
    const [sprite, mask] = await Promise.all([
      generateImage(spritePrompt),
      generateImage(maskPrompt),
    ]);

    if (sprite) {
      const spriteId = storeMedia(sprite.base64, sprite.mimeType);
      const maskId = mask ? storeMedia(mask.base64, mask.mimeType) : null;
      write("sprite", {
        url: `/api/media/${spriteId}`,
        maskUrl: maskId ? `/api/media/${maskId}` : null,
      });
      emitStep(write, "illustrate", "complete", "Sprite created!");
    } else {
      emitStep(write, "illustrate", "error", "Sprite generation failed");
    }

    // Step 4: Generate idle animation video
    emitStep(write, "animate", "active", "Generating animation...");
    const videoPrompt = buildVideoPrompt(concept);
    const videoResult = await generateVideo(videoPrompt, sprite?.base64);

    if (videoResult.video) {
      const videoId = storeMedia(videoResult.video.base64, videoResult.video.mimeType);
      write("video", { url: `/api/media/${videoId}` });
      emitStep(write, "animate", "complete", "Animation ready!");
    } else {
      emitStep(write, "animate", "error", "Video generation failed");
    }

    write("done", {});
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    write("error", { message });
  }
}
