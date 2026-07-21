"""Deterministic topic analysis and allowlisted hidden-object selection."""
from __future__ import annotations

import re
from typing import Mapping

from .models import AnalysisResult, ArticlePacket, AutostereogramConfig, SelectionResult


def _normalise(value: str) -> str:
    return re.sub(r"\s+", " ", value.casefold().replace("-", " ")).strip()


def _contains(haystack: str, term: str) -> bool:
    normalised = _normalise(term)
    if not normalised:
        return False
    return re.search(rf"(?<!\w){re.escape(normalised)}(?!\w)", haystack) is not None


def analyse_article(packet: ArticlePacket, config: AutostereogramConfig) -> AnalysisResult:
    fields = (
        (4, _normalise(packet.title)),
        (3, _normalise(" ".join((*packet.tags, packet.category)))),
        (2, _normalise(packet.summary)),
        (1, _normalise(packet.body_excerpt)),
    )
    ranked: list[tuple[int, str, tuple[str, ...], tuple[str, ...]]] = []
    for topic_id, entry in config.topics.items():
        aliases = tuple(str(value) for value in entry.get("aliases", ()))
        matched: list[str] = []
        score = 0
        for weight, text in fields:
            field_matches = [alias for alias in aliases if _contains(text, alias)]
            if field_matches:
                score += weight * min(len(field_matches), 3)
                matched.extend(field_matches)
        constraints = tuple(str(value) for value in entry.get("safety_constraints", ()))
        ranked.append((score, topic_id, tuple(dict.fromkeys(matched)), constraints))
    ranked.sort(key=lambda item: (-item[0], item[1]))
    score, topic, matched, topic_constraints = ranked[0]
    if score <= 0:
        return AnalysisResult(
            primary_topic="general",
            matched_terms=(),
            confidence=0.0,
            method="fallback",
            safety_constraints=packet.safety_constraints,
        )
    confidence = min(0.99, 0.55 + score * 0.04)
    return AnalysisResult(
        primary_topic=topic,
        matched_terms=matched,
        confidence=round(confidence, 3),
        method="deterministic",
        safety_constraints=tuple(dict.fromkeys((*packet.safety_constraints, *topic_constraints))),
    )


def _weighted_choice(choices: list[Mapping[str, object]], seed: int) -> str:
    total = sum(int(choice["weight"]) for choice in choices)
    point = seed % total
    for choice in choices:
        point -= int(choice["weight"])
        if point < 0:
            return str(choice["id"])
    raise AssertionError("weighted choice did not resolve")


def select_hidden_object(
    packet: ArticlePacket,
    analysis: AnalysisResult,
    config: AutostereogramConfig,
    *,
    seed: int,
    override: str | None = None,
) -> SelectionResult:
    if packet.section not in config.supported_sections:
        raise ValueError(f"unsupported section: {packet.section}")
    reason = "deterministic topic mapping"
    if override is not None:
        if override not in config.depth_maps:
            raise ValueError(f"unknown hidden object override: {override}")
        identifier = override
        reason = "explicit approved Design override"
    elif analysis.primary_topic == "general":
        identifier = config.section_fallbacks[packet.section]
        reason = "section fallback for low-confidence topic"
    else:
        topic = config.topics.get(analysis.primary_topic)
        if topic is None:
            identifier = config.section_fallbacks[packet.section]
            reason = "section fallback for unknown topic"
        else:
            choices = [
                choice for choice in topic["objects"]  # type: ignore[index]
                if packet.section in config.depth_maps[str(choice["id"])]["safe_sections"]
            ]
            identifier = _weighted_choice(choices, seed) if choices else config.section_fallbacks[packet.section]
            if not choices:
                reason = "section fallback because mapped objects were unsafe"
    entry = config.depth_maps[identifier]
    if packet.section not in entry["safe_sections"]:
        raise ValueError(f"hidden object {identifier} is not approved for {packet.section}")
    return SelectionResult(
        hidden_object_id=identifier,
        depth_map_id=identifier,
        selection_reason=reason,
        confidence=analysis.confidence,
        alt_label=str(entry["alt_label"]),
    )
