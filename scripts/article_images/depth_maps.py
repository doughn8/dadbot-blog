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


def _piggy_bank(width: int, height: int) -> np.ndarray:
    image = Image.new("L", (width, height), 0)
    draw = ImageDraw.Draw(image)
    body = (round(width * 0.30), round(height * 0.34), round(width * 0.66), round(height * 0.68))
    draw.ellipse(body, fill=185)
    draw.ellipse(
        (round(width * 0.59), round(height * 0.39), round(width * 0.73), round(height * 0.60)),
        fill=215,
    )
    draw.ellipse(
        (round(width * 0.68), round(height * 0.47), round(width * 0.77), round(height * 0.57)),
        fill=238,
    )
    draw.polygon(
        (
            (round(width * 0.61), round(height * 0.42)),
            (round(width * 0.65), round(height * 0.30)),
            (round(width * 0.69), round(height * 0.44)),
        ),
        fill=225,
    )
    for left in (0.36, 0.56):
        draw.rounded_rectangle(
            (
                round(width * left),
                round(height * 0.62),
                round(width * (left + 0.08)),
                round(height * 0.74),
            ),
            radius=14,
            fill=205,
        )
    draw.rounded_rectangle(
        (round(width * 0.43), round(height * 0.36), round(width * 0.55), round(height * 0.385)),
        radius=8,
        fill=245,
    )
    draw.arc(
        (round(width * 0.23), round(height * 0.42), round(width * 0.35), round(height * 0.59)),
        start=70,
        end=300,
        fill=225,
        width=18,
    )
    return _normalise(image)


def _pyramid(width: int, height: int) -> np.ndarray:
    image = Image.new("L", (width, height), 0)
    draw = ImageDraw.Draw(image)
    apex = (width // 2, round(height * 0.22))
    left = (round(width * 0.28), round(height * 0.74))
    right = (round(width * 0.72), round(height * 0.74))
    centre = (width // 2, round(height * 0.74))
    draw.polygon((apex, left, centre), fill=220)
    draw.polygon((apex, centre, right), fill=165)
    for fraction, value in ((0.43, 235), (0.58, 205), (0.72, 180)):
        y = round(height * fraction)
        half_width = round((y - apex[1]) * (right[0] - apex[0]) / (right[1] - apex[1]))
        draw.line((apex[0] - half_width, y, apex[0] + half_width, y), fill=value, width=12)
    draw.line((apex, centre), fill=245, width=14)
    return _normalise(image)


def _gavel(width: int, height: int) -> np.ndarray:
    image = Image.new("L", (width, height), 0)
    head_layer = Image.new("L", (width, height), 0)
    head_draw = ImageDraw.Draw(head_layer)
    head_draw.rounded_rectangle(
        (round(width * 0.37), round(height * 0.31), round(width * 0.63), round(height * 0.45)),
        radius=28,
        fill=230,
    )
    head_layer = head_layer.rotate(-18, resample=Image.Resampling.BICUBIC, center=(width // 2, height // 2))
    image = Image.fromarray(np.maximum(np.asarray(image), np.asarray(head_layer)).astype(np.uint8), mode="L")
    draw = ImageDraw.Draw(image)
    draw.line(
        (round(width * 0.52), round(height * 0.43), round(width * 0.68), round(height * 0.68)),
        fill=205,
        width=max(34, round(height * 0.055)),
    )
    draw.ellipse(
        (round(width * 0.29), round(height * 0.67), round(width * 0.67), round(height * 0.77)),
        fill=155,
    )
    draw.rounded_rectangle(
        (round(width * 0.35), round(height * 0.63), round(width * 0.61), round(height * 0.72)),
        radius=20,
        fill=185,
    )
    return _normalise(image)


def _church(width: int, height: int) -> np.ndarray:
    image = Image.new("L", (width, height), 0)
    draw = ImageDraw.Draw(image)
    cx = width // 2
    draw.rectangle(
        (round(width * 0.35), round(height * 0.43), round(width * 0.65), round(height * 0.73)),
        fill=180,
    )
    draw.polygon(
        ((round(width * 0.31), round(height * 0.45)), (cx, round(height * 0.27)), (round(width * 0.69), round(height * 0.45))),
        fill=220,
    )
    draw.rectangle(
        (round(width * 0.45), round(height * 0.25), round(width * 0.55), round(height * 0.50)),
        fill=205,
    )
    draw.polygon(
        ((round(width * 0.43), round(height * 0.27)), (cx, round(height * 0.16)), (round(width * 0.57), round(height * 0.27))),
        fill=235,
    )
    draw.rounded_rectangle(
        (round(width * 0.46), round(height * 0.54), round(width * 0.54), round(height * 0.73)),
        radius=24,
        fill=245,
    )
    for x in (0.39, 0.59):
        draw.ellipse(
            (round(width * (x - 0.025)), round(height * 0.52), round(width * (x + 0.025)), round(height * 0.61)),
            fill=225,
        )
    draw.line((cx, round(height * 0.17), cx, round(height * 0.25)), fill=245, width=16)
    draw.line((round(width * 0.475), round(height * 0.20), round(width * 0.525), round(height * 0.20)), fill=245, width=16)
    return _normalise(image)


def _megaphone(width: int, height: int) -> np.ndarray:
    image = Image.new("L", (width, height), 0)
    draw = ImageDraw.Draw(image)
    draw.polygon(
        (
            (round(width * 0.33), round(height * 0.43)),
            (round(width * 0.66), round(height * 0.28)),
            (round(width * 0.66), round(height * 0.68)),
            (round(width * 0.33), round(height * 0.57)),
        ),
        fill=210,
    )
    draw.rounded_rectangle(
        (round(width * 0.28), round(height * 0.42), round(width * 0.38), round(height * 0.58)),
        radius=22,
        fill=240,
    )
    draw.rounded_rectangle(
        (round(width * 0.61), round(height * 0.25), round(width * 0.70), round(height * 0.71)),
        radius=28,
        fill=180,
    )
    draw.polygon(
        (
            (round(width * 0.39), round(height * 0.56)),
            (round(width * 0.49), round(height * 0.57)),
            (round(width * 0.54), round(height * 0.78)),
            (round(width * 0.43), round(height * 0.78)),
        ),
        fill=225,
    )
    return _normalise(image)


def _newspaper(width: int, height: int) -> np.ndarray:
    image = Image.new("L", (width, height), 0)
    draw = ImageDraw.Draw(image)
    left, top = round(width * 0.27), round(height * 0.26)
    right, bottom = round(width * 0.73), round(height * 0.74)
    draw.rounded_rectangle((left, top, right, bottom), radius=24, fill=175)
    draw.rounded_rectangle(
        (left + round(width * 0.035), top + round(height * 0.05), right - round(width * 0.035), top + round(height * 0.12)),
        radius=12,
        fill=240,
    )
    draw.rectangle(
        (left + round(width * 0.04), top + round(height * 0.18), left + round(width * 0.19), bottom - round(height * 0.06)),
        fill=220,
    )
    text_left = left + round(width * 0.23)
    for index, fraction in enumerate((0.85, 0.70, 0.90, 0.62, 0.78)):
        y = top + round(height * (0.19 + index * 0.075))
        draw.rounded_rectangle(
            (text_left, y, text_left + round((right - text_left - round(width * 0.04)) * fraction), y + 16),
            radius=7,
            fill=225 - index * 9,
        )
    draw.line((round(width * 0.50), top + round(height * 0.16), round(width * 0.50), bottom - round(height * 0.04)), fill=120, width=10)
    return _normalise(image)


def _terminal(width: int, height: int) -> np.ndarray:
    image = Image.new("L", (width, height), 0)
    draw = ImageDraw.Draw(image)
    left, top = round(width * 0.28), round(height * 0.22)
    right, bottom = round(width * 0.72), round(height * 0.68)
    draw.rounded_rectangle((left, top, right, bottom), radius=34, fill=175)
    draw.rounded_rectangle(
        (left + round(width * 0.025), top + round(height * 0.04), right - round(width * 0.025), bottom - round(height * 0.05)),
        radius=22,
        fill=225,
    )
    prompt_left = left + round(width * 0.06)
    for index, fraction in enumerate((0.60, 0.78, 0.48, 0.68)):
        y = top + round(height * (0.11 + index * 0.075))
        draw.polygon(
            ((prompt_left, y), (prompt_left + 18, y + 10), (prompt_left, y + 20)),
            fill=250,
        )
        draw.rounded_rectangle(
            (prompt_left + 35, y + 3, prompt_left + 35 + round(width * 0.22 * fraction), y + 17),
            radius=6,
            fill=245 - index * 10,
        )
    draw.rectangle(
        (round(width * 0.46), bottom, round(width * 0.54), round(height * 0.76)),
        fill=205,
    )
    draw.rounded_rectangle(
        (round(width * 0.38), round(height * 0.74), round(width * 0.62), round(height * 0.79)),
        radius=18,
        fill=230,
    )
    return _normalise(image)


def _signpost(width: int, height: int) -> np.ndarray:
    image = Image.new("L", (width, height), 0)
    draw = ImageDraw.Draw(image)
    cx = width // 2
    draw.rounded_rectangle(
        (round(width * 0.47), round(height * 0.27), round(width * 0.53), round(height * 0.78)),
        radius=18,
        fill=185,
    )
    draw.polygon(
        (
            (round(width * 0.29), round(height * 0.34)),
            (round(width * 0.50), round(height * 0.34)),
            (round(width * 0.50), round(height * 0.46)),
            (round(width * 0.29), round(height * 0.46)),
            (round(width * 0.23), round(height * 0.40)),
        ),
        fill=230,
    )
    draw.polygon(
        (
            (round(width * 0.50), round(height * 0.51)),
            (round(width * 0.71), round(height * 0.51)),
            (round(width * 0.77), round(height * 0.57)),
            (round(width * 0.71), round(height * 0.63)),
            (round(width * 0.50), round(height * 0.63)),
        ),
        fill=210,
    )
    draw.ellipse(
        (cx - round(width * 0.055), round(height * 0.71), cx + round(width * 0.055), round(height * 0.80)),
        fill=245,
    )
    return _normalise(image)


_GENERATORS = {
    "geometric-portal": _portal,
    "football": _football,
    "document": _document,
    "microchip": _microchip,
    "open-book": _open_book,
    "piggy-bank": _piggy_bank,
    "pyramid": _pyramid,
    "gavel": _gavel,
    "church": _church,
    "megaphone": _megaphone,
    "newspaper": _newspaper,
    "terminal": _terminal,
    "signpost": _signpost,
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
