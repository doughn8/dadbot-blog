import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const projectRoot = new URL('../../', import.meta.url);

async function readStyles() {
  return readFile(new URL('static/style.css', projectRoot), 'utf8');
}

function extractMediaBlock(styles, condition) {
  const marker = `@media ${condition}`;
  const start = styles.indexOf(marker);
  assert.notEqual(start, -1, `Expected ${marker} to exist`);

  const openingBrace = styles.indexOf('{', start + marker.length);
  let depth = 0;

  for (let index = openingBrace; index < styles.length; index += 1) {
    if (styles[index] === '{') depth += 1;
    if (styles[index] === '}') depth -= 1;
    if (depth === 0) return styles.slice(openingBrace + 1, index);
  }

  assert.fail(`Expected ${marker} to have a closing brace`);
}

function compactCss(css) {
  return css.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\s+/g, ' ').trim();
}

const homepageCardSelectors = String.raw`\.content\s*>\s*\.latest-news\.recent-posts\s+\.post-card,\s*\.content\s*>\s*\.blog-teaser\s+\.post-card`;
const homepageSummarySelectors = String.raw`\.content\s*>\s*\.latest-news\.recent-posts\s+\.post-card-summary,\s*\.content\s*>\s*\.blog-teaser\s+\.post-card-summary`;
const homepageCtaSelectors = String.raw`\.content\s*>\s*\.latest-news\.recent-posts\s+\.post-card\s+\.read-more,\s*\.content\s*>\s*\.blog-teaser\s+\.post-card\s+\.read-more`;

test('homepage News and Blog cards use natural height through 900px', async () => {
  const tablet = compactCss(extractMediaBlock(await readStyles(), '(max-width: 900px)'));

  assert.match(
    tablet,
    new RegExp(`${homepageCardSelectors}\\s*\\{[^}]*aspect-ratio:\\s*auto;[^}]*min-height:\\s*0;[^}]*grid-template-rows:\\s*70px auto;`),
    'Expected homepage News/Blog cards to stop using the desktop 2:3 ratio through 900px',
  );
});

test('homepage News and Blog summaries do not grow through 900px', async () => {
  const tablet = compactCss(extractMediaBlock(await readStyles(), '(max-width: 900px)'));

  assert.match(
    tablet,
    new RegExp(`${homepageSummarySelectors}\\s*\\{[^}]*flex:\\s*0 0 auto;`),
    'Expected homepage News/Blog summaries to remain content-height through 900px',
  );
});

test('homepage News and Blog CTAs stay compact touch targets through 900px', async () => {
  const tablet = compactCss(extractMediaBlock(await readStyles(), '(max-width: 900px)'));

  assert.match(
    tablet,
    new RegExp(`${homepageCtaSelectors}\\s*\\{[^}]*flex:\\s*0 0 auto;[^}]*min-height:\\s*44px;`),
    'Expected homepage News/Blog CTAs to neutralise the theme growing-button rule through 900px',
  );
  assert.doesNotMatch(
    tablet,
    new RegExp(`${homepageCtaSelectors}\\s*\\{[^}]*(?:height|min-height):\\s*(?:[5-9]\\d|\\d{3,})px;`),
    'Homepage News/Blog CTAs must not acquire a fixed tall height',
  );
});

test('tablet override remains scoped to homepage News and Blog cards', async () => {
  const tablet = compactCss(extractMediaBlock(await readStyles(), '(max-width: 900px)'));

  assert.doesNotMatch(
    tablet,
    /(?:^|})\s*\.button\s*\{[^}]*(?:flex|min-height|height):/,
    'The fix must not alter every theme button',
  );
  assert.doesNotMatch(
    tablet,
    /(?:^|})\s*\.post-card\s*\{[^}]*(?:aspect-ratio|min-height|grid-template-rows):/,
    'The fix must not alter cards outside the homepage teasers',
  );
  assert.doesNotMatch(
    tablet,
    /\.latest-news[^{}]*\.(?:books-teaser|books-section|posts-list-view)|\.blog-teaser[^{}]*\.(?:books-teaser|books-section|posts-list-view)/,
    'The News/Blog override must not be grouped with Books or archive-list selectors',
  );
});

test('phone cards retain one column and desktop retains the approved 2:3 rhythm', async () => {
  const styles = await readStyles();
  const phone = compactCss(extractMediaBlock(styles, '(max-width: 600px)'));
  const desktopSource = styles.slice(0, styles.indexOf('@media (max-width: 900px)'));

  assert.match(
    phone,
    /\.content\s*>\s*\.latest-news\.recent-posts\s+\.posts-grid,\s*\.content\s*>\s*\.blog-teaser\s+\.posts-grid\s*\{[^}]*grid-template-columns:\s*minmax\(0, 1fr\);/,
  );
  assert.match(
    desktopSource,
    new RegExp(`${homepageCardSelectors}\\s*\\{[^}]*aspect-ratio:\\s*2 \\/ 3;`),
  );
});
