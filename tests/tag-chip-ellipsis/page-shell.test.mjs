import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const projectRoot = new URL('../../', import.meta.url);
const read = (path) => readFile(new URL(path, projectRoot), 'utf8');

test('card footer tag chips shrink gracefully and ellipsize instead of hard-clipping', async () => {
  const styles = await read('static/style.css');
  const match = styles.match(
    /\.post-card \.tag-chip--mini,\s*\n\.card-footer-tags \.tag-chip--mini\s*\{([\s\S]*?)\n\}/,
  );
  assert.ok(match, 'card footer chip override rule exists');
  const block = match[1];

  assert.ok(block.includes('display: inline-block'), 'inline-block so text-overflow works');
  assert.ok(block.includes('min-width: 0'), 'chips may shrink inside the flex footer');
  assert.ok(block.includes('max-width: 100%'), 'no blunt percentage cap');
  assert.ok(block.includes('text-overflow: ellipsis'), 'graceful truncation');
  assert.ok(!block.includes('max-width: 45%'), 'the old 45% cap must not return');
});
