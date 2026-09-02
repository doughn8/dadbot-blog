import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const repoRoot = '/Users/sophie/Documents/Dadbot blog';
const read = (path) => readFile(`${repoRoot}/${path}`, 'utf8');
const hugoBin = '/Users/sophie/.local/bin/hugo';

test('external article links open in a new tab via a site-wide enhancement', async () => {
  const script = await read('static/js/external-links.js');
  const head = await read('layouts/partials/extended_head.html');

  // Script targets article content links only, scoped to external hosts.
  assert.match(script, /\.post-content a\[href\], article a\[href\]/, 'article-content link scope');
  assert.match(script, /a\.host !== window\.location\.host/, 'only external hosts are enhanced');
  assert.match(script, /setAttribute\('target', '_blank'\)/, 'external links open a new tab');
  assert.match(script, /'noopener', 'noreferrer'/, 'reverse-tabnabbing protection guaranteed without clobbering rel');

  // Site-wide: loaded on every page via the shared head partial, content-hashed.
  assert.match(head, /js\/external-links\.js[\s\S]*?\?v=\{\{ md5 \(readFile "static\/js\/external-links\.js"\) \}\}/, 'content-hashed cache stamp');
  assert.match(head, /\bdefer\b/, 'script is deferred so it never blocks rendering');
});

test('rendered article pages ship the external-link enhancement', async () => {
  execFileSync(hugoBin, ['--gc', '--minify', '--destination', '/tmp/dadbot-external-links-build'], {
    cwd: repoRoot,
    stdio: 'pipe',
  });

  const article = await readFile('/tmp/dadbot-external-links-build/conspiracy-corner/2026-07-12-operation-northwoods/index.html', 'utf8');
  assert.match(article, /js\/external-links\.js\?v=[0-9a-f]{32}/, 'enhancement loads on article pages');
  // The Northwoods sources are external and unenhanced in static HTML — the
  // deferred script adds the attributes at runtime, so the raw HTML must NOT
  // contain per-article target attributes.
  assert.ok(!article.includes('nsarchive2.gwu.edu" target'), 'no per-article markdown edits');
});
