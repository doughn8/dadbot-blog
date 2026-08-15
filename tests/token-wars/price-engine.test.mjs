import test from 'node:test';
import assert from 'node:assert/strict';

import { TOKENS } from '../../static/games/token-wars/js/config.mjs';
import { createSeededRandom } from '../../static/games/token-wars/js/random.mjs';
import { generatePrices } from '../../static/games/token-wars/js/price-engine.mjs';

test('price generation is deterministic, whole, positive, and complete', () => {
  const first = generatePrices({ regionId: 'europe', rng: createSeededRandom(7) });
  const second = generatePrices({ regionId: 'europe', rng: createSeededRandom(7) });

  assert.deepEqual(first, second);
  assert.deepEqual(Object.keys(first), TOKENS.map(({ id }) => id));
  for (const price of Object.values(first)) {
    assert.ok(Number.isInteger(price));
    assert.ok(price >= 1);
  }
});

test('regional multipliers and market events affect only their targets', () => {
  const midpoint = () => 0.5;
  const europe = generatePrices({ regionId: 'europe', rng: midpoint });
  const northAmerica = generatePrices({ regionId: 'north-america', rng: midpoint });
  const boom = generatePrices({
    regionId: 'europe',
    rng: midpoint,
    event: { tokenIds: ['gpts'], multiplier: 2 },
  });

  assert.ok(northAmerica.gpts > europe.gpts);
  assert.equal(boom.gpts, europe.gpts * 2);
  assert.equal(boom.llamas, europe.llamas);
});

test('price generation rejects unknown regions and invalid event multipliers', () => {
  assert.throws(
    () => generatePrices({ regionId: 'atlantis', rng: () => 0.5 }),
    /Unknown region/,
  );
  assert.throws(
    () => generatePrices({
      regionId: 'europe',
      rng: () => 0.5,
      event: { tokenIds: ['gpts'], multiplier: 0 },
    }),
    /positive multiplier/,
  );
});

test('price generation clamps extreme market moves to each token range', () => {
  const crashed = generatePrices({
    regionId: 'europe',
    rng: () => 0,
    event: { tokenIds: ['llamas'], multiplier: 0.0001 },
  });
  const spiked = generatePrices({
    regionId: 'europe',
    rng: () => 0.999,
    event: { tokenIds: ['gpts'], multiplier: 10000 },
  });

  assert.equal(crashed.llamas, TOKENS.find(({ id }) => id === 'llamas').minPrice);
  assert.equal(spiked.gpts, TOKENS.find(({ id }) => id === 'gpts').maxPrice);
});

test('price generation rejects invalid RNG output before arithmetic', () => {
  for (const value of [Number.NaN, Number.POSITIVE_INFINITY, -0.01, 1]) {
    assert.throws(() => generatePrices({ regionId: 'europe', rng: () => value }), /RNG/);
  }
});

test('a volatility scale makes Market Scraper prices less erratic', () => {
  const normal = generatePrices({ regionId: 'europe', rng: () => 0 });
  const scraped = generatePrices({ regionId: 'europe', rng: () => 0, volatilityScale: 0.75 });
  const midpoint = generatePrices({ regionId: 'europe', rng: () => 0.5 });

  assert.ok(Math.abs(scraped.llamas - midpoint.llamas) < Math.abs(normal.llamas - midpoint.llamas));
  assert.throws(
    () => generatePrices({ regionId: 'europe', rng: () => 0.5, volatilityScale: 0 }),
    /volatility scale/,
  );
});
