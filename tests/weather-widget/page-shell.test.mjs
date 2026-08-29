import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const projectRoot = new URL('../../', import.meta.url);
const read = (path) => readFile(new URL(path, projectRoot), 'utf8');

test('weather partial contains no wttr.in and loads exactly one local module', async () => {
  const partial = await read('layouts/partials/weather-widget.html');

  assert.ok(!partial.includes('wttr.in'), 'no wttr.in URL may remain');
  assert.ok(!partial.includes('<script>\n(function()'), 'no inline weather logic may remain');
  const scriptTags = partial.match(/<script\b[^>]*>/g) || [];
  assert.equal(scriptTags.length, 1, 'exactly one script tag');
  assert.ok(/<script[^>]*type="module"/.test(scriptTags[0]), 'module script');
  assert.ok(partial.includes('js/dadbot-weather.mjs'), 'local weather module referenced');
  // Both ticker copies and the search UI survive the migration.
  assert.ok(partial.includes('id="weather-content-1"'));
  assert.ok(partial.includes('id="weather-content-2"'));
  assert.ok(partial.includes('id="weather-search-input"'));
  assert.ok(partial.includes('id="weather-search-button"'));
  for (const period of ['morning', 'afternoon', 'evening']) {
    assert.ok(partial.includes(`id="temp-${period}-1"`), `temp slot for ${period}`);
    assert.ok(partial.includes(`id="desc-${period}-2"`), `desc slot for ${period}`);
  }
});

test('weather module only references the approved endpoints', async () => {
  const source = await read('static/js/dadbot-weather.mjs');
  assert.ok(source.includes('api.open-meteo.com/v1/forecast'));
  assert.ok(source.includes('geocoding-api.open-meteo.com/v1/search'));
  assert.ok(source.includes('ipapi.co/json/'));
  assert.ok(!source.includes('wttr.in'));
  assert.ok(!source.includes('apiKey'), 'no API keys');
});

test('v2 cache keys replace all legacy wttr_* keys', async () => {
  const source = await read('static/js/dadbot-weather.mjs');
  assert.ok(source.includes('dadbot_weather_location_v2'));
  assert.ok(source.includes('dadbot_weather_forecast_v2'));
  for (const key of ['wttr_location', 'wttr_weather_data', 'wttr_user_location']) {
    assert.ok(source.includes(`'${key}'`), `${key} must be listed for cleanup`);
  }
  assert.ok(!/getItem\(['"]wttr_/.test(source), 'legacy keys must never be read');
});
