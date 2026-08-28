import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const projectRoot = new URL('../../', import.meta.url);

async function readStyles() {
  return readFile(new URL('static/style.css', projectRoot), 'utf8');
}

function ruleDeclarations(styles, selector) {
  const match = styles.match(new RegExp(`${selector}\\s*\\{([^}]*)\\}`));
  assert.ok(match, `Expected ${selector} rule`);
  return match[1]
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split(';')
    .map((declaration) => declaration.trim())
    .filter(Boolean);
}

test('single article shells remove only their stacked top margin and padding', async () => {
  const selector = String.raw`article\.post:not\(\.on-list\)`;
  const declarations = ruleDeclarations(await readStyles(), selector);

  assert.deepEqual(declarations, [
    'margin-top: 0',
    'padding-top: 0',
  ]);
});

test('single article titles remove only the inherited heading top margin', async () => {
  const selector = String.raw`article\.post:not\(\.on-list\)\s*>\s*\.post-title`;
  const declarations = ruleDeclarations(await readStyles(), selector);

  assert.deepEqual(declarations, ['margin-top: 0']);
});
