import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { execFileSync } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

test('rendered navigation has native buttons controlling unique dropdowns', async () => {
  const destination = await mkdtemp(join(tmpdir(), 'dadbot-keyboard-'));
  try {
    execFileSync('hugo', ['--destination', destination], { cwd: fileURLToPath(new URL('../', import.meta.url)), stdio: 'pipe' });
    const html = await readFile(join(destination, 'index.html'), 'utf8');
    const triggers = [...html.matchAll(/<([\w-]+)\b([^>]*class="[^"]*\bmenu__trigger\b[^"]*"[^>]*)>/g)];
    assert.equal(triggers.length, 2, 'mobile Menu and desktop Play');
    const ids = [];
    for (const [, tag, attrs] of triggers) {
      assert.equal(tag, 'button', 'dropdown triggers must be native buttons');
      assert.match(attrs, /type="button"/);
      assert.match(attrs, /aria-expanded="false"/);
      const id = attrs.match(/aria-controls="([^"]+)"/)?.[1];
      assert.ok(id, 'trigger identifies its dropdown');
      ids.push(id);
      assert.equal([...html.matchAll(new RegExp(`id="${id}"`, 'g'))].length, 1);
    }
    assert.equal(new Set(ids).size, ids.length);
  } finally {
    await rm(destination, { recursive: true, force: true });
  }
});

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

test('Play menu trigger stays green on the purple Conspiracy Corner page', async () => {
  const menuStyles = await readProjectFile('assets/css/menu.scss');

  assert.match(
    menuStyles,
    /\.navigation-menu\s*&\s*\.menu__trigger,\s*\.menu__trigger\s*\{\s*color:\s*#78e2a0\s*!important;/,
    'the grouped Play trigger has a higher-specificity fixed-green rule',
  );
});
