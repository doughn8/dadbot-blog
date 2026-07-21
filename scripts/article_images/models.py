"""Typed records shared by the Dadbot autostereogram pipeline."""
from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Mapping


@dataclass(frozen=True)
class ArticlePacket:
    article_id: str
    source_path: Path
    source_sha256: str
    title: str
    summary: str
    section: str
    slug: str
    publication_date: str
    category: str
    tags: tuple[str, ...]
    body_excerpt: str
    workflow_stage: str
    publishable: bool
    safety_constraints: tuple[str, ...]


@dataclass(frozen=True)
class AnalysisResult:
    primary_topic: str
    matched_terms: tuple[str, ...]
    confidence: float
    method: str
    safety_constraints: tuple[str, ...]


@dataclass(frozen=True)
class SelectionResult:
    hidden_object_id: str
    depth_map_id: str
    selection_reason: str
    confidence: float
    alt_label: str


@dataclass(frozen=True)
class RenderSpec:
    schema: str
    article_id: str
    article_hash: str
    section: str
    primary_topic: str
    hidden_object_id: str
    palette_id: str
    texture_id: str
    seed: int
    renderer_version: str
    width: int
    height: int
    repeat_width_px: int
    maximum_disparity_px: int
    convention: str
    safe_area: float
    variant_number: int

    def to_dict(self) -> dict[str, object]:
        return {
            "schema": self.schema,
            "article_id": self.article_id,
            "article_hash": self.article_hash,
            "section": self.section,
            "primary_topic": self.primary_topic,
            "hidden_object_id": self.hidden_object_id,
            "palette_id": self.palette_id,
            "texture_id": self.texture_id,
            "seed": self.seed,
            "renderer_version": self.renderer_version,
            "width": self.width,
            "height": self.height,
            "repeat_width_px": self.repeat_width_px,
            "maximum_disparity_px": self.maximum_disparity_px,
            "convention": self.convention,
            "safe_area": self.safe_area,
            "variant_number": self.variant_number,
        }


@dataclass(frozen=True)
class AutostereogramConfig:
    root: Path
    schema_version: int
    renderer_version: str
    default_convention: str
    supported_sections: tuple[str, ...]
    candidate_root: Path
    width: int
    height: int
    repeat_width_px: int
    maximum_disparity_px: int
    safe_area: float
    depth_maps: Mapping[str, Mapping[str, object]]
    topics: Mapping[str, Mapping[str, object]]
    section_fallbacks: Mapping[str, str]
    palettes: Mapping[str, Mapping[str, object]]
    section_palettes: Mapping[str, tuple[str, ...]]
    textures: Mapping[str, Mapping[str, object]]
    section_textures: Mapping[str, tuple[str, ...]]
