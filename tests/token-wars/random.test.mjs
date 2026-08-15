import test from 'node:test';
import assert from 'node:assert/strict';

import { choose, createSeededRandom, randomInt, sample } from '../../static/games/token-wars/js/random.mjs';

test('the same seed produces the same reproducible sequence', () => {
  const first = createSeededRandom(1984);
  const second = createSeededRandom(1984);

  const firstValues = Array.from({ length: 8 }, () => first());
  const secondValues = Array.from({ length: 8 }, () => second());

  assert.deepEqual(firstValues, secondValues);
  assert.ok(firstValues.every((value) => value >= 0 && value < 1));
  assert.ok(new Set(firstValues).size > 1);
});

test('random helpers stay inside their boundaries without mutating inputs', () => {
  const rng = createSeededRandom(42);
  const values = ['a', 'b', 'c', 'd', 'e'];
  const original = [...values];

  for (let index = 0; index < 50; index += 1) {
    const value = randomInt(rng, 3, 7);
    assert.ok(value >= 3 && value <= 7);
    assert.ok(values.includes(choose(rng, values)));
  }

  const selected = sample(rng, values, 3);
  assert.equal(selected.length, 3);
  assert.equal(new Set(selected).size, 3);
  assert.deepEqual(values, original);
});

test('random helpers reject non-finite and out-of-range RNG results', () => {
  for (const value of [-0.1, 1, Number.NaN, Number.POSITIVE_INFINITY]) {
    assert.throws(() => randomInt(() => value, 0, 2), /RNG/);
    assert.throws(() => choose(() => value, ['a', 'b']), /RNG/);
  }
});
