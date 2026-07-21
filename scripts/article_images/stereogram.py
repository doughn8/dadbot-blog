"""Deterministic scanline-constraint single-image autostereogram renderer."""
from __future__ import annotations

import numpy as np
from PIL import Image

from .models import AutostereogramConfig, RenderSpec
from .textures import generate_texture


def separation_map(depth: np.ndarray, spec: RenderSpec) -> np.ndarray:
    if depth.shape != (spec.height, spec.width):
        raise ValueError("depth map dimensions do not match render spec")
    if spec.convention not in {"parallel", "cross"}:
        raise ValueError("unsupported viewing convention")
    offset = np.rint(np.clip(depth, 0.0, 1.0) * spec.maximum_disparity_px).astype(np.int16)
    spacing = spec.repeat_width_px - offset if spec.convention == "parallel" else spec.repeat_width_px + offset
    return spacing.astype(np.int16)


def _visible(row_depth: np.ndarray, centre: int, left: int, right: int) -> bool:
    """Conservative line-of-sight gate; nearer surfaces occlude farther pairs."""
    subject_depth = float(row_depth[centre])
    if right - left <= 2:
        return False
    left_path = row_depth[left + 1:centre]
    right_path = row_depth[centre + 1:right]
    tolerance = 0.06
    return not (
        (left_path.size and float(left_path.max()) > subject_depth + tolerance)
        or (right_path.size and float(right_path.max()) > subject_depth + tolerance)
    )


def _link_scanline(row_depth: np.ndarray, spacing: np.ndarray) -> np.ndarray:
    """Build non-crossing same-colour links, resolving conflicts locally."""
    width = len(row_depth)
    same = np.arange(width, dtype=np.int32)
    # Nearest points establish constraints first; background pairs crossing them
    # then fail the line-of-sight gate instead of overwriting foreground links.
    order = np.argsort(-row_depth, kind="stable")
    for centre_value in order:
        centre = int(centre_value)
        separation = int(spacing[centre])
        left = centre - separation // 2
        right = left + separation
        if left < 0 or right >= width or not _visible(row_depth, centre, left, right):
            continue
        cursor = int(same[left])
        while cursor != left and cursor != right:
            if cursor < right:
                left = cursor
                cursor = int(same[left])
            else:
                same[left] = right
                left = right
                cursor = int(same[left])
                right = cursor
        same[left] = right
    return same


def render_autostereogram(depth: np.ndarray, spec: RenderSpec, config: AutostereogramConfig) -> Image.Image:
    if (spec.width, spec.height) != (config.width, config.height):
        raise ValueError("render spec does not match loaded configuration")
    texture = generate_texture(spec, config)
    spacing = separation_map(depth, spec)
    output = np.empty_like(texture)
    for y in range(spec.height):
        links = _link_scanline(depth[y], spacing[y])
        for x in range(spec.width - 1, -1, -1):
            linked = int(links[x])
            output[y, x] = texture[y, x] if linked == x else output[y, linked]
    return Image.fromarray(output, mode="RGB")
