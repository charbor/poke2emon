import { For } from "solid-js";
import type { PokemonStats } from "../types";

interface Props {
  stats: PokemonStats;
}

const STAT_LABELS: { key: keyof PokemonStats; label: string; color: string }[] = [
  { key: "hp", label: "HP", color: "#FF5555" },
  { key: "attack", label: "ATK", color: "#F08030" },
  { key: "defense", label: "DEF", color: "#F8D030" },
  { key: "spAtk", label: "SPA", color: "#6890F0" },
  { key: "spDef", label: "SPD", color: "#78C850" },
  { key: "speed", label: "SPE", color: "#F85888" },
];

export default function StatsDisplay(props: Props) {
  const maxStat = 255;
  const segments = 20;

  return (
    <div class="flex flex-col gap-2">
      <For each={STAT_LABELS}>
        {(stat) => {
          const value = () => props.stats[stat.key];
          const filledSegments = () => Math.round((value() / maxStat) * segments);

          return (
            <div class="flex items-center gap-2">
              <span class="text-[8px] text-poke-light/60 w-8 text-right flex-shrink-0">
                {stat.label}
              </span>
              <span class="text-[8px] text-poke-light w-8 text-right flex-shrink-0">
                {value()}
              </span>
              <div class="flex gap-[2px] flex-1">
                <For each={Array.from({ length: segments })}>
                  {(_, i) => (
                    <div
                      class="stat-segment"
                      style={{
                        "background-color":
                          i() < filledSegments() ? stat.color : "rgba(255,255,255,0.08)",
                      }}
                    />
                  )}
                </For>
              </div>
            </div>
          );
        }}
      </For>
      <div class="text-[8px] text-poke-light/30 text-right mt-1">
        Total: {Object.values(props.stats).reduce((a, b) => a + b, 0)}
      </div>
    </div>
  );
}
