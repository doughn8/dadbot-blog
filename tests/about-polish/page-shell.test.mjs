import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const projectRoot = new URL('../../', import.meta.url);
const read = (path) => readFile(new URL(path, projectRoot), 'utf8');

test('about template renders the five-window structure with a hidden H1', async () => {
  const tpl = await read('layouts/_default/about.html');

  // Exactly five windows, each with a labelled bar and no path suffix.
  const bars = tpl.match(/about-command-stream__window-bar"><span[^>]*>([^<]*)</g) || [];
  const labels = bars.map((b) => b.replace(/.*>/, '').replace('<', '').trim().toLowerCase());

  // No window-bar paths, no coffee button, no closing section.

  // H1 stays in the DOM but visually hidden.
  assert.ok(tpl.includes('about-command-stream__sr-title'));
  assert.ok(tpl.includes('.Params.hero.headline'));

  // Four static labels; the support window's label comes from frontmatter.
  assert.deepEqual(labels.slice(0, 4), ['mission', 'core values', 'what dadbot covers', 'operating principles']);
  assert.ok(labels[4].includes('{{ .title }}'), 'support label comes from frontmatter');
  assert.ok(tpl.includes('id="about-support-title">{{ .title }}'));
});

test('about frontmatter carries the feature-level desks and no closing block', async () => {
  const content = await read('content/about.md');

  for (const name of ['News', 'Blog', 'Book Reviews', 'Conspiracy Corner']) {
    assert.ok(content.includes(`name: "${name}"`), `desk ${name} present`);
  }
  assert.ok(!content.includes('Parenting'));
  assert.ok(!content.includes('closing:'));
  assert.ok(content.includes('Written with dads in mind, but open to everyone.'), 'audience sentence relocated into mission');
});

test('about styles implement the window chrome without the mission left-rule', async () => {
  const styles = await read('static/style.css');
  const start = styles.indexOf('ABOUT PAGE - Windows Blend');
  assert.ok(start !== -1, 'About style block present');
  const aboutBlock = styles.slice(start);
  assert.ok(aboutBlock.includes('.about-command-stream__window-bar'));
  assert.ok(aboutBlock.includes('.about-command-stream__value--full'));
  assert.ok(aboutBlock.includes('decimal-leading-zero'));
  assert.ok(!aboutBlock.includes('border-left: 3px'), 'no mission left-rule inside the About block');
});
