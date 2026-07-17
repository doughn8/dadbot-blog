#!/usr/bin/env python3
"""Safe, deterministic article-to-image pipeline for Dadbot.

This module intentionally depends only on the Python standard library.  The
public functions are usable by the CLI and by tests without invoking Hugo or
changing article frontmatter.
"""
from __future__ import annotations

import hashlib
import html
import json
import os
import re
import shlex
import subprocess
import tempfile
import xml.etree.ElementTree as ET
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Iterable, Mapping, Sequence

ROOT = Path(__file__).resolve().parents[1]
CONFIG_PATH = ROOT / "config" / "article-image-system.json"
CONTENT_ROOT = ROOT / "content"


class ImageSystemError(Exception):
    """A safe, user-facing generation failure."""


class EligibilityError(ImageSystemError):
    """The input is not an eligible regular article."""


class OutputError(ImageSystemError):
    """The requested or rendered output violates its contract."""


class ExistingOutput(OutputError):
    """The destination exists and force was not requested."""


@dataclass(frozen=True)
class Article:
    path: Path
    section: str
    title: str
    description: str
    body: str
    frontmatter: dict[str, object]


@dataclass(frozen=True)
class ImageBrief:
    central_subject: str
    tension: str
    metaphor: str
    focal_subject: str
    factual_constraints: tuple[str, ...]
    alt_text: str

    def to_dict(self) -> dict[str, object]:
        data = asdict(self)
        data["factual_constraints"] = list(self.factual_constraints)
        return data


# Each result is a single, drawable concept. Rules are deliberately bounded:
# unknown topics do not produce an invented illustration.
_METAPHORS: tuple[dict[str, object], ...] = (
    {
        "name": "phone-endless-loop",
        "terms": ("infinite scroll", "scrolling", "social media", "facebook", "instagram", "autoplay", "phone feed"),
        "subject": "a phone feed with no natural stopping point",
        "focal": "one ASCII phone whose feed bends into a continuous loop",
        "constraints": ("Do not copy a platform interface or logo.", "Show a design tension, not a medical diagnosis."),
        "alt": "ASCII-art phone with its scrolling feed bending into an endless loop",
    },
    {
        "name": "football-review-balance",
        "terms": ("football", "soccer", "var ", "video review", "referee", "world cup"),
        "subject": "a football decision under video review",
        "focal": "one ASCII football divided between a clear check and an unresolved question",
        "constraints": ("Do not depict a real player, referee, team badge or match result.", "Keep the decision visibly unresolved."),
        "alt": "ASCII-art football balanced between a review check and an unresolved question",
    },
    {
        "name": "document-evidence-gap",
        "terms": ("declassified", "document", "memo", "archive", "proposal", "government secrecy", "historical conspiracy"),
        "subject": "a documented proposal separated from proof of execution",
        "focal": "one ASCII document with an evidence trail ending before an execution mark",
        "constraints": ("Represent a proposal and evidence gap; do not imply the plan was executed.", "Do not invent stamps, quotations, dates or classifications."),
        "alt": "ASCII-art declassified document with an evidence trail stopping before an execution mark",
    },
    {
        "name": "security-shield-gap",
        "terms": ("cybersecurity", "security", "privacy", "protect", "protection", "safety", "scam", "malware"),
        "subject": "protection tested by a visible gap",
        "focal": "one ASCII shield with a narrow, clearly visible gap under pressure",
        "constraints": ("Do not depict a named victim, attacker or product logo.", "Do not imply protection is absolute."),
        "alt": "ASCII-art protective shield being tested at one visible gap",
    },
    {
        "name": "choice-balance",
        "terms": ("versus", " vs ", "trade-off", "tradeoff", "debate", "fairer", "balance", "choice", "should we"),
        "subject": "two competing choices held in tension",
        "focal": "one ASCII balance with unequal question and check symbols",
        "constraints": ("Do not portray either side as a person or brand.", "Keep the outcome open rather than claiming certainty."),
        "alt": "ASCII-art balance holding a check against a question mark",
    },
    {
        "name": "signal-evidence-search",
        "terms": ("evidence", "investigation", "mystery", "unexplained", "search", "findings", "research"),
        "subject": "a signal being separated from surrounding noise",
        "focal": "one ASCII magnifying lens isolating a single signal from sparse noise",
        "constraints": ("Do not invent a culprit, finding or hidden object.", "Show investigation rather than certainty."),
        "alt": "ASCII-art magnifying lens isolating one signal from sparse noise",
    },
    {
        "name": "route-obstacle",
        "terms": ("how to", "guide", "steps", "process", "workflow", "plan", "building", "saving", "improve"),
        "subject": "a practical route around one obstacle",
        "focal": "one ASCII path making a clear turn around a single block",
        "constraints": ("Do not invent products, people, locations or outcomes.", "Show a route, not a guarantee of success."),
        "alt": "ASCII-art path turning around a single obstacle toward an open route",
    },
)


def load_config(path: Path = CONFIG_PATH) -> dict[str, object]:
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise ImageSystemError(f"cannot load configuration {path}: {exc}") from exc
    try:
        if data["output"]["width"] != 1600 or data["output"]["height"] != 900:
            raise ValueError("master dimensions must be 1600x900")
        if set(data["eligibility"]["sections"]) != {"news", "posts", "conspiracy-corner"}:
            raise ValueError("eligibility allowlist is invalid")
        for section in data["eligibility"]["sections"]:
            data["sections"][section]
    except (KeyError, TypeError, ValueError) as exc:
        raise ImageSystemError(f"invalid article image configuration: {exc}") from exc
    return data


def _scalar(value: str) -> object:
    value = value.strip()
    if not value:
        return ""
    if value[0:1] in ('"', "'"):
        if len(value) < 2 or value[-1] != value[0]:
            raise EligibilityError("malformed quoted frontmatter value")
        if value[0] == '"':
            try:
                return json.loads(value)
            except json.JSONDecodeError as exc:
                raise EligibilityError("malformed quoted frontmatter value") from exc
        return value[1:-1].replace("''", "'")
    if value.startswith("["):
        try:
            parsed = json.loads(value.replace("'", '"'))
        except json.JSONDecodeError as exc:
            raise EligibilityError("malformed frontmatter list") from exc
        if not isinstance(parsed, list):
            raise EligibilityError("malformed frontmatter list")
        return parsed
    if value.lower() in ("true", "false"):
        return value.lower() == "true"
    if value.lower() in ("null", "~"):
        return None
    return value


def parse_frontmatter(text: str) -> tuple[dict[str, object], str]:
    """Parse the conservative YAML subset Dadbot needs and reject bad framing."""
    if not text.startswith("---\n"):
        raise EligibilityError("missing YAML frontmatter opening delimiter")
    lines = text.splitlines()
    try:
        end = lines.index("---", 1)
    except ValueError as exc:
        raise EligibilityError("missing YAML frontmatter closing delimiter") from exc
    if end == 1:
        raise EligibilityError("empty frontmatter")

    data: dict[str, object] = {}
    active_list: str | None = None
    for raw in lines[1:end]:
        if not raw.strip() or raw.lstrip().startswith("#"):
            continue
        if raw[:1].isspace():
            stripped = raw.strip()
            if stripped.startswith("-") and active_list:
                item = stripped[1:].strip()
                if not item:
                    raise EligibilityError("empty frontmatter list item")
                current = data.get(active_list)
                if not isinstance(current, list):
                    raise EligibilityError("malformed frontmatter list")
                current.append(_scalar(item))
            # Nested mappings are not needed by the image system; framing is
            # still validated, but their contents are intentionally ignored.
            continue
        if ":" not in raw:
            raise EligibilityError(f"malformed frontmatter line: {raw!r}")
        key, value = raw.split(":", 1)
        key = key.strip()
        if not re.fullmatch(r"[A-Za-z_][A-Za-z0-9_-]*", key) or key in data:
            raise EligibilityError(f"invalid or duplicate frontmatter key: {key!r}")
        if value.strip():
            data[key] = _scalar(value)
            active_list = None
        else:
            data[key] = []
            active_list = key
    body = "\n".join(lines[end + 1 :]).strip()
    return data, body


def _contained(path: Path, root: Path) -> bool:
    try:
        path.resolve().relative_to(root.resolve())
        return True
    except (OSError, ValueError):
        return False


def read_article(path: Path, *, root: Path = ROOT, config: Mapping[str, object] | None = None) -> Article:
    config = config or load_config()
    content_root = root.resolve() / "content"
    candidate = path if path.is_absolute() else root / path
    if candidate.suffix.lower() != config["eligibility"]["extension"]:  # type: ignore[index]
        raise EligibilityError("only .md article files are supported")
    if candidate.name.startswith("_") or candidate.name in config["eligibility"]["exclude_names"]:  # type: ignore[index]
        raise EligibilityError("section/list pages are not regular articles")
    if not _contained(candidate, content_root):
        raise EligibilityError("article must remain inside the repository content directory")
    if not candidate.is_file() or candidate.is_symlink():
        raise EligibilityError("article must be an existing regular non-symlink file")
    relative = candidate.resolve().relative_to(content_root.resolve())
    if len(relative.parts) < 2:
        raise EligibilityError("article must be inside an eligible section")
    section = relative.parts[0]
    allowed = tuple(config["eligibility"]["sections"])  # type: ignore[index]
    if section not in allowed:
        raise EligibilityError(f"unsupported section: {section}")
    try:
        text = candidate.read_text(encoding="utf-8")
    except (OSError, UnicodeError) as exc:
        raise EligibilityError(f"cannot read article: {exc}") from exc
    frontmatter, body = parse_frontmatter(text)
    title = frontmatter.get("title")
    description = frontmatter.get("description", frontmatter.get("summary", ""))
    if not isinstance(title, str) or not title.strip():
        raise EligibilityError("frontmatter must contain a non-empty scalar title")
    if description is not None and not isinstance(description, str):
        raise EligibilityError("description/summary must be a scalar")
    if not body:
        raise EligibilityError("article body is empty")
    return Article(candidate.resolve(), section, _clean_text(title), _clean_text(str(description or "")), body, frontmatter)


def _clean_text(value: str, limit: int = 240) -> str:
    value = re.sub(r"<[^>]+>|[`*_#>]", " ", value)
    value = re.sub(r"\[[^]]+\]\([^)]+\)", " ", value)
    return re.sub(r"\s+", " ", value).strip()[:limit]


def derive_brief(article: Article) -> ImageBrief:
    body_excerpt = _clean_text(article.body, 5000)
    haystack = f" {article.title} {article.description} {body_excerpt} ".lower()
    match: Mapping[str, object] | None = None
    for rule in _METAPHORS:
        if any(str(term) in haystack for term in rule["terms"]):
            match = rule
            break
    if match is None:
        raise ImageSystemError("no honest bounded visual metaphor matched this article; use the branded fallback")
    tension_source = article.description or article.title
    tension = _clean_text(tension_source, 180)
    if not tension:
        tension = "The article examines an unresolved question without assuming an outcome."
    constraints = tuple(str(item) for item in match["constraints"])
    return ImageBrief(
        central_subject=str(match["subject"]),
        tension=tension,
        metaphor=str(match["name"]),
        focal_subject=str(match["focal"]),
        factual_constraints=constraints,
        alt_text=f"Dadbot terminal illustration: {match['alt']}.",
    )


def assemble_prompt(article: Article, brief: ImageBrief, config: Mapping[str, object]) -> str:
    identity = config["visual_identity"]
    variant = config["sections"][article.section]
    negative = config["negative"]
    lines = [
        "Create exactly one finished 1600x900 image.",
        "SHARED DADBOT VISUAL IDENTITY:",
        *(f"- {key.replace('_', ' ')}: {value}" for key, value in identity.items()),
        f"SECTION VARIANT ({article.section}):",
        *(f"- {key}: {value}" for key, value in variant.items()),
        "ARTICLE-DERIVED BRIEF:",
        f"- central subject: {brief.central_subject}",
        f"- tension/question: {brief.tension}",
        f"- bounded metaphor: {brief.metaphor}",
        f"- focal subject: {brief.focal_subject}",
        *(f"- factual constraint: {item}" for item in brief.factual_constraints),
        "NEGATIVE CONSTRAINTS:",
        *(f"- {item}" for item in negative),
        "Return the finished image only.",
    ]
    return "\n".join(lines)


def _glyph_art(metaphor: str) -> list[str]:
    art = {
        "phone-endless-loop": [
            "          +------------------+          ", "          |    . . . . .     |          ",
            "          |   +-->+----+      |          ", "          |   |   |    v      |          ",
            "          |   ^   +--+ |      |          ", "          |   |      | |      |          ",
            "          |   +------<-+      |          ", "          |        O         |          ",
            "          +------------------+          ",
        ],
        "football-review-balance": [
            "             .-========-.             ", "          .-'     /\\     '-.          ",
            "        .'   ?  /__\\  ✓   '.        ", "       /    /\\  \\  /  /\\    \\       ",
            "      |    /__\\  ()  /__\\    |      ", "      |    \\  /  /\\  \\  /    |      ",
            "       \\  ✓ \\/  /__\\  \\/ ?  /       ", "        '.      ||      .'        ",
            "          '-.________.-'          ",
        ],
        "document-evidence-gap": [
            "          +------------------+          ", "          | ////  ////  //// |          ",
            "          |                  |          ", "          | ////  ////       |          ",
            "          |                  |          ", "          | ////  ////  //// |----.     ",
            "          +------------------+    :     ", "                                  :     ",
            "                               [   ]    ",
        ],
        "security-shield-gap": [
            "                /\\                ", "             /######\\             ",
            "           /##########\\           ", "          /######  ######\\          ",
            "          |#####    #####|          ", "          |####      ####|          ",
            "           \\##      ##/           ", "             \\    /             ",
            "               \\/               ",
        ],
        "choice-balance": [
            "                  |                  ", "             -----+-----             ",
            "          _______/   \\_______          ", "        .-'                   `-.        ",
            "      .---.                   .---.      ", "     /  ?  \\                 /  +  \\     ",
            "     `-----'                 `-----'     ", "                  |                  ",
            "                __|__                ",
        ],
        "signal-evidence-search": [
            "          . .    .     . .          ", "        .      .-----.      .        ",
            "             /   *   \\             ", "       .     |   |   |     .       ",
            "              \\  |  /              ", "        .      `---+'      .        ",
            "                    \\               ", "                     \\              ",
            "          . .        \\    .          ",
        ],
        "route-obstacle": [
            "         .----------------.         ", "         |                |         ",
            "    -----+     +----+     |         ", "              |####|     |         ",
            "              |####|     |         ", "              +----+     |         ",
            "                         |         ", "                         +---->     ",
            "                                    ",
        ],
    }
    try:
        return art[metaphor]
    except KeyError as exc:
        raise ImageSystemError(f"renderer has no bounded composition for {metaphor}") from exc


def render_svg(article: Article, brief: ImageBrief, config: Mapping[str, object]) -> bytes:
    """Render one deterministic, article-derived 1600x900 SVG master."""
    variant = config["sections"][article.section]
    seed = hashlib.sha256((article.title + "\0" + brief.metaphor + "\0dadbot-v1").encode("utf-8")).digest()
    lines = _glyph_art(brief.metaphor)
    font_size = 43
    line_height = 62
    y0 = 450 - ((len(lines) - 1) * line_height // 2)
    text = []
    for index, line in enumerate(lines):
        color = variant["primary"]
        if index in (2, 6):
            color = variant["accent"]
        if article.section == "conspiracy-corner" and index == 5:
            color = variant["signal"]
        text.append(
            f'<text x="800" y="{y0 + index * line_height}" text-anchor="middle" '
            f'fill="{color}" font-family="ui-monospace, Menlo, Consolas, monospace" '
            f'font-size="{font_size}" font-weight="700">{html.escape(line)}</text>'
        )
    texture = []
    for index, byte in enumerate(seed[:18]):
        x = 210 + ((byte * 47 + index * 83) % 1180)
        y = 120 + ((seed[-index - 1] * 31 + index * 61) % 660)
        texture.append(f'<circle cx="{x}" cy="{y}" r="2" fill="{variant["support"]}" opacity="0.12"/>')
    scanlines = "".join(f'<path d="M0 {y}H1600"/>' for y in range(12, 900, 18))
    accessible = html.escape(brief.alt_text)
    svg = f'''<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="900" viewBox="0 0 1600 900" role="img" aria-labelledby="title desc">
<title id="title">{accessible}</title>
<desc id="desc">A single bounded terminal metaphor derived from the article, kept inside the central safe area.</desc>
<defs><filter id="glow" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="3" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>
<rect width="1600" height="900" fill="{variant['background']}"/>
<g stroke="{variant['support']}" stroke-width="1" opacity="0.035">{scanlines}</g>
<g>{''.join(texture)}</g>
<g filter="url(#glow)">{''.join(text)}</g>
</svg>
'''
    return svg.encode("utf-8")


def validate_svg(data: bytes) -> None:
    if not data.strip():
        raise OutputError("renderer returned an empty result")
    try:
        root = ET.fromstring(data)
    except ET.ParseError as exc:
        raise OutputError(f"renderer did not return valid SVG: {exc}") from exc
    if root.tag.rsplit("}", 1)[-1] != "svg":
        raise OutputError("renderer result is not SVG")
    if root.get("width") != "1600" or root.get("height") != "900" or root.get("viewBox") != "0 0 1600 900":
        raise OutputError("SVG must be exactly 1600x900 with a matching viewBox")


def destination_for(article: Article, *, root: Path = ROOT, output_dir: Path | None = None,
                    config: Mapping[str, object] | None = None) -> tuple[Path, Path]:
    config = config or load_config(root / "config" / "article-image-system.json")
    approved_roots = tuple((root / Path(str(item))).resolve() for item in config["output"]["approved_roots"])  # type: ignore[index]
    if output_dir is not None:
        approved_root = (output_dir if output_dir.is_absolute() else root / output_dir).resolve()
        if approved_root not in approved_roots:
            raise OutputError("--output-dir must match a configured approved output root")
        return approved_root / f"{article.path.stem}.svg", approved_root
    default_root = (root / Path(str(config["output"]["default_root"]))).resolve()  # type: ignore[index]
    if default_root not in approved_roots:
        raise OutputError("default output directory is not a configured approved output root")
    cover = article.frontmatter.get("cover")
    if isinstance(cover, str) and cover.strip():
        cover_path = Path(cover.lstrip("/"))
        destination = root / "static" / cover_path
    else:
        destination = default_root / article.section / f"{article.path.stem}.svg"
    return destination, default_root


def validate_destination(destination: Path, approved_root: Path) -> None:
    if destination.suffix.lower() != ".svg":
        raise OutputError("destination must have an .svg extension")
    # Resolve the parent independently so a not-yet-created leaf is handled.
    if not _contained(destination.parent, approved_root) or not _contained(destination, approved_root):
        raise OutputError("destination escapes the approved output root")
    if destination.exists() and destination.is_symlink():
        raise OutputError("destination may not be a symlink")


def atomic_write(destination: Path, data: bytes, *, approved_root: Path, force: bool = False) -> Path:
    validate_destination(destination, approved_root)
    validate_svg(data)
    destination.parent.mkdir(parents=True, exist_ok=True)
    # Revalidate after mkdir to catch a concurrently introduced symlink.
    validate_destination(destination, approved_root)
    fd, temporary_name = tempfile.mkstemp(prefix=f".{destination.name}.", suffix=".tmp", dir=destination.parent)
    temporary = Path(temporary_name)
    try:
        with os.fdopen(fd, "wb") as handle:
            handle.write(data)
            handle.flush()
            os.fsync(handle.fileno())
        if force:
            os.replace(temporary, destination)
        else:
            try:
                os.link(temporary, destination)
            except FileExistsError as exc:
                raise ExistingOutput(f"destination exists (use --force to replace): {destination}") from exc
            temporary.unlink()
    finally:
        temporary.unlink(missing_ok=True)
    return destination


def render_external(prompt: str, destination: Path, config: Mapping[str, object], env: Mapping[str, str] | None = None) -> bytes:
    """Run the configured command adapter without a shell or stored secrets."""
    environment = dict(os.environ if env is None else env)
    adapter = config["external_adapter"]
    command_text = environment.get(adapter["command_env"], "").strip()
    if not command_text:
        raise ImageSystemError(f"external adapter requested but {adapter['command_env']} is unset")
    with tempfile.TemporaryDirectory(prefix="dadbot-image-adapter-") as directory:
        work = Path(directory)
        prompt_file = work / "prompt.txt"
        output_file = work / "output.svg"
        prompt_file.write_text(prompt, encoding="utf-8")
        values = {
            "prompt_file": str(prompt_file), "output": str(output_file), "width": "1600", "height": "900",
            "provider": environment.get(adapter["provider_env"], ""), "model": environment.get(adapter["model_env"], ""),
        }
        try:
            command = [part.format(**values) for part in shlex.split(command_text)]
        except (ValueError, KeyError) as exc:
            raise ImageSystemError(f"invalid external command template: {exc}") from exc
        if not command:
            raise ImageSystemError("external command is empty")
        try:
            completed = subprocess.run(command, check=False, capture_output=True, text=True, timeout=300, env=environment)
        except (OSError, subprocess.TimeoutExpired) as exc:
            raise ImageSystemError(f"external renderer failed: {exc}") from exc
        if completed.returncode:
            detail = (completed.stderr or completed.stdout).strip()[-500:]
            raise ImageSystemError(f"external renderer exited {completed.returncode}: {detail}")
        try:
            data = output_file.read_bytes()
        except OSError as exc:
            raise ImageSystemError("external renderer did not create its contracted output") from exc
        validate_svg(data)
        return data


def generate_article(article_path: Path, *, root: Path = ROOT, output_dir: Path | None = None,
                     force: bool = False, dry_run: bool = False, brief_only: bool = False,
                     config: Mapping[str, object] | None = None,
                     env: Mapping[str, str] | None = None) -> dict[str, object]:
    config = config or load_config(root / "config" / "article-image-system.json")
    article = read_article(article_path, root=root, config=config)
    brief = derive_brief(article)
    prompt = assemble_prompt(article, brief, config)
    destination, approved_root = destination_for(article, root=root, output_dir=output_dir, config=config)
    validate_destination(destination, approved_root)
    result: dict[str, object] = {
        "article": str(article.path), "section": article.section, "destination": str(destination),
        "brief": brief.to_dict(), "prompt": prompt,
    }
    if brief_only:
        result["status"] = "brief"
        return result
    if destination.exists() and not force:
        result["status"] = "skipped"
        result["reason"] = "destination exists; use --force to replace"
        return result
    if dry_run:
        result["status"] = "dry-run"
        return result
    adapter = config["external_adapter"]
    use_external = str((env or os.environ).get(adapter["enabled_env"], "")).lower() in ("1", "true", "yes")
    data = render_external(prompt, destination, config, env) if use_external else render_svg(article, brief, config)
    atomic_write(destination, data, approved_root=approved_root, force=force)
    result["status"] = "generated"
    result["bytes"] = len(data)
    result["alt_text"] = brief.alt_text
    return result


def collect_articles(*, root: Path = ROOT, section: str | None = None,
                     config: Mapping[str, object] | None = None) -> list[Path]:
    config = config or load_config(root / "config" / "article-image-system.json")
    allowed = tuple(config["eligibility"]["sections"])
    if section is not None and section not in allowed:
        raise EligibilityError(f"unsupported section: {section}")
    sections: Iterable[str] = (section,) if section else allowed
    paths: list[Path] = []
    for name in sections:
        directory = root / "content" / name
        if directory.is_dir():
            paths.extend(path for path in directory.rglob("*.md") if not path.name.startswith("_") and path.is_file())
    return sorted(paths)
