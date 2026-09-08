from pathlib import Path
import argparse
import sys

THIS_FILE = Path(__file__).resolve()
PROJECT_ROOT = THIS_FILE.parents[2]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from tools.blender.physical_asset_factory import generate_selected


def parse_args():
    args = sys.argv
    user_args = args[args.index("--") + 1:] if "--" in args else []
    parser = argparse.ArgumentParser(description="Generate Hex Garden physical assets")
    parser.add_argument(
        "--only",
        default="",
        help="Comma-separated ids: board-cell, water, fire, gold, ...; empty = all",
    )
    return parser.parse_args(user_args)


args = parse_args()
manifest = PROJECT_ROOT / "art" / "physical-premium-manifest.json"
output = PROJECT_ROOT / "public" / "assets" / "physical-premium"
files = generate_selected(manifest, output, only=args.only or None)
print("Hex Garden physical assets generated:")
for name in files:
    print(" -", name)
