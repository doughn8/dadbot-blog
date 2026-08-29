import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const projectRoot = new URL('../../', import.meta.url);
const read = (path) => readFile(new URL(path, projectRoot), 'utf8');

test('card top bars show the date only, with no desk label or // separator', async () => {
  for (const template of [
    'layouts/partials/section-card.html',
    'layouts/index.html',
    'layouts/books/list.html',
  ]) {
    const html = await read(template);
    const bars = html.match(/<span class="card-top-desk">([\s\S]*?)<\/span>/g) || [];
    assert.ok(bars.length > 0, `${template} renders card top bars`);
    for (const bar of bars) {
      assert.ok(!/NEWS|BLOG|BOOKS|CONSPIRACY/.test(bar), `${template}: no desk label in top bar`);
      assert.ok(!bar.includes('//'), `${template}: no // separator in top bar`);
    }
    assert.ok(html.includes('.Date.Format "Jan 2, 2006"'), `${template}: date still rendered`);
  }
});

test('card tag footers are untouched by the top-bar change', async () => {
  const partial = await read('layouts/partials/section-card.html');
  assert.ok(partial.includes('card-footer-tags'));
  assert.ok(partial.includes('tag-chip--mini'));
});
