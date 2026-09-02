import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';

const projectRoot = new URL('../../', import.meta.url);
const read = (path) => readFile(new URL(path, projectRoot), 'utf8');

const moduleUrl = new URL('../../static/radio/radio.mjs', import.meta.url);
const radio = await import(moduleUrl.href);

test('radio container header uses the shared green-left grey-right hierarchy', async () => {
  const html = await read('layouts/radio/list.html');
  const css = await read('static/radio/radio.css');

  assert.match(css, /\.radio-statusbar__brand\s*\{[^}]*color:\s*var\(--accent\)/, 'left brand is green');
  assert.match(css, /\.radio-statusbar__mode b,[\s\S]*?\.radio-statusbar__clock\s*\{[^}]*color:\s*color-mix\(in srgb, var\(--color\) 55%, transparent\)/, 'right-side country and clock are grey');
  assert.match(html, /radio\/radio\.css[^\n]*\?v=radio20/, 'edited Radio CSS has a fresh cache version');
});

// Execute regions.js the way a browser would (plain script, global attach).
async function loadRegions() {
  const src = await read('static/radio/regions.js');
  const sandbox = {};
  vm.createContext(sandbox);
  vm.runInContext(src, sandbox);
  return sandbox.DADBOT_REGIONS || sandbox.globalThis?.DADBOT_REGIONS;
}

// --- regions.js -------------------------------------------------------------

test('regions module maps representative codes from every continent', async () => {
  const regions = await loadRegions();
  assert.ok(regions, 'regions script must expose DADBOT_REGIONS');
  const checks = {
    US: 'North America', BR: 'South America', GB: 'Europe', DE: 'Europe',
    ZA: 'Africa', JP: 'Asia', AU: 'Oceania',
  };
  for (const [code, expected] of Object.entries(checks)) {
    assert.equal(regions.regionFor(code), expected, `${code} should be ${expected}`);
  }
});

test('unknown codes fall into Other; lowercase normalises', async () => {
  const regions = await loadRegions();
  assert.equal(regions.regionFor('XX'), 'Other');
  assert.equal(regions.regionFor(''), 'Other');
  assert.equal(regions.regionFor('us'), 'North America');
});

// --- normalizeStation / filterPlayable (kept from v1) ------------------------

const httpsStation = {
  stationuuid: 'uuid-1',
  name: 'BBC Radio 6 Music',
  url_resolved: 'https://stream.example.com/6music.mp3',
  homepage: 'https://bbc.example',
  tags: 'alternative,indie',
  country: 'United Kingdom',
  countrycode: 'GB',
  state: 'London',
  geo_lat: 51.5,
  geo_long: -0.12,
  bitrate: 128,
  codec: 'MP3',
  votes: 99,
};

const httpStation = {
  ...httpsStation,
  stationuuid: 'uuid-2',
  name: 'Oldies FM',
  url_resolved: 'http://stream.example.com/oldies.mp3',
  state: '',
  geo_lat: undefined,
  geo_long: undefined,
  tags: '',
};

test('normalizeStation maps a directory row into the safe station shape', () => {
  const s = radio.normalizeStation(httpsStation, 'directory');
  assert.equal(s.id, 'uuid-1');
  assert.equal(s.name, 'BBC Radio 6 Music');
  assert.equal(s.playable, true);
  assert.equal(s.codec, 'MP3');
  assert.equal(s.bitrate, 128);
  assert.equal(s.countryCode, 'GB');
  assert.equal(s.region, 'London');
});

test('normalizeStation marks http streams unplayable and tolerates missing fields', () => {
  const s = radio.normalizeStation(httpStation, 'directory');
  assert.equal(s.playable, false);
  assert.equal(s.region, '');
  assert.deepEqual(s.geo, null);
  assert.deepEqual(s.tags, []);
  assert.equal(radio.normalizeStation(null, 'directory'), null);
});

test('filterPlayable keeps https stations only', () => {
  const list = [httpsStation, httpStation].map((r) => radio.normalizeStation(r, 'directory'));
  assert.deepEqual(radio.filterPlayable(list).map((s) => s.id), ['uuid-1']);
});

// --- formatMetaLine (hero meta under the station name) ------------------------

test('formatMetaLine joins country, tags and codec/bitrate', () => {
  const s = radio.normalizeStation(httpsStation, 'directory');
  assert.equal(radio.formatMetaLine(s), 'United Kingdom · Alternative · Indie · MP3 128k');
});

test('formatMetaLine omits absent parts and handles empty stations', () => {
  const bare = radio.normalizeStation({ ...httpsStation, tags: '', bitrate: 0, codec: '' }, 'directory');
  assert.equal(radio.formatMetaLine(bare), 'United Kingdom');
  assert.equal(radio.formatMetaLine(null), '');
});

// --- filterStations (client-side name filter) ----------------------------------

test('filterStations matches name substrings case-insensitively', () => {
  const list = [
    { name: 'BBC Radio 6 Music' },
    { name: 'bbc radio 1' },
    { name: 'Jazz FM' },
  ];
  assert.deepEqual(radio.filterStations(list, 'bbc').map((s) => s.name), ['BBC Radio 6 Music', 'bbc radio 1']);
  assert.deepEqual(radio.filterStations(list, ''), list);
  assert.deepEqual(radio.filterStations(list, '  JAZZ  ').map((s) => s.name), ['Jazz FM']);
});

// --- advanceSpectrum (fake graphic-EQ engine) ---------------------------------
// Bars ease UP FAST, DOWN SLOW toward a wandering target; energy 0 decays to
// the floor. Pure: (bars, dt, energy) -> nextBars. No DOM, no time source.

test('advanceSpectrum keeps every bar within 0..1 and the bar count', () => {
  const N = 45;
  let bars = radio.advanceSpectrum(new Array(N).fill(0.5), 0.2, 1);
  assert.equal(bars.length, N);
  for (const v of bars) assert.ok(v >= 0 && v <= 1, `bar out of range: ${v}`);
});

test('bars rise much faster than they fall (up fast, down slow)', () => {
  const N = 8;
  // Rise: from floor toward a high target.
  let rising = new Array(N).fill(0.05);
  rising = radio.advanceSpectrum(rising, 0.1, 1);
  rising = radio.advanceSpectrum(rising, 0.1, 1);
  const riseGain = rising.reduce((a, b) => a + b, 0) / N;

  // Fall: from near-top toward the floor.
  let falling = new Array(N).fill(0.95);
  falling = radio.advanceSpectrum(falling, 0.1, 1);
  falling = radio.advanceSpectrum(falling, 0.1, 1);
  const fallLoss = 0.95 - falling.reduce((a, b) => a + b, 0) / N;

  assert.ok(riseGain > fallLoss * 1.5, `rise ${riseGain.toFixed(3)} should outpace fall ${fallLoss.toFixed(3)}`);
});

test('energy 0 decays bars toward the floor over time', () => {
  let bars = new Array(24).fill(0.9);
  for (let i = 0; i < 60; i += 1) bars = radio.advanceSpectrum(bars, 0.1, 0);
  const avg = bars.reduce((a, b) => a + b, 0) / bars.length;
  assert.ok(avg < 0.15, `bars should have decayed, avg=${avg}`);
});

test('dt=0 leaves bars unchanged (no NaN, no drift)', () => {
  const bars = new Array(8).fill(0.4);
  assert.deepEqual(radio.advanceSpectrum(bars, 0, 1), bars);
});

test('bars keep moving over 15s of playing — targets evolve with the clock', () => {
  let bars = new Array(12).fill(0.3);
  let t = 0;
  const snapshots = [];
  for (let i = 0; i < 300; i += 1) { // ~15s at 20fps
    t += 0.05;
    bars = radio.advanceSpectrum(bars, 0.05, 1, t);
    if (i % 50 === 0) snapshots.push([...bars]);
  }
  assert.ok(snapshots.length >= 6);
  for (let i = 1; i < snapshots.length; i += 1) {
    const diff = snapshots[i].reduce((a, v, j) => a + Math.abs(v - snapshots[i - 1][j]), 0);
    assert.ok(diff > 0.5, `bars frozen between snapshots ${i - 1} and ${i}: diff=${diff}`);
  }
});

test('same bars + dt but different clock time give different targets', () => {
  const bars = new Array(10).fill(0.3);
  const early = radio.advanceSpectrum(bars, 0.05, 1, 0);
  const late = radio.advanceSpectrum(bars, 0.05, 1, 6);
  const diff = early.reduce((a, v, i) => a + Math.abs(v - late[i]), 0);
  assert.ok(diff > 0.2, `engine must be time-driven, diff=${diff}`);
});

// --- structural: stop flow removed (pause-only transport) --------------------

test('the stop keybind and stop flow are fully removed', async () => {
  const html = await read('layouts/radio/list.html');
  const js = await read('static/radio/radio.mjs');
  assert.ok(!html.includes('[S]'), 'footer must not advertise a Stop keybind');
  assert.ok(!html.includes('data-radio-stop'), 'no stop button in the markup');
  assert.ok(!js.includes("case 's'"), 'no S keybind in the controller');
  assert.ok(!js.includes('stopAll'), 'no stop flow left in the controller');
  assert.ok(html.includes('[Spc]'), 'play/pause keybind stays');
});

// --- structural: custom terminal dropdowns, opening downward only ------------

test('radio selects are custom terminal dropdowns, not native selects', async () => {
  const html = await read('layouts/radio/list.html');
  const css = await read('static/radio/radio.css');
  // No native selects on the radio desk.
  assert.ok(!html.includes('<select'), 'region/country must not be native <select> elements');
  assert.ok(html.includes('data-radio-region-listbox'), 'region trigger exposes a listbox');
  assert.ok(html.includes('data-radio-country-listbox'), 'country trigger exposes a listbox');
  // Terminal listbox styling exists and never opens upward (no `bottom:` positioning).
  assert.match(css, /\.radio-listbox\s*\{/, 'listbox styles present');
  assert.ok(!/^\s*bottom\s*:/m.test(css), 'listbox must not be positioned upward');
  assert.match(css, /max-height:\s*360px/, 'country listbox capped to scroll downward');
  assert.match(css, /\.radio-listbox\s*\{[^}]*overflow-x:\s*hidden/, 'listboxes suppress horizontal scrolling');
});

test('browser controls lay out as two rows: language+random then region+country+filter; volume stretches', async () => {
  const css = await read('static/radio/radio.css');
  // Row order: language/random occupy grid row 1, region/country/filter row 2.
  assert.match(css, /\.radio-field--language\s*\{[^}]*grid-column:\s*1[^}]*grid-row:\s*1/, 'language row 1 col 1');
  assert.match(css, /\.radio-field--random\s*\{[^}]*grid-column:\s*2[^}]*grid-row:\s*1/, 'random row 1 col 2');
  assert.match(css, /\.radio-field\s*\{[^}]*grid-row:\s*2/, 'region+country+filter (default fields) in row 2');
  assert.match(css, /\.radio-field--country\s*\{[^}]*grid-column:\s*2/, 'country col 2 (row 2)');
  assert.match(css, /\.radio-field--grow\s*\{[^}]*grid-column:\s*3/, 'filter col 3 (row 2)');
  // Volume spans between the button and the switch.
  assert.match(css, /\.radio-volume\s*\{[^}]*width:\s*100%/, 'volume stretches across its column');
  assert.match(css, /\.radio-volume input\[type="range"]\s*\{[^}]*width:\s*100%/, 'volume slider fills the row');
});

test('stations carry their language codes for the lucky dial and row tags', () => {
  const s = radio.normalizeStation({ ...httpsStation, languagecodes: 'en,de' }, 'directory');
  assert.deepEqual(s.languagecodes, ['en', 'de']);
  const bare = radio.normalizeStation({ ...httpsStation, languagecodes: '' }, 'directory');
  assert.deepEqual(bare.languagecodes, []);
  const mono = radio.normalizeStation({ ...httpsStation, languagecodes: 'en' }, 'directory');
  assert.deepEqual(mono.languagecodes, ['en']);
});

test('pickRandomStation draws from the pool, avoiding excluded ids', () => {
  const pool = [
    { id: 'a', name: 'A' }, { id: 'b', name: 'B' }, { id: 'c', name: 'C' },
  ];
  for (let i = 0; i < 20; i += 1) {
    const pick = radio.pickRandomStation(pool, new Set(['a', 'b']));
    assert.ok(['c'].includes(pick.id), `draw outside allowed set: ${pick.id}`);
  }
  // with no exclusions it always returns a pool member
  const pick = radio.pickRandomStation(pool, new Set());
  assert.ok(pool.some((s) => s.id === pick.id));
  // exhausted pool -> null
  assert.equal(radio.pickRandomStation(pool, new Set(['a', 'b', 'c'])), null);
  assert.equal(radio.pickRandomStation([], new Set()), null);
});

test('the hi-fi toggle and attribution use the agreed wording', async () => {
  const html = await read('layouts/radio/list.html');
  assert.match(html, /aria-label="Hide unavailable stations"/, 'switch aria-label is the agreed wording');
  assert.ok(!html.includes('Streams belong to their stations'), 'removed sentence must be gone');
  assert.match(html, /radio-browser\.info/, 'directory attribution stays');
  assert.match(html, /cliamp/, 'cliamp credit stays');
});

test('the lucky dial controls exist in the markup', async () => {
  const html = await read('layouts/radio/list.html');
  assert.ok(html.includes('data-radio-language-listbox'), 'language dropdown present');
  assert.ok(html.includes('data-radio-random'), 'random button present');
  assert.ok(html.includes('[RANDOM]'), 'random button labelled');
});

test('the lucky dial verifies language locally — fuzzy server matches are rejected', () => {
  // Simulates the fuzzy directory draw: a Turkish station and an untagged one
  // sneak into a pool fetched for 'en'. Local verification must drop both.
  const rows = [
    { ...httpsStation, stationuuid: 'tr', languagecodes: 'az,tk,tr' },
    { ...httpsStation, stationuuid: 'gb', languagecodes: 'en' },
    { ...httpsStation, stationuuid: 'none', languagecodes: '' },
  ];
  const pool = rows
    .map((r) => radio.normalizeStation(r, 'directory'))
    .filter((s) => s && s.playable && (s.languagecodes || []).includes('en'));
  assert.deepEqual(pool.map((s) => s.id), ['gb']);
});

// --- structural: compact EQ + Hi-Fi toggle switch -----------------------------

test('the hide-unavailable switch sits in the transport row, right edge flush with the spectrum', async () => {
  const html = await read('layouts/radio/list.html');
  const css = await read('static/radio/radio.css');
  const transport = html.match(/<div class="radio-transport">[\s\S]*?<div class="radio-browse">/)[0];
  assert.match(transport, /data-radio-hifi/, 'switch markup lives in the transport row');
  const browse = html.match(/<div class="radio-browse">[\s\S]*?radio-stations/)[0];
  assert.ok(!browse.includes('data-radio-hifi'), 'switch no longer in the browser grid');
  assert.match(css, /\.radio-transport\s*\{[^}]*display:\s*grid/, 'transport uses grid');
  assert.match(css, /\.radio-transport\s*\{[^}]*grid-template-columns:[^;]*1fr/, 'middle column absorbs the volume (centred)');
  assert.match(css, /\.radio-volume\s*\{[^}]*justify-self:\s*center/, 'volume centred');
  assert.match(css, /\.radio-switch\s*\{[^}]*justify-self:\s*end/, 'switch flush right');
});

test('the EQ segments are half height (9px) and the canvas box matches', async () => {
  const js = await read('static/radio/radio.mjs');
  const css = await read('static/radio/radio.css');
  assert.match(js, /SEGMENT_H = 9/, 'LED segment height must be 9px');
  assert.match(css, /\.radio-spectrum\s*\{[^}]*height:\s*110px/, 'desktop canvas halves to 110px');
  assert.match(css, /@media \(max-width: 768px\)\s*\{[^}]*\.radio-spectrum\s*\{[^}]*height:\s*100px/, 'mobile canvas halves to 100px');
});

test('hi-fi is a toggle switch, not a labelled button', async () => {
  const html = await read('layouts/radio/list.html');
  assert.match(html, /<button[^>]*data-radio-hifi[^>]*role="switch"/, 'hifi control declares role=switch');
  assert.match(html, /data-radio-hifi[\s\S]{0,400}radio-switch__knob/, 'switch has a sliding knob');
});

test('hi-fi is a toggle switch labelled "Hide unavailable", right-aligned', async () => {
  const html = await read('layouts/radio/list.html');
  assert.match(html, /<button[^>]*data-radio-hifi[^>]*role="switch"/, 'hifi control declares role=switch');
  assert.match(html, /aria-label="Hide unavailable[^"]*"/, 'switch label reads Hide unavailable');
  assert.match(html, /data-radio-hifi[\s\S]{0,240}radio-switch__knob/, 'switch has a sliding knob');
});

test('random button fills an input-height field on row 2', async () => {
  const html = await read('layouts/radio/list.html');
  const css = await read('static/radio/radio.css');
  assert.match(html, /radio-btn--small radio-random/, 'random is a small button in the browser row');
  assert.match(css, /\.radio-field--random\s*\{[^}]*grid-column:\s*2\s*\/\s*-1/, 'random spans from the country line to the edge (row 1)');
  assert.match(css, /\.radio-random,\s*\.radio-switch\s*\{[^}]*height:\s*33px/, 'random button matches the 33px input height');
});

// --- advancePeaks (slow-falling peak caps) --------------------------------------

test('advancePeaks holds a cap above the bar and never below it', () => {
  const bars = new Array(10).fill(0.3);
  const peaks = new Array(10).fill(0.95);
  const next = radio.advancePeaks(peaks, bars, 0.2);
  assert.equal(next.length, 10);
  for (let i = 0; i < 10; i += 1) {
    assert.ok(next[i] >= bars[i], `peak ${i} fell below its bar`);
    assert.ok(next[i] <= 1, `peak ${i} above 1`);
  }
});

test('peak caps fall slowly, not instantly', () => {
  const bars = new Array(5).fill(0.1);
  let peaks = new Array(5).fill(1.0);
  peaks = radio.advancePeaks(peaks, bars, 0.1); // ~0.2s worth
  assert.ok(peaks[0] > 0.7, `cap should barely fall in 0.2s, got ${peaks[0]}`);
  for (let i = 0; i < 40; i += 1) peaks = radio.advancePeaks(peaks, bars, 0.1); // ~4s of frames
  assert.ok(peaks[0] < 0.3, `cap should have fallen over 4s, got ${peaks[0]}`);
});

test('peaks jump up instantly when a bar surges past them', () => {
  const bars = new Array(5).fill(0.9);
  const peaks = new Array(5).fill(0.2);
  const next = radio.advancePeaks(peaks, bars, 0.1);
  for (let i = 0; i < 5; i += 1) assert.equal(next[i], bars[i]);
});
