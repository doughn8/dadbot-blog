import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const projectRoot = fileURLToPath(new URL('../../', import.meta.url));
const read = (path) => readFileSync(join(projectRoot, path), 'utf8');
const rule = (styles, selector) => {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const body = styles.match(new RegExp(`${escaped}\\s*\\{([^}]*)\\}`))?.[1];
  assert.ok(body, `rule exists: ${selector}`);
  return body;
};

test('About spacing uses one scoped scale with margin resets instead of stacked theme margins', () => {
  const css = read('static/style.css');
  const root = rule(css, '.about-editorial');
  assert.match(root, /--about-space-copy:\s*8px/);
  assert.match(root, /--about-space-inner:\s*16px/);
  assert.match(root, /--about-space-section:\s*28px/);
  assert.match(root, /gap:\s*var\(--about-space-section\)/);
  assert.match(rule(css, '.about-editorial :is(h1, h2, h3, p)'), /margin:\s*0 !important/);
  assert.match(rule(css, '.about-editorial__section'), /gap:\s*var\(--about-space-copy\)/);
  assert.match(rule(css, '.about-editorial__value'), /gap:\s*var\(--about-space-copy\)/);
  assert.match(rule(css, '.about-editorial__values'), /gap:\s*var\(--about-space-inner\)/);
  assert.match(rule(css, '.about-editorial__desk'), /padding:\s*var\(--about-space-inner\)/);
  assert.match(rule(css, '.about-editorial__desk'), /gap:\s*var\(--about-space-copy\)/);
  assert.match(rule(css, '.about-editorial__intro.section-intro'), /margin:\s*0/);
  assert.ok(!css.includes('about-command-stream'), 'replace obsolete About rules rather than layering over them');
});

test('About keeps square green surfaces, heading hierarchy and one column at every screen width', () => {
  const css = read('static/style.css');
  assert.match(rule(css, '.about-editorial h1'), /font-size:\s*27px/);
  assert.match(rule(css, '.about-editorial h2'), /font-size:\s*19px/);
  assert.match(rule(css, '.about-editorial h3'), /font-size:\s*15px/);
  const base = css.slice(0, css.indexOf('@media (max-width: 700px)'));
  for (const selector of ['.about-editorial__layout', '.about-editorial__desks']) {
    assert.match(rule(base, selector), /grid-template-columns:\s*minmax\(0, 1fr\)\s*;/, `${selector} is single-column without depending on a phone media query`);
  }
  assert.match(rule(css, '.about-editorial__layout'), /gap:\s*var\(--about-space-section\)/);
  assert.match(rule(css, '.about-editorial__principles'), /border:\s*1px dashed/);
  assert.match(rule(css, '.about-editorial__principles'), /padding:\s*var\(--about-space-inner\)/);
  assert.match(rule(css, '.about-editorial__principles'), /align-self:\s*start/);
  assert.match(rule(css, '.about-editorial__principles li::before'), /content:\s*none !important/);
});

// Supersedes the old terminal-window contracts: option 3 was approved.
test('About renders the editorial note with a visible title and a labelled principles sidebar', () => {
  const destination = mkdtempSync(join(tmpdir(), 'dadbot-about-'));
  try {
    execFileSync('hugo', ['--destination', destination], { cwd: projectRoot, stdio: 'pipe' });
    const output = readFileSync(join(destination, 'about/index.html'), 'utf8');
    const main = output.match(/<main class="about-page about-editorial"[^>]*>([\s\S]*?)<\/main>/)?.[1];
    assert.ok(main, 'the approved editorial layout renders');
    assert.match(main, /<h1 id="about-title">About Dadbot<\/h1>/);
    assert.equal((main.match(/<h1\b/g) || []).length, 1);
    assert.equal((main.match(/<h2\b/g) || []).length, 5);
    assert.equal((main.match(/<h3\b/g) || []).length, 9);
    assert.match(main, /<aside class="about-editorial__principles about-editorial__section" aria-labelledby="about-principles-title">/);
    assert.match(main, /<h2 id="about-principles-title">Operating principles<\/h2>/);
    const intro = main.match(/<section class="about-editorial__intro section-intro section-intro--green"[^>]*>([\s\S]*?)<\/section>/)?.[1];
    assert.ok(intro, 'the shared dashed intro remains');
    assert.equal((intro.match(/<p>/g) || []).length, 1, 'only the short greeting stays inside the intro');
    assert.match(main, /<h2 id="about-mission-title">Pull up a chair\.<\/h2>/);
    const values = main.indexOf('id="about-values-title"');
    const principles = main.indexOf('<aside');
    const desks = main.indexOf('id="about-desks-title"');
    const support = main.indexOf('id="about-support-title"');
    assert.ok(values < principles && principles < desks && desks < support, 'phone reading order matches option 3');
    assert.equal((main.match(/class="about-editorial__value"/g) || []).length, 5);
    assert.equal((main.match(/class="about-editorial__desk"/g) || []).length, 4);
    assert.equal((main.match(/<li>/g) || []).length, 7);
    assert.match(main, /<h2 id="about-support-title">Keep Dadbot free<\/h2>/);
    assert.ok(!main.includes('about-command-stream'), 'obsolete terminal windows are not rendered');
  } finally {
    rmSync(destination, { recursive: true, force: true });
  }
});

test('About keeps all frontmatter-driven copy and does not introduce navigation or storage behaviour', () => {
  const tpl = read('layouts/_default/about.html');
  for (const field of ['.Title', '.Params.hero.subheadline', '.Params.hero.headline', '.Params.mission', '.Params.values', '.Params.desks', '.Params.principles', '.Params.support']) {
    assert.ok(tpl.includes(field), `${field} remains frontmatter-driven`);
  }
  assert.ok(!/<script|localStorage|sessionStorage|<button|<a\b/.test(tpl));
  const content = read('content/about.md');
  for (const name of ['News', 'Blog', 'Book Reviews', 'Conspiracy Corner']) {
    assert.ok(content.includes(`name: "${name}"`), `desk ${name} present`);
  }
  assert.ok(!content.includes('closing:'));
  assert.ok(content.includes('Written with dads in mind, but open to everyone.'));
});
