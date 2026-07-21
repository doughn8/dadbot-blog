"""Private and sanitised generation-manifest construction."""
from __future__ import annotations

from pathlib import Path
from typing import Mapping

from .models import AnalysisResult, ArticlePacket, RenderSpec, SelectionResult


def build_manifest(
    packet: ArticlePacket,
    analysis: AnalysisResult,
    selection: SelectionResult,
    spec: RenderSpec,
    qa: Mapping[str, object] | None,
    outputs: Mapping[str, Mapping[str, object]],
) -> dict[str, object]:
    """Build an auditable manifest without article excerpts, prompts or secrets."""
    return {
        "schema": "DADBOT_AUTOSTEREOGRAM_MANIFEST_V1",
        "approval_state": "private-design-candidate",
        "source": {
            "article_id": packet.article_id,
            "source_path": Path(packet.source_path).as_posix(),
            "source_sha256": packet.source_sha256,
            "workflow_stage": packet.workflow_stage,
            "publishable": packet.publishable,
        },
        "analysis": {
            "primary_topic": analysis.primary_topic,
            "matched_terms": list(analysis.matched_terms),
            "confidence": analysis.confidence,
            "method": analysis.method,
            "safety_constraints": list(analysis.safety_constraints),
        },
        "selection": {
            "hidden_object_id": selection.hidden_object_id,
            "depth_map_id": selection.depth_map_id,
            "alt_label": selection.alt_label,
            "reason": selection.selection_reason,
            "confidence": selection.confidence,
        },
        "render_spec": spec.to_dict(),
        "outputs": dict(outputs),
        "qa": {
            "passed": bool(qa and qa.get("passed")),
            "decoded_pixel_sha256": qa.get("decoded_pixel_sha256") if qa else None,
            "perceptual_dhash": qa.get("perceptual_dhash") if qa else None,
            "near_duplicate_warning": qa.get("near_duplicate_warning") if qa else None,
            "nearest_perceptual_hamming_distance": (
                qa.get("nearest_perceptual_hamming_distance") if qa else None
            ),
            "checks": qa.get("checks") if qa else None,
        },
    }
