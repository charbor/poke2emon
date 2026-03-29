import { Show, For } from "solid-js";
import type { PokemonConcept } from "../types";
import TypeBadge from "./TypeBadge";
import StatsDisplay from "./StatsDisplay";
import VideoPlayer from "./VideoPlayer";

interface Props {
  concept: PokemonConcept;
  spriteUrl: string | null;
  videoUrl: string | null;
  partial?: boolean;
}

export default function PokedexCard(props: Props) {
  const c = () => props.concept;

  return (
    <div class={`border-4 bg-poke-dark ${props.partial ? "border-poke-gold/50" : "border-poke-red"}`}>
      {/* Header */}
      <div class={`p-3 flex items-center justify-between ${props.partial ? "bg-poke-gold/30" : "bg-poke-red"}`}>
        <h2 class="text-sm text-white uppercase">
          {c().name || (
            <span class="animate-pulse text-poke-light/30">???</span>
          )}
        </h2>
        <Show when={c().dexNumber}>
          <span class="text-[10px] text-white/80">
            #{String(c().dexNumber).padStart(4, "0")}
          </span>
        </Show>
      </div>

      <div class="p-4 flex flex-col gap-4">
        {/* Sprite */}
        <div class="border-4 border-poke-gray bg-poke-darker p-4 flex items-center justify-center min-h-[200px]">
          <Show
            when={props.spriteUrl}
            fallback={
              <div class="text-xs text-poke-light/30 animate-pulse">
                {props.partial ? "Designing..." : "Drawing sprite..."}
              </div>
            }
          >
            <img
              src={props.spriteUrl!}
              alt={c().name}
              class="max-w-full max-h-[256px]"
              data-pixel
            />
          </Show>
        </div>

        {/* Type + Category */}
        <Show when={c().types?.length}>
          <div class="flex items-center justify-between flex-wrap gap-2">
            <div class="flex gap-2">
              <For each={c().types}>
                {(type) => <TypeBadge type={type} />}
              </For>
            </div>
            <Show when={c().category}>
              <span class="text-[8px] text-poke-light/50 italic">
                {c().category}
              </span>
            </Show>
          </div>
        </Show>

        {/* Height / Weight */}
        <Show when={c().height || c().weight}>
          <div class="flex gap-4 text-[8px]">
            <Show when={c().height}>
              <div>
                <span class="text-poke-light/50">HT </span>
                <span class="text-poke-light">{c().height}</span>
              </div>
            </Show>
            <Show when={c().weight}>
              <div>
                <span class="text-poke-light/50">WT </span>
                <span class="text-poke-light">{c().weight}</span>
              </div>
            </Show>
          </div>
        </Show>

        {/* Description */}
        <Show when={c().description}>
          <p class="text-[10px] text-poke-light/80 leading-relaxed border-l-4 border-poke-gold pl-3">
            {c().description}
          </p>
        </Show>

        {/* Abilities */}
        <Show when={c().abilities?.length}>
          <div>
            <div class="text-[8px] text-poke-gold mb-2">ABILITIES</div>
            <div class="flex flex-col gap-1">
              <For each={c().abilities}>
                {(ability) => (
                  <div class="text-[8px]">
                    <span class="text-poke-light">{ability.name}</span>
                    <Show when={ability.description}>
                      <span class="text-poke-light/40"> — {ability.description}</span>
                    </Show>
                  </div>
                )}
              </For>
            </div>
          </div>
        </Show>

        {/* Stats */}
        <Show when={c().stats}>
          <div>
            <div class="text-[8px] text-poke-gold mb-2">BASE STATS</div>
            <StatsDisplay stats={c().stats} />
          </div>
        </Show>

        {/* Video */}
        <Show when={props.videoUrl}>
          <VideoPlayer url={props.videoUrl!} />
        </Show>
      </div>
    </div>
  );
}
