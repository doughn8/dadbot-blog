import test, {before, after} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync, readFileSync, readdirSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join, relative} from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';

const root = fileURLToPath(new URL('../../', import.meta.url));
let dir;
let pages;
const metadata = html => Object.fromEntries(
  [...html.matchAll(/<meta\b[^>]*>/g)].map(([tag]) => {
    const attrs = Object.fromEntries([...tag.matchAll(/([\w:-]+)="([^"]*)"/g)].map(([, key, value]) => [key, value]));
    return [attrs.property || attrs.name, attrs.content];
  })
);

before(() => {
  dir = mkdtempSync(join(tmpdir(), 'dadbot-sharing-'));
  execFileSync('hugo', ['--source', root, '--destination', join(dir, 'public'), '--cacheDir', join(dir, 'cache'), '--baseURL', 'https://dadbot.blog/'], {stdio: 'pipe', timeout: 120000});
  pages = [];
  const walk = path => {
    for (const entry of readdirSync(path, {withFileTypes: true})) {
      const file = join(path, entry.name);
      if (entry.isDirectory()) walk(file);
      else if (entry.name.endsWith('.html')) pages.push({path: relative(join(dir, 'public'), file), meta: metadata(readFileSync(file, 'utf8'))});
    }
  };
  walk(join(dir, 'public'));
});
after(() => { if (dir) rmSync(dir, {recursive: true, force: true}); });

test('default sharing image exists and declares its real PNG dimensions on every fallback page', () => {
  const imagePath = 'images/dadbot-homepage-image.png';
  const png = readFileSync(join(root, 'static', imagePath));
  assert.equal(png.subarray(1, 4).toString(), 'PNG');
  const width = String(png.readUInt32BE(16));
  const height = String(png.readUInt32BE(20));
  const fallbackPages = pages.filter(page => page.meta['og:type'] && !/^(news|posts|conspiracy-corner)\//.test(page.path) && !/^books\/[^/]+\//.test(page.path));
  assert.ok(fallbackPages.some(page => page.path === 'index.html'));
  for (const {path, meta} of fallbackPages) {
    assert.equal(meta['og:image'], `https://dadbot.blog/${imagePath}`, path);
    assert.equal(meta['og:image:width'], width, path);
    assert.equal(meta['og:image:height'], height, path);
  }
  assert.deepEqual(readFileSync(join(dir, 'public', imagePath)), png);
});

test('News, Blog and Conspiracy still emit no sharing images or image dimensions', () => {
  for (const desk of ['news', 'posts', 'conspiracy-corner']) {
    const articles = pages.filter(page => page.path.startsWith(`${desk}/`));
    assert.ok(articles.length > 1, desk);
    for (const {path, meta} of articles) {
      for (const key of ['og:image', 'og:image:width', 'og:image:height']) assert.equal(meta[key], undefined, `${path}: ${key}`);
    }
  }
});

const hostedReviewPath = 'books/fahrenheit-451-book-review/index.html';
const hostedReviewCover = 'https://covers.openlibrary.org/b/olid/OL53780160M-L.jpg?default=false';

test('Fahrenheit 451 uses the exact hosted jacket and discloses the image request', () => {
  const review = pages.find(page => page.path === hostedReviewPath);
  assert.ok(review);
  assert.equal(review.meta['og:image'], hostedReviewCover);
  const legal = readFileSync(join(root, 'content', 'legal.md'), 'utf8');
  assert.match(legal, /covers\.openlibrary\.org/);
});

test('Book reviews keep their sourced covers rather than the site fallback', () => {
  const books = pages.filter(page => /^books\/[^/]+\/index.html$/.test(page.path) && page.meta['og:type'] === 'article');
  assert.ok(books.length > 0);
  for (const {path, meta} of books) {
    assert.equal(meta['og:image:width'], undefined, `${path}: do not guess cover width`);
    assert.equal(meta['og:image:height'], undefined, `${path}: do not guess cover height`);
    if (path === hostedReviewPath) continue; // Exact hosted URL is checked above.
    assert.match(meta['og:image'], /^https:\/\/dadbot\.blog\/images\/books\//, path);
    const imagePath = new URL(meta['og:image']).pathname.slice(1);
    assert.deepEqual(readFileSync(join(dir, 'public', imagePath)), readFileSync(join(root, 'static', imagePath)), path);
  }
});
