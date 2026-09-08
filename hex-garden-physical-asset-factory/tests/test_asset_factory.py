"""Renderer-independent contracts; material tuning is reviewed in rendered images.

V3–V10 tests pinned experimental numeric values and searched shader source strings.
Those checks passed even when EVERY ceramic face had no assigned material. Actual
Blender geometry/material regressions now live in blender_regressions.py.
"""
import copy
import json
import math
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from tools.physical_assets.factory_core import (
    EXPECTED_PIECE_IDS, expected_runtime_files, load_manifest, parse_svg_paths,
    parse_svg_path_d, parse_svg_fills, pointy_hex_position, validate_manifest,
    source_fingerprint, write_build_metadata,
)


class AssetFactoryTests(unittest.TestCase):
    def setUp(self):
        self.manifest = load_manifest(ROOT / "art/physical-premium-manifest.json")

    def test_exact_piece_set_and_output_names(self):
        self.assertEqual([p["id"] for p in self.manifest["pieces"]], EXPECTED_PIECE_IDS)
        self.assertEqual(len(expected_runtime_files(self.manifest)), 16)
        self.assertEqual(expected_runtime_files(self.manifest)[0], "board-cell.png")

    def test_manifest_and_all_symbols_validate(self):
        self.assertEqual(validate_manifest(self.manifest, ROOT), [])
        for path in (ROOT / "art/physical-icons").glob("*.svg"):
            self.assertTrue(parse_svg_paths(path), path.name)

    def test_geometry_keeps_existing_cell_and_orb_footprints(self):
        board, geo = self.manifest["board"], self.manifest["piece_geometry"]
        self.assertEqual(board["orientation"], "pointy")
        for key, value in {"outer_radius": 1, "height": 0.84, "socket_radius": 0.79,
                           "socket_center_z": 0.42, "grid_spacing_scale": 0.996}.items():
            self.assertAlmostEqual(board[key], value)
        self.assertAlmostEqual(geo["orb_radius"], 0.68)
        self.assertTrue(all(p["shape"] == "orb" for p in self.manifest["pieces"]))

    def test_all_six_neighbours_tile_at_same_distance(self):
        neighbours = [(1, 0), (0, 1), (-1, 1), (-1, 0), (0, -1), (1, -1)]
        for q, r in neighbours:
            self.assertAlmostEqual(math.hypot(*pointy_hex_position(q, r)), math.sqrt(3))

    def test_pointy_grid_supports_radius_and_spacing(self):
        self.assertAlmostEqual(pointy_hex_position(1, 0, 2, 0.996)[0], math.sqrt(3)*2*0.996)

    def test_metal_identifiers_keep_distinct_physical_markings(self):
        expected = {"gold": {"type": "slot", "axis": "vertical"},
                    "silver": {"type": "holes", "count": 4},
                    "copper": {"type": "holes", "count": 3},
                    "iron": {"type": "stud"}, "tin": {"type": "holes", "count": 2},
                    "lead": {"type": "slot", "axis": "horizontal"}}
        for piece in self.manifest["pieces"]:
            if piece["id"] in expected:
                self.assertEqual(piece["marking"], expected[piece["id"]])

    def test_invalid_geometry_and_missing_symbols_are_reported(self):
        self.manifest["board"]["socket_radius"] = 0.2
        self.manifest["pieces"][0]["icon_svg"] = "missing.svg"
        errors = validate_manifest(self.manifest, ROOT)
        self.assertTrue(any("greater than" in e for e in errors))
        self.assertTrue(any("missing SVG" in e for e in errors))

    def test_svg_closing_segment_is_preserved(self):
        self.assertEqual(parse_svg_path_d("M0 0 L10 0 V10 H0 Z"),
                         [[(0,0), (10,0), (10,10), (0,10), (0,0)]])

    def test_unsupported_svg_commands_fail_instead_of_silently_distorting_glyph(self):
        for path in ("M0 0 l10 20", "M0 0 A10 10 0 0 1 20 20"):
            with self.assertRaisesRegex(ValueError, "unsupported SVG"):
                parse_svg_path_d(path)

    def test_filled_symbols_are_explicit_closed_outlines(self):
        # One outline avoids coplanar overlaps and crossing strokes in the star's centre.
        self.assertEqual(len(parse_svg_fills(ROOT / "art/physical-icons/fire.svg")), 1)
        self.assertEqual(parse_svg_fills(ROOT / "art/physical-icons/water.svg"), [])

    def test_targeted_build_keeps_other_asset_records(self):
        with tempfile.TemporaryDirectory() as temp:
            output = Path(temp)
            (output / "piece-water.png").write_bytes(b"first-render")
            write_build_metadata(ROOT, output, self.manifest, ["piece-water.png"])
            first = json.loads((output / "asset-factory-manifest.json").read_text())
            (output / "piece-fire.png").write_bytes(b"second-render")
            write_build_metadata(ROOT, output, self.manifest, ["piece-fire.png"])
            second = json.loads((output / "asset-factory-manifest.json").read_text())
            self.assertEqual(second["assets"]["piece-water.png"], first["assets"]["piece-water.png"])
            self.assertEqual(set(second["files"]), {"piece-water.png", "piece-fire.png"})
            self.assertEqual(second["assets"]["piece-fire.png"]["source_sha256"], source_fingerprint(ROOT))


if __name__ == "__main__":
    unittest.main()
