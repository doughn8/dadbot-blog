"""Portable contract tests; fixtures are synthetic, not editorial approvals."""
from pathlib import Path
import importlib.util
import unittest

ROOT = Path(__file__).resolve().parents[1]
SCRIPT = ROOT / 'scripts/check_editorial_contracts.py'


def checker():
    spec = importlib.util.spec_from_file_location('editorial_contracts', SCRIPT)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


class MetadataContracts(unittest.TestCase):
    def test_missing_safety_fields_and_wrong_design_gate_are_rejected(self):
        self.assertTrue(SCRIPT.exists(), 'Editorial contract checker is not implemented')
        check = checker().check_template
        broken = '''# Synthetic Design fixture
```yaml
---
workflow_stage: "design"
next_stage: "local-publish"
approved_by: "Sophie"
---
```
## Handoff contract
- Next gate: Design → Final Approval
- Sophie decision required: Publish locally / Revise / Hold / Discard
'''
        errors = check(broken, 'design')
        self.assertTrue(any('draft' in e for e in errors), errors)
        self.assertTrue(any('publishable' in e for e in errors), errors)
        self.assertTrue(any('next_stage' in e for e in errors), errors)
        self.assertTrue(any('approved_by' in e for e in errors), errors)
        self.assertTrue(any('decision' in e for e in errors), errors)


def fixture(stage='design'):
    c = checker()
    i = c.STAGES.index(stage)
    values = {key: '""' for key in c.REQUIRED}
    values.update(title='"Synthetic test only"', date='"2026-01-01"', desk='"news"', slug='"synthetic"',
                  assigned_agent='"news-editor"', role_profile='"00-Control-Room/Agents/News Editor.md"',
                  draft='true', publishable='false', approval_required='true',
                  workflow_stage=f'"{stage}"', next_stage=f'"{c.STAGES[i+1]}"', status=f'"{c.STATUSES[i]}"',
                  source_artifact='"source.md"', next_artifact='"next.md"')
    decision = 'Publish locally / Revise / Hold / Discard' if stage == 'final-approval' else 'approve, revise or discard'
    return ('---\n' + '\n'.join(f'{k}: {v}' for k, v in values.items()) + '\n---\n\n'
            '## Handoff contract\n'
            f'- Next gate: {c.LABELS[i]} → {c.LABELS[i+1]}\n'
            f'- Sophie decision required: {decision}\n')


def as_template(artifact):
    meta, body = artifact.split('\n---\n', 1)
    return '# Synthetic template\n```yaml\n' + meta + '\n---\n```\n' + body


class PayloadContracts(unittest.TestCase):
    def test_final_approval_requires_full_article_slot(self):
        text = as_template(fixture('final-approval'))
        self.assertTrue(any('Full article for final approval' in e for e in checker().check_template(text, 'final-approval')))

    def test_artifact_rejects_unresolved_placeholders_and_missing_paths(self):
        import tempfile
        with tempfile.TemporaryDirectory() as d:
            root = Path(d)
            target = root / '06-Design/synthetic/design.md'
            text = fixture().replace('Synthetic test only', '<topic-slug>')
            c = checker()
            self.assertTrue(hasattr(c, 'check_artifact'), 'Artifact validation is not implemented')
            errors = c.check_artifact(text, 'design', target, root)
            for expected in ['placeholder', 'source_artifact', 'role_profile', 'next_artifact']:
                self.assertTrue(any(expected in e for e in errors), (expected, errors))


class CliContracts(unittest.TestCase):
    def test_missing_local_templates_are_reported_not_silently_passed(self):
        import subprocess, sys, tempfile
        with tempfile.TemporaryDirectory() as d:
            result = subprocess.run([sys.executable, str(SCRIPT), '--repo', d, '--templates'], capture_output=True, text=True)
        self.assertEqual(result.returncode, 2, result.stdout + result.stderr)
        self.assertIn('UNAVAILABLE', result.stdout + result.stderr)

    def test_artifact_at_repository_root_reports_error_without_crashing(self):
        import tempfile
        with tempfile.TemporaryDirectory() as d:
            errors = checker().check_artifact(fixture(), 'design', Path(d), Path(d))
        self.assertTrue(any('artifact path' in e for e in errors))


class PathSafetyContracts(unittest.TestCase):
    def test_next_artifact_cannot_overwrite_current_or_source(self):
        import tempfile
        with tempfile.TemporaryDirectory() as d:
            root = Path(d)
            path = root / '05-Reviews/synthetic/creative-edit.md'
            path.parent.mkdir(parents=True)
            source = path.parent / 'source.md'
            source.write_text('Synthetic upstream fixture', encoding='utf-8')
            for next_path in ['creative-edit.md', 'source.md']:
                text = fixture('creative-edit').replace('next.md', next_path)
                errors = checker().check_artifact(text, 'creative-edit', path, root)
                self.assertTrue(any('overwrite' in e for e in errors), errors)


class FinalReviewContracts(unittest.TestCase):
    def make_run(self, root, stage='design'):
        c = checker()
        path = root / c.FOLDERS[c.STAGES.index(stage)] / 'synthetic' / (stage + '.md')
        path.parent.mkdir(parents=True, exist_ok=True)
        profile = root / '00-Control-Room/Agents/News Editor.md'
        profile.parent.mkdir(parents=True, exist_ok=True)
        profile.write_text('Synthetic profile')
        (path.parent / 'source.md').write_text('Synthetic upstream')
        (path.parent / 'ledger.json').write_text('{}')
        run = root / '01-Ideas/synthetic/run.md'
        run.parent.mkdir(parents=True, exist_ok=True)
        run.write_text('---\nworkflow_mode: "final-review"\ncandidate_id: "synthetic"\nslug: "synthetic"\ndesk: "news"\n---\nSynthetic authorisation record; not real consent.\n')
        i = c.STAGES.index(stage)
        next_path = '../../content/news/synthetic.md' if stage == 'final-approval' else f'../../{c.FOLDERS[i+1]}/synthetic/{c.STAGES[i+1]}.md'
        text = fixture(stage).replace('next.md', next_path)
        status = 'checked' if stage != 'final-approval' else 'awaiting-final-review'
        text = text.replace(f'status: "{c.STATUSES[c.STAGES.index(stage)]}"', f'status: "{status}"')
        text = text.replace('---\n', '---\nworkflow_mode: "final-review"\ncandidate_id: "synthetic"\nrun_record: "../../01-Ideas/synthetic/run.md"\nsource_ledger: "ledger.json"\n', 1)
        text = text.replace('approve, revise or discard', 'none — internal checkpoint').replace('Publish locally / Revise / Hold / Discard', 'Approve / Request changes / Reject / Hold')
        if stage in c.PAYLOADS:
            text = text.replace('## Handoff contract', f'## {c.PAYLOADS[stage]}\n\nSynthetic payload only.\n\n## Handoff contract')
        return path, text

    def test_run_identity_evidence_and_paths_are_required(self):
        import tempfile
        with tempfile.TemporaryDirectory() as d:
            root = Path(d)
            path, good = self.make_run(root)
            for old, new, expected in [
                ('candidate_id: "synthetic"', 'candidate_id: "other"', 'candidate_id'),
                ('source_ledger: "ledger.json"', 'source_ledger: ""', 'source_ledger'),
                ('run_record: "../../01-Ideas/synthetic/run.md"', 'run_record: "../../content/news/evil.md"', 'run_record'),
                ('slug: "synthetic"', 'slug: "different"', 'slug'),
                ('approved_by: ""', 'approved_by: "Sophie"', 'approved_by'),
                ('status: "checked"', 'status: "rejected"', 'status'),
                ('status: "checked"', 'status: "needs-revision"', 'status'),
                ('status: "checked"', 'status: "blocked"', 'status'),
                ('workflow_mode: "final-review"', 'workflow_mode: "magic"', 'workflow_mode'),
            ]:
                with self.subTest(expected=expected, new=new):
                    errors = checker().check_artifact(good.replace(old, new), 'design', path, root)
                    self.assertTrue(any(expected in e for e in errors), errors)
            errors = checker().check_artifact(good, 'design', root/'content/news/early.md', root)
            self.assertTrue(any('artifact path' in e for e in errors), errors)

    def test_resume_rechecks_without_mutating_or_duplicating_artifacts(self):
        import tempfile, hashlib
        with tempfile.TemporaryDirectory() as d:
            root = Path(d)
            path, text = self.make_run(root)
            path.write_text(text)
            before = {str(p): hashlib.sha256(p.read_bytes()).hexdigest() for p in root.rglob('*') if p.is_file()}
            for _ in range(2):
                self.assertEqual(checker().check_artifact(path.read_text(), 'design', path, root), [])
            after = {str(p): hashlib.sha256(p.read_bytes()).hexdigest() for p in root.rglob('*') if p.is_file()}
            self.assertEqual(before, after)

    def test_next_stage_cannot_target_another_candidate(self):
        import tempfile
        with tempfile.TemporaryDirectory() as d:
            root = Path(d)
            path, text = self.make_run(root)
            text = text.replace('07-Approval/synthetic/', '07-Approval/other/')
            errors = checker().check_artifact(text, 'design', path, root)
            self.assertTrue(any('next_artifact candidate' in e for e in errors), errors)

    def test_checked_internal_stage_and_final_review_keep_human_fields_blank(self):
        import tempfile
        with tempfile.TemporaryDirectory() as d:
            for stage in checker().STAGES[:-1]:
                path, text = self.make_run(Path(d), stage)
                self.assertEqual(checker().check_artifact(text, stage, path, Path(d)), [])


if __name__ == '__main__':
    unittest.main()
