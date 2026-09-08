from pathlib import Path
import sys
import traceback

THIS_FILE = Path(__file__).resolve()
PROJECT_ROOT = THIS_FILE.parents[2]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from tools.blender.physical_asset_factory import render_preview

manifest = PROJECT_ROOT / "art" / "physical-premium-manifest.json"
preview_dir = PROJECT_ROOT / "art" / "physical-premium-preview"

try:
    files = render_preview(manifest, preview_dir)
except Exception:
    traceback.print_exc()
    sys.exit(1)

print("Hex Garden physical previews rendered:")
for name in files:
    print(" -", name)
