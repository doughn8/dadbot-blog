"""Procedural, licence-free depth maps for approved hidden objects."""
from __future__ import annotations

import math

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

from .models import AutostereogramConfig


def _normalise(image: Image.Image) -> np.ndarray:
    softened = image.convert("L").filter(ImageFilter.GaussianBlur(radius=1.25))
    return (np.asarray(softened, dtype=np.float32) / np.float32(255.0)).astype(np.float32)


def _polygon(cx: float, cy: float, radius: float, sides: int, rotation: float = -math.pi / 2) -> list[tuple[float, float]]:
    return [
        (
            cx + radius * math.cos(rotation + 2 * math.pi * index / sides),
            cy + radius * math.sin(rotation + 2 * math.pi * index / sides),
        )
        for index in range(sides)
    ]


def _portal(width: int, height: int) -> np.ndarray:
    image = Image.new("L", (width, height), 0)
    draw = ImageDraw.Draw(image)
    cx, cy = width // 2, height // 2
    unit = min(width, height)
    for fraction, value in ((0.315, 90), (0.260, 205), (0.200, 55), (0.130, 238), (0.064, 125)):
        radius = round(unit * fraction)
        draw.ellipse((cx - radius, cy - radius, cx + radius, cy + radius), fill=value)
    return _normalise(image)


def _football(width: int, height: int) -> np.ndarray:
    yy, xx = np.mgrid[0:height, 0:width]
    cx, cy, radius = width / 2, height / 2, min(width, height) * 0.278
    radial = np.sqrt((xx - cx) ** 2 + (yy - cy) ** 2) / radius
    depth = np.zeros((height, width), dtype=np.float32)
    inside = radial <= 1.0
    depth[inside] = 0.30 + 0.46 * np.sqrt(np.clip(1.0 - radial[inside] ** 2, 0.0, 1.0))
    details = Image.new("L", (width, height), 0)
    draw = ImageDraw.Draw(details)
    draw.polygon(_polygon(cx, cy, radius * 0.29, 5), fill=245)
    outer: list[tuple[float, float]] = []
    for index in range(5):
        angle = -math.pi / 2 + 2 * math.pi * index / 5
        ox, oy = cx + radius * 0.66 * math.cos(angle), cy + radius * 0.66 * math.sin(angle)
        outer.append((ox, oy))
        draw.polygon(_polygon(ox, oy, radius * 0.18, 5, angle), fill=225)
        draw.line((cx, cy, ox, oy), fill=205, width=max(6, round(radius * 0.07)))
    for index, point in enumerate(outer):
        draw.line((*point, *outer[(index + 1) % 5]), fill=175, width=max(4, round(radius * 0.045)))
    detail = np.asarray(details, dtype=np.float32) / np.float32(255.0)
    return np.where((detail > 0) & inside, np.maximum(depth, detail), depth).astype(np.float32)


def _document(width: int, height: int) -> np.ndarray:
    image = Image.new("L", (width, height), 0)
    draw = ImageDraw.Draw(image)
    left, right = round(width * 0.35), round(width * 0.65)
    top, bottom = round(height * 0.21), round(height * 0.79)
    fold = round(min(width, height) * 0.13)
    draw.rounded_rectangle((left, top, right, bottom), radius=20, fill=150)
    draw.polygon(((right - fold, top), (right, top + fold), (right, top)), fill=235)
    draw.line((right - fold, top, right - fold, top + fold, right, top + fold), fill=85, width=14)
    for index, fraction in enumerate((0.60, 0.72, 0.52, 0.68, 0.44)):
        y = top + round((index + 2) * (bottom - top) / 8)
        draw.rounded_rectangle((left + 60, y, left + 60 + round((right - left - 120) * fraction), y + 20), radius=8, fill=220 - index * 8)
    radius = round(min(width, height) * 0.06)
    mx, my = right - round(fold * 0.9), bottom - round(fold * 0.8)
    draw.ellipse((mx - radius, my - radius, mx + radius, my + radius), outline=240, width=24)
    draw.line((mx + radius * 0.7, my + radius * 0.7, mx + radius * 1.65, my + radius * 1.65), fill=240, width=22)
    return _normalise(image)


def _microchip(width: int, height: int) -> np.ndarray:
    image = Image.new("L", (width, height), 0)
    draw = ImageDraw.Draw(image)
    cx, cy = width // 2, height // 2
    half_w, half_h = round(width * 0.16), round(height * 0.24)
    draw.rounded_rectangle((cx - half_w, cy - half_h, cx + half_w, cy + half_h), radius=32, fill=205)
    draw.rounded_rectangle((cx - half_w * 0.55, cy - half_h * 0.55, cx + half_w * 0.55, cy + half_h * 0.55), radius=20, fill=245)
    pin = max(10, round(height * 0.025))
    for y in range(cy - half_h + 35, cy + half_h - 20, max(34, round(height * 0.065))):
        draw.rectangle((cx - half_w - 75, y, cx - half_w, y + pin), fill=175)
        draw.rectangle((cx + half_w, y, cx + half_w + 75, y + pin), fill=175)
    for x in range(cx - half_w + 35, cx + half_w - 20, max(42, round(width * 0.045))):
        draw.rectangle((x, cy - half_h - 65, x + pin, cy - half_h), fill=175)
        draw.rectangle((x, cy + half_h, x + pin, cy + half_h + 65), fill=175)
    return _normalise(image)


def _open_book(width: int, height: int) -> np.ndarray:
    image = Image.new("L", (width, height), 0)
    draw = ImageDraw.Draw(image)
    cx, cy = width // 2, height // 2
    half_w, half_h = round(width * 0.22), round(height * 0.23)
    left = [(cx, cy - half_h), (cx - half_w, cy - half_h * 0.78), (cx - half_w, cy + half_h), (cx, cy + half_h * 0.72)]
    right = [(cx, cy - half_h), (cx + half_w, cy - half_h * 0.78), (cx + half_w, cy + half_h), (cx, cy + half_h * 0.72)]
    draw.polygon(left, fill=190)
    draw.polygon(right, fill=220)
    draw.line((cx, cy - half_h, cx, cy + half_h * 0.72), fill=248, width=22)
    for side in (-1, 1):
        for index in range(4):
            y = cy - half_h // 2 + index * round(half_h * 0.32)
            draw.line((cx + side * 45, y, cx + side * round(half_w * 0.75), y + side * 4), fill=145, width=10)
    return _normalise(image)


_GENERATORS = {
    "geometric-portal": _portal,
    "football": _football,
    "document": _document,
    "microchip": _microchip,
    "open-book": _open_book,
}


def generate_depth_map(object_id: str, config: AutostereogramConfig) -> np.ndarray:
    try:
        entry = config.depth_maps[object_id]
        depth = entry["depth_map"]
        generator = str(depth["generator"])  # type: ignore[index]
        result = _GENERATORS[generator](config.width, config.height)
    except KeyError as exc:
        raise ValueError(f"unknown depth map: {object_id}") from exc
    if result.shape != (config.height, config.width) or result.dtype != np.float32:
        raise ValueError("depth-map generator returned an invalid array")
    if not np.isfinite(result).all() or float(result.min()) < 0.0 or float(result.max()) > 1.0:
        raise ValueError("depth-map generator returned values outside 0..1")
    return result
