"""Transform an image into a Pokemon-style image using the Gemini API."""

import base64
import io
import sys
from pathlib import Path

import argparse

from google import genai
from PIL import Image

POKEMON_PROMPT = (
    "Redesign the subject of this image as if it were an official Pokemon creature "
    "illustrated by Ken Sugimori for the Pokemon video games. "
    "Draw it in Sugimori's exact style: clean black ink outlines, soft watercolor shading, "
    "rounded friendly proportions, large shiny eyes, and a plain white background. "
    "The creature should look like it naturally evolved in the Pokemon world — "
    "add elemental features (fire, water, grass, electric, etc.) that suit its appearance. "
    "Output ONLY the creature illustration on a white background. "
    "Do NOT include any text, labels, names, Pokedex entries, cards, borders, or UI elements."
)

DEFAULT_MODEL = "gemini-3-pro-image-preview"

MIME_MAP = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".webp": "image/webp",
    ".gif": "image/gif",
}


def main():
    parser = argparse.ArgumentParser(
        description="Transform an image into a Pokemon-style image using Gemini"
    )
    parser.add_argument("image", type=str, help="Path to input image")
    parser.add_argument("--api-key", required=True, help="Gemini API key")
    parser.add_argument(
        "--output",
        type=str,
        default="output.png",
        help="Output image file path (default: output.png)",
    )
    parser.add_argument(
        "--model",
        type=str,
        default=DEFAULT_MODEL,
        help=f"Gemini model to use (default: {DEFAULT_MODEL})",
    )
    args = parser.parse_args()

    image_path = Path(args.image)
    if not image_path.exists():
        print(f"Error: image not found: {image_path}", file=sys.stderr)
        sys.exit(1)

    Image.open(image_path).verify()

    suffix = image_path.suffix.lower()
    mime_type = MIME_MAP.get(suffix)
    if mime_type is None:
        print(f"Error: unsupported image format: {suffix}", file=sys.stderr)
        sys.exit(1)

    image_bytes = image_path.read_bytes()

    print(f"Sending {image_path} to Gemini ({args.model})...")

    client = genai.Client(api_key=args.api_key)

    image_part = genai.types.Part.from_bytes(data=image_bytes, mime_type=mime_type)

    response = client.models.generate_content(
        model=args.model,
        contents=[image_part, POKEMON_PROMPT],
        config=genai.types.GenerateContentConfig(
            response_modalities=["TEXT", "IMAGE"]
        ),
    )

    result_image_bytes = None
    for part in response.candidates[0].content.parts:
        if part.inline_data is not None:
            raw = part.inline_data.data
            if isinstance(raw, bytes):
                result_image_bytes = raw
            else:
                result_image_bytes = base64.b64decode(raw)
            break

    if result_image_bytes is None:
        text_parts = [
            p.text for p in response.candidates[0].content.parts if p.text
        ]
        print("Error: Gemini returned no image.", file=sys.stderr)
        if text_parts:
            print("Gemini response:", " ".join(text_parts), file=sys.stderr)
        sys.exit(1)

    output_path = Path(args.output)
    result_image = Image.open(io.BytesIO(result_image_bytes))
    result_image.save(output_path)
    print(f"Saved Pokemon-style image to {output_path}")


if __name__ == "__main__":
    main()
