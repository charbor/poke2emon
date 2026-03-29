export const ANALYZE_IMAGE_PROMPT = `You are a Pokemon designer analyzing a real-world photo for inspiration.

Describe what you see in the image in detail:
- The subject (animal, object, person, scene)
- Key visual features (colors, shapes, textures, patterns)
- The mood or energy it conveys
- Any distinctive traits that could inspire a Pokemon design

Be specific and vivid. Your description will be used to design a new Pokemon.
Keep your response to 2-3 paragraphs.`;

export const DESIGN_POKEMON_PROMPT = `You are a world-class Pokemon designer creating an original creature for the Pokedex.

{CONTEXT}

IMPORTANT: If the input mentions a real person, character, place, brand, or any specific noun — use Google Search to research them first. Learn about their appearance, personality, accomplishments, signature traits, and quirks. Incorporate what you find into the Pokemon design (name pun, types, abilities, stats, lore, and visual design should all reference the real subject cleverly).

Design a completely original Pokemon inspired by this input. Return ONLY valid JSON (no markdown, no code fences) with this exact structure:

{
  "name": "CreativeName",
  "dexNumber": <random 4-digit number between 1000-9999>,
  "types": ["Type1"] or ["Type1", "Type2"],
  "stats": {
    "hp": <30-255>,
    "attack": <30-255>,
    "defense": <30-255>,
    "spAtk": <30-255>,
    "spDef": <30-255>,
    "speed": <30-255>
  },
  "height": "X'XX\\" (feet/inches)",
  "weight": "XX.X lbs",
  "abilities": [
    {"name": "AbilityName", "description": "What it does"},
    {"name": "AbilityName", "description": "What it does"}
  ],
  "description": "A 2-3 sentence Pokedex flavor text entry describing this Pokemon's lore, behavior, and habitat.",
  "category": "The Xxxx Pokemon",
  "spriteDescription": "A detailed visual description of the Pokemon's appearance for an artist: body shape, colors, features, expression, pose. Be very specific about colors, proportions, and distinguishing features.",
  "colorPalette": ["#hex1", "#hex2", "#hex3", "#hex4", "#hex5"]
}

Rules:
- Valid types: Normal, Fire, Water, Electric, Grass, Ice, Fighting, Poison, Ground, Flying, Psychic, Bug, Rock, Ghost, Dragon, Dark, Steel, Fairy
- Stats should total 350-600 (balanced for the design)
- The name should be creative and punny, blending the inspiration with Pokemon naming conventions
- The sprite description should be detailed enough for an AI image generator
- Color palette should be 5 hex colors that define the Pokemon's look
- Make the design fun, creative, and believable as a real Pokemon`;

export function buildDesignPrompt(context: string): string {
  return DESIGN_POKEMON_PROMPT.replace("{CONTEXT}", context);
}

export function buildSpritePrompt(concept: {
  name: string;
  spriteDescription: string;
  colorPalette: string[];
  types: string[];
  category: string;
}): string {
  return `Create a pixel art sprite of a Pokemon called "${concept.name}" (${concept.category}).

Visual description: ${concept.spriteDescription}

Color palette: ${concept.colorPalette.join(", ")}
Type(s): ${concept.types.join("/")}

Style requirements:
- 2D pixel art style, like classic Pokemon game sprites
- Front-facing view, centered in frame
- Clean white or transparent background
- Bold outlines, vibrant colors from the palette
- Expressive and dynamic pose
- Pokemon should fill most of the frame
- Style reminiscent of Pokemon Black/White era sprites`;
}

export function buildVideoPrompt(concept: {
  name: string;
  spriteDescription: string;
  types: string[];
}): string {
  return `A pixel art Pokemon called "${concept.name}" (${concept.types.join("/")}-type) performing a gentle idle animation. ${concept.spriteDescription}. The Pokemon bobs slightly, blinks, and has a subtle breathing motion. Pixel art style, clean background, seamless loop feel. The animation should be calm and gentle, like a Pokemon waiting in battle.`;
}
