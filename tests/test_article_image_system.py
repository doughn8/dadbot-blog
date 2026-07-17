from __future__ import annotations

import importlib.util
import json
import os
import subprocess
import sys
import tempfile
import unittest
import xml.etree.ElementTree as ET
from pathlib import Path

REPO = Path(__file__).resolve().parents[1]
SCRIPTS = REPO / "scripts"
sys.path.insert(0, str(SCRIPTS))

from article_image_system import (  # noqa: E402
    EligibilityError,
    ImageSystemError,
    OutputError,
    atomic_write,
    assemble_prompt,
    derive_brief,
    generate_article,
    load_config,
    parse_frontmatter,
    read_article,
    render_svg,
    validate_svg,
)


class ArticleImageSystemTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)
        (self.root / "config").mkdir()
        (self.root / "config" / "article-image-system.json").write_text(
            (REPO / "config" / "article-image-system.json").read_text(encoding="utf-8"), encoding="utf-8"
        )
        self.config = load_config(self.root / "config" / "article-image-system.json")

    def tearDown(self) -> None:
        self.temp.cleanup()

    def article(self, section: str = "posts", name: str = "story.md", *,
                title: str = "Is VAR helping football?", description: str = "Video review balances fair decisions and doubt.",
                body: str = "Football video review can correct a referee while leaving an unresolved question.",
                frontmatter: str | None = None) -> Path:
        path = self.root / "content" / section / name
        path.parent.mkdir(parents=True, exist_ok=True)
        if frontmatter is None:
            frontmatter = f'---\ntitle: "{title}"\ndescription: "{description}"\n---\n\n{body}\n'
        path.write_text(frontmatter, encoding="utf-8")
        return path

    def test_only_three_sections_are_eligible(self) -> None:
        for section in ("news", "posts", "conspiracy-corner"):
            with self.subTest(section=section):
                self.assertEqual(read_article(self.article(section), root=self.root, config=self.config).section, section)
        for section in ("books", "hot-takes", "drafts"):
            with self.subTest(section=section):
                with self.assertRaises(EligibilityError):
                    read_article(self.article(section), root=self.root, config=self.config)

    def test_indexes_outside_paths_and_extensions_are_rejected(self) -> None:
        index = self.article("posts", "_index.md")
        with self.assertRaises(EligibilityError):
            read_article(index, root=self.root, config=self.config)
        outside = self.root / "elsewhere.md"
        outside.write_text('---\ntitle: "Evidence"\n---\nBody evidence', encoding="utf-8")
        with self.assertRaises(EligibilityError):
            read_article(outside, root=self.root, config=self.config)
        unsupported = self.article("posts", "story.txt")
        with self.assertRaises(EligibilityError):
            read_article(unsupported, root=self.root, config=self.config)

    def test_symlink_input_is_rejected(self) -> None:
        target = self.article()
        link = target.with_name("linked.md")
        try:
            link.symlink_to(target)
        except OSError:
            self.skipTest("symlinks unavailable")
        with self.assertRaises(EligibilityError):
            read_article(link, root=self.root, config=self.config)

    def test_malformed_frontmatter_is_rejected_before_derivation(self) -> None:
        malformed = self.article(frontmatter='---\ntitle: "Unclosed\ndescription: nope\n---\nEvidence body')
        with self.assertRaises(EligibilityError):
            read_article(malformed, root=self.root, config=self.config)
        missing_close = self.article("posts", "missing.md", frontmatter='---\ntitle: Fine\nbody')
        with self.assertRaises(EligibilityError):
            read_article(missing_close, root=self.root, config=self.config)
        with self.assertRaises(EligibilityError):
            parse_frontmatter("title: no delimiters\nbody")

    def test_unknown_topic_fails_instead_of_inventing_metaphor(self) -> None:
        article = read_article(self.article(title="A quiet afternoon", description="Notes from today", body="Tea was warm."), root=self.root, config=self.config)
        with self.assertRaisesRegex(ImageSystemError, "no honest bounded"):
            derive_brief(article)

    def test_known_articles_select_bounded_article_derived_metaphors(self) -> None:
        cases = (
            ("Facebook infinite scrolling", "An autoplay phone feed", "phone-endless-loop"),
            ("Is VAR helping football?", "A referee reviews a decision", "football-review-balance"),
            ("Operation Northwoods", "A declassified proposal document", "document-evidence-gap"),
        )
        for index, (title, description, expected) in enumerate(cases):
            with self.subTest(expected=expected):
                parsed = read_article(self.article("news", f"case-{index}.md", title=title, description=description, body=description), root=self.root, config=self.config)
                brief = derive_brief(parsed)
                self.assertEqual(brief.metaphor, expected)
                self.assertGreater(len(brief.alt_text), 35)
                self.assertNotIn(title, brief.alt_text)

    def test_prompt_has_shared_variant_brief_negative_and_finished_only(self) -> None:
        article = read_article(self.article("conspiracy-corner", description="A declassified document records a proposal."), root=self.root, config=self.config)
        # Body mentions football first by default; use a document-specific fixture.
        article = read_article(self.article("conspiracy-corner", "document.md", title="Archived proposal", description="A declassified document separates proposal from execution.", body="The memo is evidence of a proposal, not execution."), root=self.root, config=self.config)
        brief = derive_brief(article)
        prompt = assemble_prompt(article, brief, self.config)
        self.assertIn("SHARED DADBOT VISUAL IDENTITY", prompt)
        self.assertIn("SECTION VARIANT (conspiracy-corner)", prompt)
        self.assertIn("#e45aad", prompt)
        self.assertIn("bounded metaphor: document-evidence-gap", prompt)
        self.assertIn("no logos or watermark", prompt)
        self.assertTrue(prompt.endswith("Return the finished image only."))

    def test_svg_is_deterministic_single_1600_by_900_master(self) -> None:
        article = read_article(self.article(), root=self.root, config=self.config)
        brief = derive_brief(article)
        first = render_svg(article, brief, self.config)
        second = render_svg(article, brief, self.config)
        self.assertEqual(first, second)
        validate_svg(first)
        svg = ET.fromstring(first)
        self.assertEqual((svg.get("width"), svg.get("height"), svg.get("viewBox")), ("1600", "900", "0 0 1600 900"))
        self.assertEqual(sum(1 for element in svg.iter() if element.tag.rsplit("}", 1)[-1] == "svg"), 1)
        # The rendered glyph layer must not contain the article headline.
        rendered_text = " ".join((element.text or "") for element in svg.iter() if element.tag.rsplit("}", 1)[-1] == "text")
        self.assertNotIn(article.title, rendered_text)

    def test_existing_destination_is_skipped_without_force(self) -> None:
        article = self.article()
        output = self.root / "06-Design" / "article-image-system-preview" / "assets"
        output.mkdir(parents=True)
        destination = output / "story.svg"
        original = b'<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="900" viewBox="0 0 1600 900"><rect width="1" height="1"/></svg>'
        destination.write_bytes(original)
        result = generate_article(article, root=self.root, output_dir=output, config=self.config)
        self.assertEqual(result["status"], "skipped")
        self.assertEqual(destination.read_bytes(), original)
        result = generate_article(article, root=self.root, output_dir=output, force=True, config=self.config)
        self.assertEqual(result["status"], "generated")
        self.assertNotEqual(destination.read_bytes(), original)

    def test_dry_run_and_brief_only_do_not_write(self) -> None:
        article = self.article()
        output = self.root / "06-Design" / "article-image-system-preview" / "assets"
        dry = generate_article(article, root=self.root, output_dir=output, dry_run=True, config=self.config)
        self.assertEqual(dry["status"], "dry-run")
        brief = generate_article(article, root=self.root, output_dir=output, brief_only=True, config=self.config)
        self.assertEqual(brief["status"], "brief")
        self.assertFalse(output.exists())

    def test_output_dir_must_match_a_configured_approved_root(self) -> None:
        article = self.article()
        unapproved = self.root / "arbitrary-preview"
        with self.assertRaisesRegex(OutputError, "approved output root"):
            generate_article(article, root=self.root, output_dir=unapproved, dry_run=True, config=self.config)
        self.assertFalse(unapproved.exists())

    def test_output_containment_and_symlink_destination_are_enforced(self) -> None:
        valid = render_svg(read_article(self.article(), root=self.root, config=self.config), derive_brief(read_article(self.article(), root=self.root, config=self.config)), self.config)
        approved = self.root / "approved"
        approved.mkdir()
        with self.assertRaises(OutputError):
            atomic_write(self.root / "escaped.svg", valid, approved_root=approved)
        outside = self.root / "outside"
        outside.mkdir()
        link = approved / "linked"
        try:
            link.symlink_to(outside, target_is_directory=True)
        except OSError:
            self.skipTest("symlinks unavailable")
        with self.assertRaises(OutputError):
            atomic_write(link / "bad.svg", valid, approved_root=approved)

    def test_invalid_renderer_output_never_replaces_destination(self) -> None:
        approved = self.root / "approved"
        approved.mkdir()
        destination = approved / "safe.svg"
        original = b"published asset"
        destination.write_bytes(original)
        with self.assertRaises(OutputError):
            atomic_write(destination, b"not svg", approved_root=approved, force=True)
        self.assertEqual(destination.read_bytes(), original)

    def test_external_adapter_has_no_secret_and_uses_environment_contract(self) -> None:
        serialized = json.dumps(self.config)
        self.assertNotIn("api_key\":", serialized.lower())
        adapter = self.config["external_adapter"]
        self.assertEqual(adapter["command_env"], "DADBOT_ARTICLE_IMAGE_COMMAND")
        self.assertIn("secret_env_names", adapter)

    def test_cli_batch_failure_isolated_from_success(self) -> None:
        # Exercise the real CLI using this temporary repository by loading its
        # main module and temporarily overriding its module-level ROOT.
        spec = importlib.util.spec_from_file_location("generate_article_image_cli", SCRIPTS / "generate-article-image.py")
        self.assertIsNotNone(spec and spec.loader)
        module = importlib.util.module_from_spec(spec)
        assert spec and spec.loader
        spec.loader.exec_module(module)
        module.ROOT = self.root
        good = self.article("posts", "good.md")
        bad = self.article("books", "bad.md")
        output = self.root / "06-Design" / "article-image-system-preview" / "assets"
        stdout, stderr = __import__("io").StringIO(), __import__("io").StringIO()
        from contextlib import redirect_stderr, redirect_stdout
        with redirect_stdout(stdout), redirect_stderr(stderr):
            code = module.main(["--output-dir", str(output), str(good), str(bad)])
        self.assertEqual(code, 1)
        self.assertTrue((output / "good.svg").is_file())
        self.assertIn("generated:", stdout.getvalue())
        self.assertIn("failed:", stderr.getvalue())
        validate_svg((output / "good.svg").read_bytes())

    def test_real_exclusion_samples_are_rejected(self) -> None:
        config = load_config(REPO / "config" / "article-image-system.json")
        with self.assertRaises(EligibilityError):
            read_article(REPO / "content" / "books" / "project-hail-mary-book-review.md", root=REPO, config=config)
        with self.assertRaises(EligibilityError):
            read_article(REPO / "content" / "hot-takes" / "_index.md", root=REPO, config=config)


if __name__ == "__main__":
    unittest.main()
