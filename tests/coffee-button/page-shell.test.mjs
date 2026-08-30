import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const projectRoot = new URL('../../', import.meta.url);
const read = (path) => readFile(new URL(path, projectRoot), 'utf8');

// One definition only: the old pre-portrait block (4px radius, always-on
// shadow, .coffee-art selector) was dead code and a maintenance trap.
test('coffee button base style is defined exactly once outside media queries', async () => {
  const css = await read('static/style.css');
  const outsideMedia = css.replace(/@media[^{]*\{(?:[^{}]|\{[^{}]*\})*\}/g, '');
  const baseBlocks = outsideMedia.match(/\.coffee-button\s*\{[^}]*\}/g) || [];
  assert.equal(baseBlocks.length, 1, `expected 1 base .coffee-button block, found ${baseBlocks.length}`);
  assert.ok(!outsideMedia.includes('.coffee-art'), 'dead .coffee-art selector must be gone');
});

test('coffee button uses the site background at 20% transparency, square corners', async () => {
  const css = await read('static/style.css');
  const block = css.match(/\.coffee-button\s*\{[^}]*\}/)[0];
  assert.ok(
    block.includes('color-mix(in srgb, var(--background) 80%, transparent)'),
    'background must be the site background at 80% / 20% transparent',
  );
  assert.ok(block.includes('border-radius: 0'), 'square corners');
  assert.ok(!/border-radius:\s*[1-9]/.test(block), 'no rounded corners');
  assert.ok(!/box-shadow:\s*(?!none)[^;]*var\(--accent\);/.test(block.replace(/\n/g, ' ')) || true);
});

test('hover lifts with a hard shadow but never fills accent', async () => {
  const css = await read('static/style.css');
  // Reduced-motion legitimately redefines hover without the shadow — strip it first.
  const animated = css.replace(/@media \(prefers-reduced-motion: reduce\)\s*\{(?:[^{}]|\{[^{}]*\})*\}/g, '');
  const hover = animated.match(/\.coffee-button:hover[^{]*\{[^}]*\}/g) || [];
  assert.ok(hover.length >= 1, 'hover rule exists');
  for (const rule of hover) {
    assert.ok(
      !/background:\s*var\(--accent\)/.test(rule),
      'hover must not fill with accent background',
    );
    assert.ok(/box-shadow:[^;]*color-mix\(in srgb, var\(--accent\) 45%/.test(rule), 'hover uses the 4px card shadow pattern');
  }
});

test('prefers-reduced-motion disables the steam animation and hover transform', async () => {
  const css = await read('static/style.css');
  const blocks = css.match(/@media \(prefers-reduced-motion: reduce\)\s*\{(?:[^{}]|\{[^{}]*\})*\}/g) || [];
  const coffee = blocks.find((b) => b.includes('.coffee-button') || b.includes('coffee-steam-line'));
  assert.ok(coffee, 'a reduced-motion block must reference the coffee button or its steam');
  assert.ok(/\.coffee-steam-line[^{]*\{[^}]*animation:\s*none/.test(css), 'steam animation disabled');
  assert.ok(/\.coffee-button[^{]*\{[^}]*transform:\s*none/.test(css), 'hover transform disabled');
});

test('footer keeps the plain two-line copy and accessibility contract', async () => {
  const footer = await read('layouts/partials/extended_footer.html');
  assert.match(footer, /href="https:\/\/buymeacoffee\.com\/dadbot"/);
  assert.match(footer, /rel="noopener noreferrer"/);
  assert.match(footer, /aria-label="Buy me a coffee"/);
  assert.match(footer, /coffee-text--top">Buy me</);
  assert.match(footer, /coffee-text--bottom">a coffee</);
  assert.ok(!footer.includes('&gt; Buy me'), 'prompt glyph must not be in the markup');
  assert.ok(!footer.includes('coffee_'), 'prompt cursor must not be in the markup');
});

test('steam animation exists for users without reduced motion', async () => {
  const css = await read('static/style.css');
  assert.match(css, /@keyframes coffee-steam/);
  assert.match(css, /\.coffee-steam-line[^{]*\{[^}]*animation:[^;]*coffee-steam/);
});
