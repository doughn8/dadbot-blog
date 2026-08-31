import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../../', import.meta.url);
const readProjectFile = (path) => readFile(new URL(path, root), 'utf8');

test('Games content defines the Token Wars section route metadata', async () => {
  const content = await readProjectFile('content/games/_index.md');

  assert.match(content, /^---[\s\S]*title:\s*["']Token Wars["']/m);
  assert.match(content, /description:/);
});

test('page shell exposes all mocked game views and core status information', async () => {
  const layout = await readProjectFile('layouts/games/list.html');

  assert.match(layout, /<main[^>]+class="[^"]*token-wars/);
  assert.equal((layout.match(/<h1\b/g) ?? []).length, 1);
  for (const view of ['setup', 'market', 'encounter', 'ending', 'loss']) {
    assert.match(layout, new RegExp(`data-tw-view="${view}"`));
  }
  for (const field of ['day', 'region', 'health', 'cash', 'savings', 'debt', 'pressure']) {
    assert.match(layout, new RegExp(`data-tw-field="${field}"`));
  }
  assert.match(layout, /aria-live="polite"/);
  assert.match(layout, /JavaScript is required/i);
});

test('setup, market, lender, encounter, success and loss controls have accessible native markup', async () => {
  const layout = await readProjectFile('layouts/games/list.html');

  for (const days of [30, 60, 90]) {
    assert.match(layout, new RegExp(`value="${days}"`));
  }
  for (const action of ['Start Token Wars', 'Buy', 'Sell', 'Fight', 'Pay', 'Flee', 'Repay Debt', 'Play Again']) {
    assert.match(layout, new RegExp(`>${action}<`));
  }
  assert.match(layout, /data-tw-dialog="bank"/);
  assert.match(layout, /data-tw-dialog="debt"/);
  assert.match(layout, /data-tw-service-control="bank"/);
  assert.match(layout, /data-tw-service-control="lender"/);
  assert.match(layout, /CRED-I\/O Recovery Systems/);
  assert.match(layout, /data-tw-trade-quantity[^>]+aria-label="Quantity of LLaMAs"/);
  assert.match(layout, /<input[^>]+inputmode="numeric"/);
  assert.match(layout, /class="tw-price"[^>]*role="cell"><span class="tw-mobile-label">Price<\/span>/);

  const tokenIds = [...layout.matchAll(/\(dict "id" "([^"]+)" "name"/g)].map((match) => match[1]);
  assert.equal(tokenIds.length, 10);
  assert.equal(new Set(tokenIds).size, 10);
});

test('approved Field Manual intro keeps setup concise, accessible, and responsive', async () => {
  const [layout, css] = await Promise.all([
    readProjectFile('layouts/games/list.html'),
    readProjectFile('static/games/token-wars/token-wars.css'),
  ]);

  const setup = layout.match(/<section class="tw-screen tw-screen--setup"[\s\S]*?(?=<section class="tw-screen tw-screen--market")/)?.[0] ?? '';
  const setupMobileCss = css.match(/@media \(max-width: 700px\) \{([\s\S]*?)(?=\n@media \(max-width: 600px\))/)?.[1] ?? '';
  assert.match(setup, /<h1[^>]*id="token-wars-title"[^>]*>Token Wars<\/h1>/);
  assert.match(setup, /class="tw-setup-grid"/);
  assert.match(setup, /class="tw-field-manual"/);
  assert.match(setup, /class="tw-launch-config"/);
  assert.equal((setup.match(/class="tw-manual-step"/g) ?? []).length, 4);
  assert.match(setup, /No account\. Reload to reset\./);
  assert.match(setup, /<fieldset class="tw-run-picker">[\s\S]*?<legend>Run length<\/legend>/);
  assert.match(setup, /value="60" checked/);
  assert.match(setup, /data-tw-action="start">Start Token Wars<\/button>/);
  assert.doesNotMatch(setup, /tw-instructions/);
  assert.doesNotMatch(css, /\.token-wars\s+\.tw-screen--setup\s*\{[^}]*linear-gradient/);
  assert.ok(layout.includes('?v={{ md5 (readFile "static/games/token-wars/token-wars.css") }}'), 'game stylesheet must be content-hashed after CSS edits');

  assert.match(css, /\.token-wars\s+\.tw-setup-grid\s*\{[^}]*display:\s*grid[^}]*grid-template-columns:\s*minmax\(0,\s*1\.15fr\)\s+minmax\(300px,\s*\.85fr\)/);
  assert.match(setupMobileCss, /\.token-wars\s+\.tw-setup-grid\s*\{[^}]*grid-template-columns:\s*1fr/);
  assert.match(setupMobileCss, /\.token-wars\s+\.tw-screen--setup\s+\.tw-button--primary\s*\{[^}]*width:\s*100%/);
  assert.match(css, /\.token-wars\s+\.tw-manual-step::before\s*\{[^}]*content:\s*none/, 'theme list counters must not duplicate the manual step numbers');
});

test('approved setup styling reuses the Dadbot container, type, and colour system', async () => {
  const css = await readProjectFile('static/games/token-wars/token-wars.css');
  const setupMobileCss = css.match(/@media \(max-width: 700px\) \{([\s\S]*?)(?=\n@media \(max-width: 600px\))/)?.[1] ?? '';

  assert.match(css, /\.token-wars\s+\.tw-screen--setup\s*\{[^}]*box-shadow:\s*none/);
  assert.match(css, /\.token-wars\s+\.tw-screen--setup\s*\{[^}]*background:\s*color-mix\(in srgb,\s*var\(--tw-green\) 4%,\s*var\(--tw-bg\) 96%\)/);
  assert.match(css, /\.token-wars\s+\.tw-field-manual,[\s\S]*?\.tw-launch-config\s*\{[^}]*padding:\s*1\.25rem[^}]*border:\s*1px solid color-mix\(in srgb,\s*var\(--tw-green\) 75%,\s*transparent\)/);
  assert.match(css, /\.token-wars\s+\.tw-setup-panel-heading h2\s*\{[^}]*font-size:\s*1\.125rem/);
  assert.match(css, /\.token-wars\s+\.tw-tagline\s*\{[^}]*color:\s*#f8f8f2[^}]*font-size:\s*\.95rem[^}]*line-height:\s*1\.6/);
  assert.match(css, /\.token-wars\s+\.tw-manual-step strong\s*\{[^}]*color:\s*#f8f8f2[^}]*font-size:\s*\.95rem/);
  assert.match(css, /\.token-wars\s+\.tw-manual-step small\s*\{[^}]*color:\s*#c8d4cc[^}]*font-size:\s*\.8rem/);
  assert.match(css, /\.token-wars\s+\.tw-screen--setup \.tw-button--primary\s*\{[^}]*background:\s*transparent[^}]*color:\s*var\(--tw-green\)/);
  assert.match(setupMobileCss, /\.token-wars\s+\.tw-field-manual,[\s\S]*?\.token-wars\s+\.tw-launch-config\s*\{[^}]*padding:\s*1rem/);
});

test('one responsive travel grid provides the six named destinations', async () => {
  const layout = await readProjectFile('layouts/games/list.html');
  const regions = new Map([
    ['north-america', 'North America'],
    ['south-america', 'South America'],
    ['europe', 'Europe'],
    ['africa', 'Africa'],
    ['asia', 'Asia'],
    ['oceania', 'Oceania'],
  ]);

  for (const [id, region] of regions) {
    assert.match(layout, new RegExp(`data-region-id="${id}">${region}<`));
  }
  assert.match(layout, /data-tw-action="travel"/);
  assert.match(layout, /data-region-id="europe"/);
});

test('regional account shortcuts disable Bank and Debt outside their service regions', async () => {
  const layout = await readProjectFile('layouts/games/list.html');

  assert.match(layout, /class="tw-status-item"[^>]*><small>Cash<\/small>/);
  assert.match(layout, /<button[^>]+data-dialog="bank"[^>]+data-tw-service-control="bank"[^>]*><small>Bank<\/small>/);
  assert.match(layout, /<button[^>]+data-dialog="debt"[^>]+data-tw-service-control="lender"[^>]*><small>Debt<\/small>/);
  assert.doesNotMatch(layout, /data-dialog="bank"[^>]*><small>Cash<\/small>/);
});

test('market omits the visible Action Result bar but keeps accessible and dialog-local feedback', async () => {
  const layout = await readProjectFile('layouts/games/list.html');

  assert.doesNotMatch(layout, /class="tw-feedback"/);
  assert.match(layout, /class="tw-visually-hidden"[^>]+data-tw-action-feed/);
  assert.equal((layout.match(/data-tw-dialog-feedback/g) ?? []).length, 3);
  assert.equal((layout.match(/data-tw-dialog-feedback hidden/g) ?? []).length, 3);
});

test('popup dashboard keeps travel above the market and moves transactions into native dialogs', async () => {
  const layout = await readProjectFile('layouts/games/list.html');

  for (const dialog of ['trade', 'bank', 'debt', 'health']) {
    assert.match(layout, new RegExp(`<dialog[^>]+data-tw-dialog="${dialog}"`));
  }
  for (const dialog of ['bank', 'debt', 'health']) {
    assert.match(layout, new RegExp(`data-tw-action="open-dialog"[^>]+data-dialog="${dialog}"`));
  }
  assert.match(layout, /data-tw-action="select-token"[^>]+data-dialog="trade"/);
  assert.match(layout, /data-tw-action="close-dialog"/);
  assert.ok(
    layout.indexOf('data-tw-travel-controls') < layout.indexOf('class="tw-market-table"'),
    'travel controls should appear before the token market',
  );
  assert.doesNotMatch(layout, /data-tw-trade-tray/);
  assert.doesNotMatch(layout, /class="tw-side-stack"/);
  assert.doesNotMatch(layout, /class="tw-map"/);
});

test('approved mobile run uses a full-screen 2x5 market with whole-tile Trade targets', async () => {
  const [layout, css] = await Promise.all([
    readProjectFile('layouts/games/list.html'),
    readProjectFile('static/games/token-wars/token-wars.css'),
  ]);

  assert.equal((layout.match(/\(dict "id"/g) ?? []).length, 10);
  assert.match(layout, /class="tw-exit-run"[^>]+data-tw-action="play-again"/);
  assert.match(layout, /class="tw-button tw-button--small tw-row-select"[^>]+aria-label="Trade \{\{ \.name \}\}"/);
  assert.match(css, /@media\s*\(max-width:\s*600px\)[\s\S]*\.token-wars\[data-tw-current-view\]:not\(\[data-tw-current-view="setup"\]\)[^{]*\{[^}]*position:\s*fixed[^}]*height:\s*100dvh[^}]*overflow:\s*hidden/);
  assert.match(css, /@media\s*\(max-width:\s*600px\)[\s\S]*\.tw-market-table\s*\{[^}]*display:\s*grid[^}]*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)[^}]*grid-template-rows:\s*repeat\(5,\s*minmax\(44px,\s*64px\)\)/);
  assert.match(css, /@media\s*\(max-width:\s*600px\)[\s\S]*\.tw-row-select\s*\{[^}]*position:\s*absolute[^}]*inset:\s*0/);
  assert.match(css, /@media\s*\(max-height:\s*560px\)[\s\S]*overflow:\s*auto/);
});

test('desktop Games stays inside the normal Dadbot content column', async () => {
  const css = await readProjectFile('static/games/token-wars/token-wars.css');

  assert.match(css, /@media\s*\(min-width:\s*901px\)[\s\S]*?\.token-wars\s*\{[^}]*width:\s*100%[^}]*max-width:\s*100%[^}]*margin-inline:\s*0[^}]*transform:\s*none/);
  assert.doesNotMatch(css, /@media\s*\(min-width:\s*901px\)[\s\S]*?margin-left:\s*50%[\s\S]*?translateX\(-50%\)/);
});

test('Option A keeps mobile token rows slim and hides price guidance only on the tiles', async () => {
  const [layout, css] = await Promise.all([
    readProjectFile('layouts/games/list.html'),
    readProjectFile('static/games/token-wars/token-wars.css'),
  ]);

  assert.match(layout, /class="tw-price-signal"[^>]+data-tw-selected-field="signal"/);
  assert.match(css, /@media\s*\(max-width:\s*600px\)[\s\S]*\.tw-market-row\s+\.tw-price-signal\s*\{[^}]*display:\s*none/);
  assert.match(css, /@media\s*\(max-width:\s*600px\)[\s\S]*\.tw-market-table\s*\{[^}]*grid-template-rows:\s*repeat\(5,\s*minmax\(44px,\s*64px\)\)[^}]*align-content:\s*start/);
  assert.match(css, /@media\s*\(max-width:\s*600px\)[\s\S]*\.tw-screen--market\s*>\s*\.tw-screen-body\s*\{[^}]*grid-template-areas:\s*"travel"\s*"status"\s*"workspace"\s*"news"\s*"spacer"[^}]*grid-template-rows:\s*auto\s+auto\s+auto\s+auto\s+1fr/);
  assert.doesNotMatch(css, /\.tw-dialog[^\{]*\.tw-price-signal\s*\{[^}]*display:\s*none/);
});

test('game stylesheet is loaded and contains scoped responsive and accessibility safeguards', async () => {
  const [layout, css] = await Promise.all([
    readProjectFile('layouts/games/list.html'),
    readProjectFile('static/games/token-wars/token-wars.css'),
  ]);

  assert.match(layout, /games\/token-wars\/token-wars\.css/);
  assert.match(css, /\.token-wars\s*\{/);
  assert.match(css, /\.token-wars[^\{]*:focus-visible/);
  assert.match(css, /min-height:\s*44px/);
  assert.match(css, /@media\s*\(max-width:\s*900px\)/);
  assert.match(css, /@media\s*\(min-width:\s*901px\)/);
  assert.match(css, /@media\s*\(min-width:\s*901px\)[\s\S]*?\.token-wars\s*\{[^}]*width:\s*100%[^}]*max-width:\s*100%/);
  assert.match(css, /@media\s*\(max-width:\s*900px\)[\s\S]*width:\s*calc\(100vw\s*-\s*1rem\)[\s\S]*margin-left:\s*calc\(50%\s*-\s*50vw\s*\+\s*\.5rem\)/);
  assert.match(css, /@media\s*\(max-width:\s*900px\)[\s\S]*\.tw-market-head[^\{]*\.tw-market-row\s*\{[^}]*grid-template-columns:[^}]*74px/);
  assert.match(css, /@media\s*\(max-width:\s*600px\)[\s\S]*\.tw-dialog\s*\{[^}]*margin:\s*auto 0 0/);
  assert.doesNotMatch(css, /\.token-wars\s+\.tw-market-head\s*\{\s*display:\s*none/);
  assert.match(css, /@media\s*\(max-width:\s*600px\)/);
  assert.match(css, /@media\s*\(prefers-reduced-motion:\s*reduce\)/);
  assert.match(css, /@keyframes\s+tw-screen-in/);
  assert.match(css, /\.token-wars\s+\.tw-screen:not\(\[hidden\]\)[^{]*\{[^}]*animation:\s*tw-screen-in/s);
  assert.match(css, /prefers-reduced-motion:\s*reduce[\s\S]*animation:\s*none/);
  assert.match(css, /\.token-wars\s+\.tw-screen--setup\s+\.tw-button--primary/);
  assert.match(css, /\.token-wars\s+\.tw-news\[data-event-kind="bonus"\]/);
  assert.match(css, /\.token-wars\s+\.tw-news\[data-event-kind="mishap"\]/);
  assert.match(css, /overflow-wrap:\s*anywhere/);
  assert.match(css, /\.token-wars\s+\.tw-ending-body\s+\.tw-button--primary/);
  assert.match(css, /\.token-wars\s+\.tw-price-signal\[data-price-signal="low"\]/);
  assert.match(css, /\.token-wars\s+\.tw-price-signal\[data-price-signal="high"\]/);
});

test('Phase 3 exposes one browser entry point and declarative game hooks', async () => {
  const layout = await readProjectFile('layouts/games/list.html');

  assert.match(layout, /<main[^>]+data-tw-game/);
  assert.match(layout, /<script[^>]+type="module"[^>]+games\/token-wars\/js\/main\.mjs[^>]+\?v=8/);
  assert.match(layout, /class="tw-news"[^>]+data-tw-event-feed/);
  assert.match(layout, /data-tw-field="news"/);
  assert.match(layout, /data-tw-action-feed/);
  assert.match(layout, /data-tw-dialog="trade"/);
  assert.match(layout, /data-tw-action="select-token"/);
  assert.match(layout, /data-tw-selected-field="name"/);
  assert.match(layout, /data-tw-token-field="signal"/);
  assert.match(layout, /LOW = buy/);
  for (const field of ['day', 'region', 'health', 'cash', 'savings', 'debt', 'pressure', 'capacity', 'message']) {
    assert.match(layout, new RegExp(`data-tw-field="${field}"`));
  }
  for (const action of ['start', 'max-buy', 'max-sell', 'buy', 'sell', 'deposit', 'withdraw', 'repay', 'travel', 'encounter', 'continue-outcome', 'play-again']) {
    assert.match(layout, new RegExp(`data-tw-action="${action}"`));
  }
  assert.doesNotMatch(layout, /data-tw-action="max"/);
  assert.match(layout, />Max Buy<\/button>/);
  assert.match(layout, />Max Sell<\/button>/);
  for (const headingId of ['tw-market-title', 'tw-outcome-title', 'tw-ending-title', 'tw-loss-title']) {
    assert.match(layout, new RegExp(`<h2[^>]+id="${headingId}"[^>]+tabindex="-1"`));
  }
});

test('every page-facing selector stays rooted under Token Wars', async () => {
  const css = (await readProjectFile('static/games/token-wars/token-wars.css'))
    .replace(/\/\*[\s\S]*?\*\//g, '');
  const selectors = [];
  const splitSelectorList = (header) => {
    const parts = [];
    let depth = 0;
    let start = 0;
    for (let index = 0; index < header.length; index += 1) {
      if (header[index] === '(') depth += 1;
      if (header[index] === ')') depth -= 1;
      if (header[index] === ',' && depth === 0) {
        parts.push(header.slice(start, index).trim());
        start = index + 1;
      }
    }
    parts.push(header.slice(start).trim());
    return parts;
  };

  const walkRules = (start, end) => {
    let cursor = start;
    while (cursor < end) {
      while (/\s/.test(css[cursor] ?? '')) cursor += 1;
      if (cursor >= end) break;
      const open = css.indexOf('{', cursor);
      if (open === -1 || open >= end) break;
      const header = css.slice(cursor, open).trim();
      let depth = 1;
      let close = open + 1;
      while (close < end && depth > 0) {
        if (css[close] === '{') depth += 1;
        if (css[close] === '}') depth -= 1;
        close += 1;
      }
      assert.equal(depth, 0, `Unbalanced CSS block: ${header}`);
      if (header.startsWith('@media')) {
        walkRules(open + 1, close - 1);
      } else if (!header.startsWith('@')) {
        selectors.push(...splitSelectorList(header));
      }
      cursor = close;
    }
  };

  walkRules(0, css.length);
  assert.ok(selectors.length > 0);
  for (const selector of selectors) {
    assert.match(selector, /^\.token-wars(?:\b|\s|:|\[|\.)/, `Unscoped selector: ${selector}`);
  }
});
