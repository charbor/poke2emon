import { For } from "solid-js";
import type { StepState, PipelineStep } from "../types";

interface Props {
  steps: StepState[];
}

const STEP_LABELS: Record<PipelineStep, string> = {
  analyze: "ANALYZE",
  design: "DESIGN",
  illustrate: "ILLUSTRATE",
  animate: "ANIMATE",
};

const STEP_ICONS: Record<PipelineStep, string> = {
  analyze: "?",
  design: "!",
  illustrate: "*",
  animate: ">",
};

export default function GenerationProgress(props: Props) {
  return (
    <div class="border-4 border-poke-gray bg-poke-dark p-4">
      <div class="text-[10px] text-poke-gold mb-4">GENERATION PROGRESS</div>
      <div class="flex flex-col gap-3">
        <For each={props.steps}>
          {(step) => (
            <div class="flex items-center gap-3">
              <div
                class={`w-8 h-8 border-4 flex items-center justify-center text-xs flex-shrink-0 ${
                  step.status === "complete"
                    ? "border-green-500 bg-green-500/20 text-green-400"
                    : step.status === "active"
                      ? "border-poke-gold bg-poke-gold/20 text-poke-gold animate-pulse"
                      : step.status === "error"
                        ? "border-poke-red bg-poke-red/20 text-poke-red"
                        : "border-poke-gray bg-poke-darker text-poke-light/30"
                }`}
              >
                {step.status === "complete" ? "+" : STEP_ICONS[step.step]}
              </div>
              <div class="flex-1 min-w-0">
                <div
                  class={`text-[10px] ${
                    step.status === "active"
                      ? "text-poke-gold"
                      : step.status === "complete"
                        ? "text-green-400"
                        : step.status === "error"
                          ? "text-poke-red"
                          : "text-poke-light/40"
                  }`}
                >
                  {STEP_LABELS[step.step]}
                </div>
                {step.message && (
                  <div class="text-[8px] text-poke-light/50 truncate">
                    {step.message}
                  </div>
                )}
              </div>
              {step.status === "active" && (
                <div class="flex gap-1">
                  <div class="w-2 h-2 bg-poke-gold animate-pulse" style="animation-delay: 0ms" />
                  <div class="w-2 h-2 bg-poke-gold animate-pulse" style="animation-delay: 200ms" />
                  <div class="w-2 h-2 bg-poke-gold animate-pulse" style="animation-delay: 400ms" />
                </div>
              )}
            </div>
          )}
        </For>
      </div>
    </div>
  );
}
