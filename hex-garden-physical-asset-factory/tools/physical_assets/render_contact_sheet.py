"""Optional Pillow QA sheet assembled from the actual exported RGBA sprites.

No retouching of production assets. Run after build_physical_assets.ps1.
"""
import json
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[2]


def render_contact_sheet():
    manifest = json.loads((ROOT / "art/physical-premium-manifest.json").read_text())
    assets = ROOT / "public/assets/physical-premium"
    canvas = Image.new("RGBA", (1280, 1060), "#082820")
    draw = ImageDraw.Draw(canvas)
    font = ImageFont.load_default(size=20)
    small = ImageFont.load_default(size=16)
    draw.text((34, 24), "PHYSICAL ASSET FACTORY  /  EXPORTED PNGs", fill="#eee2c5", font=font)
    draw.text((34, 56), "15 elements + ceramic cell   |   1024 x 1024 RGBA   |   no retouching", fill="#95ac9a", font=small)
    cell = Image.open(assets / "board-cell.png").convert("RGBA")
    for index, piece in enumerate(manifest["pieces"]):
        x, y = (index % 5)*250 + 20, (index // 5)*280 + 95
        orb = Image.open(assets / f"piece-{piece['id']}.png").convert("RGBA")
        composite = Image.alpha_composite(cell, orb).resize((240, 240), Image.Resampling.LANCZOS)
        canvas.alpha_composite(composite, (x, y))
        draw.text((x+120, y+244), piece["id"].upper(), fill="#eee2c5", anchor="mt", font=font)
        # Actual orb diameter ~50 px: the same exported file, with its transparent padding.
        tiny = orb.resize((86, 86), Image.Resampling.LANCZOS)
        canvas.alpha_composite(tiny, (index*82+17, 936))
    draw.text((34, 1030), "Bottom row: symbols at a 50 px orb diameter", fill="#95ac9a", font=small)
    output = ROOT / "art/physical-premium-preview/runtime-contact-sheet.png"
    canvas.convert("RGB").save(output)
    print(output)


if __name__ == "__main__":
    render_contact_sheet()
