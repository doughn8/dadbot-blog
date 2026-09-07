import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtemp, readFile, readdir, rm, access } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = fileURLToPath(new URL('../../', import.meta.url));
test('fresh preview build retires Hot Takes route and voting code', async () => {
  const output = await mkdtemp(join(tmpdir(), 'dadbot-retired-'));
  try {
    execFileSync('hugo', ['--buildDrafts', '--destination', output], { cwd: root, stdio: 'pipe' });
    await assert.rejects(access(join(output, 'hot-takes/index.html')));
    const legal = await readFile(join(output, 'legal/index.html'), 'utf8');
    assert.doesNotMatch(legal, /Hot Takes|dadbot-hot-takes-votes/);
    async function inspect(dir) {
      for (const entry of await readdir(dir, { withFileTypes: true })) {
        const path = join(dir, entry.name);
        if (entry.isDirectory()) await inspect(path);
        else if (/\.(html|js|mjs|xml|json)$/.test(entry.name)) {
          const text = await readFile(path, 'utf8');
          assert.doesNotMatch(text, /dadbot-hot-takes-votes/, `retired voting code in ${path}`);
          assert.doesNotMatch(text, /href=["']?\/hot-takes\//, `retired link in ${path}`);
        }
      }
    }
    await inspect(output);
  } finally {
    await rm(output, { recursive: true, force: true });
  }
});
