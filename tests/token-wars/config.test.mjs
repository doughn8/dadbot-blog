import test from 'node:test';
import assert from 'node:assert/strict';

import {
  INITIAL_STATE,
  REGIONS,
  RUN_LENGTHS,
  TOKENS,
  UPGRADES,
  validateGameLength,
} from '../../static/games/token-wars/js/config.mjs';

test('validateGameLength accepts only the three approved run lengths', () => {
  for (const days of [30, 60, 90]) {
    assert.equal(validateGameLength(days), days);
  }

  for (const days of [0, 29, 31, 120, '30', null]) {
    assert.throws(() => validateGameLength(days), /30, 60, or 90/);
  }
});

test('locked configuration contains the approved starting state and roster', () => {
  assert.deepEqual(RUN_LENGTHS, [30, 60, 90]);
  assert.deepEqual(INITIAL_STATE, {
    cash: 2000,
    debt: 5500,
    savings: 0,
    health: 100,
    capacity: 100,
    debtInterest: 0.08,
    savingsInterest: 0.05,
  });
  assert.deepEqual(REGIONS.map(({ id }) => id), [
    'north-america',
    'south-america',
    'europe',
    'africa',
    'asia',
    'oceania',
  ]);
  assert.equal(REGIONS.find(({ service }) => service === 'lender')?.id, 'north-america');
  assert.equal(REGIONS.find(({ service }) => service === 'bank')?.id, 'europe');
  assert.ok(REGIONS.every(({ tierModifiers }) => Object.isFrozen(tierModifiers)));
  assert.deepEqual(TOKENS.map(({ name }) => name), [
    'LLaMAs',
    'Mistrals',
    'DeepSeeks',
    'Copilots',
    'Groks',
    'Geminis',
    'Perplexities',
    'Claudes',
    'GPTs',
    'Midjourneys',
  ]);
  assert.ok(TOKENS.every(({ minPrice, basePrice, maxPrice }) => (
    Number.isSafeInteger(minPrice)
    && Number.isSafeInteger(maxPrice)
    && minPrice > 0
    && minPrice < basePrice
    && basePrice < maxPrice
  )));
  assert.ok(UPGRADES.length >= 6);
});
