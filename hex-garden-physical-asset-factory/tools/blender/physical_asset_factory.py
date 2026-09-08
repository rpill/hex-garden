from __future__ import annotations

import copy
import json
import math
import os
import random
import sys
from pathlib import Path

import bpy
from mathutils import Vector
from mathutils.geometry import tessellate_polygon

THIS_FILE = Path(__file__).resolve()
PROJECT_ROOT = THIS_FILE.parents[2]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from tools.physical_assets.factory_core import load_manifest, parse_svg_paths, parse_svg_fills, pointy_hex_position, validate_manifest, write_build_metadata  # noqa: E402


# -----------------------------
# Generic helpers
# -----------------------------

def _set_input(node, names, value):
    for name in names:
        if name in node.inputs:
            node.inputs[name].default_value = value
            return True
    return False


def _rgba(values):
    return tuple(float(v) for v in values)


def _srgb_channel_to_linear(value):
    value = float(value)
    return value / 12.92 if value <= 0.04045 else ((value + 0.055) / 1.055) ** 2.4


def srgb_hex_to_linear_rgba(value):
    text = str(value).strip().lstrip("#")
    if len(text) != 6:
        raise ValueError(f"Expected #RRGGBB color, got {value!r}")
    rgb = [int(text[i:i + 2], 16) / 255.0 for i in (0, 2, 4)]
    return tuple(_srgb_channel_to_linear(channel) for channel in rgb) + (1.0,)


def _cfg_color(cfg, hex_key, array_key, fallback):
    if cfg.get(hex_key):
        return srgb_hex_to_linear_rgba(cfg[hex_key])
    if cfg.get(array_key):
        return _rgba(cfg[array_key])
    return fallback


def _piece_base_color(piece):
    return _cfg_color(piece, "base_hex", "base_color", (0.2, 0.2, 0.2, 1.0))


def _piece_accent_color(piece):
    return _cfg_color(piece, "accent_hex", "accent_color", _scaled_color(_piece_base_color(piece), 1.6, 0.03))


def _scaled_color(color, scale, add=0.0):
    return tuple(max(0.0, min(1.0, float(c) * scale + add)) for c in color[:3]) + (1.0,)


def clear_scene():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    for collection in (
        bpy.data.meshes,
        bpy.data.curves,
        bpy.data.materials,
        bpy.data.cameras,
        bpy.data.lights,
    ):
        for block in list(collection):
            if block.users == 0:
                collection.remove(block)


def _principled_material(name, base_color, roughness, metallic=0.0, transmission=0.0, ior=1.46):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    nodes = mat.node_tree.nodes
    links = mat.node_tree.links
    bsdf = nodes.get("Principled BSDF")
    if bsdf is None:
        bsdf = nodes.new("ShaderNodeBsdfPrincipled")
        output = nodes.get("Material Output") or nodes.new("ShaderNodeOutputMaterial")
        links.new(bsdf.outputs["BSDF"], output.inputs["Surface"])
    _set_input(bsdf, ["Base Color"], base_color)
    _set_input(bsdf, ["Roughness"], float(roughness))
    _set_input(bsdf, ["Metallic"], float(metallic))
    _set_input(bsdf, ["Transmission Weight", "Transmission"], float(transmission))
    _set_input(bsdf, ["IOR"], float(ior))
    return mat, bsdf


def _safe_color_management(scene, render_cfg):
    view = str(render_cfg.get("view_transform", "AgX"))
    look = str(render_cfg.get("look", "AgX - Medium High Contrast"))
    exposure = float(render_cfg.get("exposure", 0.0))
    try:
        scene.view_settings.view_transform = view
    except Exception:
        pass
    try:
        scene.view_settings.look = look
    except Exception:
        pass
    scene.view_settings.exposure = exposure


def set_object_smooth(obj):
    if obj.type != "MESH":
        return
    for polygon in obj.data.polygons:
        polygon.use_smooth = True


def apply_modifier(obj, modifier):
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    bpy.ops.object.modifier_apply(modifier=modifier.name)
    obj.select_set(False)


def add_bevel(obj, width, segments=4, apply=True):
    modifier = obj.modifiers.new("Bevel", "BEVEL")
    modifier.width = float(width)
    modifier.segments = int(segments)
    modifier.limit_method = "ANGLE"
    if apply:
        apply_modifier(obj, modifier)
    return modifier


# -----------------------------
# Scene / camera / lighting
# -----------------------------

def configure_scene(manifest, *, preview=False):
    cache = PROJECT_ROOT / ".scratch" / "optix-cache"
    cache.mkdir(parents=True, exist_ok=True)
    os.environ.setdefault("OPTIX_CACHE_PATH", str(cache))
    scene = bpy.context.scene
    render_cfg = manifest["render"]
    requested = str(render_cfg.get("engine", "CYCLES")).upper()
    if requested == "EEVEE":
        scene.render.engine = "BLENDER_EEVEE"
    else:
        scene.render.engine = "CYCLES"
        # Use available hardware without depending on a user's saved Blender prefs.
        preferences = bpy.context.preferences.addons["cycles"].preferences
        scene.cycles.device = "CPU"
        for backend in ("OPTIX", "CUDA", "HIP", "METAL", "ONEAPI"):
            try:
                preferences.compute_device_type = backend
                preferences.refresh_devices()
                available = [device for device in preferences.devices if device.type == backend]
                if available:
                    for device in preferences.devices:
                        device.use = device.type == backend
                    scene.cycles.device = "GPU"
                    break
            except (TypeError, RuntimeError):
                continue
        scene.cycles.seed = 17
        scene.cycles.adaptive_threshold = 0.01
        if preview:
            scene.cycles.samples = int(render_cfg.get("preview_samples", 128))
            scene.cycles.use_denoising = bool(render_cfg.get("preview_denoising", False))
        else:
            scene.cycles.samples = int(render_cfg.get("samples", 256))
            scene.cycles.use_denoising = bool(render_cfg.get("denoising", False))

    render_size = int(render_cfg["render_size"])
    scene.render.resolution_x = render_size
    scene.render.resolution_y = render_size
    scene.render.resolution_percentage = 100
    scene.render.film_transparent = bool(render_cfg.get("transparent", True)) and not preview
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGBA"
    scene.render.image_settings.color_depth = str(render_cfg.get("color_depth", "8"))
    scene.render.filter_size = float(
        render_cfg.get("preview_filter_size", render_cfg.get("filter_size", 0.65))
        if preview else render_cfg.get("filter_size", 0.65)
    )
    _safe_color_management(scene, render_cfg)

    world = scene.world or bpy.data.worlds.new("World")
    scene.world = world
    world.use_nodes = True
    bg = world.node_tree.nodes.get("Background")
    if bg:
        bg.inputs["Color"].default_value = (0.45, 0.48, 0.52, 1.0)
        bg.inputs["Strength"].default_value = float(manifest["lighting"].get("world_strength", 0.08))


def create_camera(manifest, *, ortho_scale=None):
    bpy.ops.object.camera_add(location=(0.0, 0.0, float(manifest["render"].get("camera_z", 5.2))))
    camera = bpy.context.object
    camera.name = "AssetCamera"
    camera.data.type = 'ORTHO'
    camera.data.ortho_scale = float(ortho_scale or manifest["render"]["ortho_scale"])
    bpy.context.scene.camera = camera
    return camera


def _area_light(name, spec, *, rig_scale=1.0):
    bpy.ops.object.light_add(type="AREA", location=tuple(float(v) * rig_scale for v in spec["location"]))
    light = bpy.context.object
    light.name = name
    light.rotation_euler = (-light.location).to_track_quat('-Z', 'Y').to_euler()
    light.data.energy = float(spec["energy"]) * rig_scale ** 2
    light.data.shape = "DISK"
    light.data.size = float(spec["size"]) * rig_scale
    light.data.specular_factor = float(spec.get("specular_factor", 1.0))
    # Cycles does not apply the Eevee specular_factor to every glass path.
    # Fill panels illuminate the set but should not stamp extra white discs on it.
    light.visible_glossy = bool(spec.get("visible_glossy", True))
    if spec.get("color_hex"):
        light.data.color = srgb_hex_to_linear_rgba(spec["color_hex"])[:3]
    return light


def create_lights(manifest, *, rig_scale=None):
    lighting = manifest["lighting"]
    rig_scale = float(rig_scale or lighting.get("rig_scale", 30.0))
    return [
        _area_light("Key", lighting["key"], rig_scale=rig_scale),
        _area_light("Fill", lighting["fill"], rig_scale=rig_scale),
        _area_light("Rim", lighting["rim"], rig_scale=rig_scale),
    ]


def build_felt_material():
    existing = bpy.data.materials.get("MAT_preview_felt")
    if existing is not None:
        return existing
    mat, bsdf = _principled_material("MAT_preview_felt", (0.008, 0.055, 0.035, 1.0), 0.78)
    nodes, links = mat.node_tree.nodes, mat.node_tree.links
    noise = nodes.new("ShaderNodeTexNoise")
    coordinates = nodes.new("ShaderNodeTexCoord")
    links.new(coordinates.outputs["Object"], noise.inputs["Vector"])
    noise.inputs["Scale"].default_value = 145.0
    noise.inputs["Detail"].default_value = 2.2
    noise.inputs["Roughness"].default_value = 0.8
    bump = nodes.new("ShaderNodeBump")
    bump.inputs["Strength"].default_value = 0.18
    bump.inputs["Distance"].default_value = 0.015
    links.new(noise.outputs["Fac"], bump.inputs["Height"])
    links.new(bump.outputs["Normal"], bsdf.inputs["Normal"])
    tones = nodes.new("ShaderNodeValToRGB")
    tones.color_ramp.elements[0].color = srgb_hex_to_linear_rgba("#01110F")
    tones.color_ramp.elements[1].color = srgb_hex_to_linear_rgba("#093025")
    links.new(noise.outputs["Fac"], tones.inputs["Fac"])
    links.new(tones.outputs["Color"], bsdf.inputs["Base Color"])
    return mat


def create_felt_plane(*, z=-0.44, size=30.0):
    bpy.ops.mesh.primitive_plane_add(size=float(size), location=(0.0, 0.0, float(z)))
    plane = bpy.context.object
    plane.name = "PreviewFelt"
    plane.data.materials.append(build_felt_material())
    return plane


# -----------------------------
# Board geometry / material
# -----------------------------

def build_board_material(board_cfg):
    existing = bpy.data.materials.get("MAT_board_cell")
    if existing is not None:
        return existing

    cfg = board_cfg["material"]
    base = _cfg_color(cfg, "base_hex", "base_color", (0.72, 0.56, 0.34, 1.0))
    shadow = _cfg_color(cfg, "socket_shadow_hex", "socket_shadow_color", (0.30, 0.20, 0.105, 1.0))
    ceramic_light = srgb_hex_to_linear_rgba(str(cfg.get("ceramic_light_hex", "#F4DDAE")))
    ceramic_dark = srgb_hex_to_linear_rgba(str(cfg.get("ceramic_dark_hex", "#BE8E52")))
    crackle_color = srgb_hex_to_linear_rgba(str(cfg.get("crackle_color_hex", "#8E6336")))

    mat, bsdf = _principled_material("MAT_board_cell", base, float(cfg["roughness"]))
    _set_input(bsdf, ["Coat Weight", "Clearcoat"], float(cfg.get("coat_weight", 0.08)))
    _set_input(bsdf, ["Coat Roughness", "Clearcoat Roughness"], float(cfg.get("coat_roughness", 0.38)))
    nodes, links = mat.node_tree.nodes, mat.node_tree.links

    texcoord = nodes.new("ShaderNodeTexCoord")

    # Macro warmth: broad ceramic/ivory variation visible even after the 1024px asset
    # is reduced to gameplay size. This is color variation, not a fake baked highlight.
    macro = nodes.new("ShaderNodeTexNoise")
    macro.name = "CeramicMacroMottle"
    macro.label = "CeramicMacroMottle"
    macro.inputs["Scale"].default_value = float(cfg.get("ceramic_mottle_scale", 5.4))
    macro.inputs["Detail"].default_value = 3.2
    macro.inputs["Roughness"].default_value = 0.62
    macro_ramp = nodes.new("ShaderNodeValToRGB")
    macro_ramp.color_ramp.elements[0].position = 0.22
    macro_ramp.color_ramp.elements[0].color = ceramic_dark
    macro_ramp.color_ramp.elements[1].position = 0.80
    macro_ramp.color_ramp.elements[1].color = ceramic_light
    links.new(texcoord.outputs["Generated"], macro.inputs["Vector"])
    links.new(macro.outputs["Fac"], macro_ramp.inputs["Fac"])

    macro_mix = nodes.new("ShaderNodeMixRGB")
    macro_mix.blend_type = "MIX"
    macro_mix.inputs[0].default_value = float(cfg.get("ceramic_mottle_strength", 0.38))
    macro_mix.inputs[1].default_value = base
    links.new(macro_ramp.outputs["Color"], macro_mix.inputs[2])

    # Socket depth shading: bowl is warmer/deeper, rim stays lighter. No specular spot
    # is painted into the texture; lighting is still produced by Cycles.
    geom = nodes.new("ShaderNodeNewGeometry")
    sep = nodes.new("ShaderNodeSeparateXYZ")
    depth = nodes.new("ShaderNodeMapRange")
    depth.clamp = True
    depth.inputs["From Min"].default_value = -float(board_cfg["socket_radius"]) * 0.62
    depth.inputs["From Max"].default_value = float(board_cfg["height"]) * 0.5
    depth.inputs["To Min"].default_value = 0.0
    depth.inputs["To Max"].default_value = 1.0
    depth_mix = nodes.new("ShaderNodeMixRGB")
    depth_mix.blend_type = "MIX"
    depth_mix.inputs[1].default_value = shadow
    links.new(macro_mix.outputs["Color"], depth_mix.inputs[2])
    links.new(geom.outputs["Position"], sep.inputs["Vector"])
    links.new(sep.outputs["Z"], depth.inputs["Value"])
    links.new(depth.outputs["Result"], depth_mix.inputs["Fac"])

    # Bowl mask: 1.0 in the spherical socket and ~0.0 on the top rim. V7 uses this
    # to keep the ivory rim restrained while making the ceramic/crazing readable
    # inside the actual recess, matching the approved material reference.
    socket_mask = nodes.new("ShaderNodeMath")
    socket_mask.name = "CeramicSocketTextureMask"
    socket_mask.label = "CeramicSocketTextureMask"
    socket_mask.operation = "SUBTRACT"
    socket_mask.inputs[0].default_value = 1.0
    links.new(depth.outputs["Result"], socket_mask.inputs[1])

    # Two-scale glaze crazing. Fine hairlines remain subordinate to the socket
    # silhouette; material assignment is tested separately from shader parameters.
    warp = nodes.new("ShaderNodeTexNoise")
    warp.name = "CeramicCrackleWarp"
    warp.label = "CeramicCrackleWarp"
    warp.inputs["Scale"].default_value = float(cfg.get("crackle_warp_scale", 4.2))
    warp.inputs["Detail"].default_value = 3.0
    warp.inputs["Roughness"].default_value = 0.58
    links.new(texcoord.outputs["Generated"], warp.inputs["Vector"])

    warp_center = nodes.new("ShaderNodeVectorMath")
    warp_center.operation = "SUBTRACT"
    warp_center.inputs[1].default_value = (0.5, 0.5, 0.5)
    links.new(warp.outputs["Color"], warp_center.inputs[0])
    warp_scale = nodes.new("ShaderNodeVectorMath")
    warp_scale.operation = "SCALE"
    _set_input(warp_scale, ["Scale"], float(cfg.get("crackle_warp_strength", 0.18)))
    links.new(warp_center.outputs["Vector"], warp_scale.inputs[0])
    warped_coords = nodes.new("ShaderNodeVectorMath")
    warped_coords.operation = "ADD"
    links.new(texcoord.outputs["Generated"], warped_coords.inputs[0])
    links.new(warp_scale.outputs["Vector"], warped_coords.inputs[1])

    game_crackle = nodes.new("ShaderNodeTexVoronoi")
    game_crackle.name = "CeramicGameScaleCrackle"
    game_crackle.label = "CeramicGameScaleCrackle"
    game_crackle.feature = "DISTANCE_TO_EDGE"
    game_crackle.distance = "EUCLIDEAN"
    game_crackle.inputs["Scale"].default_value = float(cfg.get("game_crackle_scale", 17.0))
    game_mask = nodes.new("ShaderNodeMath")
    game_mask.name = "CeramicGameScaleCrackleMask"
    game_mask.label = "CeramicGameScaleCrackleMask"
    game_mask.operation = "LESS_THAN"
    game_mask.inputs[1].default_value = float(cfg.get("game_crackle_width", 0.085))
    links.new(warped_coords.outputs["Vector"], game_crackle.inputs["Vector"])
    links.new(game_crackle.outputs["Distance"], game_mask.inputs[0])

    fine_crackle = nodes.new("ShaderNodeTexVoronoi")
    fine_crackle.name = "CeramicFineCrackle"
    fine_crackle.label = "CeramicFineCrackle"
    fine_crackle.feature = "DISTANCE_TO_EDGE"
    fine_crackle.distance = "EUCLIDEAN"
    fine_crackle.inputs["Scale"].default_value = float(cfg.get("fine_crackle_scale", 34.0))
    fine_mask = nodes.new("ShaderNodeMath")
    fine_mask.name = "CeramicFineCrackleMask"
    fine_mask.label = "CeramicFineCrackleMask"
    fine_mask.operation = "LESS_THAN"
    fine_mask.inputs[1].default_value = float(cfg.get("fine_crackle_width", 0.036))
    links.new(warped_coords.outputs["Vector"], fine_crackle.inputs["Vector"])
    links.new(fine_crackle.outputs["Distance"], fine_mask.inputs[0])

    game_weight = nodes.new("ShaderNodeMath")
    game_weight.operation = "MULTIPLY"
    game_weight.inputs[1].default_value = float(cfg.get("game_crackle_strength", 0.34))
    links.new(game_mask.outputs[0], game_weight.inputs[0])
    fine_weight = nodes.new("ShaderNodeMath")
    fine_weight.operation = "MULTIPLY"
    fine_weight.inputs[1].default_value = float(cfg.get("fine_crackle_strength", 0.12))
    links.new(fine_mask.outputs[0], fine_weight.inputs[0])
    combined_crackle = nodes.new("ShaderNodeMath")
    combined_crackle.operation = "ADD"
    combined_crackle.use_clamp = True
    links.new(game_weight.outputs[0], combined_crackle.inputs[0])
    links.new(fine_weight.outputs[0], combined_crackle.inputs[1])

    bowl_strength = float(cfg.get("bowl_crackle_strength", 0.96))
    rim_strength = float(cfg.get("rim_game_crackle_strength", cfg.get("rim_crackle_strength", 0.025)))
    crackle_delta = nodes.new("ShaderNodeMath")
    crackle_delta.operation = "MULTIPLY"
    crackle_delta.inputs[1].default_value = max(0.0, bowl_strength - rim_strength)
    links.new(socket_mask.outputs[0], crackle_delta.inputs[0])
    crackle_amount = nodes.new("ShaderNodeMath")
    crackle_amount.name = "CeramicBowlCrackle"
    crackle_amount.label = "CeramicBowlCrackle"
    crackle_amount.operation = "ADD"
    crackle_amount.inputs[1].default_value = rim_strength
    links.new(crackle_delta.outputs[0], crackle_amount.inputs[0])
    crackle_strength = nodes.new("ShaderNodeMath")
    crackle_strength.operation = "MULTIPLY"
    links.new(combined_crackle.outputs[0], crackle_strength.inputs[0])
    links.new(crackle_amount.outputs[0], crackle_strength.inputs[1])
    crackle_color_strength = nodes.new("ShaderNodeMath")
    crackle_color_strength.name = "CeramicCrackleColorStrength"
    crackle_color_strength.label = "CeramicCrackleColorStrength"
    crackle_color_strength.operation = "MULTIPLY"
    crackle_color_strength.inputs[1].default_value = float(cfg.get("crackle_color_strength", 0.72))
    links.new(crackle_strength.outputs["Value"], crackle_color_strength.inputs[0])

    crackle_color_mix = nodes.new("ShaderNodeMixRGB")
    crackle_color_mix.name = "CeramicCrackleColor"
    crackle_color_mix.blend_type = "MIX"
    crackle_color_mix.inputs[2].default_value = crackle_color
    links.new(crackle_color_strength.outputs["Value"], crackle_color_mix.inputs[0])
    links.new(depth_mix.outputs["Color"], crackle_color_mix.inputs[1])
    links.new(crackle_color_mix.outputs["Color"], bsdf.inputs["Base Color"])

    # Independent micro grain drives roughness and bump. In V5 the texture lived mostly
    # in color/bump and disappeared at gameplay scale; V6 deliberately varies roughness.
    micro = nodes.new("ShaderNodeTexNoise")
    micro.name = "CeramicMicroGrain"
    micro.label = "CeramicMicroGrain"
    micro.inputs["Scale"].default_value = float(cfg.get("micro_scale", 165.0))
    micro.inputs["Detail"].default_value = 2.4
    micro.inputs["Roughness"].default_value = 0.60
    links.new(texcoord.outputs["Generated"], micro.inputs["Vector"])

    rough_noise = nodes.new("ShaderNodeTexNoise")
    rough_noise.name = "CeramicRoughnessVariation"
    rough_noise.label = "CeramicRoughnessVariation"
    rough_noise.inputs["Scale"].default_value = float(cfg.get("roughness_noise_scale", 11.0))
    rough_noise.inputs["Detail"].default_value = 4.0
    links.new(texcoord.outputs["Generated"], rough_noise.inputs["Vector"])
    rough_ramp = nodes.new("ShaderNodeValToRGB")
    rough_low = float(cfg.get("roughness_low", 0.28))
    rough_high = float(cfg.get("roughness_high", 0.46))
    rough_ramp.color_ramp.elements[0].color = (rough_low, rough_low, rough_low, 1.0)
    rough_ramp.color_ramp.elements[1].color = (rough_high, rough_high, rough_high, 1.0)
    links.new(rough_noise.outputs["Fac"], rough_ramp.inputs["Fac"])
    crackle_roughness = nodes.new("ShaderNodeMixRGB")
    crackle_roughness.name = "CeramicCrackleRoughness"
    crackle_roughness.label = "CeramicCrackleRoughness"
    crackle_roughness.blend_type = "MIX"
    links.new(crackle_strength.outputs[0], crackle_roughness.inputs[0])
    links.new(rough_ramp.outputs["Color"], crackle_roughness.inputs[1])
    cr = float(cfg.get("crackle_roughness", 0.58))
    crackle_roughness.inputs[2].default_value = (cr, cr, cr, 1.0)
    links.new(crackle_roughness.outputs["Color"], bsdf.inputs["Roughness"])

    bowl_boost = nodes.new("ShaderNodeMath")
    bowl_boost.operation = "MULTIPLY_ADD"
    bowl_boost.inputs[1].default_value = max(0.0, float(cfg.get("bowl_texture_boost", 1.0)) - 1.0)
    bowl_boost.inputs[2].default_value = 1.0
    links.new(socket_mask.outputs[0], bowl_boost.inputs[0])
    micro_boosted = nodes.new("ShaderNodeMath")
    micro_boosted.operation = "MULTIPLY"
    links.new(micro.outputs["Fac"], micro_boosted.inputs[0])
    links.new(bowl_boost.outputs[0], micro_boosted.inputs[1])
    micro_bump = nodes.new("ShaderNodeBump")
    micro_bump.name = "CeramicMicroBump"
    micro_bump.inputs["Strength"].default_value = float(cfg.get("micro_strength", 0.024))
    micro_bump.inputs["Distance"].default_value = 0.006
    links.new(micro_boosted.outputs[0], micro_bump.inputs["Height"])

    crackle_bump = nodes.new("ShaderNodeBump")
    crackle_bump.name = "CeramicCrackleBump"
    crackle_bump.label = "CeramicCrackleBump"
    crackle_bump.inputs["Strength"].default_value = float(cfg.get("crackle_bump_strength", 0.18))
    crackle_bump.inputs["Distance"].default_value = 0.004
    links.new(crackle_strength.outputs[0], crackle_bump.inputs["Height"])
    links.new(micro_bump.outputs["Normal"], crackle_bump.inputs["Normal"])
    links.new(crackle_bump.outputs["Normal"], bsdf.inputs["Normal"])
    return mat


def create_board_cell(manifest, *, location=(0.0, 0.0, 0.0)):
    cfg = manifest["board"]
    # Blender's six-sided cylinder is already pointy-top in top view for this factory.
    # Keep zero rotation so the rendered geometry matches the pointy axial grid.
    bpy.ops.mesh.primitive_cylinder_add(
        vertices=6,
        radius=float(cfg["outer_radius"]),
        depth=float(cfg["height"]),
        location=location,
        rotation=(0.0, 0.0, 0.0),
    )
    cell = bpy.context.object
    cell.name = "BoardCell"

    bpy.ops.mesh.primitive_uv_sphere_add(
        segments=128,
        ring_count=64,
        radius=float(cfg["socket_radius"]),
        location=(location[0], location[1], location[2] + float(cfg["socket_center_z"])),
    )
    cutter = bpy.context.object
    cutter.name = "SocketCutter"
    cutter.scale.z = float(cfg.get("socket_vertical_scale", 1.0))
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)

    boolean = cell.modifiers.new("SocketBoolean", "BOOLEAN")
    boolean.operation = "DIFFERENCE"
    boolean.solver = "EXACT"
    boolean.object = cutter
    apply_modifier(cell, boolean)
    bpy.data.objects.remove(cutter, do_unlink=True)

    add_bevel(cell, float(cfg["bevel"]), int(cfg.get("bevel_segments", 5)))
    # Smooth only the curved socket and its lip; the six rim planes stay planar.
    for polygon in cell.data.polygons:
        polygon.use_smooth = polygon.center.xy.length < float(cfg["socket_radius"]) + float(cfg["bevel"])
    # Boolean can create an empty slot 0. Appending then leaves every face using
    # Blender's fallback grey shader instead of the carefully built ceramic.
    cell.data.materials.clear()
    cell.data.materials.append(build_board_material(cfg))
    for polygon in cell.data.polygons:
        polygon.material_index = 0
    return cell


# -----------------------------
# Piece materials
# -----------------------------

def _make_noise_ramp(nodes, *, scale, dark, mid, light):
    noise = nodes.new("ShaderNodeTexNoise")
    noise.inputs["Scale"].default_value = float(scale)
    noise.inputs["Detail"].default_value = 7.0
    noise.inputs["Roughness"].default_value = 0.72
    ramp = nodes.new("ShaderNodeValToRGB")
    ramp.color_ramp.elements[0].position = 0.22
    ramp.color_ramp.elements[0].color = dark
    middle = ramp.color_ramp.elements.new(0.52)
    middle.color = mid
    ramp.color_ramp.elements[-1].position = 0.80
    ramp.color_ramp.elements[-1].color = light
    return noise, ramp


def build_inner_core_material(piece):
    name = f"MAT_CORE_{piece['id']}"
    existing = bpy.data.materials.get(name)
    if existing is not None:
        return existing

    kind = piece["material_kind"]
    base = _piece_base_color(piece)
    accent = _piece_accent_color(piece)
    roughness = float(piece.get("roughness", 0.16))
    metallic = 1.0 if kind == "liquid_metal" else float(piece.get("metallic", 0.0))
    transmission = float(piece.get("transmission", 0.0)) if kind not in {"mineral", "obsidian"} else 0.0
    mat, bsdf = _principled_material(name, base, roughness, metallic=metallic, transmission=transmission)
    _set_input(bsdf, ["Coat Weight", "Clearcoat"], 0.36 if kind in {"glass", "opal", "crystal", "liquid_metal"} else 0.16)
    _set_input(bsdf, ["Coat Roughness", "Clearcoat Roughness"], 0.11 if kind != "mineral" else 0.18)

    nodes, links = mat.node_tree.nodes, mat.node_tree.links
    scale = float(piece.get("texture_scale", 7.0))
    macro_strength = float(piece.get("macro_strength", piece.get("texture_strength", 0.20)))
    micro_strength = float(piece.get("micro_strength", 0.08))

    # Broad material structure. This is intentionally calmer than the V5 all-purpose
    # noise so the surface reads as glass/mineral rather than procedural camouflage.
    macro = nodes.new("ShaderNodeTexNoise")
    macro.name = "OrbMacroTexture"
    macro.label = "OrbMacroTexture"
    macro.inputs["Scale"].default_value = scale
    macro.inputs["Detail"].default_value = 4.2
    macro.inputs["Roughness"].default_value = 0.58
    macro_ramp = nodes.new("ShaderNodeValToRGB")
    macro_ramp.color_ramp.elements[0].position = 0.24
    macro_ramp.color_ramp.elements[0].color = _scaled_color(base, 0.58)
    macro_ramp.color_ramp.elements[1].position = 0.78
    macro_ramp.color_ramp.elements[1].color = accent
    links.new(macro.outputs["Fac"], macro_ramp.inputs["Fac"])
    macro_mix = nodes.new("ShaderNodeMixRGB")
    macro_mix.blend_type = "MIX"
    macro_mix.inputs[0].default_value = macro_strength
    macro_mix.inputs[1].default_value = base
    links.new(macro_ramp.outputs["Color"], macro_mix.inputs[2])

    color_output = macro_mix.outputs["Color"]
    if piece["id"] == "fire":
        glow = nodes.new("ShaderNodeTexNoise")
        glow.name = "FireInternalGlow"
        glow.label = "FireInternalGlow"
        glow.inputs["Scale"].default_value = scale * 0.78
        glow.inputs["Detail"].default_value = 5.0
        glow.inputs["Roughness"].default_value = 0.68
        glow.inputs["Distortion"].default_value = 0.22
        glow_ramp = nodes.new("ShaderNodeValToRGB")
        glow_ramp.color_ramp.elements[0].position = 0.22
        glow_ramp.color_ramp.elements[0].color = _scaled_color(base, 0.48)
        glow_mid = glow_ramp.color_ramp.elements.new(0.53)
        glow_mid.color = base
        glow_ramp.color_ramp.elements[-1].position = 0.80
        glow_ramp.color_ramp.elements[-1].color = accent
        links.new(glow.outputs["Fac"], glow_ramp.inputs["Fac"])
        glow_mix = nodes.new("ShaderNodeMixRGB")
        glow_mix.blend_type = "MIX"
        glow_mix.inputs[0].default_value = float(piece.get("fire_internal_strength", 0.24))
        links.new(macro_mix.outputs["Color"], glow_mix.inputs[1])
        links.new(glow_ramp.outputs["Color"], glow_mix.inputs[2])
        color_output = glow_mix.outputs["Color"]
    elif piece["id"] == "mors":
        vor = nodes.new("ShaderNodeTexVoronoi")
        vor.feature = "DISTANCE_TO_EDGE"
        vor.distance = "EUCLIDEAN"
        vor.inputs["Scale"].default_value = scale * 1.35
        edge = nodes.new("ShaderNodeValToRGB")
        edge.color_ramp.elements[0].position = 0.014
        edge.color_ramp.elements[0].color = accent
        edge.color_ramp.elements[1].position = 0.060
        edge.color_ramp.elements[1].color = _scaled_color(base, 0.42)
        links.new(vor.outputs["Distance"], edge.inputs["Fac"])
        structure = nodes.new("ShaderNodeMixRGB")
        structure.blend_type = "MULTIPLY"
        structure.inputs[0].default_value = min(0.22, macro_strength * 0.66)
        links.new(macro_mix.outputs["Color"], structure.inputs[1])
        links.new(edge.outputs["Color"], structure.inputs[2])
        color_output = structure.outputs["Color"]

    if piece["id"] == "air":
        facing = nodes.new("ShaderNodeTexNoise")
        facing.name = "OrbIridescence"
        facing.label = "OrbIridescence"
        facing.inputs["Scale"].default_value = 4.5
        facing.inputs["Detail"].default_value = 2.0
        iri_ramp = nodes.new("ShaderNodeValToRGB")
        iri_ramp.color_ramp.elements[0].position = 0.25
        iri_ramp.color_ramp.elements[0].color = srgb_hex_to_linear_rgba("#8FBBE5")
        iri_mid = iri_ramp.color_ramp.elements.new(0.45)
        iri_mid.color = srgb_hex_to_linear_rgba("#D7BADE")
        iri_mid = iri_ramp.color_ramp.elements.new(0.56)
        iri_mid.color = srgb_hex_to_linear_rgba("#F5CBA3")
        iri_ramp.color_ramp.elements[-1].position = 0.70
        iri_ramp.color_ramp.elements[-1].color = srgb_hex_to_linear_rgba("#B7D7CB")
        links.new(facing.outputs["Fac"], iri_ramp.inputs["Fac"])
        iri_mix = nodes.new("ShaderNodeMixRGB")
        iri_mix.blend_type = "MIX"
        iri_mix.inputs[0].default_value = float(piece.get("opal_iridescence", 0.22))
        links.new(color_output, iri_mix.inputs[1])
        links.new(iri_ramp.outputs["Color"], iri_mix.inputs[2])
        color_output = iri_mix.outputs["Color"]
    elif piece["id"] == "salt":
        facet = nodes.new("ShaderNodeTexVoronoi")
        facet.name = "CrystalFacetTexture"
        facet.label = "CrystalFacetTexture"
        facet.feature = "DISTANCE_TO_EDGE"
        facet.distance = "EUCLIDEAN"
        facet.inputs["Scale"].default_value = scale * 1.65
        facet_ramp = nodes.new("ShaderNodeValToRGB")
        facet_ramp.color_ramp.elements[0].position = 0.012
        facet_ramp.color_ramp.elements[0].color = accent
        facet_ramp.color_ramp.elements[1].position = 0.075
        facet_ramp.color_ramp.elements[1].color = _scaled_color(base, 0.86, 0.04)
        links.new(facet.outputs["Distance"], facet_ramp.inputs["Fac"])
        facet_mix = nodes.new("ShaderNodeMixRGB")
        facet_mix.blend_type = "SCREEN"
        facet_mix.inputs[0].default_value = float(piece.get("crystal_mix", 0.34))
        links.new(color_output, facet_mix.inputs[1])
        links.new(facet_ramp.outputs["Color"], facet_mix.inputs[2])
        color_output = facet_mix.outputs["Color"]
    elif piece["id"] == "earth":
        veins = nodes.new("ShaderNodeTexNoise")
        veins.name = "MineralVeinTexture"
        veins.label = "MineralVeinTexture"
        veins.inputs["Scale"].default_value = scale * 2.15
        veins.inputs["Detail"].default_value = 5.5
        veins.inputs["Roughness"].default_value = 0.70
        veins.inputs["Distortion"].default_value = 0.32
        vein_ramp = nodes.new("ShaderNodeValToRGB")
        vein_ramp.color_ramp.elements[0].position = 0.32
        vein_ramp.color_ramp.elements[0].color = _scaled_color(base, 0.52)
        vein_mid = vein_ramp.color_ramp.elements.new(0.52)
        vein_mid.color = accent
        vein_ramp.color_ramp.elements[-1].position = 0.72
        vein_ramp.color_ramp.elements[-1].color = _scaled_color(base, 0.70)
        links.new(veins.outputs["Fac"], vein_ramp.inputs["Fac"])
        vein_mix = nodes.new("ShaderNodeMixRGB")
        vein_mix.blend_type = "MIX"
        vein_mix.inputs[0].default_value = float(piece.get("vein_strength", 0.16))
        links.new(color_output, vein_mix.inputs[1])
        links.new(vein_ramp.outputs["Color"], vein_mix.inputs[2])
        color_output = vein_mix.outputs["Color"]

    depth_strength = float(piece.get("depth_edge_strength", 0.0))
    if depth_strength > 0.0:
        depth_fresnel = nodes.new("ShaderNodeLayerWeight")
        depth_fresnel.name = "OrbDepthFresnel"
        depth_fresnel.label = "OrbDepthFresnel"
        depth_factor = nodes.new("ShaderNodeMath")
        depth_factor.operation = "MULTIPLY_ADD"
        depth_factor.inputs[1].default_value = depth_strength
        depth_factor.inputs[2].default_value = 1.0 - depth_strength
        links.new(depth_fresnel.outputs["Facing"], depth_factor.inputs[0])
        depth_mix = nodes.new("ShaderNodeMixRGB")
        depth_mix.name = "OrbDepthEdgeMix"
        depth_mix.label = "OrbDepthEdgeMix"
        depth_mix.blend_type = "MIX"
        depth_mix.inputs[1].default_value = _scaled_color(base, 0.44)
        links.new(color_output, depth_mix.inputs[2])
        links.new(depth_factor.outputs[0], depth_mix.inputs[0])
        color_output = depth_mix.outputs["Color"]

    links.new(color_output, bsdf.inputs["Base Color"])

    # Fine texture only modulates micro-reflection/bump. It no longer paints giant
    # blotches into the orb, which was the main V5 material problem.
    micro = nodes.new("ShaderNodeTexNoise")
    micro.name = "OrbMicroTexture"
    micro.label = "OrbMicroTexture"
    micro.inputs["Scale"].default_value = max(28.0, scale * 7.0)
    micro.inputs["Detail"].default_value = 2.0
    micro.inputs["Roughness"].default_value = 0.46
    rough_ramp = nodes.new("ShaderNodeValToRGB")
    lo = max(0.035, roughness * 0.78)
    hi = min(0.78, roughness + micro_strength)
    rough_ramp.color_ramp.elements[0].color = (lo, lo, lo, 1.0)
    rough_ramp.color_ramp.elements[1].color = (hi, hi, hi, 1.0)
    links.new(micro.outputs["Fac"], rough_ramp.inputs["Fac"])
    links.new(rough_ramp.outputs["Color"], bsdf.inputs["Roughness"])

    bump = nodes.new("ShaderNodeBump")
    bump.inputs["Strength"].default_value = micro_strength * (0.18 if kind in {"glass", "opal"} else 0.28)
    bump.inputs["Distance"].default_value = 0.012
    links.new(micro.outputs["Fac"], bump.inputs["Height"])
    links.new(bump.outputs["Normal"], bsdf.inputs["Normal"])

    if piece["id"] == "fire":
        _set_input(bsdf, ["Emission Color", "Emission"], accent)
        _set_input(bsdf, ["Emission Strength"], 0.055)
    elif piece["id"] == "vitae":
        _set_input(bsdf, ["Emission Color", "Emission"], accent)
        _set_input(bsdf, ["Emission Strength"], 0.025)
    elif piece["id"] == "quintessence":
        _set_input(bsdf, ["Emission Color", "Emission"], accent)
        _set_input(bsdf, ["Emission Strength"], 0.030)
    return mat


def build_outer_shell_material(piece, manifest):
    name = f"MAT_SHELL_{piece['id']}"
    existing = bpy.data.materials.get(name)
    if existing is not None:
        return existing
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    nodes, links = mat.node_tree.nodes, mat.node_tree.links
    for node in list(nodes):
        nodes.remove(node)
    output = nodes.new("ShaderNodeOutputMaterial")
    glass = nodes.new("ShaderNodeBsdfGlass")
    glass.distribution = "BECKMANN"
    glass.inputs["Roughness"].default_value = float(manifest["piece_geometry"].get("outer_shell_roughness", 0.045))
    glass.inputs["IOR"].default_value = float(manifest["piece_geometry"].get("outer_shell_ior", 1.46))
    glass.inputs["Color"].default_value = (0.98, 0.99, 1.0, 1.0)
    links.new(glass.outputs["BSDF"], output.inputs["Surface"])
    return mat


def build_metal_material(piece):
    name = f"MAT_METAL_{piece['id']}"
    existing = bpy.data.materials.get(name)
    if existing is not None:
        return existing
    base = _piece_base_color(piece)
    accent = _piece_accent_color(piece)
    rough = float(piece.get("roughness", 0.38))
    metallic = float(piece.get("metallic", 0.86))
    mat, bsdf = _principled_material(name, base, rough, metallic=metallic)
    _set_input(bsdf, ["Coat Weight", "Clearcoat"], float(piece.get("coat_weight", 0.08)))
    _set_input(bsdf, ["Coat Roughness", "Clearcoat Roughness"], 0.28)
    nodes, links = mat.node_tree.nodes, mat.node_tree.links

    # Satin patina instead of mirror-black reflections. Base/accent stay close enough
    # that the metal reads as one material with wear, not two colors painted together.
    patina = nodes.new("ShaderNodeTexNoise")
    patina.name = "MetalPatina"
    patina.label = "MetalPatina"
    patina.inputs["Scale"].default_value = float(piece.get("texture_scale", 18.0)) * 0.28
    patina.inputs["Detail"].default_value = 4.0
    patina.inputs["Roughness"].default_value = 0.60
    ramp = nodes.new("ShaderNodeValToRGB")
    ramp.color_ramp.elements[0].position = 0.27
    ramp.color_ramp.elements[0].color = _scaled_color(base, 0.72)
    ramp.color_ramp.elements[1].position = 0.76
    ramp.color_ramp.elements[1].color = accent
    links.new(patina.outputs["Fac"], ramp.inputs["Fac"])
    patina_mix = nodes.new("ShaderNodeMixRGB")
    patina_mix.blend_type = "MIX"
    patina_mix.inputs[0].default_value = float(piece.get("patina_strength", 0.20))
    patina_mix.inputs[1].default_value = base
    links.new(ramp.outputs["Color"], patina_mix.inputs[2])

    midtone = nodes.new("ShaderNodeMixRGB")
    midtone.name = "MetalMidToneLift"
    midtone.label = "MetalMidToneLift"
    midtone.blend_type = "SCREEN"
    midtone.inputs[0].default_value = float(piece.get("mid_tone_strength", 0.12))
    links.new(patina_mix.outputs["Color"], midtone.inputs[1])
    midtone.inputs[2].default_value = _scaled_color(base, 0.62)

    readable_fill = nodes.new("ShaderNodeMixRGB")
    readable_fill.name = "MetalReflectionFill"
    readable_fill.label = "MetalReflectionFill"
    readable_fill.blend_type = "SCREEN"
    readable_fill.inputs[0].default_value = float(piece.get("reflection_fill", 0.12))
    links.new(midtone.outputs["Color"], readable_fill.inputs[1])
    readable_fill.inputs[2].default_value = _scaled_color(accent, 0.72)
    links.new(readable_fill.outputs["Color"], bsdf.inputs["Base Color"])

    # Independent roughness noise keeps broad highlights readable without collapsing
    # the whole metal sphere into a black mirror against the dark felt.
    # readable but no metal collapses into a black mirror under the dark felt scene.
    rough_noise = nodes.new("ShaderNodeTexNoise")
    rough_noise.name = "MetalRoughnessVariation"
    rough_noise.label = "MetalRoughnessVariation"
    rough_noise.inputs["Scale"].default_value = float(piece.get("texture_scale", 18.0)) * 1.35
    rough_noise.inputs["Detail"].default_value = 2.0
    variation = float(piece.get("roughness_variation", 0.16))
    rough_ramp = nodes.new("ShaderNodeValToRGB")
    lo = max(0.12, rough - variation * 0.55)
    hi = min(0.82, rough + variation)
    rough_ramp.color_ramp.elements[0].color = (lo, lo, lo, 1.0)
    rough_ramp.color_ramp.elements[1].color = (hi, hi, hi, 1.0)
    links.new(rough_noise.outputs["Fac"], rough_ramp.inputs["Fac"])
    links.new(rough_ramp.outputs["Color"], bsdf.inputs["Roughness"])

    hammered = nodes.new("ShaderNodeTexNoise")
    hammered.name = "MetalHammeredSurface"
    hammered.label = "MetalHammeredSurface"
    hammered.inputs["Scale"].default_value = float(piece.get("texture_scale", 20.0)) * 0.72
    hammered.inputs["Detail"].default_value = 2.2
    hammered.inputs["Roughness"].default_value = 0.58
    hammered.inputs["Distortion"].default_value = 0.08
    hammered_bump = nodes.new("ShaderNodeBump")
    hammered_bump.inputs["Strength"].default_value = float(piece.get("hammer_strength", 0.0))
    hammered_bump.inputs["Distance"].default_value = 0.018
    links.new(hammered.outputs["Fac"], hammered_bump.inputs["Height"])

    scratches = nodes.new("ShaderNodeTexNoise")
    scratches.name = "MetalMicroWear"
    scratches.inputs["Scale"].default_value = float(piece.get("texture_scale", 20.0)) * 5.5
    scratches.inputs["Detail"].default_value = 1.7
    scratches.inputs["Roughness"].default_value = 0.40
    bump = nodes.new("ShaderNodeBump")
    bump.inputs["Strength"].default_value = float(piece.get("texture_strength", 0.18)) * 0.10
    bump.inputs["Distance"].default_value = 0.008
    links.new(scratches.outputs["Fac"], bump.inputs["Height"])
    links.new(hammered_bump.outputs["Normal"], bump.inputs["Normal"])
    links.new(bump.outputs["Normal"], bsdf.inputs["Normal"])
    return mat


def build_icon_material(kind: str, manifest):
    name = f"MAT_ICON_{kind}"
    existing = bpy.data.materials.get(name)
    if existing is not None:
        return existing
    colors = {
        "ivory": srgb_hex_to_linear_rgba("#F4E9CF"),
        "gold": srgb_hex_to_linear_rgba("#E8C56C"),
        "silver": srgb_hex_to_linear_rgba("#D9E1E8"),
        "bronze": srgb_hex_to_linear_rgba("#92764D"),
    }
    geo = manifest["piece_geometry"]
    configured_metallic = float(geo.get("icon_inlay_metallic", 0.10))
    metallic = max(configured_metallic, 0.24) if kind in {"gold", "silver"} else configured_metallic
    roughness = float(geo.get("icon_inlay_roughness", 0.34))
    mat, bsdf = _principled_material(name, colors.get(kind, colors["ivory"]), roughness, metallic=metallic)
    emission_strength = float(geo.get("icon_emission_strength", 0.004))
    _set_input(bsdf, ["Emission Color", "Emission"], colors.get(kind, colors["ivory"]))
    _set_input(bsdf, ["Emission Strength"], emission_strength)
    return mat


def build_icon_groove_material(manifest):
    existing = bpy.data.materials.get("MAT_ICON_GROOVE")
    if existing is not None:
        return existing
    groove_hex = str(manifest["piece_geometry"].get("icon_groove_hex", "#8A6A48"))
    mat, _ = _principled_material(
        "MAT_ICON_GROOVE",
        srgb_hex_to_linear_rgba(groove_hex),
        0.58,
        metallic=0.0,
    )
    return mat


# -----------------------------
# Piece geometry / details
# -----------------------------

def create_orb_body(manifest, piece, *, location=(0.0, 0.0, 0.0)):
    radius = float(manifest["piece_geometry"]["orb_radius"])
    bpy.ops.mesh.primitive_uv_sphere_add(segments=160, ring_count=80, radius=radius, location=location)
    body = bpy.context.object
    body.name = f"Orb_{piece['id']}"
    set_object_smooth(body)
    if piece["material_kind"] in {"liquid_metal", "metal"}:
        body.data.materials.append(build_metal_material(piece))
    else:
        body.data.materials.append(build_inner_core_material(piece))
    return body


def create_outer_glass_shell(manifest, piece, *, location=(0.0, 0.0, 0.0)):
    radius = float(manifest["piece_geometry"]["orb_radius"])
    bpy.ops.mesh.primitive_uv_sphere_add(segments=160, ring_count=80, radius=radius, location=location)
    shell = bpy.context.object
    shell.name = f"Shell_{piece['id']}"
    set_object_smooth(shell)
    shell.data.materials.append(build_outer_shell_material(piece, manifest))
    return shell


def create_inner_core(manifest, piece, *, location=(0.0, 0.0, 0.0)):
    radius = float(manifest["piece_geometry"]["orb_radius"]) * float(manifest["piece_geometry"].get("inner_core_scale", 0.91))
    bpy.ops.mesh.primitive_uv_sphere_add(segments=128, ring_count=64, radius=radius, location=location)
    core = bpy.context.object
    core.name = f"Core_{piece['id']}"
    set_object_smooth(core)
    if piece["material_kind"] == "liquid_metal":
        core.data.materials.append(build_metal_material(piece))
    else:
        core.data.materials.append(build_inner_core_material(piece))
        bsdf = core.data.materials[0].node_tree.nodes.get("Principled BSDF")
        _set_input(bsdf, ["Coat Weight", "Clearcoat"], 0.0)
        _set_input(bsdf, ["Specular IOR Level", "Specular"], 0.0)
    return core


def create_medallion(manifest, piece, *, location=(0.0, 0.0, 0.0)):
    geo = manifest["piece_geometry"]
    radius = float(geo["medallion_radius"])
    height = float(geo["medallion_height"])
    bpy.ops.mesh.primitive_uv_sphere_add(segments=144, ring_count=72, radius=radius, location=location)
    medallion = bpy.context.object
    medallion.name = f"Piece_{piece['id']}"
    medallion.scale.z = height / (2.0 * radius)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    set_object_smooth(medallion)
    medallion.data.materials.append(build_metal_material(piece))
    return medallion


def create_medallion_rim(manifest, piece, *, location=(0.0, 0.0, 0.0)):
    geo = manifest["piece_geometry"]
    radius = float(geo["medallion_radius"])
    height = float(geo["medallion_height"])
    bpy.ops.mesh.primitive_torus_add(
        major_segments=96,
        minor_segments=24,
        major_radius=radius * 0.86,
        minor_radius=0.027,
        location=(location[0], location[1], location[2] + height * 0.31),
    )
    rim = bpy.context.object
    rim.name = f"Rim_{piece['id']}"
    rim.data.materials.append(build_metal_material(piece))
    set_object_smooth(rim)
    return rim


def _sphere_surface_z(manifest, x=0.0, y=0.0):
    radius = float(manifest["piece_geometry"]["orb_radius"])
    planar = float(x) * float(x) + float(y) * float(y)
    return math.sqrt(max(0.0, radius * radius - planar))


def _boolean_recess(target, cutter):
    modifier = target.modifiers.new("MarkingBoolean", "BOOLEAN")
    modifier.operation = "DIFFERENCE"
    modifier.solver = "EXACT"
    modifier.object = cutter
    apply_modifier(target, modifier)
    bpy.data.objects.remove(cutter, do_unlink=True)


def apply_hole_marking(manifest, orb, count):
    geo = manifest["piece_geometry"]
    radius = float(geo.get("metal_hole_radius", 0.05))
    depth = float(geo.get("metal_marking_depth", 0.055))
    cutter_depth = depth * 2.8
    if count == 5:
        points = [(0.0, 0.23), (-0.16, 0.08), (0.16, 0.08), (-0.10, -0.14), (0.10, -0.14)]
    elif count == 4:
        points = [(-0.14, 0.14), (0.14, 0.14), (-0.14, -0.14), (0.14, -0.14)]
    elif count == 3:
        points = [(0.0, 0.18), (0.0, 0.0), (0.0, -0.18)]
    elif count == 2:
        points = [(0.0, 0.13), (0.0, -0.13)]
    else:
        points = [(0.0, 0.0)]

    cx, cy, cz = orb.location
    for x, y in points:
        surface_z = float(cz) + _sphere_surface_z(manifest, x, y)
        center_z = surface_z + cutter_depth * 0.5 - depth
        bpy.ops.mesh.primitive_cylinder_add(
            vertices=64,
            radius=radius,
            depth=cutter_depth,
            location=(float(cx) + x, float(cy) + y, center_z),
        )
        _boolean_recess(orb, bpy.context.object)


def apply_slot_marking(manifest, orb, axis="vertical"):
    geo = manifest["piece_geometry"]
    depth = float(geo.get("metal_marking_depth", 0.055))
    width = float(geo.get("metal_slot_width", 0.072))
    length = float(geo.get("metal_slot_length", 0.32))
    cx, cy, cz = orb.location
    surface_z = float(cz) + _sphere_surface_z(manifest, 0.0, 0.0)
    cutter_depth = depth * 2.8
    if str(axis) == "horizontal":
        scale = (length * 0.5, width * 0.5, cutter_depth * 0.5)
    else:
        scale = (width * 0.5, length * 0.5, cutter_depth * 0.5)
    bpy.ops.mesh.primitive_cube_add(
        location=(float(cx), float(cy), surface_z + cutter_depth * 0.5 - depth),
        scale=scale,
    )
    cutter = bpy.context.object
    add_bevel(cutter, width * 0.45, 5)
    _boolean_recess(orb, cutter)


def apply_ring_marking(manifest, orb):
    geo = manifest["piece_geometry"]
    major = float(geo.get("metal_ring_major_radius", 0.22))
    minor = float(geo.get("metal_ring_minor_radius", 0.03))
    depth = float(geo.get("metal_marking_depth", 0.055))
    cx, cy, cz = orb.location
    surface_z = float(cz) + _sphere_surface_z(manifest, major, 0.0)
    bpy.ops.mesh.primitive_torus_add(
        major_segments=96,
        minor_segments=24,
        major_radius=major,
        minor_radius=minor,
        location=(float(cx), float(cy), surface_z - depth * 0.42),
    )
    cutter = bpy.context.object
    _boolean_recess(orb, cutter)
    return []


def apply_stud_marking(manifest, orb, piece):
    geo = manifest["piece_geometry"]
    radius = float(geo.get("metal_hole_radius", 0.05)) * 1.35
    cx, cy, cz = orb.location
    surface_z = float(cz) + _sphere_surface_z(manifest, 0.0, 0.0)
    bpy.ops.mesh.primitive_uv_sphere_add(
        segments=64,
        ring_count=32,
        radius=radius,
        location=(float(cx), float(cy), surface_z + radius * 0.18),
    )
    stud = bpy.context.object
    stud.scale.z = 0.44
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    set_object_smooth(stud)
    stud.data.materials.append(build_metal_material(piece))
    return [stud]


def apply_metal_marking(manifest, piece, orb):
    marking = piece.get("marking", {})
    kind = marking.get("type")
    extras = []
    if kind == "holes":
        apply_hole_marking(manifest, orb, int(marking.get("count", 1)))
    elif kind == "slot":
        apply_slot_marking(manifest, orb, str(marking.get("axis", "vertical")))
    elif kind == "ring":
        extras.extend(apply_ring_marking(manifest, orb))
    elif kind == "stud":
        extras.extend(apply_stud_marking(manifest, orb, piece))
    return extras


def add_internal_details(manifest, piece, *, location=(0.0, 0.0, 0.0)):
    detail = piece.get("internal_detail")
    if not detail:
        return []
    rng = random.Random(piece["id"])
    extras = []
    core_r = float(manifest["piece_geometry"]["orb_radius"]) * float(manifest["piece_geometry"].get("inner_core_scale", 0.91))

    if detail == "bubbles":
        mat, _ = _principled_material(f"MAT_DETAIL_{piece['id']}", (1.0, 1.0, 1.0, 1.0), 0.025, transmission=1.0, ior=1.05)
        for _ in range(18):
            angle = rng.random() * math.tau
            rad = rng.uniform(core_r * 0.58, core_r * 0.93)
            x, y = math.cos(angle) * rad, math.sin(angle) * rad
            rr = rng.uniform(0.009, 0.024)
            shell_r = float(manifest["piece_geometry"]["orb_radius"])
            z = math.sqrt(max(0.0, (shell_r * 0.94) ** 2 - rad * rad))
            bpy.ops.mesh.primitive_uv_sphere_add(segments=24, ring_count=12, radius=rr, location=(location[0] + x, location[1] + y, location[2] + z))
            obj = bpy.context.object
            obj.data.materials.append(mat)
            extras.append(obj)
    elif detail == "crystals":
        mat, _ = _principled_material(f"MAT_DETAIL_{piece['id']}", (1.0, 0.90, 0.68, 1.0), 0.16)
        for _ in range(12):
            x = rng.uniform(-0.34, 0.34)
            y = rng.uniform(-0.34, 0.34)
            bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1, radius=rng.uniform(0.028, 0.070), location=(location[0] + x, location[1] + y, location[2] + rng.uniform(0.05, 0.33)))
            obj = bpy.context.object
            obj.scale.z = rng.uniform(1.2, 2.2)
            bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
            obj.data.materials.append(mat)
            extras.append(obj)
    elif detail == "sparkles":
        mat, bsdf = _principled_material(f"MAT_DETAIL_{piece['id']}", (1.0, 0.35, 1.0, 1.0), 0.10)
        _set_input(bsdf, ["Emission Color", "Emission"], (0.95, 0.22, 1.0, 1.0))
        _set_input(bsdf, ["Emission Strength"], 1.0)
        for _ in range(16):
            angle = rng.random() * math.tau
            rad = rng.uniform(0.08, 0.44)
            bpy.ops.mesh.primitive_uv_sphere_add(segments=16, ring_count=8, radius=rng.uniform(0.007, 0.018), location=(location[0] + math.cos(angle) * rad, location[1] + math.sin(angle) * rad, location[2] + rng.uniform(0.12, 0.45)))
            obj = bpy.context.object
            obj.data.materials.append(mat)
            extras.append(obj)
    return extras


def _project_icon_point(px, py, radius, scale, lift, offset=(0.0, 0.0)):
    x = ((float(px) - 50.0) / 50.0) * radius * scale + float(offset[0]) * radius
    y = ((50.0 - float(py)) / 50.0) * radius * scale + float(offset[1]) * radius
    planar = x * x + y * y
    max_planar = (radius * 0.93) ** 2
    if planar > max_planar:
        factor = math.sqrt(max_planar / planar)
        x *= factor
        y *= factor
        planar = x * x + y * y
    z = math.sqrt(max(0.0, radius * radius - planar)) + lift
    return x, y, z


def _create_projected_icon_layer(manifest, piece, polylines, *, location, width, lift, material, layer_name):
    geo = manifest["piece_geometry"]
    radius = float(geo["orb_radius"])
    scale = float(piece.get("icon_scale", geo.get("icon_scale", 0.76)))
    offset = piece.get("icon_offset", [0.0, 0.0])
    objects = []
    for index, polyline in enumerate(polylines):
        # A chord between projected endpoints passes THROUGH the sphere. Subdivide
        # in SVG space first, including L/H/V/Z strokes, then project every sample.
        sampled = [polyline[0]]
        for a, b in zip(polyline, polyline[1:]):
            steps = max(1, math.ceil(math.dist(a, b) / 0.65))
            sampled.extend((a[0] + (b[0] - a[0]) * t / steps,
                            a[1] + (b[1] - a[1]) * t / steps)
                           for t in range(1, steps + 1))
        curve = bpy.data.curves.new(f"{layer_name}_{piece['id']}_{index}", type="CURVE")
        curve.dimensions = "3D"
        curve.resolution_u = 3
        curve.bevel_depth = float(width)
        curve.bevel_resolution = 4
        curve.use_fill_caps = True
        spline = curve.splines.new("POLY")
        spline.points.add(len(sampled) - 1)
        for i, (px, py) in enumerate(sampled):
            x, y, z = _project_icon_point(px, py, radius, scale, lift, offset)
            spline.points[i].co = (location[0] + x, location[1] + y, location[2] + z, 1.0)
        obj = bpy.data.objects.new(f"{layer_name}_{piece['id']}_{index}", curve)
        bpy.context.collection.objects.link(obj)
        obj.data.materials.append(material)
        objects.append(obj)
    return objects


def create_icon_inlay(manifest, piece, *, location=(0.0, 0.0, 0.0)):
    icon_path = PROJECT_ROOT / "art" / "physical-icons" / piece["icon_svg"]
    fills = parse_svg_fills(icon_path)
    polylines = [path for path in parse_svg_paths(icon_path) if path not in fills]
    geo = manifest["piece_geometry"]
    groove_width = float(geo.get("icon_groove_width", 0.019))
    inlay_width = float(piece.get("icon_inlay_width", geo.get("icon_inlay_width", 0.012)))
    groove_lift = float(geo.get("icon_groove_lift", -0.0035))
    inlay_lift = float(geo.get("icon_inlay_lift", 0.0025))
    groove = _create_projected_icon_layer(
        manifest, piece, polylines,
        location=location, width=groove_width, lift=groove_lift,
        material=build_icon_groove_material(manifest), layer_name="IconGroove",
    )
    inlay = _create_projected_icon_layer(
        manifest, piece, polylines,
        location=location, width=inlay_width, lift=inlay_lift,
        material=build_icon_material(str(piece.get("icon_material", "ivory")), manifest),
        layer_name="IconInlay",
    )
    # Filled silhouettes use a subdivided surface mesh, never a flat polygon
    # intersecting the sphere. Only SVG paths with explicit fill opt into this.
    for index, outline in enumerate(fills):
        polygon = [Vector((x, y, 0)) for x, y in outline[:-1]]
        triangles = tessellate_polygon([polygon])
        # Blender 5.2 returns vertex indices; earlier versions returned Vectors.
        pending = [tuple(polygon[v] if isinstance(v, int) else v for v in tri)
                   for tri in triangles]
        verts, faces = [], []
        while pending:
            a, b, c = pending.pop()
            if max((a-b).length, (b-c).length, (c-a).length) > 1.5:
                ab, bc, ca = (a+b)/2, (b+c)/2, (c+a)/2
                pending.extend([(a, ab, ca), (ab, b, bc), (ca, bc, c), (ab, bc, ca)])
                continue
            start = len(verts)
            for point in (a, b, c):
                projected = _project_icon_point(point.x, point.y, float(geo["orb_radius"]),
                    float(piece.get("icon_scale", geo["icon_scale"])), inlay_lift + 0.001,
                    piece.get("icon_offset", [0, 0]))
                verts.append(tuple(projected[i] + location[i] for i in range(3)))
            # SVG outlines may use either winding. Orient each face out of the orb.
            va, vb, vc = (Vector(verts[i]) for i in (start, start+1, start+2))
            faces.append((start, start+1, start+2) if (vb-va).cross(vc-va).z > 0
                         else (start+2, start+1, start))
        mesh = bpy.data.meshes.new(f"IconFill_{piece['id']}_{index}")
        mesh.from_pydata(verts, [], faces)
        mesh.update()
        obj = bpy.data.objects.new(mesh.name, mesh)
        bpy.context.collection.objects.link(obj)
        obj.data.materials.append(build_icon_material(str(piece.get("icon_material", "ivory")), manifest))
        inlay.append(obj)
    return [*groove, *inlay]


def create_piece(manifest, piece, *, location=(0.0, 0.0, 0.0)):
    # V7 contract: every gameplay element remains a true sphere. Metals differ by material
    # and tactile recessed/raised markings, not by flattening into medallions.
    extras = []
    layered = (bool(manifest["piece_geometry"].get("layered_shell_enabled", False))
               and piece["material_kind"] in {"glass", "opal", "crystal"})
    body = (create_inner_core(manifest, piece, location=location) if layered
            else create_orb_body(manifest, piece, location=location))

    if piece["material_kind"] == "metal":
        extras.extend(apply_metal_marking(manifest, piece, body))
        return [body, *extras]

    if layered:
        shell = create_outer_glass_shell(manifest, piece, location=location)
        extras.append(shell)
    extras.extend(add_internal_details(manifest, piece, location=location))
    extras.extend(create_icon_inlay(manifest, piece, location=location))
    return [body, *extras]


# -----------------------------
# Rendering and previews
# -----------------------------

def _delete_objects(objects):
    for obj in objects:
        if obj and obj.name in bpy.data.objects:
            bpy.data.objects.remove(obj, do_unlink=True)


def render_png(path: Path):
    path.parent.mkdir(parents=True, exist_ok=True)
    bpy.context.scene.render.filepath = str(path)
    bpy.ops.render.render(write_still=True)


def generate_selected(manifest_path: Path, output_dir: Path, only=None):
    manifest = load_manifest(manifest_path)
    errors = validate_manifest(manifest, PROJECT_ROOT)
    if errors:
        raise RuntimeError("Invalid physical asset manifest:\n- " + "\n- ".join(errors))

    if only is None:
        requested = {"board-cell", *[piece["id"] for piece in manifest["pieces"]]}
    elif isinstance(only, str):
        requested = {part.strip() for part in only.split(",") if part.strip()}
    else:
        requested = {str(part).strip() for part in only if str(part).strip()}

    valid = {"board-cell", *[piece["id"] for piece in manifest["pieces"]]}
    unknown = sorted(requested - valid)
    if unknown:
        raise ValueError(f"Unknown physical asset ids: {unknown}; valid ids: {sorted(valid)}")

    clear_scene()
    configure_scene(manifest, preview=False)
    create_camera(manifest)
    create_lights(manifest)

    generated = []
    if "board-cell" in requested:
        cell = create_board_cell(manifest)
        render_png(output_dir / "board-cell.png")
        generated.append("board-cell.png")
        _delete_objects([cell])

    # Camera-invisible set supplies exactly the same ceramic/felt reflections as
    # the physical preview, while the exported sprite keeps a transparent canvas.
    support = create_board_cell(manifest)
    support.visible_camera = False
    felt = create_felt_plane(z=-float(manifest["board"]["height"]) * 0.5 - 0.025)
    felt.visible_camera = False
    for piece in manifest["pieces"]:
        if piece["id"] not in requested:
            continue
        objects = create_piece(manifest, piece, location=(0, 0, float(manifest["piece_geometry"]["preview_piece_center_z"])))
        filename = f"piece-{piece['id']}.png"
        render_png(output_dir / filename)
        generated.append(filename)
        _delete_objects(objects)
    _delete_objects([support, felt])

    output_dir.mkdir(parents=True, exist_ok=True)
    write_build_metadata(PROJECT_ROOT, output_dir, manifest, generated)
    return generated


def generate_all(manifest_path: Path, output_dir: Path):
    return generate_selected(manifest_path, output_dir, only=None)


def _hex_position(q, r, *, outer_radius=1.0, spacing_scale=1.0):
    # Shared pure helper keeps Blender preview positions identical to the manifest math.
    return pointy_hex_position(q, r, outer_radius=outer_radius, spacing_scale=spacing_scale)


def _hex_coords(radius):
    coords = []
    for q in range(-radius, radius + 1):
        r1 = max(-radius, -q - radius)
        r2 = min(radius, -q + radius)
        for r in range(r1, r2 + 1):
            coords.append((q, r))
    return coords


def render_preview(manifest_path: Path, preview_dir: Path):
    manifest = load_manifest(manifest_path)
    errors = validate_manifest(manifest, PROJECT_ROOT)
    if errors:
        raise RuntimeError("Invalid physical asset manifest:\n- " + "\n- ".join(errors))
    manifest_preview = copy.deepcopy(manifest)
    manifest_preview["render"]["transparent"] = False
    piece_z = float(manifest_preview["piece_geometry"]["preview_piece_center_z"])

    # Whole-board concept preview: 37 pointy cells on dark green felt.
    clear_scene()
    configure_scene(manifest_preview, preview=True)
    create_camera(manifest_preview, ortho_scale=14.0)
    create_lights(manifest_preview)
    create_felt_plane(z=-float(manifest_preview["board"]["height"]) * 0.5 - 0.025, size=28.0)

    coords = _hex_coords(3)
    grid_spacing_scale = float(manifest_preview["board"].get("grid_spacing_scale", 1.0))
    outer_radius = float(manifest_preview["board"]["outer_radius"])
    for q, r in coords:
        x, y = _hex_position(q, r, outer_radius=outer_radius, spacing_scale=grid_spacing_scale)
        create_board_cell(manifest_preview, location=(x, y, 0.0))

    by_id = {p["id"]: p for p in manifest_preview["pieces"]}
    piece_ids = [
        "water", "fire", "earth", "air", "copper", "vitae", "mors", "gold",
        "silver", "iron", "quicksilver", "salt", "quintessence", "tin", "lead",
    ]
    placements = [
        (0, 0), (-1, 0), (1, 0), (0, -1), (0, 1), (-1, 1), (1, -1),
        (-2, 1), (2, -1), (-1, -1), (1, 1), (-2, 0), (2, 0), (0, 2), (0, -2),
    ]
    for pid, (q, r) in zip(piece_ids, placements):
        x, y = _hex_position(q, r, outer_radius=outer_radius, spacing_scale=grid_spacing_scale)
        create_piece(manifest_preview, by_id[pid], location=(x, y, piece_z))
    render_png(preview_dir / "board-preview.png")

    # Family sheet: same material/light language, enough room to inspect every type.
    clear_scene()
    configure_scene(manifest_preview, preview=True)
    create_camera(manifest_preview, ortho_scale=10.8)
    create_lights(manifest_preview)
    create_felt_plane(z=-float(manifest_preview["board"]["height"]) * 0.5 - 0.025, size=28.0)
    columns = 5
    for index, piece in enumerate(manifest_preview["pieces"]):
        col = index % columns
        row = index // columns
        x = (col - 2) * 1.95
        y = (1 - row) * 1.90
        create_board_cell(manifest_preview, location=(x, y, 0.0))
        create_piece(manifest_preview, piece, location=(x, y, piece_z))
    render_png(preview_dir / "piece-family-preview.png")

    preview_dir.mkdir(parents=True, exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=str(preview_dir / "physical-asset-factory-preview.blend"))
    return ["board-preview.png", "piece-family-preview.png", "physical-asset-factory-preview.blend"]
