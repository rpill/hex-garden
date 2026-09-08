"""Validate pixels and provenance using Blender, or ordinary Python with Pillow."""
from __future__ import annotations
import argparse
import hashlib
import json
import sys
from array import array
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))
from tools.physical_assets.factory_core import expected_runtime_files, load_manifest, validate_manifest, source_fingerprint


def alpha_bounds(path):
    try:
        import bpy
    except ImportError:
        from PIL import Image
        with Image.open(path) as image:
            if image.mode != "RGBA":
                raise ValueError(f"expected RGBA, got {image.mode}")
            return image.size, image.getchannel("A").getbbox()
    image = bpy.data.images.load(str(path), check_existing=False)
    try:
        width, height = image.size
        if image.channels != 4:
            raise ValueError(f"expected RGBA, got {image.channels} channels")
        pixels = array('f', [0.0]) * (width * height * 4)
        image.pixels.foreach_get(pixels)
        xs, ys = [], []
        for row in range(height):
            occupied = [x for x in range(width) if pixels[(row * width + x) * 4 + 3] > 0]
            if occupied:
                xs.extend((occupied[0], occupied[-1]))
                ys.append(row)
        bbox = (min(xs), min(ys), max(xs) + 1, max(ys) + 1) if xs else None
        return (width, height), bbox
    finally:
        bpy.data.images.remove(image)


def verify(only="") -> int:
    manifest = load_manifest(ROOT / "art/physical-premium-manifest.json")
    output_dir = ROOT / "public/assets/physical-premium"
    failures = validate_manifest(manifest, ROOT)
    names = expected_runtime_files(manifest)
    if only:
        selected = [f"piece-{pid.strip()}.png" if pid.strip() != "board-cell" else "board-cell.png"
                    for pid in only.split(",") if pid.strip()]
        for name in selected:
            if name not in names:
                failures.append(f"unknown asset: {name}")
        names = selected
    metadata_path = output_dir / "asset-factory-manifest.json"
    records = json.loads(metadata_path.read_text()).get("assets", {}) if metadata_path.exists() else {}
    fingerprint = source_fingerprint(ROOT)
    expected_size = int(manifest["render"]["render_size"])
    for filename in names:
        path = output_dir / filename
        if not path.exists():
            failures.append(f"missing {filename}")
            continue
        record = records.get(filename, {})
        if record.get("source_sha256") != fingerprint:
            failures.append(f"{filename}: stale source fingerprint; rebuild this asset")
        if record.get("png_sha256") != hashlib.sha256(path.read_bytes()).hexdigest():
            failures.append(f"{filename}: PNG checksum differs from build record")
        try:
            size, bbox = alpha_bounds(path)
        except Exception as exc:
            failures.append(f"{filename}: cannot read RGBA: {exc}")
            continue
        if size != (expected_size, expected_size):
            failures.append(f"{filename}: size {size}, expected {expected_size} square")
        if bbox is None:
            failures.append(f"{filename}: fully transparent")
            continue
        left, top, right, bottom = bbox
        cx, cy = (left+right-1)/2, (top+bottom-1)/2
        target = (expected_size-1)/2
        if abs(cx-target) > 2 or abs(cy-target) > 2:
            failures.append(f"{filename}: alpha bbox center ({cx:.2f},{cy:.2f}) is not centered")
        if min(left, top, expected_size-right, expected_size-bottom) < 8:
            failures.append(f"{filename}: alpha touches canvas too closely")
    if failures:
        print("Physical asset verification FAILED:\n - " + "\n - ".join(failures))
        return 1
    print(f"Physical asset verification PASS: {len(names)} centered {expected_size}px RGBA PNGs; current source and PNG hashes")
    return 0


if __name__ == "__main__":
    args = sys.argv[sys.argv.index("--")+1:] if "--" in sys.argv else sys.argv[1:]
    parser = argparse.ArgumentParser()
    parser.add_argument("--only", default="", nargs="?")
    raise SystemExit(verify(parser.parse_args(args).only or ""))
