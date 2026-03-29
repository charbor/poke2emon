import { Show, For } from "solid-js";
import type { PokemonConcept } from "../types";
import TypeBadge from "./TypeBadge";
import StatsDisplay from "./StatsDisplay";
import VideoPlayer from "./VideoPlayer";

interface Props {
  concept: PokemonConcept;
  spriteUrl: string | null;
  videoUrl: string | null;
}

export default function PokedexCard(props: Props) {
  return (
    <div class="border-4 border-poke-red bg-poke-dark">
      {/* Header */}
      <div class="bg-poke-red p-3 flex items-center justify-between">
        <h2 class="text-sm text-white uppercase">{props.concept.name}</h2>
        <span class="text-[10px] text-white/80">
          #{String(props.concept.dexNumber).padStart(4, "0")}
        </span>
      </div>

      <div class="p-4 flex flex-col gap-4">
        {/* Sprite */}
        <div class="border-4 border-poke-gray bg-poke-darker p-4 flex items-center justify-center min-h-[200px]">
          <Show
            when={props.spriteUrl}
            fallback={
              <div class="text-xs text-poke-light/30 animate-pulse">
                Drawing sprite...
              </div>
            }
          >
            <img
              src={props.spriteUrl!}
              alt={props.concept.name}
              class="max-w-full max-h-[256px]"
              data-pixel
            />
          </Show>
        </div>

        {/* Type + Category */}
        <div class="flex items-center justify-between flex-wrap gap-2">
          <div class="flex gap-2">
            <For each={props.concept.types}>
              {(type) => <TypeBadge type={type} />}
            </For>
          </div>
          <span class="text-[8px] text-poke-light/50 italic">
            {props.concept.category}
          </span>
        </div>

        {/* Height / Weight */}
        <div class="flex gap-4 text-[8px]">
          <div>
            <span class="text-poke-light/50">HT </span>
            <span class="text-poke-light">{props.concept.height}</span>
          </div>
          <div>
            <span class="text-poke-light/50">WT </span>
            <span class="text-poke-light">{props.concept.weight}</span>
          </div>
        </div>

        {/* Description */}
        <p class="text-[10px] text-poke-light/80 leading-relaxed border-l-4 border-poke-gold pl-3">
          {props.concept.description}
        </p>

        {/* Abilities */}
        <div>
          <div class="text-[8px] text-poke-gold mb-2">ABILITIES</div>
          <div class="flex flex-col gap-1">
            <For each={props.concept.abilities}>
              {(ability) => (
                <div class="text-[8px]">
                  <span class="text-poke-light">{ability.name}</span>
                  <span class="text-poke-light/40"> — {ability.description}</span>
                </div>
              )}
            </For>
          </div>
        </div>

        {/* Stats */}
        <div>
          <div class="text-[8px] text-poke-gold mb-2">BASE STATS</div>
          <StatsDisplay stats={props.concept.stats} />
        </div>

        {/* Video */}
        <Show when={props.videoUrl}>
          <VideoPlayer url={props.videoUrl!} />
        </Show>
      </div>
    </div>
  );
}
