"""Deterministic seed derivation for Dadbot autostereograms."""
from __future__ import annotations

import hashlib

from .models import ArticlePacket

_NAMESPACE = "dadbot-autostereogram"


def derive_article_seed(packet: ArticlePacket, renderer_version: str, *, variant_number: int = 0) -> int:
    if variant_number < 0:
        raise ValueError("variant_number must be zero or greater")
    identity = "\0".join(
        (
            _NAMESPACE,
            packet.section,
            packet.slug,
            packet.publication_date,
            packet.source_sha256,
            renderer_version,
            str(variant_number),
        )
    )
    return int.from_bytes(hashlib.sha256(identity.encode("utf-8")).digest()[:8], "big")


def derive_subseed(seed: int, purpose: str) -> int:
    digest = hashlib.sha256(f"{seed}\0{purpose}".encode("utf-8")).digest()
    return int.from_bytes(digest[:8], "big")
