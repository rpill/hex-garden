from __future__ import annotations

import json
import hashlib
import math
import re
import xml.etree.ElementTree as ET
from pathlib import Path
from typing import Iterable

EXPECTED_PIECE_IDS = [
    "salt", "air", "fire", "water", "earth", "quicksilver", "gold", "silver",
    "copper", "iron", "tin", "lead", "vitae", "mors", "quintessence",
]

NUMBER_RE = r"[-+]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][-+]?\d+)?"
TOKEN_RE = re.compile(rf"[MLHVCQZ]|{NUMBER_RE}")
SUPPORTED_COMMANDS = set("MLHVCQZ")


def pointy_hex_position(q: int, r: int, outer_radius: float = 1.0, spacing_scale: float = 1.0) -> tuple[float, float]:
    """Return axial-grid center coordinates for a pointy-top regular hex.

    ``outer_radius`` is the center-to-vertex radius of the rendered cell.
    ``spacing_scale`` is a tiny seam/overlap control; 1.0 is exact mathematical tiling.
    """
    radius = float(outer_radius)
    scale = float(spacing_scale)
    x = math.sqrt(3.0) * radius * (float(q) + float(r) / 2.0) * scale
    y = 1.5 * radius * float(r) * scale
    return x, y


def load_manifest(path: str | Path) -> dict:
    path = Path(path)
    with path.open("r", encoding="utf-8") as fh:
        data = json.load(fh)
    if not isinstance(data, dict):
        raise ValueError("Manifest root must be an object")
    return data


def expected_runtime_files(manifest: dict) -> list[str]:
    return ["board-cell.png", *[f"piece-{piece['id']}.png" for piece in manifest.get("pieces", [])]]


def validate_manifest(manifest: dict, project_root: str | Path) -> list[str]:
    root = Path(project_root)
    errors: list[str] = []

    pieces = manifest.get("pieces")
    if not isinstance(pieces, list):
        return ["manifest.pieces must be an array"]

    ids = [piece.get("id") for piece in pieces]
    if ids != EXPECTED_PIECE_IDS:
        errors.append(f"piece id order must be exactly {EXPECTED_PIECE_IDS!r}; got {ids!r}")

    render = manifest.get("render", {})
    size = render.get("render_size")
    if not isinstance(size, int) or size < 512:
        errors.append("render.render_size must be an integer >= 512")

    board = manifest.get("board", {})
    piece_geo = manifest.get("piece_geometry", {})
    try:
        socket_radius = float(board["socket_radius"])
        orb_radius = float(piece_geo["orb_radius"])
        if socket_radius <= orb_radius:
            errors.append("board.socket_radius must be greater than piece_geometry.orb_radius")
    except (KeyError, TypeError, ValueError):
        errors.append("board.socket_radius and piece_geometry.orb_radius must be numeric")

    valid_shapes = {"orb"}
    valid_materials = {"crystal", "opal", "glass", "mineral", "liquid_metal", "metal", "obsidian"}
    valid_markings = {"holes", "slot", "ring", "stud"}

    icon_dir = root / "art" / "physical-icons"
    for index, piece in enumerate(pieces):
        prefix = f"pieces[{index}]"
        pid = piece.get("id")
        shape = piece.get("shape")
        if shape not in valid_shapes:
            errors.append(f"{prefix}.shape invalid: {shape!r}")
        material_kind = piece.get("material_kind")
        if material_kind not in valid_materials:
            errors.append(f"{prefix}.material_kind invalid: {material_kind!r}")
        color = piece.get("base_color")
        if not (isinstance(color, list) and len(color) == 4 and all(isinstance(v, (int, float)) for v in color)):
            errors.append(f"{prefix}.base_color must be four numbers")
        if shape == "orb":
            if material_kind == "metal":
                marking = piece.get("marking")
                if not isinstance(marking, dict) or marking.get("type") not in valid_markings:
                    errors.append(f"{prefix}.marking must use one of {sorted(valid_markings)} for metal orb")
                elif marking.get("type") == "holes":
                    count = marking.get("count")
                    if not isinstance(count, int) or not (1 <= count <= 6):
                        errors.append(f"{prefix}.marking.count must be 1..6")
                elif marking.get("type") == "slot":
                    axis = marking.get("axis", "vertical")
                    if axis not in {"vertical", "horizontal"}:
                        errors.append(f"{prefix}.marking.axis must be vertical or horizontal")
            else:
                icon_name = piece.get("icon_svg")
                if not icon_name:
                    errors.append(f"{prefix}.icon_svg required for non-metal orb")
                else:
                    icon_path = icon_dir / icon_name
                    if not icon_path.exists():
                        errors.append(f"missing SVG for {pid}: {icon_path}")
                    else:
                        try:
                            parsed = parse_svg_paths(icon_path)
                            if not parsed:
                                errors.append(f"SVG contains no drawable paths: {icon_path}")
                        except Exception as exc:  # validation should report, not abort
                            errors.append(f"cannot parse SVG {icon_path}: {exc}")

    return errors


def _tokenize_path(d: str) -> list[str]:
    remainder = TOKEN_RE.sub("", d.replace(",", " ")).strip()
    if remainder:
        raise ValueError(f"unsupported SVG path syntax: {remainder!r}; use absolute M/L/H/V/C/Q/Z")
    tokens = TOKEN_RE.findall(d.replace(",", " "))
    if not tokens:
        raise ValueError("empty path")
    return tokens


def _sample_cubic(p0, p1, p2, p3, steps: int = 12):
    out = []
    for i in range(1, steps + 1):
        t = i / steps
        u = 1.0 - t
        x = u**3*p0[0] + 3*u*u*t*p1[0] + 3*u*t*t*p2[0] + t**3*p3[0]
        y = u**3*p0[1] + 3*u*u*t*p1[1] + 3*u*t*t*p2[1] + t**3*p3[1]
        out.append((x, y))
    return out


def _sample_quadratic(p0, p1, p2, steps: int = 10):
    out = []
    for i in range(1, steps + 1):
        t = i / steps
        u = 1.0 - t
        x = u*u*p0[0] + 2*u*t*p1[0] + t*t*p2[0]
        y = u*u*p0[1] + 2*u*t*p1[1] + t*t*p2[1]
        out.append((x, y))
    return out


def parse_svg_path_d(d: str) -> list[list[tuple[float, float]]]:
    tokens = _tokenize_path(d)
    paths: list[list[tuple[float, float]]] = []
    current_path: list[tuple[float, float]] = []
    current = (0.0, 0.0)
    start = (0.0, 0.0)
    cmd = None
    i = 0

    def number(index: int) -> float:
        if index >= len(tokens) or tokens[index] in SUPPORTED_COMMANDS:
            raise ValueError(f"expected number at token {index}")
        return float(tokens[index])

    while i < len(tokens):
        if tokens[i] in SUPPORTED_COMMANDS:
            cmd = tokens[i]
            i += 1
        if cmd is None:
            raise ValueError("path must begin with a supported command")

        if cmd == "M":
            x, y = number(i), number(i + 1); i += 2
            if current_path:
                paths.append(current_path)
            current = start = (x, y)
            current_path = [current]
            cmd = "L"
        elif cmd == "L":
            x, y = number(i), number(i + 1); i += 2
            current = (x, y)
            current_path.append(current)
        elif cmd == "H":
            x = number(i); i += 1
            current = (x, current[1])
            current_path.append(current)
        elif cmd == "V":
            y = number(i); i += 1
            current = (current[0], y)
            current_path.append(current)
        elif cmd == "C":
            p1 = (number(i), number(i + 1))
            p2 = (number(i + 2), number(i + 3))
            p3 = (number(i + 4), number(i + 5))
            i += 6
            current_path.extend(_sample_cubic(current, p1, p2, p3))
            current = p3
        elif cmd == "Q":
            p1 = (number(i), number(i + 1))
            p2 = (number(i + 2), number(i + 3))
            i += 4
            current_path.extend(_sample_quadratic(current, p1, p2))
            current = p2
        elif cmd == "Z":
            if current_path and current_path[-1] != start:
                current_path.append(start)
            if current_path:
                paths.append(current_path)
            current_path = []
            current = start
            cmd = None
        else:
            raise ValueError(f"unsupported SVG command {cmd!r}")

    if current_path:
        paths.append(current_path)
    return [path for path in paths if len(path) >= 2]


def parse_svg_paths(path: str | Path) -> list[list[tuple[float, float]]]:
    root = ET.parse(Path(path)).getroot()
    paths: list[list[tuple[float, float]]] = []
    for elem in root.iter():
        if elem.tag.endswith("path"):
            d = elem.attrib.get("d", "").strip()
            if d:
                paths.extend(parse_svg_path_d(d))
    return paths


def parse_svg_fills(path: str | Path) -> list[list[tuple[float, float]]]:
    """Only explicitly filled, simple closed outlines (no implicit SVG default)."""
    root = ET.parse(Path(path)).getroot()
    return [outline for elem in root.iter()
            if elem.tag.endswith("path") and elem.attrib.get("fill", "none") != "none"
            for outline in parse_svg_path_d(elem.attrib["d"])
            if outline[0] == outline[-1]]


def source_fingerprint(root: str | Path) -> str:
    root = Path(root)
    paths = [root / "art/physical-premium-manifest.json",
             root / "tools/blender/physical_asset_factory.py",
             root / "tools/physical_assets/factory_core.py",
             *sorted((root / "art/physical-icons").glob("*.svg"))]
    digest = hashlib.sha256()
    for path in paths:
        digest.update(path.relative_to(root).as_posix().encode())
        digest.update(path.read_bytes().replace(b"\r\n", b"\n"))
    return digest.hexdigest()


def write_build_metadata(root: Path, output_dir: Path, manifest: dict, generated: list[str]) -> None:
    """A targeted build updates only its records; stale neighbours remain detectable."""
    path = output_dir / "asset-factory-manifest.json"
    previous = json.loads(path.read_text()) if path.exists() else {}
    records = previous.get("assets", {})
    fingerprint = source_fingerprint(root)
    for filename in generated:
        records[filename] = {"source_sha256": fingerprint,
                             "png_sha256": hashlib.sha256((output_dir / filename).read_bytes()).hexdigest()}
    metadata = {"factory_version": 11, "manifest_version": manifest["version"],
                "render_size": manifest["render"]["render_size"],
                "files": [name for name in expected_runtime_files(manifest) if name in records],
                "assets": records}
    path.write_text(json.dumps(metadata, indent=2) + "\n", encoding="utf-8")
