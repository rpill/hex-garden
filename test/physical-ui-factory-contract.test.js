import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const manifestPath = path.join(ROOT, 'tools/physical-ui-factory/ui_manifest.json');
const frozenFactoryPresent = fs.existsSync(manifestPath);

function frozenFactoryTest(name, fn) {
  test(name, { skip: frozenFactoryPresent ? false : 'frozen Physical UI Factory is not part of the live functional checkout' }, fn);
}

const REQUIRED_SURFACES = [
  'system-button',
  'action-button',
  'hud-plate',
  'inventory-tray',
  'counter-plate',
  'panel',
  'card',
];

const REQUIRED_ICONS = [
  'back',
  'pause',
  'restart',
  'settings',
  'shop',
  'hint',
  'undo',
  'rescue',
  'rating',
  'success',
  'failure',
  'next',
  'check',
  'lock',
];

frozenFactoryTest('frozen physical UI source manifest declares the seven reusable surfaces when present', () => {
  assert.ok(fs.existsSync(manifestPath), `missing ${manifestPath}`);
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  assert.equal(manifest.version, 1);
  assert.deepEqual(Object.keys(manifest.surfaces).sort(), [...REQUIRED_SURFACES].sort());
});

frozenFactoryTest('frozen stretchable physical UI surfaces keep valid NineSlice borders when present', () => {
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  for (const [id, surface] of Object.entries(manifest.surfaces)) {
    assert.ok(surface.master.width > 0 && surface.master.height > 0, `${id}: invalid master size`);
    assert.ok(surface.runtime.width > 0 && surface.runtime.height > 0, `${id}: invalid runtime size`);
    const border = surface.nineSlice;
    if (!border) continue;
    for (const key of ['left', 'right', 'top', 'bottom']) {
      assert.ok(border[key] > 0, `${id}: ${key} border must be positive`);
    }
    assert.ok(border.left + border.right < surface.runtime.width, `${id}: horizontal borders overlap`);
    assert.ok(border.top + border.bottom < surface.runtime.height, `${id}: vertical borders overlap`);
  }
});

frozenFactoryTest('frozen physical UI source manifest keeps the neutral icon family when present', () => {
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  for (const id of REQUIRED_ICONS) {
    assert.ok(manifest.icons[id], `missing icon ${id}`);
    assert.match(manifest.icons[id].file, /^icon-[a-z0-9-]+\.png$/);
  }
});

frozenFactoryTest('frozen physical UI factory scripts remain internally complete when present', () => {
  for (const rel of [
    'tools/physical-ui-factory/physical_ui_factory.py',
    'tools/physical-ui-factory/render_ui_preview.py',
    'scripts/build-physical-ui-runtime.mjs',
  ]) {
    assert.ok(fs.existsSync(path.join(ROOT, rel)), `missing ${rel}`);
  }
});


frozenFactoryTest('frozen physical UI brass trim keeps frame geometry when present', () => {
  const rel = 'tools/physical-ui-factory/physical_ui_factory.py';
  const source = fs.readFileSync(path.join(ROOT, rel), 'utf8');

  assert.match(source, /def add_frame\(/, `${rel}: missing frame helper`);
  assert.match(source, /add_frame\(f\"\{kind\}_brass\"/, `${rel}: component brass trim must use frame geometry`);
  assert.doesNotMatch(source, /add_rounded_box\(f\"\{kind\}_brass\"/, `${rel}: solid brass plate would occlude recessed inner surfaces`);
});


frozenFactoryTest('frozen Blender preview entrypoint bootstraps its sibling factory when present', () => {
  const rel = 'tools/physical-ui-factory/render_ui_preview.py';
  const source = fs.readFileSync(path.join(ROOT, rel), 'utf8');
  const rootAssignment = source.indexOf('ROOT = Path(__file__).resolve().parent');
  const sysPathInsert = source.indexOf('sys.path.insert(0, str(ROOT))');
  const factoryImport = source.indexOf('from physical_ui_factory import');

  assert.ok(rootAssignment >= 0, `${rel}: missing script-directory ROOT bootstrap`);
  assert.ok(sysPathInsert > rootAssignment, `${rel}: must add its directory to sys.path`);
  assert.ok(factoryImport > sysPathInsert, `${rel}: sibling factory import must happen after sys.path bootstrap`);
});
