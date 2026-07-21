"""Safe source normalisation for public articles and approved workflow stages."""
from __future__ import annotations

import hashlib
import os
import re
import stat
from pathlib import Path

from article_image_system import EligibilityError, parse_frontmatter

from .models import ArticlePacket, AutostereogramConfig


class SourceEligibilityError(ValueError):
    """The source is outside the approved image-generation workflow."""


_SLUG_PATTERN = re.compile(r"[a-z0-9]+(?:-[a-z0-9]+)*")


def _read_source_beneath_root(path: Path, root: Path) -> tuple[bytes, Path]:
    lexical_root = Path(os.path.abspath(root))
    lexical_path = Path(os.path.abspath(path))
    try:
        relative = lexical_path.relative_to(lexical_root)
    except ValueError as exc:
        raise SourceEligibilityError("source must remain inside the repository") from exc
    if not relative.parts or any(part in {"", ".", ".."} for part in relative.parts):
        raise SourceEligibilityError("source path contains an unsafe component")

    directory_flags = os.O_RDONLY | getattr(os, "O_DIRECTORY", 0) | getattr(os, "O_NOFOLLOW", 0)
    try:
        descriptor = os.open(lexical_root, directory_flags)
    except OSError as exc:
        raise SourceEligibilityError("repository root is missing or unsafe") from exc
    try:
        for component in relative.parts[:-1]:
            child_descriptor = os.open(component, directory_flags, dir_fd=descriptor)
            os.close(descriptor)
            descriptor = child_descriptor
        file_flags = os.O_RDONLY | getattr(os, "O_NOFOLLOW", 0)
        file_descriptor = os.open(relative.parts[-1], file_flags, dir_fd=descriptor)
        try:
            metadata = os.fstat(file_descriptor)
            if not stat.S_ISREG(metadata.st_mode):
                raise SourceEligibilityError("source must be a regular file")
            with os.fdopen(file_descriptor, "rb", closefd=False) as handle:
                source_bytes = handle.read()
        finally:
            os.close(file_descriptor)
    except OSError as exc:
        raise SourceEligibilityError("source path may not contain symlinks or unsafe components") from exc
    finally:
        os.close(descriptor)
    return source_bytes, relative


def _text(value: object, *, field: str, required: bool = False) -> str:
    if value is None and not required:
        return ""
    if not isinstance(value, str) or (required and not value.strip()):
        raise SourceEligibilityError(f"{field} must be a non-empty scalar")
    return value.strip()


def _string_list(value: object) -> tuple[str, ...]:
    if value in (None, ""):
        return ()
    if isinstance(value, str):
        return (value.strip(),) if value.strip() else ()
    if not isinstance(value, list) or any(not isinstance(item, str) for item in value):
        raise SourceEligibilityError("tags/categories must contain strings")
    return tuple(item.strip() for item in value if item.strip())


def _clean_excerpt(body: str, limit: int = 5000) -> str:
    body = re.split(r"(?im)^##\s+(?:sources|references|sources and caveats)\s*$", body, maxsplit=1)[0]
    body = re.sub(r"https?://\S+", " ", body)
    body = re.sub(r"!\[[^]]*]\([^)]+\)", " ", body)
    body = re.sub(r"\[([^]]+)]\([^)]+\)", r"\1", body)
    body = re.sub(r"<[^>]+>|[`*_#>|]", " ", body)
    return re.sub(r"\s+", " ", body).strip()[:limit]


def _section_from_workflow(frontmatter: dict[str, object]) -> str:
    raw = _text(frontmatter.get("section") or frontmatter.get("desk"), field="section/desk", required=True).casefold()
    aliases = {
        "blog": "posts",
        "post": "posts",
        "posts": "posts",
        "news": "news",
        "conspiracy": "conspiracy-corner",
        "conspiracy-corner": "conspiracy-corner",
        "book": "books",
        "books": "books",
        "book-review": "books",
        "review": "books",
    }
    try:
        return aliases[raw]
    except KeyError as exc:
        raise SourceEligibilityError(f"unsupported workflow desk: {raw}") from exc


def build_article_packet(path: Path, *, root: Path, config: AutostereogramConfig) -> ArticlePacket:
    candidate = Path(os.path.abspath(path if path.is_absolute() else root / path))
    if candidate.suffix.casefold() != ".md":
        raise SourceEligibilityError("source must be a Markdown file")
    if candidate.name.startswith("_"):
        raise SourceEligibilityError("source must be a regular article file")

    source_bytes, source_path = _read_source_beneath_root(candidate, root)
    source_root = source_path.parts[0] if source_path.parts else ""
    public = len(source_path.parts) >= 2 and source_root == "content"
    workflow = len(source_path.parts) >= 2 and source_root in {"05-Reviews", "06-Design"}
    if not public and not workflow:
        raise SourceEligibilityError("source must remain in content/, 05-Reviews/ or 06-Design/")

    try:
        text = source_bytes.decode("utf-8")
        frontmatter, body = parse_frontmatter(text)
    except (OSError, UnicodeError, EligibilityError) as exc:
        raise SourceEligibilityError(f"cannot parse source article: {exc}") from exc
    if not body.strip():
        raise SourceEligibilityError("source article body is empty")

    if public:
        relative = Path(*source_path.parts[1:])
        if len(relative.parts) < 2:
            raise SourceEligibilityError("public source must be inside a content section")
        section = relative.parts[0]
        workflow_stage = "published"
        draft = frontmatter.get("draft", False)
        declared_publishable = frontmatter.get("publishable", True)
        if type(draft) is not bool or type(declared_publishable) is not bool:
            raise SourceEligibilityError("public draft and publishable flags must be booleans")
        if draft or not declared_publishable:
            raise SourceEligibilityError(
                "public source must be publishable; use an approved Proofread/Design workflow artifact for drafts"
            )
        publishable = True
    else:
        section = _section_from_workflow(frontmatter)
        workflow_stage = _text(frontmatter.get("workflow_stage"), field="workflow_stage", required=True).casefold()
        expected_stage = "proofread" if source_root == "05-Reviews" else "design"
        if workflow_stage != expected_stage:
            raise SourceEligibilityError(
                f"{source_root} source must declare workflow_stage: {expected_stage}"
            )
        if frontmatter.get("draft") is not True or frontmatter.get("publishable") is not False:
            raise SourceEligibilityError("workflow source must declare draft: true and publishable: false")
        publishable = False
    if section not in config.supported_sections:
        raise SourceEligibilityError(f"unsupported section: {section}")

    title = _text(frontmatter.get("title"), field="title", required=True)
    summary = _text(frontmatter.get("description", frontmatter.get("summary")), field="description")
    tags = _string_list(frontmatter.get("tags"))
    categories = _string_list(frontmatter.get("categories"))
    category = _text(frontmatter.get("category"), field="category") or (categories[0] if categories else "")
    stem = candidate.stem
    fallback_slug = re.sub(r"^\d{4}-\d{2}-\d{2}-", "", stem)
    slug = _text(frontmatter.get("slug"), field="slug") or fallback_slug
    if len(slug) > 100 or _SLUG_PATTERN.fullmatch(slug) is None:
        raise SourceEligibilityError(
            "slug must contain only lowercase letters, numbers and single hyphens"
        )
    date = _text(frontmatter.get("date"), field="date")
    if not date:
        matched = re.match(r"^(\d{4}-\d{2}-\d{2})-", stem)
        date = matched.group(1) if matched else "undated"
    constraints: tuple[str, ...] = ()
    if section == "conspiracy-corner":
        constraints = ("Preserve proposal, internal approval, civilian authorisation and execution as separate states.",)
    elif section == "news":
        constraints = ("Do not turn preliminary findings, allegations or possible outcomes into settled facts.",)

    return ArticlePacket(
        article_id=f"{section}:{slug}",
        source_path=source_path,
        source_sha256=hashlib.sha256(source_bytes).hexdigest(),
        title=title,
        summary=summary,
        section=section,
        slug=slug,
        publication_date=date,
        category=category,
        tags=tags,
        body_excerpt=_clean_excerpt(body),
        workflow_stage=workflow_stage,
        publishable=publishable,
        safety_constraints=constraints,
    )
