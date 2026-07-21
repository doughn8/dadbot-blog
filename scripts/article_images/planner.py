"""Resolve an auditable render specification from article analysis."""
from __future__ import annotations

from .models import AnalysisResult, ArticlePacket, AutostereogramConfig, RenderSpec, SelectionResult
from .seeds import derive_subseed


def _select(values: tuple[str, ...], seed: int, purpose: str, override: str | None) -> str:
    if override is not None:
        if override not in values:
            raise ValueError(f"{purpose} override is not approved for this section: {override}")
        return override
    return values[derive_subseed(seed, purpose) % len(values)]


def build_render_spec(
    packet: ArticlePacket,
    analysis: AnalysisResult,
    selection: SelectionResult,
    config: AutostereogramConfig,
    *,
    seed: int,
    variant_number: int,
    palette_override: str | None = None,
    texture_override: str | None = None,
) -> RenderSpec:
    entry = config.depth_maps[selection.hidden_object_id]
    minimum = int(entry.get("minimum_disparity_px", 13))
    maximum = int(entry.get("maximum_disparity_px", config.maximum_disparity_px))
    if not 1 <= minimum <= maximum <= config.maximum_disparity_px:
        raise ValueError(f"invalid disparity range for {selection.hidden_object_id}")
    span = maximum - minimum + 1
    disparity = minimum + derive_subseed(seed, "disparity") % span
    palette_id = _select(config.section_palettes[packet.section], seed, "palette", palette_override)
    texture_id = _select(config.section_textures[packet.section], seed, "texture", texture_override)
    return RenderSpec(
        schema="AUTOSTEREOGRAM_RENDER_SPEC_V1",
        article_id=packet.article_id,
        article_hash=packet.source_sha256,
        section=packet.section,
        primary_topic=analysis.primary_topic,
        hidden_object_id=selection.hidden_object_id,
        palette_id=palette_id,
        texture_id=texture_id,
        seed=seed,
        renderer_version=config.renderer_version,
        width=config.width,
        height=config.height,
        repeat_width_px=config.repeat_width_px,
        maximum_disparity_px=disparity,
        convention=config.default_convention,
        safe_area=config.safe_area,
        variant_number=variant_number,
    )
