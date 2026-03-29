"""Generate a textured 3D mesh (GLB) from an image using Hunyuan3D-2."""

import argparse
import sys
from pathlib import Path

import torch
from PIL import Image


def main():
    parser = argparse.ArgumentParser(description="Generate a 3D mesh from an image")
    parser.add_argument("image", type=str, help="Path to input image")
    parser.add_argument(
        "--output",
        type=str,
        default="output.glb",
        help="Output GLB file path (default: output.glb)",
    )
    args = parser.parse_args()

    image_path = Path(args.image)
    if not image_path.exists():
        print(f"Error: image not found: {image_path}", file=sys.stderr)
        sys.exit(1)

    image = Image.open(image_path)

    device = torch.device("cpu")

    # Shape generation
    from hy3dgen.shapegen import Hunyuan3DDiTFlowMatchingPipeline

    print("Loading shape generation pipeline...")
    shape_pipeline = Hunyuan3DDiTFlowMatchingPipeline.from_pretrained(
        "tencent/Hunyuan3D-2",
        subfolder="hunyuan3d-dit-v2-0",
        torch_dtype=torch.float32,
        device=device,
    )

    print("Generating 3D shape...")
    mesh = shape_pipeline(image=image)

    # Texture painting
    from hy3dgen.texgen import Hunyuan3DPaintPipeline

    print("Loading texture paint pipeline...")
    paint_pipeline = Hunyuan3DPaintPipeline.from_pretrained(
        "tencent/Hunyuan3D-2",
        subfolder="hunyuan3d-paint-v2-0",
        torch_dtype=torch.float32,
        device=device,
    )

    print("Painting texture...")
    textured_mesh = paint_pipeline(mesh, image=image)

    # Export
    output_path = Path(args.output)
    textured_mesh.export(str(output_path))
    print(f"Saved mesh to {output_path}")


if __name__ == "__main__":
    main()
