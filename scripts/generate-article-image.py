#!/usr/bin/env python3
"""Generate safe Dadbot article images.

Examples:
  python3 scripts/generate-article-image.py --brief-only content/news/story.md
  python3 scripts/generate-article-image.py --dry-run --all --section posts
  python3 scripts/generate-article-image.py --output-dir 06-Design/preview/assets content/posts/story.md
  python3 scripts/generate-article-image.py --autostereogram --dry-run content/posts/story.md
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
    parser = argparse.ArgumentParser(description="Create safe 1600x900 article-derived Dadbot image candidates")
    parser.add_argument("articles", nargs="*", type=Path, help="article paths under content/")
    parser.add_argument("--all", action="store_true", help="process all regular articles in eligible sections")
    parser.add_argument("--section", choices=("news", "posts", "conspiracy-corner", "books"), help="limit selection to one section")
    parser.add_argument("--output-dir", type=Path, help="approved output root inside this repository")
    parser.add_argument("--force", action="store_true", help="atomically replace existing destinations")
    parser.add_argument("--dry-run", action="store_true", help="validate and report without invoking a renderer or writing")
    parser.add_argument("--brief-only", action="store_true", help="print article brief and assembled prompt without rendering")
    parser.add_argument("--autostereogram", action="store_true", help="use the private autostereogram candidate pipeline")
    parser.add_argument("--variant-number", type=int, default=0, help="zero-based deterministic candidate variant")
    parser.add_argument("--output-format", choices=("png", "webp", "both"), default="png")
    parser.add_argument("--manifest-only", action="store_true", help="resolve and print the private render specification without rendering")
    parser.add_argument("--validate-only", type=Path, metavar="IMAGE", help="re-run QA for one private candidate without writing")
    return parser


def main(argv: list[str] | None = None) -> int:
    parser = build_parser()
    raw_args = list(sys.argv[1:] if argv is None else argv)
    args = parser.parse_args(raw_args)
    if args.validate_only is not None:
        args.autostereogram = True
    if args.all and args.articles:
        parser.error("--all cannot be combined with explicit article paths")
    if args.validate_only is not None and (args.all or args.articles or args.section):
        parser.error("--validate-only cannot be combined with article selection")
    if args.dry_run and args.brief_only:
        parser.error("choose either --dry-run or --brief-only")
    if args.dry_run and args.manifest_only:
        parser.error("choose either --dry-run or --manifest-only")
    if not args.all and not args.articles and not args.section and args.validate_only is None:
        parser.error("pass article paths, --all, or --section")
    if args.variant_number < 0:
        parser.error("--variant-number must be zero or greater")
    stereogram_only = (
        args.variant_number != 0
        or args.output_format != "png"
        or args.manifest_only
    )
    if stereogram_only and not args.autostereogram:
        parser.error("stereogram options require --autostereogram")
    if args.autostereogram and args.brief_only:
        parser.error("--brief-only belongs to the legacy SVG renderer; use --manifest-only")
    if args.validate_only is not None and (
        args.dry_run
        or args.manifest_only
        or args.force
        or args.output_dir is not None
        or args.variant_number != 0
        or any(
            value == "--output-format" or value.startswith("--output-format=")
            for value in raw_args
        )
    ):
        parser.error("--validate-only cannot be combined with generation or output options")
    if not args.autostereogram and args.section == "books":
        parser.error("the legacy SVG renderer does not support the books section")

    output_dir = args.output_dir
    if output_dir is not None:
        output_dir = output_dir if output_dir.is_absolute() else ROOT / output_dir
        if not _inside(output_dir, ROOT):
            parser.error("--output-dir must remain inside the repository")

    config = load_config()
    stereogram_config = None
    if args.autostereogram:
        # Lazy import keeps the existing SVG workflow usable without optional
        # NumPy/Pillow dependencies.
        from article_images.config import load_autostereogram_config

        stereogram_config = load_autostereogram_config(ROOT)

    if args.validate_only is not None:
        from article_images.pipeline import validate_candidate_file

        assert stereogram_config is not None
        image_path = args.validate_only if args.validate_only.is_absolute() else ROOT / args.validate_only
        try:
            report = validate_candidate_file(image_path, config=stereogram_config)
        except (OSError, ValueError) as exc:
            print(f"failed: {image_path}: {exc}", file=sys.stderr)
            return 1
        print(json.dumps(report, indent=2, ensure_ascii=False))
        return 0 if report.get("passed") else 1

    if args.autostereogram and (args.all or (args.section and not args.articles)):
        assert stereogram_config is not None
        sections = (args.section,) if args.section else stereogram_config.supported_sections
        articles = sorted(
            path
            for section in sections
            for path in (ROOT / "content" / section).rglob("*.md")
            if path.name != "_index.md" and not path.is_symlink()
        )
    elif args.all or (args.section and not args.articles):
        articles = collect_articles(root=ROOT, section=args.section, config=config)
    else:
        articles = [item if item.is_absolute() else ROOT / item for item in args.articles]

    failures = 0
    for path in articles:
        try:
            if args.autostereogram:
                from article_images.pipeline import generate_candidate
                from article_images.source import build_article_packet

                assert stereogram_config is not None
                selected = build_article_packet(path, root=ROOT, config=stereogram_config)
                if args.section and selected.section != args.section:
                    raise ImageSystemError(
                        f"article is in {selected.section}, not requested section {args.section}"
                    )
                candidate_output = output_dir / selected.slug if output_dir is not None else None
                result = generate_candidate(
                    path,
                    root=ROOT,
                    config=stereogram_config,
                    output_dir=candidate_output,
                    variant_number=args.variant_number,
                    output_format=args.output_format,
                    force=args.force,
                    dry_run=args.dry_run,
                    manifest_only=args.manifest_only,
                )
                print(json.dumps(result, indent=2, ensure_ascii=False))
                continue
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
        except (ImageSystemError, OSError, ValueError) as exc:
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
