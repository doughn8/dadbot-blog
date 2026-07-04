#!/usr/bin/env python3
"""Generate coloured Dadbot ASCII-pattern SVG covers for Hugo posts.

Usage:
  scripts/generate-ascii-cover.py content/posts/example.md
  scripts/generate-ascii-cover.py content/news/example.md
  scripts/generate-ascii-cover.py --all
  scripts/generate-ascii-cover.py --all --section news

The script reads each content file's frontmatter `title`, `categories`, `tags`, and `cover`
field, then writes a deterministic random SVG to `static/<cover path>` or
`static/images/<section>/` when no cover path is supplied.
"""
from __future__ import annotations

import argparse
import hashlib
import html
import random
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
POSTS_DIR = ROOT / "content" / "posts"
CONTENT_DIR = ROOT / "content"
STATIC_DIR = ROOT / "static"
CONTENT_SECTIONS = ("posts", "news", "conspiracy-corner")

THEMES = {
    "conspiracy": {
        "bg": "#08130f", "panel": "#0d1d16", "border": "#6ee79a",
        "colors": ["#6ee79a", "#bfffd0", "#40ffd2", "#ffd166"],
        "glyphs": list("△◇◈◆○●◌?!=/\\|-_+*#░▒▓█01"),
        "label": "SIGNAL_SCAN"
    },
    "finance": {
        "bg": "#101108", "panel": "#191a0d", "border": "#f7d774",
        "colors": ["#f7d774", "#fff1a8", "#6ee79a", "#ff9f1c"],
        "glyphs": list("$¢¥€%#0123456789↑↓+-.░▒▓█"),
        "label": "MARKET_NOISE"
    },
    "tech": {
        "bg": "#071219", "panel": "#0b1b22", "border": "#40c9ff",
        "colors": ["#40c9ff", "#6ee79a", "#d7f9ff", "#b06cff"],
        "glyphs": list("01{}[]<>/=+*_#░▒▓█|~^;:"),
        "label": "HOME_NODE"
    },
    "parenting": {
        "bg": "#130d16", "panel": "#1b1220", "border": "#ff8bd1",
        "colors": ["#ff8bd1", "#ffd1ea", "#6ee79a", "#ffd166"],
        "glyphs": list("ABCXYZ!?*#@░▒▓█<>/\\|-_+01"),
        "label": "CHAOS_MONITOR"
    },
    "news": {
        "bg": "#140f05", "panel": "#211707", "border": "#ffb347",
        "colors": ["#ffb347", "#ffd166", "#ffe7a3", "#6ee79a"],
        "glyphs": list("NEWSWIRE0123456789:/|-_+*#░▒▓█"),
        "label": "NEWSWIRE"
    },
    "default": {
        "bg": "#102019", "panel": "#0b1712", "border": "#6ee79a",
        "colors": ["#6ee79a", "#bfffd0", "#40ffd2", "#ffd166", "#ff8bd1"],
        "glyphs": list("01#*@+=-:/\\|_<>[]{}░▒▓█◆◇○●△▽"),
        "label": "DADBOT_PATTERN"
    },
}


def parse_frontmatter(path: Path) -> dict[str, object]:
    text = path.read_text(encoding="utf-8")
    if not text.startswith("---"):
        return {}
    end = text.find("\n---", 3)
    if end == -1:
        return {}
    fm = text[3:end]
    data: dict[str, object] = {}
    current: str | None = None
    for raw in fm.splitlines():
        line = raw.rstrip()
        if not line.strip():
            continue
        if not line.startswith(" ") and ":" in line:
            key, value = line.split(":", 1)
            key = key.strip()
            value = value.strip()
            current = key
            if value == "":
                data[key] = []
            else:
                data[key] = value.strip('"')
        elif current and line.strip().startswith("-"):
            value = line.strip()[1:].strip().strip('"')
            data.setdefault(current, [])
            if isinstance(data[current], list):
                data[current].append(value)
    return data


def section_for_path(post_path: Path) -> str:
    try:
        rel = post_path.resolve().relative_to(CONTENT_DIR)
    except ValueError:
        return "posts"
    return rel.parts[0] if rel.parts else "posts"


def choose_theme(data: dict[str, object], post_path: Path | None = None) -> str:
    section = section_for_path(post_path) if post_path else ""
    if section == "news":
        return "news"
    if section == "conspiracy-corner":
        return "conspiracy"
    haystack = " ".join(
        str(x) for x in [data.get("title", ""), data.get("categories", ""), data.get("tags", "")]
    ).lower()
    if any(word in haystack for word in ["conspiracy", "mystery", "pyramid", "alien"]):
        return "conspiracy"
    if any(word in haystack for word in ["bitcoin", "finance", "etf", "market", "crypto"]):
        return "finance"
    if any(word in haystack for word in ["automation", "tech", "smart", "home"]):
        return "tech"
    if any(word in haystack for word in ["toddler", "parent", "kid", "family"]):
        return "parenting"
    return "default"


def slug_from_cover(cover: str, post_path: Path) -> str:
    if cover:
        return Path(cover).name
    return f"terminal-{post_path.stem}.svg"


def chunks(seq: list[str], n: int) -> list[list[str]]:
    return [seq[i:i + n] for i in range(0, len(seq), n)]


def make_line(rng: random.Random, glyphs: list[str], width: int) -> str:
    line = []
    while len(line) < width:
        mode = rng.random()
        if mode < 0.10:
            token = rng.choice(["DAD", "BOT", "RUN", "LOG", "SYS", "OK", "//", "::", "++", "--"])
            line.extend(token)
        elif mode < 0.23:
            g = rng.choice(glyphs)
            line.extend(g * rng.randint(2, 6))
        elif mode < 0.30:
            line.append(" ")
        else:
            line.append(rng.choice(glyphs))
    return "".join(line[:width])


def svg_for_post(post_path: Path, data: dict[str, object]) -> str:
    title = str(data.get("title") or post_path.stem.replace("-", " ").title())
    theme_name = choose_theme(data, post_path)
    theme = THEMES[theme_name]
    seed = hashlib.sha256(f"{post_path.stem}|{title}|dadbot".encode()).hexdigest()
    rng = random.Random(int(seed[:16], 16))

    width, height = 900, 360
    cols, rows = 58, 12
    x0, y0 = 42, 72
    dx, dy = 14, 22

    pattern_lines = [make_line(rng, theme["glyphs"], cols) for _ in range(rows)]
    colors = theme["colors"]
    title_short = re.sub(r"\s+", " ", title).strip()[:54]
    checksum = seed[:8].upper()

    text_rows = []
    for i, line in enumerate(pattern_lines):
        color = colors[i % len(colors)] if i % 3 else rng.choice(colors)
        opacity = "0.95" if 3 <= i <= 8 else "0.72"
        text_rows.append(
            f'  <text x="{x0}" y="{y0 + i * dy}" fill="{color}" opacity="{opacity}" '
            f'font-family="Fira Code, Consolas, Menlo, monospace" font-size="18">{html.escape(line)}</text>'
        )

    scanlines = []
    for y in range(32, height - 20, 18):
        scanlines.append(f'    <line x1="20" y1="{y}" x2="880" y2="{y}"/>')

    return "\n".join([
        f'<svg xmlns="http://www.w3.org/2000/svg" width="{width}" height="{height}" viewBox="0 0 {width} {height}" role="img" aria-labelledby="title desc">',
        f'  <title id="title">Dadbot coloured ASCII pattern for {html.escape(title_short)}</title>',
        f'  <desc id="desc">Random-looking coloured terminal ASCII pattern generated for this Dadbot blog post.</desc>',
        f'  <rect width="900" height="360" fill="{theme["bg"]}"/>',
        f'  <rect x="18" y="18" width="864" height="324" fill="{theme["panel"]}" stroke="{theme["border"]}" stroke-width="3"/>',
        '  <g opacity="0.16" stroke="#ffffff" stroke-width="1">',
        *scanlines,
        '  </g>',
        f'  <text x="42" y="48" fill="{theme["border"]}" font-family="Fira Code, Consolas, Menlo, monospace" font-size="18">DADBOT/{theme["label"]} --seed {checksum}</text>',
        *text_rows,
        f'  <text x="42" y="330" fill="{theme["border"]}" font-family="Fira Code, Consolas, Menlo, monospace" font-size="16">{html.escape(title_short)}  ::  generated ascii cover</text>',
        f'  <rect x="18" y="18" width="864" height="324" fill="none" stroke="{theme["border"]}" stroke-width="3"/>',
        '</svg>',
        '',
    ])


def generate(post_path: Path) -> Path:
    data = parse_frontmatter(post_path)
    cover = str(data.get("cover") or "")
    section = section_for_path(post_path)
    filename = slug_from_cover(cover, post_path)
    if cover.startswith("/"):
        output = STATIC_DIR / cover.lstrip("/")
    else:
        output = STATIC_DIR / "images" / section / filename
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(svg_for_post(post_path, data), encoding="utf-8")
    return output


def collect_posts(section: str | None = None) -> list[Path]:
    sections = [section] if section else list(CONTENT_SECTIONS)
    posts: list[Path] = []
    for name in sections:
        section_dir = CONTENT_DIR / name
        posts.extend(sorted(p for p in section_dir.glob("*.md") if not p.name.startswith("_")))
    return posts


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("posts", nargs="*", type=Path)
    parser.add_argument("--all", action="store_true", help="Generate covers for content posts, news, and conspiracy-corner sections")
    parser.add_argument("--section", choices=CONTENT_SECTIONS, help="Limit --all to one content section")
    args = parser.parse_args()

    if args.section and not args.all:
        parser.error("--section requires --all")
    if args.all:
        posts = collect_posts(args.section)
    else:
        posts = args.posts
    if not posts:
        parser.error("pass one or more markdown files, or --all")

    for post in posts:
        post = post if post.is_absolute() else ROOT / post
        output = generate(post)
        print(f"generated {output.relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
