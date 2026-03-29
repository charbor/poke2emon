import argparse
import json
import io
import os
import concurrent.futures
from collections import deque

from google import genai
from PIL import Image

client = genai.Client()

os.makedirs("sprites", exist_ok=True)

with open("statblocks/pokemon_bayarea.json") as f:
    pokemon_list = json.load(f)


def _is_magenta(pixel):
    """Check if pixel is close to magenta (#FF00FF)."""
    r, g, b = pixel[0], pixel[1], pixel[2]
    return r > 160 and g < 100 and b > 160


def _is_magenta_fringe(pixel):
    """Looser check for anti-aliased magenta bleed on sprite edges."""
    r, g, b = pixel[0], pixel[1], pixel[2]
    return r > 100 and g < 140 and b > 100 and (r + b) > (g * 3)


def _flood_fill(pixels, w, h, seeds, check_fn):
    """BFS flood fill from seeds, returns set of all connected matching pixels."""
    visited = set()
    queue = deque()
    for s in seeds:
        if check_fn(pixels[s[0], s[1]]):
            queue.append(s)
            visited.add(s)
    while queue:
        x, y = queue.popleft()
        for dx, dy in [(-1, 0), (1, 0), (0, -1), (0, 1)]:
            nx, ny = x + dx, y + dy
            if 0 <= nx < w and 0 <= ny < h and (nx, ny) not in visited:
                if check_fn(pixels[nx, ny]):
                    visited.add((nx, ny))
                    queue.append((nx, ny))
    return visited


def find_split_columns(image, n_splits=2):
    """Find the best vertical split points by locating transparent column gaps.

    Scans every column and scores it by how many pixels are transparent.
    Then finds contiguous runs of fully/mostly transparent columns (gaps),
    and picks the n_splits best gaps closest to the ideal equal-width positions.
    """
    w, h = image.size
    pixels = image.load()

    # Count non-transparent pixels per column
    col_opaque = []
    for x in range(w):
        count = 0
        for y in range(h):
            if pixels[x, y][3] > 0:
                count += 1
        col_opaque.append(count)

    # Find contiguous gap runs (columns with 0 opaque pixels)
    # Allow a small tolerance for anti-aliasing artifacts
    threshold = max(1, h // 50)
    gaps = []  # list of (start_x, end_x) inclusive
    in_gap = False
    gap_start = 0
    for x in range(w):
        if col_opaque[x] <= threshold:
            if not in_gap:
                gap_start = x
                in_gap = True
        else:
            if in_gap:
                gaps.append((gap_start, x - 1))
                in_gap = False
    if in_gap:
        gaps.append((gap_start, w - 1))

    # Filter out edge gaps (first/last 5% of image)
    margin = w // 20
    gaps = [(s, e) for s, e in gaps if s > margin and e < w - margin]

    if len(gaps) >= n_splits:
        # Pick the gaps closest to the ideal split positions
        ideal_positions = [(i + 1) * w // (n_splits + 1) for i in range(n_splits)]
        chosen = []
        remaining = list(gaps)
        for ideal in ideal_positions:
            best = min(remaining, key=lambda g: abs((g[0] + g[1]) // 2 - ideal))
            chosen.append((best[0] + best[1]) // 2)
            remaining.remove(best)
        return sorted(chosen)

    # Fallback: equal thirds
    print("  Warning: could not find clear gaps, falling back to equal splits")
    return [(i + 1) * w // (n_splits + 1) for i in range(n_splits)]


def remove_background(image, interior_min_size=100):
    """Remove magenta background using flood fill from edges + interior gap removal."""
    image = image.convert("RGBA")
    w, h = image.size
    pixels = image.load()

    # Seed from every border pixel
    border_seeds = set()
    for x in range(w):
        border_seeds.add((x, 0))
        border_seeds.add((x, h - 1))
    for y in range(h):
        border_seeds.add((0, y))
        border_seeds.add((w - 1, y))

    # Remove outer magenta background
    outer_bg = _flood_fill(pixels, w, h, border_seeds, _is_magenta)
    for x, y in outer_bg:
        pixels[x, y] = (0, 0, 0, 0)

    # Find and remove interior magenta gaps (between arms, legs, etc.)
    transparent = set(outer_bg)
    checked = set(outer_bg)
    for y in range(h):
        for x in range(w):
            if (x, y) in checked:
                continue
            if not _is_magenta(pixels[x, y]):
                checked.add((x, y))
                continue
            region = _flood_fill(pixels, w, h, [(x, y)], _is_magenta)
            checked.update(region)
            if len(region) >= interior_min_size:
                for rx, ry in region:
                    pixels[rx, ry] = (0, 0, 0, 0)
                transparent.update(region)

    # Final global sweep: remove any remaining pixel with magenta character.
    # Magenta never belongs in a Pokemon sprite, so this is safe.
    for y in range(h):
        for x in range(w):
            r, g, b, a = pixels[x, y]
            if a == 0:
                continue
            if _is_magenta_fringe((r, g, b)):
                pixels[x, y] = (0, 0, 0, 0)

    return image


# Reorder so pre-evolutions come before their evolutions, but otherwise
# preserve the original file order.
pokemon_by_id = {mon["id"]: mon for mon in pokemon_list}
ordered = []
added = set()


def add_mon(mon):
    if mon["id"] in added:
        return
    chain = mon.get("evolution_chain")
    if chain and chain.get("evolves_from"):
        pre = pokemon_by_id.get(chain["evolves_from"])
        if pre:
            add_mon(pre)
    added.add(mon["id"])
    ordered.append(mon)


for mon in pokemon_list:
    add_mon(mon)
pokemon_list = ordered

def generate_mon(mon, dep_future=None):
    """Generate sprites for a single pokemon. Waits on dep_future if provided."""
    if dep_future is not None:
        dep_future.result()  # block until pre-evolution is done

    name = mon["name"]
    species = mon["real_species"]
    types = ", ".join(mon["types"])
    sprite_dir = f"sprites/{mon['id']}"
    os.makedirs(sprite_dir, exist_ok=True)
    output_sheet = f"{sprite_dir}/sheet.png"
    output_front = f"{sprite_dir}/front.png"
    output_back = f"{sprite_dir}/back.png"
    output_tpose = f"{sprite_dir}/tpose.png"

    if os.path.exists(output_front) and os.path.exists(output_back) and os.path.exists(output_tpose):
        print(f"Skipping {name} (already exists)")
        return

    # Build evolution context and collect previous evolution sprite
    evo_context = ""
    prev_sprite_path = None
    chain = mon.get("evolution_chain")
    if chain:
        stage = chain["stage"]
        total = chain["total_stages"]
        evolves_from = chain.get("evolves_from")
        if evolves_from:
            prev_sprite_path = f"sprites/{evolves_from}/front.png"

        if stage == 1 and total > 1:
            evo_context = (
                f"This is a baby/first-stage Pokemon (stage {stage} of {total}). "
                f"It should look small, cute, and juvenile — big eyes, round proportions, playful expression. "
            )
            if chain.get("evolves_into"):
                evo_context += f"It evolves into {chain['evolves_into']}, so its design should hint at what it will become. "
        elif stage == total:
            evo_context = (
                f"This is the final evolution (stage {stage} of {total}). "
                f"It should look powerful, formidable, and imposing — larger, more serious expression, sharper features. "
            )
            if evolves_from:
                evo_context += f"It evolved from {evolves_from}, so it should clearly be a grown-up version of the same creature. "
        else:
            evo_context = (
                f"This is a mid-stage evolution (stage {stage} of {total}). "
                f"It should look adolescent — between cute and powerful, showing growth from its previous form. "
            )
            if evolves_from:
                evo_context += f"It evolved from {evolves_from}. "
            if chain.get("evolves_into"):
                evo_context += f"It will evolve into {chain['evolves_into']}. "

    if not evo_context:
        evo_context = "It should look serious and cool — a distinct Pokemon that occupies a clear niche and could be someone's favorite. "

    sprite_desc = mon.get("sprite_description", "")
    features = ", ".join(mon.get("distinguishing_features", []))

    prompt_text = (
        f"Generate a sprite sheet of a Pokemon in the style of Gen 4 (Diamond/Pearl/Platinum) pixel art. "
        f"The image should contain exactly 3 sprites of the SAME Pokemon arranged in a single row on a plain solid bright magenta (#FF00FF) background. "
        f"LAYOUT: Divide the image into 3 equal-width columns. Each sprite must fit entirely within its column — "
        f"no part of any sprite may cross into an adjacent column. Leave a visible vertical magenta gap between columns. "
        f"Each sprite should be roughly the same size and centered within its column. "
        f"CONSISTENCY: All three sprites must depict the EXACT same creature with identical colors, patterns, markings, and proportions — "
        f"they are three views of ONE design, not three different interpretations. "
        f"Left column: one front-facing battle sprite (3/4 view from the front, idle combat stance). "
        f"Center column: one back-facing battle sprite (3/4 view from behind, same combat stance as the front sprite). "
        f"Right column: one front-facing T-pose for rigging — the creature seen from the FRONT (stomach-facing the viewer) "
        f"with arms/limbs extended straight out to the sides horizontally. "
        f"If the creature has no arms or limbs, show it front-facing in a neutral upright pose with its body fully visible. "
        f"The T-pose must face the viewer. "
        f"The Pokemon is called {name}, a {types}-type inspired by {species}. "
        f"{evo_context}"
        f"Description: {sprite_desc} "
        f"Key features: {features}. "
        f"Clean 1px pixel art outlines, cel-shaded coloring, limited palette. "
        f"The design should be distinct and clearly Pokemon-like."
    )

    # Build contents: include previous evolution sprite if available
    contents = []
    if prev_sprite_path and os.path.exists(prev_sprite_path):
        prev_image = Image.open(prev_sprite_path)
        buf = io.BytesIO()
        prev_image.save(buf, format="PNG")
        contents.append(genai.types.Part.from_bytes(data=buf.getvalue(), mime_type="image/png"))
        contents.append(f"Above is the sprite for {chain['evolves_from']}, the previous evolution. "
                        f"Your design MUST look like a clear visual progression from this sprite, and be "
                        f"more evolved. Keep the same color scheme and core features, but it should be visibly distinct, as a next entry in the evolutionary line.\n\n"
                        + prompt_text)
        print(f"Generating {name} ({species}, {types}) [with {chain['evolves_from']} reference]...")
    else:
        contents.append(prompt_text)
        print(f"Generating {name} ({species}, {types})...")

    try:
        response = client.models.generate_content(
            model="gemini-3-pro-image-preview",
            contents=contents,
            config=genai.types.GenerateContentConfig(
                response_modalities=["TEXT", "IMAGE"],
            ),
        )

        for part in response.candidates[0].content.parts:
            if part.inline_data is not None:
                img_data = part.inline_data.data
                sheet = Image.open(io.BytesIO(img_data))
                sheet = remove_background(sheet)
                sheet.save(output_sheet)
                w, h = sheet.size
                splits = find_split_columns(sheet)
                front = sheet.crop((0, 0, splits[0], h))
                back = sheet.crop((splits[0], 0, splits[1], h))
                tpose = sheet.crop((splits[1], 0, w, h))
                front.save(output_front)
                back.save(output_back)
                tpose.save(output_tpose)
                print(f"  Saved sheet + splits at x={splits[0]}, x={splits[1]}")
                break
        else:
            print(f"  No image returned for {name}")
    except Exception as e:
        print(f"  Error generating {name}: {e}")


parser = argparse.ArgumentParser()
parser.add_argument("-n", "--parallel", type=int, default=4,
                    help="number of parallel generations (default: 4)")
args = parser.parse_args()

futures = {}  # mon_id -> Future
with concurrent.futures.ThreadPoolExecutor(max_workers=args.parallel) as pool:
    for mon in pokemon_list:
        chain = mon.get("evolution_chain")
        dep = None
        if chain and chain.get("evolves_from"):
            dep = futures.get(chain["evolves_from"])
        fut = pool.submit(generate_mon, mon, dep)
        futures[mon["id"]] = fut

    # Wait for all and surface any exceptions
    for mon_id, fut in futures.items():
        try:
            fut.result()
        except Exception as e:
            print(f"  Failed {mon_id}: {e}")

print("Done!")
