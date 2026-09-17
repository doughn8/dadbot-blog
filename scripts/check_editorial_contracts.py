#!/usr/bin/env python3
"""Read-only checks for new Dadbot editorial templates/artifacts.

Checks a deliberately small top-level scalar contract, NOT general YAML syntax,
factual accuracy, approval authenticity or writing quality. Parse YAML separately.
Historical artifacts are not migrated or automatically repaired.
"""
import re

STAGES = ('idea', 'brief', 'seo', 'draft', 'creative-edit', 'proofread', 'design', 'final-approval', 'local-publish')
LABELS = ('Idea', 'Brief', 'SEO', 'Draft', 'Creative Edit', 'Proofread', 'Design', 'Final Approval', 'Local Publish')
STATUSES = ('awaiting-brief-approval', 'awaiting-seo-approval', 'awaiting-draft-approval', 'awaiting-creative-edit-approval', 'awaiting-proofread-approval', 'awaiting-design-approval', 'awaiting-final-approval', 'awaiting-final-approval')
REQUIRED = ('title', 'date', 'desk', 'slug', 'assigned_agent', 'role_profile', 'draft', 'publishable', 'approval_required', 'approved_by', 'approved_at', 'sophie_decision', 'sophie_decision_date', 'workflow_stage', 'status', 'source_artifact', 'next_artifact', 'next_stage')


def metadata(text, template):
    if template:
        match = re.search(r'^```yaml\s*\n(.*?)^```\s*$', text, re.M | re.S)
        if not match:
            return {}, ['missing YAML example']
        block = match.group(1)
    else:
        block = text
    match = re.match(r'\A---\n(.*?)\n---(?:\n|$)', block, re.S)
    if not match:
        return {}, ['frontmatter must start with --- and close before the body']
    values, errors = {}, []
    for key, value in re.findall(r'^([a-zA-Z_][\w-]*):[ \t]*(.*)$', match.group(1), re.M):
        if key in values:
            errors.append(f'duplicate top-level key: {key}')
        values[key] = value.strip()
    return values, errors


def unquote(value):
    if len(value) >= 2 and value[0] == value[-1] and value[0] in '\"\'':
        return value[1:-1]
    return value


def check_template(text, stage):
    if stage not in STAGES[:-1]:
        return [f'unsupported pre-publication stage: {stage}']
    values, errors = metadata(text, True)
    i = STAGES.index(stage)
    for key in REQUIRED:
        if key not in values:
            errors.append(f'missing field: {key}')
    for key, expected in [('draft', 'true'), ('publishable', 'false'), ('approval_required', 'true')]:
        if values.get(key) != expected:
            errors.append(f'{key} must be YAML {expected}')
    for key in ('approved_by', 'approved_at', 'sophie_decision', 'sophie_decision_date'):
        if key in values and values[key] not in ('\"\"', "''"):
            errors.append(f'{key} must be blank until the human decision')
    final_review = unquote(values.get('workflow_mode', '')) == 'final-review'
    expected_status = ('awaiting-final-review' if stage == 'final-approval' else 'checked') if final_review else STATUSES[i]
    for key, expected in [('workflow_stage', stage), ('next_stage', STAGES[i+1]), ('status', expected_status)]:
        if unquote(values.get(key, '')) != expected:
            errors.append(f'{key} must be {expected}')
    gate = f'{LABELS[i]} → {LABELS[i+1]}'
    if f'- Next gate: {gate}' not in text:
        errors.append(f'handoff must name {gate}')
    expected_decision = 'Publish locally / Revise / Hold / Discard' if stage == 'final-approval' else 'approve, revise or discard'
    if final_review:
        expected_decision = 'Approve / Request changes / Reject / Hold' if stage == 'final-approval' else 'none — internal checkpoint'
    decisions = re.findall(r'^- Sophie decision required: (.*)$', text, re.M)
    if decisions != [expected_decision]:
        errors.append(f'decision must be exactly: {expected_decision}')
    if stage == 'final-approval' and '## Full article for final approval' not in text:
        errors.append('missing Full article for final approval payload slot')
    return errors


FOLDERS = ('01-Ideas', '02-Briefs', '03-SEO', '04-Drafts', '05-Reviews', '05-Reviews', '06-Design', '07-Approval', 'content')
OWNERS = {
    'news': ('news-editor', 'News Editor.md', 'news'),
    'blog': ('blog-editor', 'Blog Editor.md', 'posts'),
    'books': ('shelf-scout', 'Book Review Agent.md', 'books'),
    'conspiracy-corner': ('conspiracy-editor', 'Conspiracy Editor.md', 'conspiracy-corner'),
}
PAYLOADS = {'draft': 'Full draft article', 'creative-edit': 'Full edited article', 'proofread': 'Full proofread article', 'final-approval': 'Full article for final approval'}
PLACEHOLDER = re.compile(r'<(?:topic-slug|desk-editor|section|date|slug)>|\{\{.*?\}\}|YYYY-MM-DD|\[Title\]|\[Author\]')


def check_artifact(text, stage, path, repo):
    """Validate ready NEW artifacts in either mode; never mutate old approvals."""
    from pathlib import Path
    path, repo = Path(path).resolve(), Path(repo).resolve()
    values, errors = metadata(text, False)
    if not values:
        return errors
    # Reuse the exact pending-template contract with a syntactic wrapper only.
    head, body = text.split('\n---', 1)
    errors += check_template('```yaml\n' + head + '\n---\n```\n' + body, stage)
    if stage not in STAGES[:-1]:
        return errors
    mode = unquote(values.get('workflow_mode', ''))
    if mode not in ('', 'stage-gated', 'final-review'):
        errors.append('workflow_mode must be stage-gated or final-review')
    identity = unquote(values.get('candidate_id', ''))
    if mode == 'final-review':
        if not re.fullmatch(r'[a-z0-9]+(?:-[a-z0-9]+)*', identity):
            errors.append('candidate_id must be a concrete lowercase bundle ID')
        run_value = unquote(values.get('run_record', ''))
        run = (path.parent / run_value).resolve()
        expected_run = repo / '01-Ideas' / identity / 'run.md'
        if not run_value or run != expected_run or not run.is_relative_to(repo) or not run.is_file():
            errors.append('run_record must point to the candidate-specific 01-Ideas run.md')
        else:
            record, record_errors = metadata(run.read_text(encoding='utf-8'), False)
            errors.extend('run_record: ' + error for error in record_errors)
            for key in ('workflow_mode', 'candidate_id', 'desk', 'slug'):
                if not unquote(values.get(key, '')) or unquote(values.get(key, '')) != unquote(record.get(key, '')):
                    errors.append(f'{key} must match run_record')
        if path.parent.name != identity:
            errors.append('candidate_id must match artifact bundle folder')
        if not unquote(values.get('source_ledger', '')):
            errors.append('source_ledger required for final-review checkpoints')
    if PLACEHOLDER.search(text):
        errors.append('unresolved template placeholder')
    for key in ('title', 'date', 'desk', 'slug'):
        if not unquote(values.get(key, '')):
            errors.append(f'{key} must not be blank')
    desk = unquote(values.get('desk', ''))
    if desk not in OWNERS:
        errors.append('desk must identify exactly one supported desk')
    else:
        owner, profile, _ = OWNERS[desk]
        if unquote(values.get('assigned_agent', '')) != owner:
            errors.append('assigned_agent does not match desk')
        if unquote(values.get('role_profile', '')) != '00-Control-Room/Agents/' + profile:
            errors.append('role_profile does not match desk')
    for key in ('source_artifact', 'role_profile', 'source_ledger'):
        value = unquote(values.get(key, ''))
        if key == 'source_artifact' and stage == 'idea' and not value:
            continue
        if key == 'source_ledger' and not value:
            if re.search(r'\[\d+\]', body):
                errors.append('source_ledger required for numbered citations')
            continue
        candidate = (repo / value if key == 'role_profile' else path.parent / value).resolve()
        if not value or not candidate.is_relative_to(repo) or not candidate.is_file():
            errors.append(f'{key} must resolve to an existing file within the repository')
    i = STAGES.index(stage)
    if not path.is_relative_to(repo) or not path.relative_to(repo).parts or path.relative_to(repo).parts[0] != FOLDERS[i]:
        errors.append('artifact path does not match its stage folder')
    target = (path.parent / unquote(values.get('next_artifact', ''))).resolve()
    if mode == 'final-review' and stage != 'final-approval' and target.parent.name != identity:
        errors.append('next_artifact candidate must match candidate_id')
    source = unquote(values.get('source_artifact', ''))
    if target == path or (source and target == (path.parent / source).resolve()):
        errors.append('next_artifact must not overwrite the current or source artifact')
    if not target.is_relative_to(repo) or not target.relative_to(repo).parts or target.relative_to(repo).parts[0] != FOLDERS[i+1] or target.suffix != '.md':
        errors.append('next_artifact must point to the next stage Markdown file within the repository')
    elif stage == 'final-approval' and desk in OWNERS and (len(target.relative_to(repo).parts) < 3 or target.relative_to(repo).parts[1] != OWNERS[desk][2]):
        errors.append('next_artifact public section does not match desk')
    if stage in PAYLOADS:
        heading = '## ' + PAYLOADS[stage] + '\n'
        if heading not in body or '\n## Handoff contract' not in body:
            errors.append(f'missing {PAYLOADS[stage]} payload boundaries')
        else:
            start = body.index(heading) + len(heading)
            end = body.index('\n## Handoff contract')
            payload = re.sub(r'<!--.*?-->', '', body[start:end], flags=re.S).strip()
            if end <= start or not payload:
                errors.append('article payload is empty or out of order')
    return errors


TEMPLATES = {
    'idea-template.md': 'idea', 'brief-template.md': 'brief', 'seo-template.md': 'seo',
    'blog-post-template.md': 'draft', 'news-story-template.md': 'draft',
    'book-review-template.md': 'draft', 'conspiracy-corner-template.md': 'draft',
    'draft-template.md': 'draft', 'creative-edit-template.md': 'creative-edit',
    'proofread-template.md': 'proofread', 'design-template.md': 'design',
    'approval-template.md': 'final-approval',
}


def main(argv=None):
    import argparse
    from pathlib import Path
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--repo', type=Path, default=Path(__file__).resolve().parents[1])
    mode = parser.add_mutually_exclusive_group(required=True)
    mode.add_argument('--templates', action='store_true', help='Require and check local ignored templates')
    mode.add_argument('--artifact', type=Path, help='Check a NEW awaiting-approval artifact, never migrate it')
    parser.add_argument('--stage', choices=STAGES[:-1])
    args = parser.parse_args(argv)
    repo = args.repo.resolve()
    if args.artifact and not args.stage:
        parser.error('--artifact requires --stage')
    if args.templates:
        targets = [(repo/'templates'/f, stage) for f, stage in TEMPLATES.items()]
    else:
        targets = [(args.artifact if args.artifact.is_absolute() else repo/args.artifact, args.stage)]
    failures, unavailable = 0, 0
    for path, stage in targets:
        try:
            text = path.read_text(encoding='utf-8')
        except (OSError, UnicodeError) as exc:
            print(f'UNAVAILABLE {path}: {exc}')
            unavailable += 1
            continue
        errors = check_template(text, stage) if args.templates else check_artifact(text, stage, path, repo)
        for error in errors:
            print(f'FAIL {path.name}: {error}')
        failures += bool(errors)
        if not errors:
            print(f'PASS {path.name}: {stage} structural contract')
    print(f'Checked {len(targets)} target(s): {failures} failed, {unavailable} unavailable.')
    print('Structural checks only. Separately parse YAML and verify sources, word count, Board state, human approval and article quality.')
    return 2 if unavailable else (1 if failures else 0)


if __name__ == '__main__':
    raise SystemExit(main())
