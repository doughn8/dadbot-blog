import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const projectRoot = new URL('../../', import.meta.url);
const read = (path) => readFile(new URL(path, projectRoot), 'utf8');

test('article tag links are rendered by the shared section-routing partial', async () => {
  for (const template of ['layouts/_default/single.html', 'layouts/books/single.html']) {
    const html = await read(template);
    assert.ok(
      html.includes('partial "post-tags.html"'),
      `${template} should render tags via the shared partial`,
    );
    assert.ok(
      !html.includes('urls.JoinPath "tags"'),
      `${template} must no longer hardcode global /tags/ links`,
    );
  }
  // The global /tags/ term page keeps its related-tag chips pointing at sibling
  // /tags/ pages: those are cross-section taxonomy navigation with no owning section.
  const term = await read('layouts/_default/term.html');
  assert.ok(term.includes('partial "post-tags.html"'), 'term.html post tags use the shared partial');
});

test('the shared partial routes tags to the owning section with a tag query param', async () => {
  const partial = await read('layouts/partials/post-tags.html');
  assert.match(partial, /CurrentSection/);
  assert.match(partial, /RelPermalink/);
  assert.match(partial, /%s\?tag=%s/);
  assert.match(partial, /relLangURL/);
});

test('both section filter scripts honour a ?tag= deep link on arrival', async () => {
  for (const file of ['layouts/_default/list.html', 'layouts/partials/section-filter-script.html']) {
    const html = await read(file);
    assert.match(html, /URLSearchParams/, `${file} should read the query string`);
    assert.match(html, /linkedTag/, `${file} should activate the linked tag`);
    assert.match(html, /history\.replaceState/, `${file} should clean the URL after applying`);
  }
});
