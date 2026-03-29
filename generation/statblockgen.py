import argparse
import json
import os

from google import genai

client = genai.Client()

SYSTEM_PROMPT = """\
You are a Pokemon designer creating detailed statblock entries for a fan-made Pokedex.
Each entry is inspired by a REAL species but must be transformed into a fantastical creature.

CRITICAL RULES:
- The Pokemon must be clearly fantastical — not just a real animal.
  Incorporate the typing into the physical design: a Fire-type should have flames, magma,
  ember-like features; a Water-type should have aquatic/fluid elements; an Ice-type should
  have frost, crystals, icy coloring; etc. Subtle characterization is sufficient - it doesn't need to be very visually noisy.
- The sprite_description must be extremely detailed and specific — describe exact colors
  (with hex codes), exact features, exact pose elements. An artist should be able to draw
  it from your description alone.
- Evolution chains should show clear visual progression: baby forms are small/cute/round,
  mid forms are adolescent/growing, final forms are powerful/imposing.
- The "id" must be lowercase, one word, no spaces or hyphens.
- The "name" is the capitalized version of the id.
- Dex numbers should continue from the highest existing number in the file.
- Color palettes must use specific hex codes that match the sprite description.
- The category should be "The ___ Pokemon" format.
- art_notes should explain the design philosophy and what makes this creature special.
- Every entry MUST include a "rig_type" field. Valid values:
  - "biped" — walks on two legs, has arms (humanoid, upright birds, etc.)
  - "quadruped" — walks on four legs (mammals, lizards, etc.)
  - "serpentine" — elongated body with no legs (snakes, worms, eels)
  - "flying" — biped body with prominent wings (birds in flight, bats, dragons)
  - "amorphous" — no clear limbs or standard body plan (slugs, blobs, plants, jellyfish)
  Choose the value that best matches the creature's primary body plan.

Output ONLY a valid JSON array of statblock objects. No markdown, no explanation, just JSON.
"""


def load_existing(path):
    if os.path.exists(path):
        with open(path) as f:
            return json.load(f)
    return []


def build_prompt(species, freeform, existing):
    examples_note = ""
    if existing:
        ids = [e["id"] for e in existing]
        max_dex = max(e.get("dex_number", 0) for e in existing)
        examples_note = (
            f"The file already contains {len(existing)} Pokemon (IDs: {', '.join(ids)}). "
            f"The highest dex_number is {max_dex}. Continue numbering from {max_dex + 1}. "
            f"Make sure the new Pokemon's id does not collide with any existing id. "
        )

        # Include format references: one with evolution chain, one without
        sample = []
        has_chain = next((e for e in existing if e.get("evolution_chain") and isinstance(e["evolution_chain"], dict)), None)
        no_chain = next((e for e in existing if not e.get("evolution_chain")), None)
        if has_chain:
            sample.append(has_chain)
        if no_chain:
            sample.append(no_chain)
        if not sample:
            sample = existing[:2]
        examples_note += (
            f"\nHere are existing entries for format reference (follow this EXACT schema):\n"
            f"{json.dumps(sample, indent=2)}\n"
        )

    prompt = (
        f"Create Pokemon statblock(s) inspired by: {species}\n\n"
    )
    if freeform:
        prompt += f"Additional context/direction: {freeform}\n\n"
    prompt += (
        f"{examples_note}\n"
        f"Generate the statblock(s) as a JSON array. If the species naturally has an "
        f"evolution chain (e.g. baby -> adult), generate all stages. Otherwise generate "
        f"a single entry. Follow the exact schema of the examples.\n"
        f"Remember: the design must be FANTASTICAL, not just a renamed real animal. "
        f"Weave the elemental typing into every aspect of the physical description."
    )
    return prompt


def generate_statblock(species, freeform, statblock_file):
    os.makedirs("statblocks", exist_ok=True)
    path = f"statblocks/{statblock_file}"
    if not path.endswith(".json"):
        path += ".json"

    existing = load_existing(path)
    prompt = build_prompt(species, freeform, existing)

    print(f"Generating statblock for {species} -> {path}...")

    response = client.models.generate_content(
        model="gemini-2.5-flash",
        contents=prompt,
        config=genai.types.GenerateContentConfig(
            system_instruction=SYSTEM_PROMPT,
            response_mime_type="application/json",
        ),
    )

    text = response.text.strip()
    new_entries = json.loads(text)
    if isinstance(new_entries, dict):
        new_entries = [new_entries]

    existing.extend(new_entries)

    with open(path, "w") as f:
        json.dump(existing, f, indent=2, ensure_ascii=False)
        f.write("\n")

    names = [e["name"] for e in new_entries]
    print(f"  Added {len(new_entries)} entries: {', '.join(names)}")
    print(f"  Total entries in {path}: {len(existing)}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Generate Pokemon statblocks via Gemini")
    parser.add_argument("species", help="Real species name to base the Pokemon on")
    parser.add_argument("-t", "--text", default="", help="Free-form direction/context")
    parser.add_argument("-f", "--file", default="pokemon.json",
                        help="Statblock JSON file in statblocks/ (default: pokemon.json)")
    args = parser.parse_args()

    generate_statblock(args.species, args.text, args.file)
