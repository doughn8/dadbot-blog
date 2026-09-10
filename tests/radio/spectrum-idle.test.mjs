import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

// Roadmap 031: the LED spectrum must animate ONLY while a station is actually
// playing. Tuning, paused and off-air states decay to the flat baseline and the
// tick loop stops — no wave advance (energy 1) may ever run outside "playing".
const source = readFileSync(new URL('../../static/radio/radio.mjs', import.meta.url), 'utf8');
const start = source.indexOf('  function tickSpectrum()');
const end = source.indexOf("  window.addEventListener('resize'", start);
assert.ok(start >= 0 && end > start, 'spectrum tick section must exist');

// Stub advanceSpectrum behaves like the real engine's monotone decay when
// energy is 0 (bars sink toward the floor) and is observable when energy is 1.
function fixture({ paused = false, active = true, bars = null, peaks = null } = {}) {
  const calls = [];
  const state = {
    // audio.paused is the single source of truth (031): active&&!paused means playing.
    lastFrame: null, spectrumClock: 0, spectrumTimer: 7,
    bars: bars || new Array(12).fill(0.9),
    peaks: peaks || new Array(12).fill(0.9),
    activeId: active ? 's1' : null, isPaused: paused,
    audio: { paused: !active || paused },
    statusEl: { textContent: active && !paused ? '▸ Playing' : '▸ TUNING…' },
    performance: { now: () => 2e9 },
    advanceSpectrum: (b, dt, energy) => {
      calls.push(['advance', energy]);
      return b.map((v) => (energy === 0 ? Math.max(0.04, v - 0.2) : Math.min(1, v + 0.01)));
    },
    advancePeaks: (p, b) => { calls.push('peaks'); return p.map((v) => Math.max(0.05, v - 0.2)); },
    drawSpectrum: () => calls.push('draw'),
    clearInterval: (id) => calls.push(['clear', id]),
    console,
  };
  state.ctx2d = true; state.canvas = { width: 100, height: 40 };
  vm.createContext(state);
  vm.runInContext(source.slice(start, end), state);
  return { state, calls };
}

test('not-playing ticks never run the wave animation and land on the baseline', () => {
  for (const setup of [{ paused: true }, { active: false }, { active: false, paused: true }]) {
    const { state: s, calls } = fixture({ ...setup, bars: new Array(12).fill(0.9), peaks: new Array(12).fill(0.9) });
    for (let i = 0; i < 10; i += 1) s.tickSpectrum();
    assert.ok(!calls.some((c) => Array.isArray(c) && c[0] === 'advance' && c[1] === 1),
      `${JSON.stringify(setup)}: wave animation must not run outside playing`);
    assert.ok(s.bars.every((b) => Math.abs(b - 0.04) < 1e-9), `bars must reach baseline: ${s.bars[0]}`);
    assert.equal(s.spectrumTimer, null, 'idle tick loop must stop itself');
    assert.equal(s.lastFrame, null);
  }
});

test('moving to another station from playing: TUNING status stops the animation', () => {
  const { state: s, calls } = fixture(); // starts Playing
  s.tickSpectrum();
  assert.ok(calls.some((c) => Array.isArray(c) && c[0] === 'advance' && c[1] === 1));
  // User picks an offline station: status flips to TUNING… while audio is still unpaused/stale.
  s.statusEl.textContent = '▸ TUNING…';
  calls.length = 0;
  for (let i = 0; i < 30; i += 1) s.tickSpectrum();
  assert.ok(!calls.some((c) => Array.isArray(c) && c[0] === 'advance' && c[1] === 1),
    'animation must stop the moment the status leaves Playing');
  assert.ok(s.bars.every((b) => Math.abs(b - 0.04) < 1e-9));
  assert.equal(s.spectrumTimer, null);
});

test('playing station keeps animating with energy 1 and a live timer', () => {
  const { state: s, calls } = fixture();
  s.tickSpectrum();
  assert.ok(calls.some((c) => Array.isArray(c) && c[0] === 'advance' && c[1] === 1));
  assert.equal(s.spectrumTimer, 7, 'timer stays alive while playing');
});