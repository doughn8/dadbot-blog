import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const projectRoot = new URL('../', import.meta.url);

async function readProjectFile(path) {
  return readFile(new URL(path, projectRoot), 'utf8');
}

test('site-wide navigation hides Hot Takes and groups Games + Radio under Play', async () => {
  const config = await readProjectFile('hugo.toml');

  assert.match(config, /showMenuItems\s*=\s*7/);
  assert.doesNotMatch(config, /identifier\s*=\s*"hot-takes"/);
  // Play parent sits at weight 5 (between Books and About).
  assert.match(config, /identifier\s*=\s*"play"[\s\S]*?name\s*=\s*"Play"[\s\S]*?weight\s*=\s*5/);
  // Games and Radio are children of Play.
  assert.match(config, /identifier\s*=\s*"games"[\s\S]*?parent\s*=\s*"play"/);
  assert.match(config, /identifier\s*=\s*"radio"[\s\S]*?parent\s*=\s*"play"/);
  assert.match(config, /identifier\s*=\s*"about"[\s\S]*?weight\s*=\s*6/);
  assert.match(config, /identifier\s*=\s*"conspiracy-corner"[\s\S]*?weight\s*=\s*7/);
});

test('mobile menu green styling cannot override the purple Conspiracy Corner link', async () => {
  const menuStyles = await readProjectFile('assets/css/menu.scss');

  assert.match(menuStyles, /\.menu__dropdown\s*>\s*li:not\(\.menu__item--special-mobile\)/);
  assert.match(menuStyles, /\.menu__item--special-mobile[\s\S]*?color:\s*#ee72f1\s*!important/);
});
