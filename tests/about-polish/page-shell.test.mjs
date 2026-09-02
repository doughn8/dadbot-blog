import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const projectRoot = new URL('../../', import.meta.url);
const read = (path) => readFile(new URL(path, projectRoot), 'utf8');

test('about template renders the four-window structure with a hidden H1', async () => {
  const tpl = await read('layouts/_default/about.html');

  // Exactly four windows, each with a labelled bar and no path suffix.
  const bars = tpl.match(/about-command-stream__window-bar"><span[^>]*>([^<]*)</g) || [];
  const labels = bars.map((b) => b.replace(/.*>/, '').replace('<', '').trim().toLowerCase());
  assert.equal(bars.length, 4, 'exactly four About window bars render');

  // No window-bar paths, no coffee button, no closing section.

  // H1 stays in the DOM but visually hidden.
  assert.ok(tpl.includes('about-command-stream__sr-title'));
  assert.ok(tpl.includes('.Params.hero.headline'));

  // Three static labels; the support window's label comes from frontmatter.
  assert.deepEqual(labels.slice(0, 3), ['core values', 'what dadbot covers', 'operating principles']);
  assert.ok(labels[3].includes('{{ .title }}'), 'support label comes from frontmatter');
  assert.ok(tpl.includes('id="about-support-title">{{ .title }}'));
});

test('about combines intro and mission in the shared Dadbot dashed intro', async () => {
  const tpl = await read('layouts/_default/about.html');
  const styles = await read('static/style.css');
  const aboutBlock = styles.slice(styles.indexOf('ABOUT PAGE - Windows Blend'));
  const introRule = styles.match(/\.section-intro\s*\{([^}]*)\}/)?.[1] || '';
  const greenRule = styles.match(/\.section-intro--green\s*\{([^}]*)\}/)?.[1] || '';

  assert.match(
    tpl,
    /<section class="about-command-stream__hero section-intro section-intro--green"[^>]*>[\s\S]*?<div class="section-intro__content">[\s\S]*?\.Params\.hero\.subheadline[\s\S]*?\.Params\.mission[\s\S]*?\.body[\s\S]*?<\/div>[\s\S]*?<\/section>/,
    'the hero and mission copy share the established green dashed intro container',
  );
  assert.ok(!tpl.includes('about-mission-title'), 'the separate Mission window is removed');
  assert.match(introRule, /border:\s*1px dashed transparent/, 'shared intro supplies the dashed border');
  assert.match(greenRule, /border-color:\s*color-mix\(in srgb, #78e2a0 75%, transparent\)/, 'green modifier supplies the Dadbot border colour');
  assert.match(aboutBlock, /\.about-command-stream__hero\.section-intro[\s\S]*?color:\s*var\(--color\)/);
  assert.match(aboutBlock, /\.about-command-stream__hero\.section-intro[\s\S]*?font-family:\s*inherit/);
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
