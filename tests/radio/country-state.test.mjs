import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

// Exercise production controller functions; isolate DOM/media/network dependencies.
const source = readFileSync(new URL('../../static/radio/radio.mjs', import.meta.url), 'utf8');
function section(start, end) {
  const a = source.indexOf(start), b = source.indexOf(end, a);
  assert.ok(a >= 0 && b > a);
  return source.slice(a, b);
}
function fixture({ paused = false, active = true } = {}) {
  const pending = [], calls = [];
  const station = { id: 'gb', name: 'Original', countryCode: 'GB', streamUrl: 'https://example.test/gb', playable: true };
  const state = {
    activeId: active ? station.id : null, currentStation: active ? station : null,
    isPaused: paused, fetchSeq: 0, stations: [station], visible: [station], selected: 4,
    API_BASE: 'https://example.test',
    fetch: () => new Promise((resolve, reject) => pending.push({ resolve, reject })),
    normalizeStation: x => x,
    renderNowPlaying() { calls.push('now-playing'); },
    renderList() { state.visible = state.stations; calls.push('list'); },
    ensureSpectrum() {},
    ccEl: { textContent: 'GB' }, metaEl: {}, listEl: { innerHTML: '' }, volumeInput: { value: '70' },
    playBtn: { textContent: paused ? '▶ PLAY' : '❚❚ PAUSE', setAttribute(key, value) { this[key] = value; } },
    status: paused ? '❚❚ Paused' : '▸ Playing',
    setStatus(text) { state.status = text; },
    audio: { src: station.streamUrl, paused,
      pause() { this.paused = true; calls.push('pause'); },
      play() { this.paused = false; calls.push('play'); return Promise.resolve(); },
    },
  };
  vm.createContext(state);
  vm.runInContext(section('  function tune(station)', '  const audio ='), state);
  vm.runInContext(section('  async function loadCountry(code)', '  let filterDebounce'), state);
  return { state, pending, calls, station };
}
const rows = [{ id: 'de', countryCode: 'DE', countrycode: 'DE', streamUrl: 'https://example.test/de', playable: true }];
const response = (data = rows) => ({ ok: true, json: async () => data });

for (const failure of ['network', 'http']) {
  test(`${failure} directory failure leaves playback status and stream intact`, async () => {
    const { state: s, pending, station } = fixture();
    const request = s.loadCountry('DE');
    if (failure === 'network') pending[0].reject(new Error('offline'));
    else pending[0].resolve({ ok: false, json: async () => rows });
    await request;
    assert.equal(s.status, '▸ Playing');
    assert.equal(s.currentStation, station);
    assert.equal(s.audio.src, station.streamUrl);
    assert.match(s.listEl.innerHTML, /Could not reach/);
  });
}

test('tuning a new station while paused updates the transport label', async () => {
  const { state: s } = fixture({ paused: true });
  s.tune(rows[0]);
  await Promise.resolve();
  assert.equal(s.isPaused, false);
  assert.equal(s.audio.src, rows[0].streamUrl);
  assert.equal(s.playBtn.textContent, '❚❚ PAUSE');
  assert.equal(s.playBtn['aria-label'], 'Pause');
});

test('late country responses cannot replace the newest directory', async () => {
  const { state: s, pending, station } = fixture();
  const first = s.loadCountry('DE');
  const second = s.loadCountry('FR');
  pending[1].resolve(response([{ ...rows[0], id: 'fr' }]));
  await second;
  pending[0].resolve(response());
  await first;
  assert.equal(s.stations[0].id, 'fr');
  assert.equal(s.currentStation, station);
});

test('a failed stale request cannot replace the newest directory with an error', async () => {
  const { state: s, pending } = fixture();
  const first = s.loadCountry('DE');
  const second = s.loadCountry('FR');
  pending[1].resolve(response([{ ...rows[0], id: 'fr' }]));
  await second;
  const html = s.listEl.innerHTML;
  pending[0].reject(new Error('late failure'));
  await first;
  assert.equal(s.stations[0].id, 'fr');
  assert.equal(s.listEl.innerHTML, html);
  assert.equal(s.status, '▸ Playing');
});

for (const fail of [false, true]) {
  test(`station tuned during initial directory request survives ${fail ? 'failure' : 'success'}`, async () => {
    const { state: s, pending } = fixture({ active: false });
    const request = s.loadCountry('DE');
    s.tune(rows[0]);
    await Promise.resolve();
    if (fail) pending[0].reject(new Error('offline'));
    else pending[0].resolve(response([]));
    await request;
    assert.equal(s.currentStation, rows[0]);
    assert.equal(s.activeId, 'de');
    assert.equal(s.status, '▸ Playing');
    assert.equal(s.audio.src, rows[0].streamUrl);
  });
}

for (const fail of [false, true]) {
  test(`initial directory ${fail ? 'failure shows offline' : 'empty response shows off air'}`, async () => {
    const { state: s, pending } = fixture({ active: false });
    const request = s.loadCountry('DE');
    assert.equal(s.status, '▸ LOADING…');
    if (fail) pending[0].reject(new Error('offline'));
    else pending[0].resolve(response([]));
    await request;
    assert.equal(s.status, fail ? '■ OFFLINE' : '■ Off Air');
    assert.equal(s.activeId, null);
    if (!fail) { assert.equal(s.ccEl.textContent, 'DE'); assert.equal(s.stations.length, 0); }
  });
}

for (const paused of [false, true]) {
  test(`country browsing preserves ${paused ? 'paused' : 'playing'} station and transport`, async () => {
    const { state: s, pending, calls, station } = fixture({ paused });
    const status = s.status, label = s.playBtn.textContent;
    const request = s.loadCountry('DE');
    assert.equal(s.status, status, 'directory loading must not replace playback status');
    assert.match(s.listEl.innerHTML, /loading/i);
    pending[0].resolve(response());
    await request;
    assert.equal(s.activeId, station.id);
    assert.equal(s.currentStation, station);
    assert.equal(s.isPaused, paused);
    assert.equal(s.audio.paused, paused);
    assert.equal(s.audio.src, station.streamUrl);
    assert.equal(s.ccEl.textContent, 'GB');
    assert.equal(s.status, status);
    assert.equal(s.playBtn.textContent, label);
    assert.equal(s.stations[0].id, 'de');
    assert.equal(s.selected, -1);
    assert.deepEqual(calls, ['list'], 'browsing must not operate on media or repaint station identity');
    s.pauseToggle();
    await Promise.resolve();
    assert.equal(s.audio.paused, !paused);
    s.pauseToggle();
    await Promise.resolve();
    assert.equal(s.audio.paused, paused);
  });
}
