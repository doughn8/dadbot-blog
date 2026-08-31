import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const projectRoot = new URL('../../', import.meta.url);
const read = (path) => readFile(new URL(path, projectRoot), 'utf8');

// --- Play parent menu with Games + Radio children (roadmap item 19) ----------

test('hugo.toml defines a Play parent with Games and Radio children', async () => {
  const toml = await read('hugo.toml');

  // Play parent, replacing the standalone Games entry's top-level slot.
  assert.match(toml, /identifier\s*=\s*"play"/, 'play parent identifier');
  assert.match(toml, /name\s*=\s*"Play"/, 'Play label');
  assert.match(toml, /identifier\s*=\s*"games"/, 'games child kept');
  assert.match(toml, /identifier\s*=\s*"radio"/, 'radio child kept');

  // Child entries: pageRef/url targets and parent bindings.
  const gamesBlock = toml.match(/\[\[languages\.en\.menu\.main\]\][^\[]*?identifier\s*=\s*"games"[\s\S]*?(?=\[\[languages\.en\.menu\.main\]\]|$)/)[0];
  assert.match(gamesBlock, /parent\s*=\s*"play"/, 'games must be a child of play');
  const radioBlock = toml.match(/\[\[languages\.en\.menu\.main\]\][^\[]*?identifier\s*=\s*"radio"[\s\S]*?(?=\[\[languages\.en\.menu\.main\]\]|$)/)[0];
  assert.match(radioBlock, /parent\s*=\s*"play"/, 'radio must be a child of play');
  assert.match(radioBlock, /url\s*=\s*"\/radio\/"/, 'radio child points at /radio/');

  // No top-level /games/ entry outside the Play group (Games is nested now).
  const gamesTopLevel = toml.match(/\[\[languages\.en\.menu\.main\]\][^\[]*?identifier\s*=\s*"games"[\s\S]*?url\s*=\s*"\/games\/"/);
  assert.ok(gamesBlock.includes('parent'), 'games entry declares its parent');
});

test('menu weights keep reading desks first and Play after them', async () => {
  const toml = await read('hugo.toml');
  const weightOf = (id) => {
    const block = toml.match(new RegExp(`\\[\\[languages\\.en\\.menu\\.main\\]\\][^\\[]*?identifier\\s*=\\s*"${id}"[\\s\\S]*?(?=\\[\\[languages\\.en\\.menu\\.main\\]\\]|$)`))[0];
    return Number(block.match(/weight\s*=\s*(\d+)/)[1]);
  };
  const order = ['home', 'news', 'blog', 'books', 'play', 'about', 'conspiracy-corner'].map(weightOf);
  const sorted = [...order].sort((a, b) => a - b);
  assert.deepEqual(order, sorted, 'menu weights must stay monotonic');
  assert.ok(weightOf('play') < weightOf('about'), 'Play sits before About');
});
