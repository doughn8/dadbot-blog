import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
  applyKeyboardInput,
  applyPointerMovement,
  clamp,
  createInitialState,
  sampleLand,
  shouldAnimate,
  stepMotion,
} from '../../static/js/dadbot-globe.mjs';

test('initial globe motion respects reduced-motion and both visibility signals', () => {
  assert.equal(createInitialState(false).yawVelocity, 0.085);
  assert.equal(createInitialState(true).yawVelocity, 0);
  assert.equal(shouldAnimate(true, true, true), false);
  assert.equal(shouldAnimate(false, true, true), true);
  assert.equal(shouldAnimate(false, false, true), false);
  assert.equal(shouldAnimate(false, true, false), false);
});

test('reduced-motion pointer movement updates orientation and requests one repaint', () => {
  const state = createInitialState(true);
  state.x = 10;
  state.y = 20;
  state.time = 100;

  const repaint = applyPointerMovement(state, { x: 30, y: 5, time: 116 }, true);

  assert.equal(repaint, true);
  assert.notEqual(state.yaw, -0.48);
  assert.notEqual(state.pitch, -0.12);
  assert.equal(state.yawVelocity, 0);
  assert.equal(state.pitchVelocity, 0);
});

test('land-mask sampling wraps longitude and always returns a boolean', () => {
  const latitude = 0.4;
  const longitude = -1.2;

  assert.equal(typeof sampleLand(longitude, latitude), 'boolean');
  assert.equal(sampleLand(longitude, latitude), sampleLand(longitude + Math.PI * 2, latitude));
});

test('keyboard rotation changes orientation and Home restores the approved view', () => {
  const state = createInitialState(false);
  const initialYaw = state.yaw;

  assert.equal(applyKeyboardInput(state, 'ArrowRight', false), true);
  assert.ok(state.yaw > initialYaw);

  state.pitch = 0.8;
  state.yawVelocity = 3;
  assert.equal(applyKeyboardInput(state, 'Home', false), true);
  assert.equal(state.yaw, -0.48);
  assert.equal(state.pitch, -0.12);
  assert.equal(state.yawVelocity, 0.085);

  assert.equal(applyKeyboardInput(state, 'Tab', false), false);
});

test('idle stepping eases momentum back towards the approved rotation', () => {
  const state = createInitialState(false);
  state.yawVelocity = 1;
  const yaw = state.yaw;

  stepMotion(state, 0.05, false);

  assert.ok(state.yaw > yaw);
  assert.ok(state.yawVelocity < 1);
  assert.ok(state.yawVelocity > 0.085);
});

test('clamp keeps pitch within the interaction boundary', () => {
  assert.equal(clamp(2, -1.25, 1.25), 1.25);
  assert.equal(clamp(-2, -1.25, 1.25), -1.25);
});

test('mount lifecycle keeps fallback until first render and cleans up listeners', async () => {
  const source = await readFile(new URL('../../static/js/dadbot-globe.mjs', import.meta.url), 'utf8');
  const revealIndex = source.indexOf('canvas.hidden = false');
  const firstResizeIndex = source.indexOf('resize();', revealIndex);
  const firstRenderIndex = source.indexOf('render();', firstResizeIndex);
  const hideFallbackIndex = source.indexOf('fallback.hidden = true', firstRenderIndex);

  assert.ok(
    revealIndex >= 0
      && firstResizeIndex > revealIndex
      && firstRenderIndex > firstResizeIndex
      && hideFallbackIndex > firstRenderIndex,
  );
  assert.match(source, /const listenerController = new AbortController\(\)/);
  assert.match(source, /listenerController\.abort\(\)/);
  assert.match(source, /canvas\.hidden = true/);
  assert.doesNotMatch(source, /window\.__dadbotGlobe(?:State|Metrics)/);
});
