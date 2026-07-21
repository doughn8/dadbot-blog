"""Computational QA for generated single-image autostereograms."""
from __future__ import annotations

import hashlib

import numpy as np
from PIL import Image, ImageFilter

from .models import RenderSpec
from .stereogram import separation_map


def _pearson(first: np.ndarray, second: np.ndarray) -> float:
    a = first.astype(np.float64).ravel()
    b = second.astype(np.float64).ravel()
    a -= a.mean()
    b -= b.mean()
    denominator = float(np.linalg.norm(a) * np.linalg.norm(b))
    return float(np.dot(a, b) / denominator) if denominator else 0.0


def _rank(values: np.ndarray) -> np.ndarray:
    order = np.argsort(values, kind="stable")
    ranks = np.empty(len(values), dtype=np.float64)
    ranks[order] = np.arange(len(values), dtype=np.float64)
    # Replace tied runs with their average rank.
    sorted_values = values[order]
    start = 0
    while start < len(values):
        end = start + 1
        while end < len(values) and sorted_values[end] == sorted_values[start]:
            end += 1
        ranks[order[start:end]] = (start + end - 1) / 2.0
        start = end
    return ranks


def _spearman(first: np.ndarray, second: np.ndarray) -> float:
    return _pearson(_rank(first), _rank(second))


def _perceptual_dhash(image: Image.Image) -> str:
    reduced = np.asarray(
        image.convert("L").resize((9, 8), Image.Resampling.LANCZOS),
        dtype=np.uint8,
    )
    comparisons = reduced[:, 1:] > reduced[:, :-1]
    value = 0
    for bit in comparisons.ravel():
        value = (value << 1) | int(bit)
    return f"{value:016x}"


def _hamming_distance(first: str, second: str) -> int:
    return (int(first, 16) ^ int(second, 16)).bit_count()


def _forward_correspondence(pixels: np.ndarray, depth: np.ndarray, spec: RenderSpec) -> tuple[float, int]:
    spacing = separation_map(depth, spec)
    matches = 0
    samples = 0
    for y in range(12, spec.height - 12, 8):
        row = depth[y]
        for x in range(spec.repeat_width_px, spec.width - spec.repeat_width_px, 8):
            local = row[x - 3:x + 4]
            if local.size != 7 or float(local.max() - local.min()) > 0.08:
                continue
            separation = int(spacing[y, x])
            left = x - separation // 2
            right = left + separation
            if left < 0 or right >= spec.width:
                continue
            samples += 1
            if np.array_equal(pixels[y, left], pixels[y, right]):
                matches += 1
    return (matches / samples if samples else 0.0), samples


def _blind_recovery(pixels: np.ndarray, depth: np.ndarray, spec: RenderSpec) -> dict[str, float | int]:
    image = pixels.astype(np.float32)
    recovered_depth: list[float] = []
    expected_depth: list[float] = []
    spacing_errors: list[float] = []
    radius = 4
    lower = spec.repeat_width_px - spec.maximum_disparity_px
    upper = spec.repeat_width_px + (spec.maximum_disparity_px if spec.convention == "cross" else 0)
    for y in range(150, spec.height - 150, 18):
        for x in range(220, spec.width - 220, 18):
            target_depth = float(depth[y, x])
            local_depth = depth[y - radius:y + radius + 1, x - radius:x + radius + 1]
            if float(local_depth.max() - local_depth.min()) > 0.08:
                continue
            expected_spacing = (
                spec.repeat_width_px - round(target_depth * spec.maximum_disparity_px)
                if spec.convention == "parallel"
                else spec.repeat_width_px + round(target_depth * spec.maximum_disparity_px)
            )
            expected_left = x - expected_spacing // 2
            expected_right = expected_left + expected_spacing
            if expected_left < 0 or expected_right >= spec.width:
                continue
            left_path = depth[y, expected_left + 1:x]
            right_path = depth[y, x + 1:expected_right]
            if (
                (left_path.size and float(left_path.max()) > target_depth + 0.06)
                or (right_path.size and float(right_path.max()) > target_depth + 0.06)
            ):
                continue
            best_spacing = spec.repeat_width_px
            best_error = float("inf")
            second_error = float("inf")
            for candidate in range(lower, upper + 1):
                left = x - candidate // 2
                right = left + candidate
                if left - radius < 0 or right + radius >= spec.width:
                    continue
                left_patch = image[y - radius:y + radius + 1, left - radius:left + radius + 1]
                right_patch = image[y - radius:y + radius + 1, right - radius:right + radius + 1]
                error = float(np.mean((left_patch - right_patch) ** 2))
                if error < best_error:
                    second_error = best_error
                    best_error = error
                    best_spacing = candidate
                elif error < second_error:
                    second_error = error
            if not np.isfinite(best_error):
                continue
            if best_error > 0 and second_error <= best_error * 1.08:
                continue
            recovered = (
                (spec.repeat_width_px - best_spacing) / spec.maximum_disparity_px
                if spec.convention == "parallel"
                else (best_spacing - spec.repeat_width_px) / spec.maximum_disparity_px
            )
            recovered_depth.append(float(np.clip(recovered, 0.0, 1.0)))
            expected_depth.append(target_depth)
            spacing_errors.append(abs(best_spacing - expected_spacing))
    recovered_array = np.asarray(recovered_depth, dtype=np.float32)
    expected_array = np.asarray(expected_depth, dtype=np.float32)
    errors = np.asarray(spacing_errors, dtype=np.float32)
    active = expected_array > 0.05
    background = expected_array <= 0.01
    # Balance background and active samples so a large flat field cannot dominate.
    if active.any() and background.any():
        count = min(int(active.sum()), int(background.sum()))
        selected = np.concatenate((np.flatnonzero(active)[:count], np.flatnonzero(background)[:count]))
    else:
        selected = np.arange(len(expected_array))
    correlation = _spearman(recovered_array[selected], expected_array[selected]) if len(selected) > 2 else 0.0
    foreground_median = float(np.median(recovered_array[active])) if active.any() else 0.0
    background_median = float(np.median(recovered_array[background])) if background.any() else 0.0
    return {
        "correlation": correlation,
        "median_error": float(np.median(errors)) if len(errors) else float("inf"),
        "p95_error": float(np.percentile(errors, 95)) if len(errors) else float("inf"),
        "foreground_contrast": foreground_median - background_median,
        "samples": len(errors),
    }


def _periodicity(pixels: np.ndarray, depth: np.ndarray, spec: RenderSpec) -> float:
    repeat = spec.repeat_width_px
    flat = (depth[:, repeat:] <= 0.01) & (depth[:, :-repeat] <= 0.01)
    exact = np.all(pixels[:, repeat:] == pixels[:, :-repeat], axis=2)
    return float(exact[flat].mean()) if flat.any() else 0.0


def _smoothed_feature(array: np.ndarray, *, radius: float) -> np.ndarray:
    maximum = float(array.max())
    normalised = array / maximum if maximum else array
    feature = Image.fromarray(np.uint8(np.clip(normalised, 0.0, 1.0) * 255), mode="L")
    return np.asarray(
        feature.filter(ImageFilter.GaussianBlur(radius=radius)).resize(
            (160, 90), Image.Resampling.BILINEAR
        ),
        dtype=np.float32,
    )


def _leakage(image: Image.Image, depth: np.ndarray) -> tuple[float, dict[str, float]]:
    depth_image = Image.fromarray(np.uint8(np.clip(depth, 0.0, 1.0) * 255), mode="L")
    values: dict[str, float] = {}
    for radius in (12, 24, 48):
        luminance = image.convert("L").filter(ImageFilter.GaussianBlur(radius=radius)).resize((160, 90), Image.Resampling.BILINEAR)
        reduced_depth = depth_image.resize((160, 90), Image.Resampling.BILINEAR)
        correlation = abs(_pearson(np.asarray(luminance), np.asarray(reduced_depth)))
        values[f"blur_{radius}_correlation"] = correlation
    luminance_array = np.asarray(image.convert("L"), dtype=np.float32)
    foreground = depth > 0.10
    background = depth <= 0.01
    histogram_distance = (
        abs(float(luminance_array[foreground].mean()) - float(luminance_array[background].mean())) / 255.0
        if foreground.any() and background.any()
        else 0.0
    )
    values["foreground_background_luminance_distance"] = histogram_distance

    rgb = np.asarray(image.convert("RGB"), dtype=np.float32)
    horizontal = np.mean(np.abs(np.diff(rgb, axis=1, prepend=rgb[:, :1])), axis=2)
    vertical = np.mean(np.abs(np.diff(rgb, axis=0, prepend=rgb[:1, :])), axis=2)
    texture_energy = np.hypot(horizontal, vertical)
    depth_horizontal = np.abs(np.diff(depth, axis=1, prepend=depth[:, :1]))
    depth_vertical = np.abs(np.diff(depth, axis=0, prepend=depth[:1, :]))
    depth_boundary = np.hypot(depth_horizontal, depth_vertical)
    values["structure_boundary_correlation"] = abs(
        _pearson(
            _smoothed_feature(texture_energy, radius=8),
            _smoothed_feature(depth_boundary, radius=4),
        )
    )

    local_mean = np.asarray(
        image.convert("L").filter(ImageFilter.GaussianBlur(radius=4)), dtype=np.float32
    )
    local_contrast = np.abs(luminance_array - local_mean)
    values["local_contrast_depth_correlation"] = abs(
        _pearson(
            _smoothed_feature(local_contrast, radius=10),
            _smoothed_feature(depth, radius=4),
        )
    )
    return max((*values.values(), 0.0)), values


def validate_autostereogram(
    image: Image.Image,
    depth: np.ndarray,
    spec: RenderSpec,
    *,
    existing_pixel_hashes: tuple[str, ...] = (),
    existing_perceptual_hashes: tuple[str, ...] = (),
) -> dict[str, object]:
    if image.mode != "RGB" or image.size != (spec.width, spec.height):
        return {
            "passed": False,
            "checks": {"format": False},
            "failure": f"image must be RGB {spec.width}x{spec.height}",
        }
    pixels = np.asarray(image, dtype=np.uint8)
    pixel_hash = hashlib.sha256(pixels.tobytes()).hexdigest()
    perceptual_hash = _perceptual_dhash(image)
    valid_perceptual_hashes = tuple(
        value for value in existing_perceptual_hashes if len(value) == 16
    )
    nearest_perceptual_distance = (
        min(_hamming_distance(perceptual_hash, value) for value in valid_perceptual_hashes)
        if valid_perceptual_hashes
        else None
    )
    forward_score, forward_samples = _forward_correspondence(pixels, depth, spec)
    recovery = _blind_recovery(pixels, depth, spec)
    periodicity = _periodicity(pixels, depth, spec)
    leakage_score, leakage_metrics = _leakage(image, depth)
    checks = {
        "format": True,
        "periodicity": periodicity >= 0.70,
        "forward_correspondence": forward_score >= 0.80,
        "depth_recovery": (
            float(recovery["correlation"]) >= 0.80
            and float(recovery["median_error"]) <= 1.5
            and float(recovery["p95_error"]) <= 3.0
            and float(recovery["foreground_contrast"]) > 0.12
        ),
        "normal_view_leakage": (
            max(
                float(leakage_metrics["blur_12_correlation"]),
                float(leakage_metrics["blur_24_correlation"]),
                float(leakage_metrics["blur_48_correlation"]),
                float(leakage_metrics["foreground_background_luminance_distance"]),
            ) < 0.15
            and float(leakage_metrics["structure_boundary_correlation"]) < 0.18
            and float(leakage_metrics["local_contrast_depth_correlation"]) < 0.15
        ),
        "exact_uniqueness": pixel_hash not in existing_pixel_hashes,
    }
    return {
        "passed": all(checks.values()),
        "checks": checks,
        "decoded_pixel_sha256": pixel_hash,
        "perceptual_dhash": perceptual_hash,
        "near_duplicate_warning": (
            nearest_perceptual_distance is not None and nearest_perceptual_distance <= 6
        ),
        "nearest_perceptual_hamming_distance": nearest_perceptual_distance,
        "periodicity_score": round(periodicity, 6),
        "forward_correspondence_score": round(forward_score, 6),
        "forward_correspondence_samples": forward_samples,
        "depth_recovery_correlation": round(float(recovery["correlation"]), 6),
        "median_spacing_error_px": round(float(recovery["median_error"]), 6),
        "p95_spacing_error_px": round(float(recovery["p95_error"]), 6),
        "recovered_foreground_contrast": round(float(recovery["foreground_contrast"]), 6),
        "depth_recovery_samples": int(recovery["samples"]),
        "normal_view_leakage_score": round(leakage_score, 6),
        "normal_view_leakage_metrics": {key: round(value, 6) for key, value in leakage_metrics.items()},
    }
