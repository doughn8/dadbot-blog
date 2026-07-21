from __future__ import annotations

import json
import hashlib
import io
import os
import subprocess
import sys
import tempfile
import threading
import unittest
from concurrent.futures import ThreadPoolExecutor
from dataclasses import replace
from pathlib import Path
from unittest import mock

from PIL import Image

REPO = Path(__file__).resolve().parents[1]
SCRIPTS = REPO / "scripts"
sys.path.insert(0, str(SCRIPTS))

from article_images.analysis import analyse_article, select_hidden_object
from article_images.config import load_autostereogram_config
from article_images.models import ArticlePacket, RenderSpec
from article_images.seeds import derive_article_seed
from article_images.source import SourceEligibilityError, build_article_packet
from article_images.depth_maps import generate_depth_map
from article_images.planner import build_render_spec
from article_images.stereogram import render_autostereogram, separation_map
from article_images.qa import validate_autostereogram
from article_images.pipeline import (
    CandidateOutputError,
    CandidateQAError,
    ExistingCandidate,
    _atomic_bundle,
    _existing_hashes,
    _existing_hashes_at,
    generate_candidate,
    validate_candidate_file,
)


class AutostereogramCoreTests(unittest.TestCase):
    def packet(self, **overrides: object) -> ArticlePacket:
        values: dict[str, object] = {
            "article_id": "posts:is-var-helping-football",
            "source_path": Path("content/posts/2026-07-12-is-var-helping-football.md"),
            "source_sha256": "ab" * 32,
            "title": "Is VAR helping football?",
            "summary": "Video review can correct mistakes while leaving supporters uncertain.",
            "section": "posts",
            "slug": "is-var-helping-football",
            "publication_date": "2026-07-12",
            "category": "Sport",
            "tags": ("football", "var", "refereeing"),
            "body_excerpt": "The referee reviews a football decision using video.",
            "workflow_stage": "published",
            "publishable": True,
            "safety_constraints": (),
        }
        values.update(overrides)
        return ArticlePacket(**values)  # type: ignore[arg-type]

    def test_config_analysis_selection_and_seed_form_one_deterministic_slice(self) -> None:
        config = load_autostereogram_config(REPO)
        self.assertEqual(config.renderer_version, "2.0.0")
        self.assertEqual(config.default_convention, "parallel")
        self.assertNotIn("hot-takes", config.supported_sections)

        packet = self.packet()
        analysis = analyse_article(packet, config)
        self.assertEqual(analysis.primary_topic, "football")
        self.assertEqual(analysis.method, "deterministic")
        self.assertGreaterEqual(analysis.confidence, 0.70)

        seed = derive_article_seed(packet, config.renderer_version, variant_number=0)
        self.assertEqual(seed, derive_article_seed(packet, config.renderer_version, variant_number=0))
        self.assertNotEqual(seed, derive_article_seed(packet, config.renderer_version, variant_number=1))
        selection = select_hidden_object(packet, analysis, config, seed=seed)
        self.assertEqual(selection.hidden_object_id, "football-v1")
        self.assertEqual(selection.depth_map_id, "football-v1")

    def test_unknown_topic_uses_configured_section_fallback_without_invention(self) -> None:
        config = load_autostereogram_config(REPO)
        packet = self.packet(
            article_id="posts:quiet-afternoon",
            slug="quiet-afternoon",
            title="A quiet afternoon",
            summary="Tea was warm.",
            category="Notes",
            tags=(),
            body_excerpt="Nothing much happened.",
        )
        analysis = analyse_article(packet, config)
        self.assertEqual(analysis.primary_topic, "general")
        self.assertEqual(analysis.method, "fallback")
        selection = select_hidden_object(packet, analysis, config, seed=123)
        self.assertEqual(selection.hidden_object_id, "geometric-portal-v1")
        self.assertIn("fallback", selection.selection_reason)

    def test_invalid_config_reference_fails_before_generation(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / "config").mkdir()
            system = json.loads((REPO / "config" / "article-image-system.json").read_text(encoding="utf-8"))
            objects = json.loads((REPO / "config" / "autostereogram-objects.json").read_text(encoding="utf-8"))
            palettes = json.loads((REPO / "config" / "autostereogram-palettes.json").read_text(encoding="utf-8"))
            objects["objects"][0]["depth_map"]["generator"] = "missing-generator"
            for name, data in (
                ("article-image-system.json", system),
                ("autostereogram-objects.json", objects),
                ("autostereogram-palettes.json", palettes),
            ):
                (root / "config" / name).write_text(json.dumps(data), encoding="utf-8")
            with self.assertRaisesRegex(ValueError, "unsupported depth-map generator"):
                load_autostereogram_config(root)

    def test_config_rejects_injected_supported_sections(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / "config").mkdir()
            system = json.loads((REPO / "config" / "article-image-system.json").read_text(encoding="utf-8"))
            objects = json.loads((REPO / "config" / "autostereogram-objects.json").read_text(encoding="utf-8"))
            palettes = json.loads((REPO / "config" / "autostereogram-palettes.json").read_text(encoding="utf-8"))
            system["autostereogram"]["supported_sections"].append("injected-section")
            for name, data in (
                ("article-image-system.json", system),
                ("autostereogram-objects.json", objects),
                ("autostereogram-palettes.json", palettes),
            ):
                (root / "config" / name).write_text(json.dumps(data), encoding="utf-8")
            with self.assertRaisesRegex(ValueError, "supported autostereogram sections"):
                load_autostereogram_config(root)

            system["autostereogram"]["supported_sections"].remove("injected-section")
            system["autostereogram"]["candidate_root"] = "06-Design/../../outside"
            (root / "config" / "article-image-system.json").write_text(
                json.dumps(system),
                encoding="utf-8",
            )
            with self.assertRaisesRegex(ValueError, "candidate_root"):
                load_autostereogram_config(root)

            system["autostereogram"]["candidate_root"] = (
                "06-Design/article-image-system-preview/autostereograms"
            )
            system["autostereogram"]["width"] = True
            (root / "config" / "article-image-system.json").write_text(
                json.dumps(system),
                encoding="utf-8",
            )
            with self.assertRaisesRegex(ValueError, "width must be an integer"):
                load_autostereogram_config(root)

            system["autostereogram"]["width"] = 1600
            system["autostereogram"]["unexpected"] = "injected"
            (root / "config" / "article-image-system.json").write_text(
                json.dumps(system),
                encoding="utf-8",
            )
            with self.assertRaisesRegex(ValueError, "approved schema"):
                load_autostereogram_config(root)

            del system["autostereogram"]["unexpected"]
            objects["objects"][0]["unexpected"] = "injected"
            (root / "config" / "article-image-system.json").write_text(
                json.dumps(system),
                encoding="utf-8",
            )
            (root / "config" / "autostereogram-objects.json").write_text(
                json.dumps(objects),
                encoding="utf-8",
            )
            with self.assertRaisesRegex(ValueError, "approved schema"):
                load_autostereogram_config(root)

    def test_real_pilot_sources_build_normalised_packets(self) -> None:
        config = load_autostereogram_config(REPO)
        cases = (
            ("content/news/2026-07-10-meta-eu-addictive-design.md", "news", "meta-eu-addictive-design"),
            ("content/posts/2026-07-12-is-var-helping-football.md", "posts", "is-var-helping-football"),
            ("content/conspiracy-corner/2026-07-12-operation-northwoods.md", "conspiracy-corner", "operation-northwoods"),
        )
        for relative, section, slug in cases:
            with self.subTest(relative=relative):
                packet = build_article_packet(REPO / relative, root=REPO, config=config)
                self.assertEqual(packet.section, section)
                self.assertEqual(packet.slug, slug)
                self.assertEqual(packet.workflow_stage, "published")
                self.assertTrue(packet.publishable)
                self.assertEqual(len(packet.source_sha256), 64)
                self.assertLessEqual(len(packet.body_excerpt), 5000)

    def test_approved_workflow_source_is_allowed_but_earlier_stage_is_rejected(self) -> None:
        config = load_autostereogram_config(REPO)
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            approved = root / "05-Reviews" / "story" / "proofread.md"
            approved.parent.mkdir(parents=True)
            approved.write_text(
                "---\n"
                'title: "A document investigation"\n'
                'description: "A declassified proposal is examined carefully."\n'
                'date: "2026-07-21"\n'
                'desk: "conspiracy-corner"\n'
                'slug: "document-investigation"\n'
                'workflow_stage: "proofread"\n'
                "draft: true\n"
                "publishable: false\n"
                "tags:\n  - declassified\n  - evidence\n"
                "---\n\nThe document records a proposal, not an executed operation.\n",
                encoding="utf-8",
            )
            packet = build_article_packet(approved, root=root, config=config)
            self.assertEqual(packet.section, "conspiracy-corner")
            self.assertEqual(packet.workflow_stage, "proofread")
            self.assertFalse(packet.publishable)

            wrong_stage = root / "06-Design" / "story" / "proofread.md"
            wrong_stage.parent.mkdir(parents=True)
            wrong_stage.write_bytes(approved.read_bytes())
            with self.assertRaisesRegex(SourceEligibilityError, "workflow_stage: design"):
                build_article_packet(wrong_stage, root=root, config=config)

            early = root / "04-Drafts" / "story" / "draft.md"
            early.parent.mkdir(parents=True)
            early.write_text(approved.read_text(encoding="utf-8").replace('workflow_stage: "proofread"', 'workflow_stage: "draft"'), encoding="utf-8")
            with self.assertRaises(SourceEligibilityError):
                build_article_packet(early, root=root, config=config)

            public_draft = root / "content" / "posts" / "draft.md"
            public_draft.parent.mkdir(parents=True)
            public_draft.write_text(
                "---\n"
                'title: "Unapproved public draft"\n'
                "draft: true\n"
                "---\n\nThis article has not passed the publication gate.\n",
                encoding="utf-8",
            )
            with self.assertRaisesRegex(SourceEligibilityError, "public source must be publishable"):
                build_article_packet(public_draft, root=root, config=config)

            quoted_boolean = public_draft.with_name("quoted-boolean.md")
            quoted_boolean.write_text(
                "---\n"
                'title: "Quoted boolean"\n'
                'draft: "true"\n'
                "---\n\nThis must not bypass the publication gate.\n",
                encoding="utf-8",
            )
            with self.assertRaisesRegex(SourceEligibilityError, "flags must be booleans"):
                build_article_packet(quoted_boolean, root=root, config=config)

            malicious_slug = public_draft.with_name("malicious.md")
            malicious_slug.write_text(
                "---\n"
                'title: "Malicious slug"\n'
                'slug: "../another-article"\n'
                "draft: false\n"
                "---\n\nThis must not control a candidate destination.\n",
                encoding="utf-8",
            )
            with self.assertRaisesRegex(SourceEligibilityError, "slug"):
                build_article_packet(malicious_slug, root=root, config=config)

    def test_source_path_escape_and_symlink_are_rejected(self) -> None:
        config = load_autostereogram_config(REPO)
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            outside = root / "outside.md"
            outside.write_text('---\ntitle: "Outside"\n---\nBody', encoding="utf-8")
            with self.assertRaises(SourceEligibilityError):
                build_article_packet(outside, root=root / "repo", config=config)
            content = root / "content" / "posts"
            content.mkdir(parents=True)
            link = content / "linked.md"
            try:
                link.symlink_to(outside)
            except OSError:
                self.skipTest("symlinks unavailable")
            with self.assertRaises(SourceEligibilityError):
                build_article_packet(link, root=root, config=config)

            repository = root / "repository"
            outside_content = root / "outside-content"
            outside_article = outside_content / "posts" / "article.md"
            outside_article.parent.mkdir(parents=True)
            outside_article.write_text(
                '---\ntitle: "Ancestor link"\ndraft: false\n---\nBody',
                encoding="utf-8",
            )
            repository.mkdir()
            (repository / "content").symlink_to(outside_content, target_is_directory=True)
            with self.assertRaisesRegex(SourceEligibilityError, "symlinks"):
                build_article_packet(
                    repository / "content" / "posts" / "article.md",
                    root=repository,
                    config=config,
                )

    def test_depth_map_render_spec_and_renderer_produce_a_real_deterministic_master(self) -> None:
        config = load_autostereogram_config(REPO)
        packet = self.packet()
        analysis = analyse_article(packet, config)
        seed = derive_article_seed(packet, config.renderer_version, variant_number=0)
        selection = select_hidden_object(packet, analysis, config, seed=seed)
        spec = build_render_spec(packet, analysis, selection, config, seed=seed, variant_number=0)
        depth = generate_depth_map(selection.depth_map_id, config)

        self.assertEqual(depth.shape, (900, 1600))
        self.assertEqual(str(depth.dtype), "float32")
        self.assertGreater(float(depth.max()), 0.5)
        ys, xs = __import__("numpy").nonzero(depth > 0.01)
        self.assertGreaterEqual(int(xs.min()), 240)
        self.assertLessEqual(int(xs.max()), 1360)
        self.assertGreaterEqual(int(ys.min()), 135)
        self.assertLessEqual(int(ys.max()), 765)
        self.assertEqual(spec.convention, "parallel")
        self.assertEqual(spec.hidden_object_id, "football-v1")
        self.assertIn(spec.palette_id, config.section_palettes["posts"])
        self.assertIn(spec.texture_id, config.section_textures["posts"])

        first = render_autostereogram(depth, spec, config)
        second = render_autostereogram(depth, spec, config)
        self.assertEqual(first.size, (1600, 900))
        self.assertEqual(first.mode, "RGB")
        self.assertEqual(first.tobytes(), second.tobytes())
        pixel_hash = hashlib.sha256(first.tobytes()).hexdigest()
        self.assertEqual(pixel_hash, hashlib.sha256(second.tobytes()).hexdigest())
        self.assertEqual(
            pixel_hash,
            "77ef653ce5365551ea1a22945c3d625cba8d20dc60eaea0ccbdc3b48d8efd564",
        )

        for depth_map_id in config.depth_maps:
            with self.subTest(depth_map_id=depth_map_id):
                candidate_depth = generate_depth_map(depth_map_id, config)
                candidate_ys, candidate_xs = __import__("numpy").nonzero(candidate_depth > 0.01)
                self.assertGreaterEqual(int(candidate_xs.min()), 240)
                self.assertLessEqual(int(candidate_xs.max()), 1360)
                self.assertGreaterEqual(int(candidate_ys.min()), 135)
                self.assertLessEqual(int(candidate_ys.max()), 765)

    def test_spacing_sign_and_variant_are_explicit_and_auditable(self) -> None:
        config = load_autostereogram_config(REPO)
        packet = self.packet()
        analysis = analyse_article(packet, config)
        seed0 = derive_article_seed(packet, config.renderer_version, variant_number=0)
        seed1 = derive_article_seed(packet, config.renderer_version, variant_number=1)
        selection = select_hidden_object(packet, analysis, config, seed=seed0)
        spec0 = build_render_spec(packet, analysis, selection, config, seed=seed0, variant_number=0)
        spec1 = build_render_spec(packet, analysis, selection, config, seed=seed1, variant_number=1)
        depth = generate_depth_map(selection.depth_map_id, config)
        spacing = separation_map(depth, spec0)
        self.assertEqual(int(spacing[0, 0]), spec0.repeat_width_px)
        self.assertLess(int(spacing[450, 800]), spec0.repeat_width_px)
        self.assertGreaterEqual(spec0.maximum_disparity_px, 12)
        self.assertNotEqual(spec0.seed, spec1.seed)
        self.assertEqual(spec1.variant_number, 1)
        self.assertNotEqual(
            render_autostereogram(depth, spec0, config).tobytes(),
            render_autostereogram(depth, spec1, config).tobytes(),
        )

    def test_qa_recovers_depth_and_rejects_flat_wrong_or_visible_controls(self) -> None:
        import numpy as np
        from PIL import Image, ImageFilter

        config = load_autostereogram_config(REPO)
        packet = self.packet()
        analysis = analyse_article(packet, config)
        seed = derive_article_seed(packet, config.renderer_version, variant_number=0)
        selection = select_hidden_object(packet, analysis, config, seed=seed)
        spec = build_render_spec(packet, analysis, selection, config, seed=seed, variant_number=0)
        depth = generate_depth_map(selection.depth_map_id, config)
        image = render_autostereogram(depth, spec, config)
        report = validate_autostereogram(image, depth, spec)
        self.assertTrue(report["passed"], report)
        self.assertGreater(report["forward_correspondence_score"], 0.80)
        self.assertGreater(report["depth_recovery_correlation"], 0.80)
        self.assertLess(report["median_spacing_error_px"], 2.0)
        self.assertEqual(len(report["decoded_pixel_sha256"]), 64)
        self.assertEqual(len(report["perceptual_dhash"]), 16)
        self.assertLess(report["normal_view_leakage_metrics"]["structure_boundary_correlation"], 0.18)
        self.assertLess(report["normal_view_leakage_metrics"]["local_contrast_depth_correlation"], 0.15)
        similarity_report = validate_autostereogram(
            image,
            depth,
            spec,
            existing_perceptual_hashes=(report["perceptual_dhash"],),
        )
        self.assertTrue(similarity_report["passed"])
        self.assertTrue(similarity_report["near_duplicate_warning"])
        self.assertEqual(similarity_report["nearest_perceptual_hamming_distance"], 0)

        pixels = np.asarray(image, dtype=np.uint8)
        flat = np.tile(pixels[:, :spec.repeat_width_px], (1, 13, 1))[:, :spec.width]
        flat_report = validate_autostereogram(Image.fromarray(flat, mode="RGB"), depth, spec)
        self.assertTrue(flat_report["checks"]["periodicity"])
        self.assertFalse(flat_report["checks"]["depth_recovery"])
        self.assertFalse(flat_report["passed"])

        wrong_depth = generate_depth_map("document-v1", config)
        wrong_report = validate_autostereogram(image, wrong_depth, spec)
        self.assertFalse(wrong_report["checks"]["depth_recovery"])

        overlay = pixels.astype(np.float32)
        overlay += depth[:, :, None] * 80.0
        visible = Image.fromarray(np.clip(overlay, 0, 255).astype(np.uint8), mode="RGB")
        visible_report = validate_autostereogram(visible, depth, spec)
        self.assertFalse(visible_report["checks"]["normal_view_leakage"])

        dx = np.abs(np.diff(depth, axis=1, prepend=depth[:, :1]))
        dy = np.abs(np.diff(depth, axis=0, prepend=depth[:1, :]))
        boundary = np.uint8(np.hypot(dx, dy) > 0.04) * 255
        boundary = np.asarray(
            Image.fromarray(boundary, mode="L").filter(ImageFilter.MaxFilter(size=11)),
            dtype=np.float32,
        ) / 255.0
        outlined = pixels.astype(np.float32) + boundary[:, :, None] * 110.0
        outline_image = Image.fromarray(np.clip(outlined, 0, 255).astype(np.uint8), mode="RGB")
        outline_report = validate_autostereogram(outline_image, depth, spec)
        self.assertFalse(outline_report["checks"]["normal_view_leakage"])
        self.assertGreater(
            outline_report["normal_view_leakage_metrics"]["structure_boundary_correlation"],
            0.18,
        )

    def test_candidate_bundle_is_private_atomic_sanitised_and_no_overwrite(self) -> None:
        config = load_autostereogram_config(REPO)
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            source = root / "content" / "posts" / "2026-07-21-football-test.md"
            source.parent.mkdir(parents=True)
            source.write_text(
                "---\n"
                'title: "Football video review"\n'
                'date: "2026-07-21"\n'
                'description: "VAR reviews a football decision."\n'
                "draft: false\n"
                "tags:\n  - football\n  - var\n"
                "---\n\nA referee uses video review. SECRET_BODY_MARKER must not enter manifests.\n",
                encoding="utf-8",
            )
            original = source.read_bytes()
            private_root = root / "06-Design" / "article-image-system-preview" / "autostereograms"
            test_config = replace(config, root=root, candidate_root=private_root)
            output = private_root / "football-test"
            result = generate_candidate(
                source,
                root=root,
                config=test_config,
                output_dir=output,
                output_format="both",
            )

            self.assertEqual(result["status"], "qa-passed")
            image_path = Path(result["image"])
            webp_path = Path(result["images"]["webp"])
            render_path = Path(result["render_manifest"])
            qa_path = Path(result["qa_report"])
            self.assertTrue(image_path.is_file())
            self.assertTrue(webp_path.is_file())
            self.assertTrue(render_path.is_file())
            self.assertTrue(qa_path.is_file())
            self.assertTrue(image_path.resolve().is_relative_to(private_root.resolve()))
            self.assertEqual(source.read_bytes(), original)
            self.assertFalse((root / "static").exists())
            manifest_text = render_path.read_text(encoding="utf-8")
            deterministic_manifest = render_path.read_bytes()
            self.assertNotIn("SECRET_BODY_MARKER", manifest_text)
            self.assertNotIn("body_excerpt", manifest_text)
            self.assertNotIn("api_key", manifest_text.casefold())
            self.assertTrue(json.loads(qa_path.read_text(encoding="utf-8"))["passed"])
            validation = validate_candidate_file(image_path, config=test_config)
            self.assertTrue(validation["passed"], validation)
            self.assertTrue(validation["encoded_file_hash_matches_manifest"])
            self.assertTrue(validation["encoded_file_size_matches_manifest"])
            webp_validation = validate_candidate_file(webp_path, config=test_config)
            self.assertTrue(webp_validation["passed"], webp_validation)
            self.assertTrue(webp_validation["encoded_file_hash_matches_manifest"])
            self.assertTrue(webp_validation["encoded_file_size_matches_manifest"])
            self.assertEqual(
                webp_validation["decoded_pixel_sha256"],
                validation["decoded_pixel_sha256"],
            )
            self.assertTrue(validation["deterministic_render_matches_source"])

            source.write_bytes(original + b"\nSource changed after candidate generation.\n")
            with self.assertRaisesRegex(CandidateOutputError, "derivation"):
                validate_candidate_file(image_path, config=test_config)
            source.write_bytes(original)

            unsafe_validation_path = output / "candidate-v2.png"
            unsafe_validation_path.symlink_to(image_path)
            with self.assertRaisesRegex(CandidateOutputError, "missing or unsafe"):
                validate_candidate_file(unsafe_validation_path, config=test_config)
            unsafe_validation_path.unlink()

            duplicate_dir = private_root / "duplicate-corpus-entry"
            duplicate_dir.mkdir()
            duplicate_report = duplicate_dir / "candidate-v1.qa.json"
            duplicate_report.write_bytes(qa_path.read_bytes())
            duplicate_validation = validate_candidate_file(image_path, config=test_config)
            self.assertFalse(duplicate_validation["checks"]["exact_uniqueness"])
            self.assertTrue(duplicate_validation["near_duplicate_warning"])
            self.assertFalse(duplicate_validation["passed"])
            duplicate_report.unlink()
            duplicate_dir.rmdir()

            original_manifest = json.loads(render_path.read_text(encoding="utf-8"))
            with self.assertRaisesRegex(CandidateOutputError, "output formats"):
                generate_candidate(
                    source,
                    root=root,
                    config=test_config,
                    output_dir=output,
                    output_format="png",
                    force=True,
                )

            malformed_manifest = json.loads(render_path.read_text(encoding="utf-8"))
            malformed_manifest["render_spec"]["width"] = 1
            render_path.write_text(json.dumps(malformed_manifest), encoding="utf-8")
            with self.assertRaisesRegex(CandidateOutputError, "invalid render manifest"):
                validate_candidate_file(image_path, config=test_config)
            render_path.write_text(
                json.dumps(original_manifest, indent=2, sort_keys=True) + "\n",
                encoding="utf-8",
            )

            wrong_filename = json.loads(render_path.read_text(encoding="utf-8"))
            wrong_filename["outputs"]["png"]["filename"] = "another-article.png"
            render_path.write_text(json.dumps(wrong_filename), encoding="utf-8")
            with self.assertRaisesRegex(CandidateOutputError, "invalid render manifest"):
                validate_candidate_file(image_path, config=test_config)
            render_path.write_text(
                json.dumps(original_manifest, indent=2, sort_keys=True) + "\n",
                encoding="utf-8",
            )

            wrong_size = json.loads(render_path.read_text(encoding="utf-8"))
            wrong_size["outputs"]["png"]["bytes"] += 1
            render_path.write_text(json.dumps(wrong_size), encoding="utf-8")
            wrong_size_validation = validate_candidate_file(image_path, config=test_config)
            self.assertFalse(wrong_size_validation["encoded_file_size_matches_manifest"])
            self.assertFalse(wrong_size_validation["passed"])
            render_path.write_text(
                json.dumps(original_manifest, indent=2, sort_keys=True) + "\n",
                encoding="utf-8",
            )

            manifest_tampering: list[tuple[str, dict[str, object]]] = []
            unknown_top_level = json.loads(json.dumps(original_manifest))
            unknown_top_level["secret"] = "must-not-survive-validation"
            manifest_tampering.append(("unknown top-level field", unknown_top_level))
            unknown_source_field = json.loads(json.dumps(original_manifest))
            unknown_source_field["source"]["private_prompt"] = "sensitive"
            manifest_tampering.append(("unknown source field", unknown_source_field))
            outside_source = json.loads(json.dumps(original_manifest))
            outside_source["source"]["source_path"] = "tmp/unapproved.md"
            manifest_tampering.append(("unapproved source provenance", outside_source))
            invalid_workflow = json.loads(json.dumps(original_manifest))
            invalid_workflow["source"]["source_path"] = "06-Design/unapproved.md"
            invalid_workflow["source"]["workflow_stage"] = "design"
            invalid_workflow["source"]["publishable"] = True
            manifest_tampering.append(("publishable design source", invalid_workflow))
            injected_constraint = json.loads(json.dumps(original_manifest))
            injected_constraint["analysis"]["safety_constraints"].append("SECRET_CONFIG_MARKER")
            manifest_tampering.append(("unallowlisted manifest text", injected_constraint))
            for label, tampered in manifest_tampering:
                with self.subTest(label=label):
                    render_path.write_text(json.dumps(tampered), encoding="utf-8")
                    with self.assertRaisesRegex(CandidateOutputError, "invalid render manifest"):
                        validate_candidate_file(image_path, config=test_config)
            render_path.write_text(
                json.dumps(original_manifest, indent=2, sort_keys=True) + "\n",
                encoding="utf-8",
            )

            arbitrary_seed = json.loads(json.dumps(original_manifest))
            arbitrary_seed["render_spec"]["seed"] += 1
            render_path.write_text(json.dumps(arbitrary_seed), encoding="utf-8")
            with self.assertRaisesRegex(CandidateOutputError, "derivation"):
                validate_candidate_file(image_path, config=test_config)
            render_path.write_text(
                json.dumps(original_manifest, indent=2, sort_keys=True) + "\n",
                encoding="utf-8",
            )

            forged_object_override = json.loads(json.dumps(original_manifest))
            forged_object_override["selection"].update(
                {
                    "hidden_object_id": "document-v1",
                    "depth_map_id": "document-v1",
                    "alt_label": "document and magnifying glass",
                    "reason": "explicit approved Design override",
                }
            )
            forged_object_override["render_spec"]["hidden_object_id"] = "document-v1"
            render_path.write_text(json.dumps(forged_object_override), encoding="utf-8")
            with self.assertRaisesRegex(CandidateOutputError, "derivation"):
                validate_candidate_file(image_path, config=test_config)

            forged_style_override = json.loads(json.dumps(original_manifest))
            forged_style_override["render_spec"]["palette_id"] = "blog-retro-bright-v1"
            forged_style_override["render_spec"]["texture_id"] = "fine-confetti-v1"
            render_path.write_text(json.dumps(forged_style_override), encoding="utf-8")
            with self.assertRaisesRegex(CandidateOutputError, "derivation"):
                validate_candidate_file(image_path, config=test_config)
            render_path.write_text(
                json.dumps(original_manifest, indent=2, sort_keys=True) + "\n",
                encoding="utf-8",
            )

            original_png = image_path.read_bytes()
            with Image.open(io.BytesIO(original_png)) as opened:
                forged_image = opened.convert("RGB")
            forged_pixel = forged_image.getpixel((0, 0))
            self.assertIsInstance(forged_pixel, tuple)
            assert isinstance(forged_pixel, tuple)
            red, green, blue = (int(forged_pixel[0]), int(forged_pixel[1]), int(forged_pixel[2]))
            forged_image.putpixel((0, 0), ((red + 1) % 256, green, blue))
            forged_buffer = io.BytesIO()
            forged_image.save(
                forged_buffer,
                format="PNG",
                optimize=False,
                compress_level=9,
            )
            forged_bytes = forged_buffer.getvalue()
            forged_spec = RenderSpec(**original_manifest["render_spec"])
            forged_depth = generate_depth_map(
                original_manifest["selection"]["depth_map_id"],
                test_config,
            )
            forged_qa = validate_autostereogram(forged_image, forged_depth, forged_spec)
            self.assertTrue(forged_qa["passed"], forged_qa)
            forged_manifest = json.loads(json.dumps(original_manifest))
            forged_manifest["outputs"]["png"]["sha256"] = hashlib.sha256(forged_bytes).hexdigest()
            forged_manifest["outputs"]["png"]["bytes"] = len(forged_bytes)
            for key in forged_manifest["qa"]:
                forged_manifest["qa"][key] = forged_qa[key]
            image_path.write_bytes(forged_bytes)
            render_path.write_text(json.dumps(forged_manifest), encoding="utf-8")
            forged_validation = validate_candidate_file(image_path, config=test_config)
            self.assertFalse(forged_validation["deterministic_render_matches_source"])
            self.assertFalse(forged_validation["passed"])
            image_path.write_bytes(original_png)
            render_path.write_text(
                json.dumps(original_manifest, indent=2, sort_keys=True) + "\n",
                encoding="utf-8",
            )

            wrong_owner = json.loads(render_path.read_text(encoding="utf-8"))
            wrong_owner["source"]["source_sha256"] = "00" * 32
            render_path.write_text(json.dumps(wrong_owner, indent=2, sort_keys=True) + "\n", encoding="utf-8")
            with self.assertRaisesRegex(CandidateOutputError, "belongs to a different source"):
                generate_candidate(
                    source,
                    root=root,
                    config=test_config,
                    output_dir=output,
                    output_format="both",
                    force=True,
                )
            render_path.write_text(
                json.dumps(original_manifest, indent=2, sort_keys=True) + "\n",
                encoding="utf-8",
            )

            with self.assertRaises(ExistingCandidate):
                generate_candidate(source, root=root, config=test_config, output_dir=output)
            forced = generate_candidate(
                source,
                root=root,
                config=test_config,
                output_dir=output,
                output_format="both",
                force=True,
            )
            self.assertEqual(forced["status"], "qa-passed")
            self.assertEqual(
                forced["qa"]["decoded_pixel_sha256"],
                validation["decoded_pixel_sha256"],
            )
            self.assertEqual(render_path.read_bytes(), deterministic_manifest)
            outside = root / "not-private"
            with self.assertRaises(CandidateOutputError):
                generate_candidate(source, root=root, config=test_config, output_dir=outside, dry_run=True)

            manifest_only = generate_candidate(
                source,
                root=root,
                config=test_config,
                output_dir=private_root / "manifest-only",
                variant_number=1,
                manifest_only=True,
            )
            self.assertEqual(manifest_only["status"], "manifest-only")
            self.assertFalse((private_root / "manifest-only").exists())

    def test_private_root_symlink_hash_parsing_and_force_rollback_are_safe(self) -> None:
        config = load_autostereogram_config(REPO)
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            source = root / "content" / "posts" / "safe.md"
            source.parent.mkdir(parents=True)
            source.write_text(
                '---\ntitle: "Safe"\ndraft: false\n---\n\nFootball.\n',
                encoding="utf-8",
            )
            outside = root / "outside"
            outside.mkdir()
            private_root = root / "06-Design" / "article-image-system-preview" / "autostereograms"
            private_root.parent.mkdir(parents=True)
            try:
                private_root.symlink_to(outside, target_is_directory=True)
            except OSError:
                self.skipTest("symlinks unavailable")
            test_config = replace(config, root=root, candidate_root=private_root)
            with self.assertRaisesRegex(CandidateOutputError, "symlink"):
                generate_candidate(source, root=root, config=test_config, dry_run=True)

        with tempfile.TemporaryDirectory() as directory:
            corpus = Path(directory)
            (corpus / "list.qa.json").write_text("[]", encoding="utf-8")
            (corpus / "bad-hash.qa.json").write_text(
                json.dumps({"decoded_pixel_sha256": "z" * 64, "perceptual_dhash": "not-hexadecimal!"}),
                encoding="utf-8",
            )
            self.assertEqual(_existing_hashes(corpus), ((), ()))

            first = corpus / "a.txt"
            second = corpus / "b.txt"
            first.write_bytes(b"old-a")
            second.write_bytes(b"old-b")
            real_replace = os.replace

            def fail_second_install(source_path, destination_path, *args, **kwargs) -> None:
                if Path(str(destination_path)).name == "b.txt" and ".tmp" in Path(str(source_path)).name:
                    raise OSError("injected replacement failure")
                real_replace(source_path, destination_path, *args, **kwargs)

            with mock.patch("article_images.pipeline.os.replace", side_effect=fail_second_install):
                with self.assertRaisesRegex(OSError, "injected replacement failure"):
                    _atomic_bundle({first: b"new-a", second: b"new-b"}, force=True)
            self.assertEqual(first.read_bytes(), b"old-a")
            self.assertEqual(second.read_bytes(), b"old-b")

            third = corpus / "c.txt"
            fourth = corpus / "d.txt"
            real_fdopen = os.fdopen
            fdopen_calls = 0

            def fail_second_temporary(descriptor: int, *args, **kwargs):
                nonlocal fdopen_calls
                fdopen_calls += 1
                if fdopen_calls == 2:
                    raise OSError("injected temporary preparation failure")
                return real_fdopen(descriptor, *args, **kwargs)

            with mock.patch("article_images.pipeline.os.fdopen", side_effect=fail_second_temporary):
                with self.assertRaisesRegex(OSError, "temporary preparation failure"):
                    _atomic_bundle({third: b"new-c", fourth: b"new-d"}, force=False)
            self.assertFalse(third.exists())
            self.assertFalse(fourth.exists())
            self.assertEqual(tuple(corpus.glob(".*.tmp")), ())

    def test_concurrent_duplicate_admission_publishes_only_one_bundle(self) -> None:
        config = load_autostereogram_config(REPO)
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            source = root / "content" / "posts" / "concurrent.md"
            source.parent.mkdir(parents=True)
            source.write_text(
                "---\n"
                'title: "Concurrent football review"\n'
                'description: "A referee uses VAR to review a football decision."\n'
                "draft: false\n"
                "---\n\nA referee reviews the same football decision.\n",
                encoding="utf-8",
            )
            private_root = root / "06-Design" / "article-image-system-preview" / "autostereograms"
            test_config = replace(config, root=root, candidate_root=private_root)
            barrier = threading.Barrier(2)
            real_render = render_autostereogram

            def synchronized_render(*args, **kwargs):
                image = real_render(*args, **kwargs)
                barrier.wait(timeout=30)
                return image

            def run_candidate(name: str) -> str:
                try:
                    result = generate_candidate(
                        source,
                        root=root,
                        config=test_config,
                        output_dir=private_root / name,
                    )
                    return str(result["status"])
                except CandidateQAError:
                    return "exact-duplicate-rejected"

            with mock.patch(
                "article_images.pipeline.render_autostereogram",
                side_effect=synchronized_render,
            ):
                with ThreadPoolExecutor(max_workers=2) as executor:
                    outcomes = sorted(executor.map(run_candidate, ("candidate-a", "candidate-b")))
            self.assertEqual(outcomes, ["exact-duplicate-rejected", "qa-passed"])

    def test_candidate_root_replacement_during_transaction_fails_without_publication(self) -> None:
        config = load_autostereogram_config(REPO)
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            source = root / "content" / "posts" / "root-race.md"
            source.parent.mkdir(parents=True)
            source.write_text(
                "---\n"
                'title: "Football root race"\n'
                'description: "VAR reviews a football decision."\n'
                "draft: false\n"
                "---\n\nA referee reviews a football decision.\n",
                encoding="utf-8",
            )
            private_root = root / "06-Design" / "article-image-system-preview" / "autostereograms"
            moved_root = private_root.with_name("autostereograms-moved")
            test_config = replace(config, root=root, candidate_root=private_root)

            def replace_root(descriptor: int, **kwargs):
                private_root.rename(moved_root)
                private_root.mkdir(parents=True)
                return _existing_hashes_at(descriptor, **kwargs)

            with mock.patch(
                "article_images.pipeline._existing_hashes_at",
                side_effect=replace_root,
            ):
                with self.assertRaisesRegex(CandidateOutputError, "root changed"):
                    generate_candidate(source, root=root, config=test_config)
            self.assertFalse(any(moved_root.rglob("candidate-v*")))
            self.assertFalse(any(private_root.rglob("candidate-v*")))

    def test_cli_has_explicit_private_mode_and_keeps_legacy_default(self) -> None:
        article = REPO / "content" / "posts" / "2026-07-12-is-var-helping-football.md"
        command = [
            sys.executable,
            str(REPO / "scripts" / "generate-article-image.py"),
            str(article),
            "--autostereogram",
            "--dry-run",
            "--variant-number",
            "1",
        ]
        completed = subprocess.run(
            command,
            cwd=REPO,
            text=True,
            capture_output=True,
            check=False,
        )
        self.assertEqual(completed.returncode, 0, completed.stderr)
        result = json.loads(completed.stdout)
        self.assertEqual(result["status"], "dry-run")
        self.assertEqual(result["hidden_object"], "football-v1")
        self.assertEqual(result["render_spec"]["variant_number"], 1)
        self.assertIn("06-Design/article-image-system-preview/autostereograms", result["output_dir"])

        legacy = subprocess.run(
            [sys.executable, str(REPO / "scripts" / "generate-article-image.py"), str(article), "--dry-run"],
            cwd=REPO,
            text=True,
            capture_output=True,
            check=False,
        )
        self.assertEqual(legacy.returncode, 0, legacy.stderr)
        self.assertRegex(legacy.stdout, r"^(planned|skipped):")
        self.assertIn(".svg", legacy.stdout)

        invalid = subprocess.run(
            command + ["--object", "unreviewed-object"],
            cwd=REPO,
            text=True,
            capture_output=True,
            check=False,
        )
        self.assertNotEqual(invalid.returncode, 0)
        self.assertIn("unreviewed-object", invalid.stderr)

        ignored_validate_option = subprocess.run(
            [
                sys.executable,
                str(REPO / "scripts" / "generate-article-image.py"),
                "--validate-only",
                "missing.png",
                "--variant-number",
                "1",
            ],
            cwd=REPO,
            text=True,
            capture_output=True,
            check=False,
        )
        self.assertEqual(ignored_validate_option.returncode, 2)
        self.assertIn("cannot be combined", ignored_validate_option.stderr)


if __name__ == "__main__":
    unittest.main()
