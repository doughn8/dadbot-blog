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
    .replace(/\/[\s\S]*?\*\//g, '')
    .split(';')
    .map((declaration) => declaration.trim())
    .filter(Boolean);
}

test('article code blocks hide the Prism copy toolbar', async () => {
  const selector = String.raw`\.post-content \.code-toolbar \.toolbar`;
  const declarations = ruleDeclarations(await readStyles(), selector);

  assert.deepEqual(declarations, ['display: none']);
});

test('article code blocks wrap long lines instead of overflowing', async () => {
  const selector = String.raw`\.post-content pre,\s*\.post-content pre code`;
  const declarations = ruleDeclarations(await readStyles(), selector);

  assert.deepEqual(declarations, [
    'white-space: pre-wrap',
    'overflow-wrap: break-word',
  ]);
});
