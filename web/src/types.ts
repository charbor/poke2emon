export type PokemonType =
  | "Normal"
  | "Fire"
  | "Water"
  | "Electric"
  | "Grass"
  | "Ice"
  | "Fighting"
  | "Poison"
  | "Ground"
  | "Flying"
  | "Psychic"
  | "Bug"
  | "Rock"
  | "Ghost"
  | "Dragon"
  | "Dark"
  | "Steel"
  | "Fairy";

export interface PokemonStats {
  hp: number;
  attack: number;
  defense: number;
  spAtk: number;
  spDef: number;
  speed: number;
}

export interface PokemonAbility {
  name: string;
  description: string;
}

export interface PokemonConcept {
  name: string;
  dexNumber: number;
  types: [PokemonType] | [PokemonType, PokemonType];
  stats: PokemonStats;
  height: string;
  weight: string;
  abilities: PokemonAbility[];
  description: string;
  category: string;
  spriteDescription: string;
  colorPalette: string[];
}

export type PipelineStep = "analyze" | "design" | "illustrate" | "animate";

export type StepStatus = "pending" | "active" | "complete" | "error";

export interface StepState {
  step: PipelineStep;
  status: StepStatus;
  message?: string;
}

export interface GenerationState {
  steps: StepState[];
  concept: PokemonConcept | null;
  spriteUrl: string | null;
  videoUrl: string | null;
  error: string | null;
}

export interface SSEEvent {
  type: "step" | "concept" | "sprite" | "video" | "error" | "done";
  data: unknown;
}

export interface StepEvent {
  step: PipelineStep;
  status: StepStatus;
  message?: string;
}

export interface GenerateRequest {
  prompt?: string;
  imageBase64?: string;
  imageMimeType?: string;
}
