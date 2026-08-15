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


def _style_indices(
    style: str,
    *,
    height: int,
    width: int,
    palette_size: int,
    rng: np.random.Generator,
) -> np.ndarray:
    shape = (height, width)
    if style == "confetti":
        return rng.integers(0, palette_size, size=shape, dtype=np.int16)

    rows, columns = np.indices(shape)
    if style == "circuit":
        segment_width = palette_size
        segment_count = (width + segment_width - 1) // segment_width
        segments = rng.random((height, segment_count, palette_size)).argsort(axis=2)
        return segments.reshape(height, segment_count * segment_width)[:, :width].astype(np.int16)

    if style == "cosmic":
        indices = rng.integers(0, palette_size, size=shape, dtype=np.int16)
        return np.roll(indices, shift=1, axis=1)

    if style == "halftone":
        block_height = 2 if palette_size % 2 == 0 else 1
        block_width = (palette_size + block_height - 1) // block_height
        base = (rows * block_width + columns) % palette_size
        offset_height = (height + block_height - 1) // block_height
        offset_width = (width + block_width - 1) // block_width
        offsets = rng.integers(
            0,
            palette_size,
            size=(offset_height, offset_width),
            dtype=np.int16,
        )
        offsets = np.repeat(
            np.repeat(offsets, block_height, axis=0),
            block_width,
            axis=1,
        )[:height, :width]
        return ((base + offsets) % palette_size).astype(np.int16)

    if style == "arcade":
        block_height = 2 if palette_size % 2 == 0 else 1
        block_width = (palette_size + block_height - 1) // block_height
        tile_rows = (height + block_height - 1) // block_height
        tile_columns = (width + block_width - 1) // block_width
        tiles = rng.random((tile_rows, tile_columns, palette_size)).argsort(axis=2)
        tiled = tiles.reshape(tile_rows, tile_columns, block_height, block_width)
        return tiled.transpose(0, 2, 1, 3).reshape(
            tile_rows * block_height,
            tile_columns * block_width,
        )[:height, :width].astype(np.int16)

    raise ValueError(f"unsupported texture style: {style}")


def generate_texture(spec: RenderSpec, config: AutostereogramConfig) -> np.ndarray:
    palette_entry = config.palettes[spec.palette_id]
    texture_entry = config.textures[spec.texture_id]
    colours = palette_entry.get("colours")
    if not isinstance(colours, list) or len(colours) < 4:
        raise ValueError("palette requires at least four colours")
    palette = np.asarray([_hex_colour(colour) for colour in colours], dtype=np.int16)
    style = str(texture_entry.get("style", ""))
    run = int(texture_entry.get("vertical_run_px", 2))
    carry_probability = float(texture_entry.get("horizontal_carry", 0.18))
    grain_strength = int(texture_entry.get("grain", 8))
    if run not in (1, 2, 3, 4) or not 0 <= carry_probability <= 0.4 or not 0 <= grain_strength <= 20:
        raise ValueError("texture parameters are outside safe bounds")
    rng = np.random.Generator(np.random.PCG64(derive_subseed(spec.seed, "surface-texture")))
    source_height = (spec.height + run - 1) // run
    indices = _style_indices(
        style,
        height=source_height,
        width=spec.width,
        palette_size=len(palette),
        rng=rng,
    )
    texture = np.repeat(palette[indices], run, axis=0)[:spec.height]
    grain = rng.integers(-grain_strength, grain_strength + 1, size=texture.shape, dtype=np.int16)
    texture = np.clip(texture + grain, 0, 255).astype(np.uint8)
    carry = rng.random((spec.height, spec.width)) < carry_probability
    for x in range(1, spec.width):
        texture[carry[:, x], x] = texture[carry[:, x], x - 1]
    return texture
