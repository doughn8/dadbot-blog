import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const repoRoot = fileURLToPath(new URL('../../', import.meta.url)).replace(/\/$/, '');
const read = (path) => readFile(`${repoRoot}/${path}`, 'utf8');

// Roadmap item 11: one combined Legal page (Impressum + Privacy) with a
// footer link. Contracts below are copy-contracts; the privacy claims must
// match audited reality (verified 2026-09-07 against the shipped frontend).

const OPERATOR_LINES = ['Mark Hickinson', 'grosse falterstrasse 85', '70597 stuttgart', 'Germany'];

test('legal page is publishable (no draft flag or local-draft banner)', async () => {
  const page = await read('content/legal.md');
  assert.doesNotMatch(page, /^draft:/m, 'no draft flag: page must render in production builds');
  assert.doesNotMatch(page, /Local draft for review/i, 'no local-draft banner in published copy');
  assert.match(page, /^title: "Legal — Impressum & Privacy"/m, 'combined page title');
  for (const line of OPERATOR_LINES) {
    assert.ok(page.includes(line), `Impressum operator line present: ${line}`);
  }
  assert.match(page, /markandrewhickinson@gmail\.com/, 'approved contact address');
  assert.match(page, /Please do not send pitches or unsolicited submissions\./, 'approved contact-scope wording');
  assert.match(page, /^## Impressum/m, 'labelled Impressum section');
  assert.match(page, /^## Privacy/m, 'labelled Privacy section');
});

test('legal page claims match audited site behaviour', async () => {
  const page = await read('content/legal.md');

  // Hosting claim: GitHub Pages, evidenced by .github/workflows/deploy.yml.
  const workflow = await read('.github/workflows/deploy.yml');
  assert.match(workflow, /Deploy to GitHub Pages/, 'deployment target is GitHub Pages');
  assert.match(page, /GitHub Pages/, 'privacy page discloses GitHub Pages hosting');

  // Local storage keys actually shipped in the frontend.
  const weather = await read('static/js/dadbot-weather.mjs');
  assert.match(weather, /dadbot_weather_location_v2/);
  assert.match(weather, /dadbot_weather_forecast_v2/);
  assert.match(page, /dadbot_weather_location_v2/, 'names the weather location cache key');
  assert.match(page, /dadbot_weather_forecast_v2/, 'names the weather forecast cache key');

  const radio = await read('static/radio/radio.mjs');
  assert.match(radio, /dadbot_radio_countries_v1/);
  assert.match(radio, /dadbot_radio_languages_v1/);
  assert.match(page, /dadbot_radio_countries_v1/, 'names the radio countries cache key');
  assert.match(page, /dadbot_radio_languages_v1/, 'names the radio languages cache key');

  // Third parties actually contacted by the shipped frontend.
  for (const host of ['api.open-meteo.com', 'geocoding-api.open-meteo.com', 'ipapi.co', 'de1.api.radio-browser.info', 'buymeacoffee.com']) {
    assert.ok(page.includes(host), `privacy page discloses ${host}`);
  }
});

test('privacy section makes no false no-tracking claims', async () => {
  const page = await read('content/legal.md');
  assert.doesNotMatch(page, /we do not collect (any )?(personal )?data/i, 'no absolute no-collection claim');
  assert.doesNotMatch(page, /GDPR[ -]compliant/i, 'no blanket GDPR-compliance boast');
  assert.match(page, /ipapi\.co/, 'automatic IP-based location lookup is disclosed');
  assert.match(page, /no analytics or usage statistics/i, 'no-analytics claim present (item 20 parked)');
});

test('footer carries the Legal link via the copyright param', async () => {
  const config = await read('hugo.toml');
  assert.match(config, /copyright\s*=\s*"© \d{4} Dadbot · <a href=\\"\/legal\/\\">Legal<\/a>"/, 'copyright string links /legal/ as “Legal” in the theme footer');
});
