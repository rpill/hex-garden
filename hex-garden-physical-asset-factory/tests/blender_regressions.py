"""Run with blender --background --python-exit-code 1 --python this_file."""
import sys
import unittest
from pathlib import Path

import bpy
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from tools.blender import physical_asset_factory as factory


class GeometryRegressions(unittest.TestCase):
    def setUp(self):
        factory.clear_scene()
        self.manifest = factory.load_manifest(ROOT / "art/physical-premium-manifest.json")

    def test_straight_svg_strokes_follow_sphere_between_endpoints(self):
        piece = self.manifest["pieces"][0]  # Salt has long straight strokes.
        objects = factory.create_icon_inlay(self.manifest, piece)
        radius = self.manifest["piece_geometry"]["orb_radius"]
        for obj in objects:
            if not obj.name.startswith("IconInlay"):
                continue
            points = obj.data.splines[0].points
            for a, b in zip(points, list(points)[1:]):
                midpoint = (Vector(a.co[:3]) + Vector(b.co[:3])) / 2
                self.assertGreaterEqual(midpoint.length, radius - 0.0005,
                                        f"{obj.name}: stroke sinks inside sphere")

    def test_orb_fits_inside_socket_without_intersection(self):
        board, geo = self.manifest["board"], self.manifest["piece_geometry"]
        separation = abs(geo["preview_piece_center_z"] - board["socket_center_z"])
        self.assertLessEqual(separation + geo["orb_radius"], board["socket_radius"] + 1e-6)

    def test_every_cell_face_uses_ceramic_after_boolean(self):
        cell = factory.create_board_cell(self.manifest)
        for polygon in cell.data.polygons:
            self.assertIsNotNone(cell.data.materials[polygon.material_index],
                                 "Boolean left faces assigned to an empty material slot")

    def test_area_lights_face_subject(self):
        for light in factory.create_lights(self.manifest):
            axis = light.rotation_euler.to_quaternion() @ Vector((0, 0, -1))
            desired = -light.location.normalized()
            self.assertGreater(axis.dot(desired), 0.999, light.name)

    def test_every_piece_builds_with_assigned_materials_and_outward_fills(self):
        for piece in self.manifest["pieces"]:
            with self.subTest(piece=piece["id"]):
                objects = factory.create_piece(self.manifest, piece)
                self.assertTrue(objects)
                for obj in objects:
                    self.assertTrue(obj.data.materials)
                    if obj.type == "MESH":
                        self.assertTrue(all(obj.data.materials[p.material_index] is not None for p in obj.data.polygons))
                        if obj.name.startswith("IconFill"):
                            self.assertTrue(all(p.normal.z > 0 for p in obj.data.polygons), obj.name)
                factory._delete_objects(objects)


if __name__ == "__main__":
    result = unittest.TextTestRunner(verbosity=2).run(unittest.defaultTestLoader.loadTestsFromTestCase(GeometryRegressions))
    if not result.wasSuccessful():
        raise SystemExit(1)
