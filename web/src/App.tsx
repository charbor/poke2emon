import { createSignal, Show } from "solid-js";
import type {
  GenerationState,
  PokemonConcept,
  SSEEvent,
  StepEvent,
  PipelineStep,
  StepState,
} from "./types";
import { startGeneration, fileToBase64, chromaKey } from "./api";
import InputForm from "./components/InputForm";
import GenerationProgress from "./components/GenerationProgress";
import PokedexCard from "./components/PokedexCard";

const ALL_STEPS: PipelineStep[] = ["analyze", "design", "illustrate", "animate"];

function initialSteps(): StepState[] {
  return ALL_STEPS.map((step) => ({ step, status: "pending" }));
}

function tryParsePartial(text: string): Partial<PokemonConcept> | null {
  try {
    const cleaned = text.replace(/```json?\n?/g, "").replace(/```\n?/g, "").trim();
    const obj = JSON.parse(cleaned);
    return obj;
  } catch {
    // Try to repair incomplete JSON by closing open braces/brackets
    let cleaned = text.replace(/```json?\n?/g, "").replace(/```\n?/g, "").trim();
    // Remove trailing comma
    cleaned = cleaned.replace(/,\s*$/, "");
    // Count open braces/brackets and close them
    const opens = (cleaned.match(/[{[]/g) || []).length;
    const closes = (cleaned.match(/[}\]]/g) || []).length;
    const chars = [];
    for (const ch of cleaned) {
      if (ch === "{" || ch === "[") chars.push(ch);
      if (ch === "}" || ch === "]") chars.pop();
    }
    let suffix = "";
    for (let i = chars.length - 1; i >= 0; i--) {
      suffix += chars[i] === "{" ? "}" : "]";
    }
    if (opens > closes) {
      try {
        return JSON.parse(cleaned + suffix);
      } catch {
        return null;
      }
    }
    return null;
  }
}

export default function App() {
  const [state, setState] = createSignal<GenerationState>({
    steps: initialSteps(),
    concept: null,
    partialConcept: null,
    streamText: null,
    spriteUrl: null,
    videoUrl: null,
    error: null,
  });
  const [isGenerating, setIsGenerating] = createSignal(false);

  function updateStep(step: PipelineStep, update: Partial<StepState>) {
    setState((prev) => ({
      ...prev,
      steps: prev.steps.map((s) => (s.step === step ? { ...s, ...update } : s)),
    }));
  }

  function handleEvent(event: SSEEvent) {
    switch (event.type) {
      case "step": {
        const data = event.data as StepEvent;
        updateStep(data.step, { status: data.status, message: data.message });
        break;
      }
      case "stream": {
        const { text } = event.data as { step: string; text: string };
        const partial = tryParsePartial(text);
        setState((prev) => ({ ...prev, streamText: text, partialConcept: partial }));
        break;
      }
      case "concept": {
        const concept = event.data as PokemonConcept;
        setState((prev) => ({ ...prev, concept, partialConcept: null, streamText: null }));
        break;
      }
      case "sprite": {
        const { url } = event.data as { url: string };
        chromaKey(url).then((keyed) => {
          setState((prev) => ({ ...prev, spriteUrl: keyed }));
        });
        break;
      }
      case "video": {
        const { url } = event.data as { url: string };
        setState((prev) => ({ ...prev, videoUrl: url }));
        break;
      }
      case "error": {
        const { message } = event.data as { message: string };
        setState((prev) => ({ ...prev, error: message }));
        setIsGenerating(false);
        break;
      }
      case "done": {
        setIsGenerating(false);
        break;
      }
    }
  }

  async function handleSubmit(prompt: string, imageFile: File | null) {
    setState({
      steps: initialSteps(),
      concept: null,
      partialConcept: null,
      streamText: null,
      spriteUrl: null,
      videoUrl: null,
      error: null,
    });
    setIsGenerating(true);

    const request: Record<string, string | undefined> = { prompt: prompt || undefined };

    if (imageFile) {
      request.imageBase64 = await fileToBase64(imageFile);
      request.imageMimeType = imageFile.type;
    }

    await startGeneration(request, handleEvent);
  }

  function handleReset() {
    setState({
      steps: initialSteps(),
      concept: null,
      partialConcept: null,
      streamText: null,
      spriteUrl: null,
      videoUrl: null,
      error: null,
    });
    setIsGenerating(false);
  }

  const hasResult = () => state().concept !== null;
  const hasPartial = () => state().partialConcept !== null;
  const showProgress = () => isGenerating() || hasResult();

  return (
    <div class="min-h-screen flex flex-col items-center px-4 py-8">
      <header class="text-center mb-8">
        <h1 class="text-2xl md:text-4xl text-poke-gold mb-2">POKE2EMON</h1>
        <p class="text-xs md:text-sm text-poke-light/60">
          AI-Powered Pokemon Generator
        </p>
      </header>

      <main class="w-full max-w-2xl flex flex-col gap-8">
        <Show when={!showProgress()}>
          <InputForm onSubmit={handleSubmit} disabled={isGenerating()} />
        </Show>

        <Show when={showProgress()}>
          <GenerationProgress steps={state().steps} />
        </Show>

        <Show when={state().error}>
          <div class="border-4 border-poke-red bg-poke-red/20 p-4 text-xs text-poke-red">
            {state().error}
          </div>
        </Show>

        <Show when={hasPartial() && !hasResult()}>
          <PokedexCard
            concept={state().partialConcept as PokemonConcept}
            spriteUrl={null}
            videoUrl={null}
            partial
          />
        </Show>

        <Show when={hasResult()}>
          <PokedexCard
            concept={state().concept!}
            spriteUrl={state().spriteUrl}
            videoUrl={state().videoUrl}
          />
          <button
            class="pixel-btn bg-poke-gray text-poke-light px-6 py-3 text-xs mx-auto"
            onClick={handleReset}
          >
            GENERATE ANOTHER
          </button>
        </Show>
      </main>

      <footer class="mt-auto pt-8 text-center text-[8px] text-poke-light/30">
        Poke2emon &mdash; Not affiliated with Nintendo or The Pokemon Company
      </footer>
    </div>
  );
}
