#!/usr/bin/env python3
"""Generate safe Dadbot article images.

Examples:
  python3 scripts/generate-article-image.py --brief-only content/news/story.md
  python3 scripts/generate-article-image.py --dry-run --all --section posts
  python3 scripts/generate-article-image.py --output-dir 06-Design/preview/assets content/posts/story.md
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from article_image_system import (
    ROOT,
    ImageSystemError,
    collect_articles,
    generate_article,
    load_config,
    read_article,
)


def _inside(path: Path, root: Path) -> bool:
    try:
        path.resolve().relative_to(root.resolve())
        return True
    except (OSError, ValueError):
        return False


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Create one 1600x900 article-derived Dadbot SVG per eligible article")
    parser.add_argument("articles", nargs="*", type=Path, help="article paths under content/")
    parser.add_argument("--all", action="store_true", help="process all regular articles in eligible sections")
    parser.add_argument("--section", choices=("news", "posts", "conspiracy-corner"), help="limit selection to one section")
    parser.add_argument("--output-dir", type=Path, help="approved output root inside this repository")
    parser.add_argument("--force", action="store_true", help="atomically replace existing destinations")
    parser.add_argument("--dry-run", action="store_true", help="validate and report without invoking a renderer or writing")
    parser.add_argument("--brief-only", action="store_true", help="print article brief and assembled prompt without rendering")
    return parser


def main(argv: list[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)
    if args.all and args.articles:
        parser.error("--all cannot be combined with explicit article paths")
    if args.dry_run and args.brief_only:
        parser.error("choose either --dry-run or --brief-only")
    if not args.all and not args.articles and not args.section:
        parser.error("pass article paths, --all, or --section")

    output_dir = args.output_dir
    if output_dir is not None:
        output_dir = output_dir if output_dir.is_absolute() else ROOT / output_dir
        if not _inside(output_dir, ROOT):
            parser.error("--output-dir must remain inside the repository")

    config = load_config()
    if args.all or (args.section and not args.articles):
        articles = collect_articles(root=ROOT, section=args.section, config=config)
    else:
        articles = [item if item.is_absolute() else ROOT / item for item in args.articles]

    failures = 0
    for path in articles:
        try:
            if args.section:
                selected = read_article(path, root=ROOT, config=config)
                if selected.section != args.section:
                    raise ImageSystemError(
                        f"article is in {selected.section}, not requested section {args.section}"
                    )
            result = generate_article(
                path, root=ROOT, output_dir=output_dir, force=args.force,
                dry_run=args.dry_run, brief_only=args.brief_only, config=config,
            )
            if args.brief_only:
                print(json.dumps(result, indent=2, ensure_ascii=False))
            else:
                destination = Path(str(result["destination"]))
                try:
                    shown = destination.relative_to(ROOT)
                except ValueError:
                    shown = destination
                print(f"{result['status']}: {path} -> {shown}")
                if result.get("reason"):
                    print(f"  {result['reason']}")
        except (ImageSystemError, OSError) as exc:
            failures += 1
            print(f"failed: {path}: {exc}", file=sys.stderr)
    if not articles:
        print("no eligible articles found", file=sys.stderr)
        return 1
    if failures:
        print(f"completed with {failures} failure(s); other items were left intact", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
