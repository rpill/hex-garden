import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from test_asset_factory import AssetFactoryTests
from blender_regressions import GeometryRegressions

suite = unittest.TestSuite(unittest.defaultTestLoader.loadTestsFromTestCase(case)
                           for case in (AssetFactoryTests, GeometryRegressions))
if not unittest.TextTestRunner(verbosity=2).run(suite).wasSuccessful():
    raise SystemExit(1)
