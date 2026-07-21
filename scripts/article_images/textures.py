"""Seeded, stationary colour textures for stereogram correspondence classes."""
from __future__ import annotations

import numpy as np

from .models import AutostereogramConfig, RenderSpec
from .seeds import derive_subseed


def _hex_colour(value: object) -> tuple[int, int, int]:
    text = str(value)
    if len(text) != 7 or not text.startswith("#"):
        raise ValueError(f"invalid palette colour: {text}")
    try:
        return int(text[1:3], 16), int(text[3:5], 16), int(text[5:7], 16)
    except ValueError as exc:
        raise ValueError(f"invalid palette colour: {text}") from exc


def generate_texture(spec: RenderSpec, config: AutostereogramConfig) -> np.ndarray:
    palette_entry = config.palettes[spec.palette_id]
    texture_entry = config.textures[spec.texture_id]
    colours = palette_entry.get("colours")
    if not isinstance(colours, list) or len(colours) < 4:
        raise ValueError("palette requires at least four colours")
    palette = np.asarray([_hex_colour(colour) for colour in colours], dtype=np.int16)
    run = int(texture_entry.get("vertical_run_px", 2))
    carry_probability = float(texture_entry.get("horizontal_carry", 0.18))
    grain_strength = int(texture_entry.get("grain", 8))
    if run not in (1, 2, 3, 4) or not 0 <= carry_probability <= 0.4 or not 0 <= grain_strength <= 20:
        raise ValueError("texture parameters are outside safe bounds")
    rng = np.random.Generator(np.random.PCG64(derive_subseed(spec.seed, "surface-texture")))
    source_height = (spec.height + run - 1) // run
    indices = rng.integers(0, len(palette), size=(source_height, spec.width), dtype=np.int16)
    texture = np.repeat(palette[indices], run, axis=0)[:spec.height]
    grain = rng.integers(-grain_strength, grain_strength + 1, size=texture.shape, dtype=np.int16)
    texture = np.clip(texture + grain, 0, 255).astype(np.uint8)
    carry = rng.random((spec.height, spec.width)) < carry_probability
    for x in range(1, spec.width):
        texture[carry[:, x], x] = texture[carry[:, x], x - 1]
    return texture
