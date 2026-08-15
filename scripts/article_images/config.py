"""Configuration loading and strict cross-reference validation."""
from __future__ import annotations

import json
from pathlib import Path
from typing import Mapping, cast

from .models import AutostereogramConfig

_ALLOWED_GENERATORS = {
    "geometric-portal",
    "football",
    "document",
    "microchip",
    "open-book",
    "piggy-bank",
    "pyramid",
    "gavel",
    "church",
    "megaphone",
    "newspaper",
    "terminal",
    "signpost",
}
_SUPPORTED_SECTIONS = {"news", "posts", "conspiracy-corner", "books"}
_TEXTURE_STYLES = {"confetti", "circuit", "cosmic", "halftone", "arcade"}
_SYSTEM_KEYS = {
    "schema_version",
    "renderer_version",
    "default_convention",
    "supported_sections",
    "candidate_root",
    "width",
    "height",
    "repeat_width_px",
    "maximum_disparity_px",
    "safe_area",
    "generation_mode",
    "public_association_requires_approval",
}
_OBJECT_KEYS = {
    "id",
    "topic_families",
    "depth_map",
    "fallback_safe",
    "minimum_disparity_px",
    "maximum_disparity_px",
    "safe_sections",
    "alt_label",
    "provenance",
}
_TOPIC_KEYS = {"id", "aliases", "objects", "safety_constraints"}


def _load_json(path: Path) -> dict[str, object]:
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise ValueError(f"cannot load autostereogram configuration {path}: {exc}") from exc
    if not isinstance(data, dict):
        raise ValueError(f"configuration must be an object: {path}")
    return data


def _exact_keys(value: Mapping[str, object], expected: set[str], label: str) -> None:
    if set(value) != expected:
        raise ValueError(f"{label} fields do not match the approved schema")


def _integer(value: object, label: str) -> int:
    if type(value) is not int:
        raise ValueError(f"{label} must be an integer")
    return cast(int, value)


def _number(value: object, label: str) -> float:
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        raise ValueError(f"{label} must be a number")
    return float(value)


def _text(value: object, label: str) -> str:
    if not isinstance(value, str) or not value.strip():
        raise ValueError(f"{label} must be non-empty text")
    return value


def _text_list(value: object, label: str, *, allow_empty: bool = False) -> list[str]:
    if not isinstance(value, list) or (not allow_empty and not value):
        raise ValueError(f"{label} must be a list of text values")
    if not all(isinstance(item, str) and item.strip() for item in value):
        raise ValueError(f"{label} must contain only non-empty text values")
    return cast(list[str], value)


def _mapping_by_id(
    items: object,
    label: str,
    expected_keys: set[str],
) -> dict[str, Mapping[str, object]]:
    if not isinstance(items, list):
        raise ValueError(f"{label} must be a list")
    mapped: dict[str, Mapping[str, object]] = {}
    for item in items:
        if not isinstance(item, dict):
            raise ValueError(f"each {label} entry must be an object")
        _exact_keys(item, expected_keys, f"{label} entry")
        identifier = _text(item.get("id"), f"{label} id")
        if identifier in mapped:
            raise ValueError(f"duplicate {label} id: {identifier}")
        mapped[identifier] = item
    return mapped


def load_autostereogram_config(root: Path) -> AutostereogramConfig:
    system = _load_json(root / "config" / "article-image-system.json")
    objects_data = _load_json(root / "config" / "autostereogram-objects.json")
    palettes_data = _load_json(root / "config" / "autostereogram-palettes.json")

    settings_value = system.get("autostereogram")
    if not isinstance(settings_value, dict):
        raise ValueError("autostereogram system settings must be an object")
    settings = cast(dict[str, object], settings_value)
    _exact_keys(settings, _SYSTEM_KEYS, "autostereogram system settings")
    schema_version = _integer(settings["schema_version"], "schema_version")
    width = _integer(settings["width"], "width")
    height = _integer(settings["height"], "height")
    repeat = _integer(settings["repeat_width_px"], "repeat_width_px")
    disparity = _integer(settings["maximum_disparity_px"], "maximum_disparity_px")
    safe_area = _number(settings["safe_area"], "safe_area")
    sections_list = _text_list(settings["supported_sections"], "supported_sections")
    sections = tuple(sections_list)
    convention = _text(settings["default_convention"], "default_convention")
    renderer_version = _text(settings["renderer_version"], "renderer_version")
    candidate_root_value = _text(settings["candidate_root"], "candidate_root")
    generation_mode = _text(settings["generation_mode"], "generation_mode")
    public_approval = settings["public_association_requires_approval"]

    if schema_version != 1:
        raise ValueError("autostereogram schema_version must be 1")
    if (width, height) != (1600, 900):
        raise ValueError("autostereogram master dimensions must be 1600x900")
    if convention != "parallel":
        raise ValueError("the approved Dadbot convention must be parallel")
    if len(sections) != len(_SUPPORTED_SECTIONS) or set(sections) != _SUPPORTED_SECTIONS:
        raise ValueError("supported autostereogram sections must match the approved allowlist")
    if not 64 <= repeat <= 256 or not 1 <= disparity < repeat // 3:
        raise ValueError("repeat/disparity geometry is outside safe bounds")
    if not 0.5 <= safe_area <= 0.8:
        raise ValueError("safe_area must be between 0.5 and 0.8")
    if generation_mode != "private-design-candidate-only" or public_approval is not True:
        raise ValueError("autostereogram generation must remain private and approval-gated")

    candidate_root = Path(candidate_root_value)
    if candidate_root.is_absolute():
        raise ValueError("candidate_root must be repository-relative")
    resolved_root = root.resolve()
    candidate_path = resolved_root / candidate_root
    try:
        candidate_parts = candidate_path.relative_to(resolved_root).parts
    except ValueError as exc:
        raise ValueError("candidate_root must remain inside the repository") from exc
    if (
        not candidate_parts
        or candidate_parts[0] != "06-Design"
        or any(part in {"", ".", ".."} for part in candidate_parts)
    ):
        raise ValueError("candidate_root must be inside the private 06-Design area")
    current = resolved_root
    for part in candidate_parts:
        current /= part
        if current.is_symlink():
            raise ValueError("candidate_root may not contain symlinks")

    _exact_keys(objects_data, {"schema_version", "objects", "topics", "section_fallbacks"}, "object config")
    if _integer(objects_data["schema_version"], "object schema_version") != 1:
        raise ValueError("object schema_version must be 1")
    depth_maps = _mapping_by_id(objects_data["objects"], "objects", _OBJECT_KEYS)
    topics = _mapping_by_id(objects_data["topics"], "topics", _TOPIC_KEYS)
    for identifier, entry in depth_maps.items():
        _text_list(entry["topic_families"], f"object {identifier} topic_families")
        if type(entry["fallback_safe"]) is not bool:
            raise ValueError(f"object {identifier} fallback_safe must be boolean")
        _text(entry["alt_label"], f"object {identifier} alt_label")
        _text(entry["provenance"], f"object {identifier} provenance")
        depth = entry["depth_map"]
        if not isinstance(depth, dict):
            raise ValueError(f"object {identifier} depth_map must be an object")
        _exact_keys(depth, {"type", "generator", "version"}, f"object {identifier} depth_map")
        if depth["type"] != "procedural" or _integer(depth["version"], "depth_map version") != 1:
            raise ValueError(f"object {identifier} must use a version-1 procedural depth map")
        generator = depth["generator"]
        if not isinstance(generator, str) or generator not in _ALLOWED_GENERATORS:
            raise ValueError(f"unsupported depth-map generator: {generator}")
        safe_sections = _text_list(entry["safe_sections"], f"object {identifier} safe_sections")
        if not set(safe_sections).issubset(sections):
            raise ValueError(f"object {identifier} has invalid safe_sections")
        minimum = _integer(entry["minimum_disparity_px"], f"object {identifier} minimum disparity")
        maximum = _integer(entry["maximum_disparity_px"], f"object {identifier} maximum disparity")
        if not 1 <= minimum <= maximum <= disparity:
            raise ValueError(f"object {identifier} has an invalid disparity range")

    for topic, entry in topics.items():
        _text_list(entry["aliases"], f"topic {topic} aliases", allow_empty=True)
        _text_list(entry["safety_constraints"], f"topic {topic} safety_constraints", allow_empty=True)
        choices = entry["objects"]
        if not isinstance(choices, list) or not choices:
            raise ValueError(f"topic {topic} requires object choices")
        for choice in choices:
            if not isinstance(choice, dict):
                raise ValueError(f"topic {topic} has an invalid object reference")
            _exact_keys(choice, {"id", "weight"}, f"topic {topic} object reference")
            choice_id = _text(choice["id"], f"topic {topic} object id")
            weight = _integer(choice["weight"], f"topic {topic} object weight")
            if choice_id not in depth_maps or weight < 1:
                raise ValueError(f"topic {topic} has an invalid object reference")

    fallbacks = objects_data["section_fallbacks"]
    if not isinstance(fallbacks, dict) or set(fallbacks) != set(sections):
        raise ValueError("section_fallbacks must cover every supported section")
    for section, identifier_value in fallbacks.items():
        identifier = _text(identifier_value, f"fallback for {section}")
        if identifier not in depth_maps or section not in depth_maps[identifier]["safe_sections"]:
            raise ValueError(f"invalid fallback {identifier} for {section}")

    _exact_keys(
        palettes_data,
        {"schema_version", "palettes", "textures", "section_palettes", "section_textures"},
        "palette config",
    )
    if _integer(palettes_data["schema_version"], "palette schema_version") != 1:
        raise ValueError("palette schema_version must be 1")
    palettes = _mapping_by_id(palettes_data["palettes"], "palettes", {"id", "colours"})
    textures = _mapping_by_id(
        palettes_data["textures"],
        "textures",
        {"id", "style", "vertical_run_px", "horizontal_carry", "grain"},
    )
    for identifier, entry in palettes.items():
        colours = _text_list(entry["colours"], f"palette {identifier} colours")
        if len(colours) < 4 or not all(
            len(colour) == 7
            and colour.startswith("#")
            and all(character in "0123456789abcdefABCDEF" for character in colour[1:])
            for colour in colours
        ):
            raise ValueError(f"palette {identifier} requires at least four hexadecimal colours")
    for identifier, entry in textures.items():
        style = _text(entry["style"], f"texture {identifier} style")
        run = _integer(entry["vertical_run_px"], f"texture {identifier} vertical_run_px")
        carry = _number(entry["horizontal_carry"], f"texture {identifier} horizontal_carry")
        grain = _integer(entry["grain"], f"texture {identifier} grain")
        if style not in _TEXTURE_STYLES:
            raise ValueError(f"texture {identifier} uses an unsupported style")
        if run not in (1, 2, 3, 4) or not 0 <= carry <= 0.4 or not 0 <= grain <= 20:
            raise ValueError(f"texture {identifier} has parameters outside safe bounds")

    section_palettes_raw = palettes_data["section_palettes"]
    section_textures_raw = palettes_data["section_textures"]
    if not isinstance(section_palettes_raw, dict) or set(section_palettes_raw) != set(sections):
        raise ValueError("section palette mappings must match supported sections")
    if not isinstance(section_textures_raw, dict) or set(section_textures_raw) != set(sections):
        raise ValueError("section texture mappings must match supported sections")
    section_palettes: dict[str, tuple[str, ...]] = {}
    section_textures: dict[str, tuple[str, ...]] = {}
    for section in sections:
        palette_ids = tuple(_text_list(section_palettes_raw[section], f"palettes for {section}"))
        texture_ids = tuple(_text_list(section_textures_raw[section], f"textures for {section}"))
        if any(identifier not in palettes for identifier in palette_ids):
            raise ValueError(f"invalid palettes for {section}")
        if any(identifier not in textures for identifier in texture_ids):
            raise ValueError(f"invalid textures for {section}")
        section_palettes[section] = palette_ids
        section_textures[section] = texture_ids

    return AutostereogramConfig(
        root=resolved_root,
        schema_version=schema_version,
        renderer_version=renderer_version,
        default_convention=convention,
        supported_sections=sections,
        candidate_root=candidate_path,
        width=width,
        height=height,
        repeat_width_px=repeat,
        maximum_disparity_px=disparity,
        safe_area=safe_area,
        depth_maps=depth_maps,
        topics=topics,
        section_fallbacks={str(key): cast(str, value) for key, value in fallbacks.items()},
        palettes=palettes,
        section_palettes=section_palettes,
        textures=textures,
        section_textures=section_textures,
    )
