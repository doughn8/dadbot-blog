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

const standardArticleCards = String.raw`\.post-card:not\(\.book-card\)`;
const listArticleCards = String.raw`\.posts-list-view\s+\.post-card:not\(\.book-card\)`;

test('standard article cards use the approved fixed desktop height without targeting Books', async () => {
  const styles = await readStyles();
  const desktop = compactCss(styles.slice(0, styles.indexOf('@media (max-width: 900px)')));

  assert.match(
    desktop,
    new RegExp(`${standardArticleCards}\\s*\\{[^}]*display:\\s*flex\\s*!important;[^}]*height:\\s*260px;`),
  );
  assert.doesNotMatch(
    desktop,
    /(?:^|})\s*\.post-card\s*\{[^}]*height:\s*260px;/,
    'The fixed article-card height must not apply to Book cards',
  );
});

test('tablet keeps uniform article cards and a tighter list-page variant', async () => {
  const tablet = compactCss(extractMediaBlock(await readStyles(), '(max-width: 900px)'));

  assert.match(tablet, new RegExp(`${standardArticleCards}\\s*\\{[^}]*height:\\s*240px;`));
  assert.match(tablet, new RegExp(`${listArticleCards}\\s*\\{[^}]*height:\\s*190px;`));
});

test('mobile list cards can grow so long content does not clip tag footers', async () => {
  const phone = compactCss(extractMediaBlock(await readStyles(), '(max-width: 600px)'));

  assert.match(phone, new RegExp(`${standardArticleCards}\\s*\\{[^}]*height:\\s*220px;`));
  assert.match(
    phone,
    new RegExp(`${listArticleCards}\\s*\\{[^}]*height:\\s*auto;[^}]*min-height:\\s*180px;`),
  );
});

test('homepage shows two teaser cards below desktop and one column on phones', async () => {
  const styles = await readStyles();
  const tablet = compactCss(extractMediaBlock(styles, '(max-width: 900px)'));
  const phone = compactCss(extractMediaBlock(styles, '(max-width: 600px)'));

  assert.match(
    tablet,
    /\.content\s*>\s*\.latest-news\.recent-posts\s+\.post-card-link:nth-child\(3\),\s*\.content\s*>\s*\.blog-teaser\s+\.post-card-link:nth-child\(3\)\s*\{[^}]*display:\s*none;/,
  );
  assert.match(
    phone,
    /\.content\s*>\s*\.latest-news\.recent-posts\s+\.posts-grid,\s*\.content\s*>\s*\.blog-teaser\s+\.posts-grid\s*\{[^}]*grid-template-columns:\s*minmax\(0, 1fr\);/,
  );
});

test('responsive Book cards retain content-driven heights outside generic article rules', async () => {
  const styles = await readStyles();
  const tablet = compactCss(extractMediaBlock(styles, '(max-width: 900px)'));
  const phone = compactCss(extractMediaBlock(styles, '(max-width: 600px)'));

  assert.match(
    tablet,
    /\.content\s*>\s*\.books-teaser\s+\.book-card--responsive,\s*\.books-section\s+\.book-card--responsive\s*\{[^}]*height:\s*auto;[^}]*aspect-ratio:\s*auto;/,
  );
  assert.match(
    phone,
    /\.content\s*>\s*\.books-teaser\s+\.book-card--responsive,\s*\.books-section\s+\.book-card--responsive\s*\{[^}]*height:\s*auto;/,
  );
});
