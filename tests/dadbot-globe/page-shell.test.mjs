import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const projectRoot = new URL('../../', import.meta.url);

async function readProjectFile(path) {
  return readFile(new URL(path, projectRoot), 'utf8');
}

test('homepage hero uses the Terminal theme Fira Code stack throughout', async () => {
  const [styles, engine] = await Promise.all([
    readProjectFile('static/style.css'),
    readProjectFile('static/js/dadbot-globe.mjs'),
  ]);
  const terminalFontStack = /'Fira Code', Monaco, Consolas, Ubuntu Mono, monospace/;

  assert.match(styles, new RegExp(`\\.dadbot-hero\\s*\\{[^}]*font-family:\\s*${terminalFontStack.source};`));
  assert.match(engine, /context\.font = `\$\{Math\.max\(6, cell \* 1\.08\)\}px 'Fira Code', Monaco, Consolas, 'Ubuntu Mono', monospace`;/);
});

test('homepage exposes a concise accessible introduction beside the globe', async () => {
  const homepage = await readProjectFile('layouts/index.html');

  assert.match(homepage, /<section[^>]+class="welcome-section"[^>]+aria-labelledby="dadbot-hero-title"/);
  assert.match(homepage, /<div[^>]+class="dadbot-hero-intro"/);
  assert.match(homepage, /<h1[^>]+id="dadbot-hero-title"[^>]*><span[^>]+aria-hidden="true"[^>]*>&gt;<\/span> WELCOME TO DADBOT_<\/h1>/);
  assert.match(homepage, /Curiosity without the clickbait\. Facts without the fuss\. Free to read\. No ads\./);
  assert.match(homepage, /<p[^>]+class="dadbot-hero-action"[^>]*><span[^>]+aria-hidden="true"[^>]*>&gt;<\/span> DRAG TO SPIN_<\/p>/);
  assert.equal((homepage.match(/WELCOME TO DADBOT_/g) ?? []).length, 1);
  assert.match(homepage, /<canvas[^>]+id="dadbot-globe"[^>]+tabindex="0"[^>]+aria-label="[^"]+"[^>]*>/);
  assert.doesNotMatch(homepage, /Scanning the World|Filtering the Noise/);
});

test('homepage provides a text-free static ASCII Earth fallback', async () => {
  const homepage = await readProjectFile('layouts/index.html');

  assert.match(homepage, /<pre[^>]+class="dadbot-globe-fallback"[^>]+aria-hidden="true"/);
  assert.doesNotMatch(homepage, /ASCII EARTH|Interactive globe controls require JavaScript|<noscript>/);
});

test('homepage omits status and instruction chrome', async () => {
  const homepage = await readProjectFile('layouts/index.html');

  assert.doesNotMatch(homepage, /dadbot-globe-status|data-dadbot-globe-signal/);
  assert.doesNotMatch(homepage, /SIGNAL ACQUIRED|DRAG \/ SWIPE TO ROTATE|Mouse, touch or pen/);
});

test('hero provides a non-interactive terminal continuation divider', async () => {
  const homepage = await readProjectFile('layouts/index.html');
  const styles = await readProjectFile('static/style.css');

  assert.match(homepage, /<div[^>]+class="dadbot-content-cue"[^>]+aria-hidden="true"/);
  assert.match(homepage, /<span[^>]+class="dadbot-content-cue-arrow"[^>]+aria-hidden="true"[^>]*>↓<\/span>/);
  assert.match(homepage, /<span[^>]+class="dadbot-content-cue-label"[^>]*>CONTINUE BELOW_<\/span>/);
  assert.doesNotMatch(homepage, /<a[^>]+class="dadbot-content-cue"/);
  assert.doesNotMatch(homepage, /class="dadbot-content-cue"[^>]+(?:href|tabindex|role=)/);
  assert.match(homepage, /id="homepage-content"/);
  assert.match(styles, /\.dadbot-content-cue::before,[\s\S]*?\.dadbot-content-cue::after/);
  assert.match(styles, /\.dadbot-content-cue\s*\{[^}]*min-height:\s*44px;/);
  assert.match(styles, /\.dadbot-content-cue-arrow\s*\{[^}]*animation:\s*dadbot-content-cue-pulse/);
  assert.doesNotMatch(styles, /\.dadbot-content-cue:(?:hover|focus-visible)/);
  assert.match(styles, /@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]*?\.dadbot-content-cue-arrow\s*\{[^}]*animation:\s*none;/);
});

test('stacked phone and portrait-tablet heroes keep text close to the globe', async () => {
  const styles = await readProjectFile('static/style.css');

  assert.match(styles, /\.dadbot-hero\s*\{[^}]*column-gap:\s*clamp\(0\.25rem, 1\.5vw, 1rem\);[^}]*row-gap:\s*clamp\(0\.25rem, 0\.75vw, 0\.5rem\);/);
  assert.match(styles, /\.dadbot-hero-intro\s*\{[^}]*padding:\s*clamp\(0\.75rem, 2vw, 1\.25rem\) 0 0;/);
  assert.match(styles, /@media\s*\(min-width:\s*1200px\)[\s\S]*?\.dadbot-hero\s*\{[^}]*row-gap:\s*clamp\(0\.25rem, 1\.5vw, 1rem\);/);
  assert.match(styles, /@media\s*\(min-width:\s*900px\)\s*and\s*\(max-width:\s*1199px\),[\s\S]*?\.dadbot-hero\s*\{[^}]*row-gap:\s*clamp\(0\.25rem, 1\.5vw, 1rem\);/);
  assert.match(styles, /\.dadbot-globe-console\s*\{[^}]*margin:\s*clamp\(-2rem, -4vw, -1rem\) auto 0;/);
  assert.match(styles, /@media\s*\(min-width:\s*1200px\)[\s\S]*?\.dadbot-globe-console\s*\{[^}]*margin-top:\s*0;/);
  assert.match(styles, /@media\s*\(min-width:\s*900px\)\s*and\s*\(max-width:\s*1199px\),[\s\S]*?\.dadbot-globe-console\s*\{[^}]*margin-top:\s*0;/);
  assert.doesNotMatch(styles, /@media\s*\(max-width:\s*480px\)[\s\S]*?\.dadbot-globe-console\s*\{[^}]*margin-top:\s*0;/);
});

test('responsive hero stays unboxed and reflows without fixed positioning', async () => {
  const styles = await readProjectFile('static/style.css');

  assert.match(styles, /\.welcome-section\s*\{[^}]*width:\s*100%;[^}]*margin-left:\s*0;[^}]*transform:\s*none;/);
  assert.doesNotMatch(styles, /\.welcome-section\s*\{[^}]*100vw/);
  assert.match(styles, /\.dadbot-hero\s*\{[^}]*display:\s*grid;[^}]*grid-template-columns:\s*minmax\(0, 1fr\);/);
  assert.match(styles, /\.dadbot-hero-intro\s*\{[^}]*border:\s*0;[^}]*background:\s*transparent;[^}]*box-shadow:\s*none;/);
  assert.match(styles, /\.dadbot-globe-console\s*\{[^}]*width:\s*min\(100%, 720px, 68vh\);/);
  assert.match(styles, /@media\s*\(min-width:\s*1200px\)[\s\S]*?\.dadbot-hero\s*\{[^}]*grid-template-columns:\s*minmax\(210px, 0\.62fr\) minmax\(0, 1\.38fr\);[^}]*padding-inline:\s*0;/);
  assert.match(styles, /@media\s*\(min-width:\s*900px\)\s*and\s*\(max-width:\s*1199px\),\s*\(min-width:\s*768px\)\s*and\s*\(max-width:\s*899px\)\s*and\s*\(max-height:\s*850px\),\s*\(min-width:\s*1200px\)\s*and\s*\(max-height:\s*799px\)[\s\S]*?\.dadbot-hero\s*\{[^}]*grid-template-columns:/);
  assert.match(styles, /\.dadbot-content-cue\s*\{[^}]*grid-column:\s*1\s*\/\s*-1;/);
  assert.doesNotMatch(styles, /\.dadbot-hero-intro\s*\{[^}]*(?:position:\s*(?:absolute|fixed)|(?:top|left|right):\s*\d)/);
});

test('obsolete typed tagline markup and footer behaviour are removed', async () => {
  const [homepage, footer] = await Promise.all([
    readProjectFile('layouts/index.html'),
    readProjectFile('layouts/partials/extended_footer.html'),
  ]);

  assert.doesNotMatch(homepage, /typed-tagline|loading-line|terminal-tagline|class="cursor"/);
  assert.doesNotMatch(footer, /typed-tagline|loading dad wisdom|function tick\(\)/);
});

test('coffee widget remains intact while old hero script is removed', async () => {
  const footer = await readProjectFile('layouts/partials/extended_footer.html');

  assert.match(footer, /href="https:\/\/buymeacoffee\.com\/dadbot"/);
  assert.match(footer, /class="coffee-button"/);
  assert.match(footer, /class="coffee-cup-svg"/);
  assert.match(footer, /<span class="coffee-text coffee-text--top">Buy me<\/span>/);
  assert.match(footer, /<span class="coffee-text coffee-text--bottom">a coffee<\/span>/);
});

test('globe shell styles are responsive, frameless and reduced-motion safe', async () => {
  const styles = await readProjectFile('static/style.css');

  assert.match(styles, /\.dadbot-hero\s*\{[^}]*border:\s*0;[^}]*background:\s*var\(--background\);[^}]*box-shadow:\s*none;/);
  assert.doesNotMatch(styles, /\.dadbot-hero::before/);
  assert.match(styles, /\.dadbot-globe-console\s*\{[^}]*border:\s*0;[^}]*background:\s*transparent;[^}]*\}/);
  assert.match(styles, /\.dadbot-globe-canvas\s*\{[^}]*background:\s*transparent;[^}]*cursor:\s*grab;[^}]*touch-action:\s*none;[^}]*\}/);
  assert.match(styles, /\.dadbot-globe-canvas:active\s*\{[^}]*cursor:\s*grabbing;/);
  assert.match(styles, /\.dadbot-globe-fallback\s*\{[^}]*background:\s*transparent;[^}]*\}/);
  assert.match(styles, /\.dadbot-globe-fallback\[hidden\]\s*\{[^}]*display:\s*none;/);
  assert.match(styles, /\.dadbot-globe-fallback\s*\{[\s\S]*?font-size:\s*clamp\([^;]+\)\s*!important;/);
  assert.match(styles, /\.dadbot-globe-canvas:focus-visible/);
  assert.match(styles, /@media\s*\(max-width:\s*480px\)[\s\S]*?\.dadbot-globe-canvas\s*\{[^}]*aspect-ratio:\s*1\s*\/\s*1;/);
});

test('homepage loads exactly one local globe module from the feature root', async () => {
  const homepage = await readProjectFile('layouts/index.html');
  const hero = homepage.match(/<section[^>]+class="welcome-section"[\s\S]*?<\/section>/)?.[0] ?? '';

  assert.match(hero, /data-dadbot-globe-root/);
  assert.match(hero, /<script type="module" src="{{ "js\/dadbot-globe\.mjs" \| relURL }}\?v=5"><\/script>/);
  assert.doesNotMatch(hero, /https?:\/\//);
});
