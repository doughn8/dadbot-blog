import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const projectRoot = new URL('../../', import.meta.url);

async function readProjectFile(path) {
  return readFile(new URL(path, projectRoot), 'utf8');
}

function commandStreamStyles(styles) {
  const start = styles.indexOf('ABOUT PAGE - Command Stream');
  assert.notEqual(start, -1, 'expected the Command Stream stylesheet block');
  return styles.slice(start);
}

function cssRules(styles) {
  return [...styles.matchAll(/([^{}]+)\{([^{}]*)\}/g)]
    .map(([, selector, declarations]) => ({ selector: selector.trim(), declarations }));
}

test('About Command Stream preserves the approved hero copy and all existing content groups from frontmatter', async () => {
  const template = await readProjectFile('layouts/_default/about.html');

  assert.match(template, /<main[^>]+class="about-page about-command-stream"[^>]+aria-labelledby="about-title"/);
  assert.match(template, /\.Params\.hero\.headline/);
  assert.match(template, /\.Params\.hero\.subheadline/);
  assert.doesNotMatch(template, /about-command-stream__prompt/);
  assert.doesNotMatch(template, /\.Params\.hero\.kicker/);
  assert.doesNotMatch(template, /\.Params\.hero\.status/);
  assert.doesNotMatch(template, />\s*cat about-dadbot\.txt/);
  assert.match(template, /{{ with \.Params\.mission }}/);
  assert.match(template, /{{ with \.Params\.values }}/);
  assert.match(template, /{{ with \.Params\.desks }}/);
  assert.match(template, /{{ with \.Params\.principles }}/);
  assert.match(template, /{{ with \.Params\.closing }}/);
  assert.match(template, /{{ with \.Params\.support }}/);
  assert.match(template, /<h1[^>]+id="about-title"[^>]*>{{ \.Params\.hero\.headline }}<\/h1>/);
  assert.match(template, /<h2 id="about-mission-title">{{ \.title }}<\/h2>/);
  assert.match(template, /<h2 id="about-values-title">Core values<\/h2>/);
  assert.match(template, /<h2 id="about-desks-title">What Dadbot covers<\/h2>/);
  assert.match(template, /<h2 id="about-principles-title">Operating principles<\/h2>/);
});

test('About Command Stream keeps semantic sections and descriptive labels', async () => {
  const template = await readProjectFile('layouts/_default/about.html');

  assert.match(template, /<section class="about-command-stream__hero" aria-labelledby="about-title">/);
  assert.doesNotMatch(template, /<hr class="about-command-stream__rule">/);
  assert.match(template, /<section class="about-command-stream__section about-command-stream__mission" aria-labelledby="about-mission-title">/);
  assert.match(template, /<section class="about-command-stream__section" aria-labelledby="about-values-title">/);
  assert.match(template, /<article class="about-command-stream__value">/);
  assert.match(template, /<section class="about-command-stream__section" aria-labelledby="about-desks-title">/);
  assert.match(template, /<section class="about-command-stream__section about-command-stream__principles" aria-labelledby="about-principles-title">/);
  assert.match(template, /<section class="about-command-stream__closing" aria-labelledby="about-closing-title">/);
  assert.match(template, /<section class="about-command-stream__closing about-command-stream__support" aria-labelledby="about-support-title">/);
});

test('About Command Stream removes CSS-generated heading prompts', async () => {
  const styles = await readProjectFile('static/style.css');
  const aboutRules = cssRules(commandStreamStyles(styles));
  const generatedAboutContent = aboutRules.filter(({ selector, declarations }) =>
    selector.includes('.about-command-stream') &&
    /::?(?:before|after)\b/.test(selector) &&
    /\bcontent\s*:\s*(?!none\s*;)[^;]+;/.test(declarations),
  );

  assert.deepEqual(
    generatedAboutContent,
    [],
    'About pseudo-selectors must not generate prompt or other visible content',
  );
});

test('About Command Stream styles are green, unboxed, scoped and responsive', async () => {
  const styles = await readProjectFile('static/style.css');
  const aboutStyles = commandStreamStyles(styles);
  const aboutRules = cssRules(aboutStyles);
  const boxedAboutRegions = aboutRules.filter(({ selector, declarations }) =>
    selector.includes('.about-command-stream') &&
    /(?:\bsection\b|\barticle\b|__hero\b|__section\b|__value\b|__desk\b|__closing\b|__support\b|__principles\b)/.test(selector) &&
    /\b(?:border(?:-(?:top|right|bottom|left))?|background(?:-(?:color|image))?)\s*:\s*(?!none\s*;|transparent\s*;)[^;]+;/.test(declarations),
  );

  assert.match(aboutStyles, /\.about-command-stream\s*\{[^}]*max-width:\s*1080px;[^}]*margin:\s*0 auto 5rem;/);
  assert.doesNotMatch(aboutStyles, /var\(--foreground\)/, 'About must use the theme --color token or inherited color');
  assert.deepEqual(boxedAboutRegions, [], 'About sections and articles must remain transparent and borderless');
  assert.doesNotMatch(aboutStyles, /\.about-command-stream__rule\s*\{/);
  assert.match(aboutStyles, /\.about-command-stream__section h2,[\s\S]*?\.about-command-stream__closing h2\s*\{[^}]*color:\s*var\(--accent\);/);
  assert.match(aboutStyles, /\.about-command-stream__value h3,[\s\S]*?\.about-command-stream__desk h3\s*\{[^}]*color:\s*var\(--accent\);/);
  assert.doesNotMatch(aboutStyles, /#f6a21a|orange/i);
  assert.match(aboutStyles, /\.about-command-stream__values,[\s\S]*?\.about-command-stream__desks\s*\{[^}]*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\);/);
  assert.match(aboutStyles, /@media \(max-width: 600px\)[\s\S]*?\.about-command-stream__values,[\s\S]*?\.about-command-stream__desks\s*\{[^}]*grid-template-columns:\s*minmax\(0, 1fr\);/);
});
