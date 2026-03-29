# 3D Rigging Guide — Denver Pokedex Sprites

## Pipeline Overview

```
2D Sprite → 3D Mesh (TRELLIS.2 / Hunyuan3D) → Texture (Meshy AI) → Rig → Animate
```

## Mesh Generation

- **TRELLIS.2**: `microsoft-trellis-2.hf.space` — best mesh quality for stylized characters
- **Hunyuan3D-2.1**: `hy-3d.com` — two-stage pipeline (DiT + Paint), should texture automatically
- **Tripo3D**: `tripo3d.ai` — best API, 2000 free credits on signup, v3.1 model

Output format: **GLB** (geometry + textures + PBR materials in one file)

## Texturing Bare Meshes

If you get untextured mesh (common on free GPU tiers):
- **Meshy AI** (`meshy.ai`) — upload OBJ + sprite as reference image → AI paints PBR textures
- **Tripo** retexture — upload mesh, use sprite as style reference

## Rigging by Body Type

### Bipeds → Mixamo (automatic)

Grizzmont, Trembark, Ursapine, Liberion, Marmochunk, Columbelle, etc.

1. Convert GLB to OBJ and decimate to ~30K faces:
   ```python
   import trimesh, fast_simplification, numpy as np
   scene = trimesh.load('creature.glb')
   mesh = list(scene.geometry.values())[0]
   verts, faces = fast_simplification.simplify(
       mesh.vertices.astype(np.float32),
       mesh.faces.astype(np.int32),
       target_reduction=1.0 - (30000 / len(mesh.faces))
   )
   trimesh.Trimesh(vertices=verts, faces=faces).export('creature.obj')
   ```
2. Upload OBJ to [Mixamo](https://www.mixamo.com)
3. Auto-rig → pick animations (idle, walk, attack) → download as FBX

### Quadrupeds → Blender Rigify

Swifthorn, Muledoe, Elkid, Peaklion, Cougarock, Pumakitten, Coyotrik, Howlpup, Tigermander, Croakini, Tortaura

1. Install Blender: `brew install --cask blender`
2. Enable Rigify addon (Edit → Preferences → Add-ons → Rigify)
3. Add → Armature → select quadruped meta-rig (cat/horse/wolf)
4. Scale and position bone markers to fit mesh
5. Generate Rig → parent mesh with automatic weights

### Special Rigs (custom Blender)

- **Venomrattle** (snake) — spine-only rig, chain of bones along the body
- **Flying creatures** (Obsidiwing, Redgale, etc.) — biped rig + wing bones
- **Frog/toad** (Croakini) — quadruped with exaggerated back legs

## Seed Image Guidance for Quadrupeds

The 2D sprite pose directly affects 3D mesh quality. For quadrupeds, the current 3/4 chibi poses cause merged/overlapping legs in the 3D output.

### Ideal Quadruped Reference Pose ("Bind Pose")

Generate a **side orthographic view** in **neutral standing bind pose**:
- All four legs straight, evenly spaced, clearly separated
- Tail extended outward
- Head facing forward in profile
- No perspective distortion

### Prompt Template for Image Generation

```
pixel art [creature name], side orthographic view, neutral standing bind pose,
all four legs straight and evenly spaced, tail extended, white background,
character model sheet style
```

Or more descriptive:
```
side view of a [creature description], standing neutral pose like a veterinary
anatomy diagram, legs spread and clearly separated, pixel art style,
transparent background
```

### Key Terms

| Term | Meaning |
|------|---------|
| **Bind pose** | Neutral default pose for rigging — the "T-pose" equivalent |
| **Rest pose** | Same as bind pose |
| **Model sheet** | Reference art showing front/side/back views |
| **Orthographic** | Flat view, no perspective distortion |
| **Turnaround** | Multiple angle views of the same character |

### Good vs Bad Reference for Quadrupeds

- **Good**: Swifthorn (side view, legs separated, clean silhouette)
- **Needs redo**: Coyotrik, Howlpup (3/4 chibi, legs overlapping)
- **Acceptable**: Muledoe, Peaklion (legs mostly visible)

## Tools Summary

| Task | Tool | Cost |
|------|------|------|
| Sprite → 3D mesh | TRELLIS.2 | Free (HuggingFace) |
| Sprite → textured 3D | Tripo3D | Free credits on signup |
| Paint bare mesh | Meshy AI | 200 free credits/mo |
| Biped rigging | Mixamo | Free (Adobe account) |
| Quadruped rigging | Blender Rigify | Free |
| Animation library | Mixamo | Free |
| Custom animation | Cascadeur / Blender | Free |
