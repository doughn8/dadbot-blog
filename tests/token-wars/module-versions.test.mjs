import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const base = new URL('../../static/games/token-wars/js/', import.meta.url);
const changed = new Set(['holding-costs.mjs','encounter-engine.mjs','game-engine.mjs','ui.mjs']);
test('changed ES-module dependencies carry their exact content hashes', async () => {
  let count = 0;
  for (const name of ['main.mjs','ui.mjs','game-engine.mjs','encounter-engine.mjs']) {
    const source = await readFile(new URL(name, base), 'utf8');
    for (const [, dependency, query] of source.matchAll(/from '\.\/([^'?]+)(\?v=[^']+)?'/g)) {
      if (!changed.has(dependency)) continue;
      count++;
      const hash = createHash('md5').update(await readFile(new URL(dependency, base))).digest('hex');
      assert.equal(query, `?v=${hash}`, `${name} must invalidate ${dependency}`);
    }
  }
  assert.equal(count, 8);
});
