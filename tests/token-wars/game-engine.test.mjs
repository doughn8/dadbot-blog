import test from 'node:test';
import assert from 'node:assert/strict';

import { REGIONS, TOKENS } from '../../static/games/token-wars/js/config.mjs';
import { createSeededRandom } from '../../static/games/token-wars/js/random.mjs';
import { resolveEncounter } from '../../static/games/token-wars/js/encounter-engine.mjs';
import {
  buyToken,
  depositSavings,
  inventoryUsed,
  repayDebt,
  resetGame,
  sellToken,
  startGame,
  travel,
  withdrawSavings,
} from '../../static/games/token-wars/js/game-engine.mjs';

function sequence(...values) {
  let index = 0;
  return () => values[Math.min(index++, values.length - 1)];
}

test('startGame creates the approved clean state in a random valid region', () => {
  const state = startGame(30, { rng: createSeededRandom(11) });

  assert.equal(state.maxDays, 30);
  assert.equal(state.day, 1);
  assert.equal(state.cash, 2000);
  assert.equal(state.debt, 5500);
  assert.equal(state.savings, 0);
  assert.equal(state.health, 100);
  assert.equal(state.capacity, 100);
  assert.equal(state.status, 'playing');
  assert.ok(REGIONS.some(({ id }) => id === state.regionId));
  assert.deepEqual(state.holdings, Object.fromEntries(TOKENS.map(({ id }) => [id, 0])));
  assert.deepEqual(Object.keys(state.prices), TOKENS.map(({ id }) => id));
  assert.equal(state.availableUpgrades.length, 3);
  assert.equal(new Set(state.availableUpgrades).size, 3);
  assert.deepEqual(state.upgrades, []);
  assert.equal(state.pendingEncounter, null);
  assert.equal(state.lastEvent, null);
});

test('resetGame discards the previous run and validates the new length', () => {
  const original = startGame(30, { rng: createSeededRandom(12) });
  const changed = { ...original, cash: 999999, debt: 0, health: 4 };
  const reset = resetGame(changed, 60, { rng: createSeededRandom(13) });

  assert.equal(reset.maxDays, 60);
  assert.equal(reset.cash, 2000);
  assert.equal(reset.debt, 5500);
  assert.equal(reset.health, 100);
  assert.throws(() => resetGame(changed, 45, { rng: createSeededRandom(1) }), /30, 60, or 90/);
});

test('buyToken spends cash and uses secure-server capacity without mutating the input', () => {
  const original = startGame(30, { rng: createSeededRandom(20) });
  const state = { ...original, prices: { ...original.prices, llamas: 100 } };
  const result = buyToken(state, 'llamas', 2);

  assert.equal(result.ok, true);
  assert.equal(result.state.cash, 1800);
  assert.equal(result.state.holdings.llamas, 2);
  assert.equal(inventoryUsed(result.state), 2);
  assert.equal(state.cash, 2000);
  assert.equal(state.holdings.llamas, 0);
});

test('buyToken rejects invalid quantities, insufficient cash, and insufficient capacity unchanged', () => {
  const original = startGame(30, { rng: createSeededRandom(21) });
  const expensive = { ...original, prices: { ...original.prices, llamas: 3000 } };
  const full = {
    ...original,
    holdings: { ...original.holdings, llamas: 100 },
    prices: { ...original.prices, mistrals: 1 },
  };

  for (const result of [
    buyToken(original, 'llamas', 0),
    buyToken(original, 'llamas', 1.5),
    buyToken(expensive, 'llamas', 1),
    buyToken(full, 'mistrals', 1),
  ]) {
    assert.equal(result.ok, false);
  }
  assert.deepEqual(original.holdings, Object.fromEntries(TOKENS.map(({ id }) => [id, 0])));
  assert.equal(original.cash, 2000);
});

test('sellToken returns cash and rejects sales beyond current holdings', () => {
  const original = startGame(30, { rng: createSeededRandom(22) });
  const owned = {
    ...original,
    cash: 500,
    prices: { ...original.prices, gpts: 12000 },
    holdings: { ...original.holdings, gpts: 2 },
  };
  const sold = sellToken(owned, 'gpts', 1);
  const rejected = sellToken(owned, 'gpts', 3);

  assert.equal(sold.ok, true);
  assert.equal(sold.state.cash, 12500);
  assert.equal(sold.state.holdings.gpts, 1);
  assert.equal(rejected.ok, false);
  assert.equal(rejected.state, owned);
  assert.equal(owned.cash, 500);
  assert.equal(owned.holdings.gpts, 2);
});

test('trading rejects malformed numeric state before arithmetic', () => {
  const original = startGame(30, { rng: createSeededRandom(25) });
  const invalidPrice = { ...original, prices: { ...original.prices, llamas: Number.NaN } };
  const invalidHolding = { ...original, holdings: { ...original.holdings, llamas: Number.NaN } };
  const invalidCash = { ...original, cash: Number.POSITIVE_INFINITY };

  assert.equal(buyToken(invalidPrice, 'llamas', 1).state, invalidPrice);
  assert.equal(sellToken(invalidHolding, 'llamas', 1).state, invalidHolding);
  assert.equal(buyToken(invalidCash, 'llamas', 1).state, invalidCash);
  assert.equal(buyToken(original, 'llamas', Number.MAX_SAFE_INTEGER + 1).state, original);
});

test('bank deposits and withdrawals work only in Europe', () => {
  const original = startGame(30, { rng: createSeededRandom(30) });
  const europe = { ...original, regionId: 'europe' };
  const deposited = depositSavings(europe, 500);
  const withdrawn = withdrawSavings(deposited.state, 200);

  assert.equal(deposited.ok, true);
  assert.equal(deposited.state.cash, 1500);
  assert.equal(deposited.state.savings, 500);
  assert.equal(withdrawn.ok, true);
  assert.equal(withdrawn.state.cash, 1700);
  assert.equal(withdrawn.state.savings, 300);
  assert.equal(depositSavings({ ...original, regionId: 'asia' }, 100).ok, false);
  assert.equal(withdrawSavings(europe, 1).ok, false);
});

test('financial services reject malformed balances before arithmetic', () => {
  const original = startGame(30, { rng: createSeededRandom(31) });
  const badBank = { ...original, regionId: 'europe', cash: Number.NaN };
  const badLender = { ...original, regionId: 'north-america', debt: Number.POSITIVE_INFINITY };

  assert.equal(depositSavings(badBank, 100).state, badBank);
  assert.equal(withdrawSavings({ ...badBank, cash: 100, savings: Number.NaN }, 1).ok, false);
  assert.equal(repayDebt(badLender, 100).state, badLender);
});

test('debt repayment works only in North America and never creates a credit balance', () => {
  const original = startGame(30, { rng: createSeededRandom(31) });
  const lender = { ...original, regionId: 'north-america', cash: 7000 };
  const partial = repayDebt(lender, 1000);
  const overpayment = repayDebt(partial.state, 5000);

  assert.equal(partial.ok, true);
  assert.equal(partial.state.cash, 6000);
  assert.equal(partial.state.debt, 4500);
  assert.equal(overpayment.ok, false);
  assert.equal(repayDebt({ ...lender, regionId: 'africa' }, 100).ok, false);
  assert.equal(repayDebt(lender, 0).ok, false);
  assert.equal(lender.debt, 5500);
});

test('travel changes region, advances one day for free, refreshes prices, and compounds interest', () => {
  const original = startGame(30, { rng: createSeededRandom(40) });
  const state = {
    ...original,
    regionId: 'asia',
    cash: 1234,
    savings: 1000,
    prices: Object.fromEntries(TOKENS.map(({ id }) => [id, 1])),
  };
  const result = travel(state, 'europe', { rng: createSeededRandom(41), randomEvents: false });

  assert.equal(result.ok, true);
  assert.equal(result.state.regionId, 'europe');
  assert.equal(result.state.day, 2);
  assert.equal(result.state.cash, 1234);
  assert.equal(result.state.debt, 5940);
  assert.equal(result.state.savings, 1050);
  assert.notDeepEqual(result.state.prices, state.prices);
  assert.equal(state.day, 1);
});

test('travel rejects the current or unknown region without advancing time', () => {
  const state = { ...startGame(30, { rng: createSeededRandom(42) }), regionId: 'asia' };
  const same = travel(state, 'asia', { rng: createSeededRandom(43), randomEvents: false });
  const unknown = travel(state, 'atlantis', { rng: createSeededRandom(44), randomEvents: false });

  assert.equal(same.ok, false);
  assert.equal(unknown.ok, false);
  assert.equal(same.state.day, 1);
  assert.equal(unknown.state.day, 1);
});

test('travel rejects malformed numeric state before interest or liquidation arithmetic', () => {
  const original = { ...startGame(30, { rng: createSeededRandom(44) }), regionId: 'asia' };
  const badDebt = { ...original, debt: Number.NaN };
  const badDay = { ...original, day: 1.5 };
  const overflowingInterest = { ...original, debt: Number.MAX_SAFE_INTEGER };

  assert.equal(travel(badDebt, 'europe', { rng: () => 0.5, randomEvents: false }).state, badDebt);
  assert.equal(travel(badDay, 'europe', { rng: () => 0.5, randomEvents: false }).state, badDay);
  assert.equal(
    travel(overflowingInterest, 'europe', { rng: () => 0.5, randomEvents: false }).state,
    overflowingInterest,
  );
});

test('the final journey auto-sells holdings and scores cash plus savings without deducting debt', () => {
  const original = startGame(30, { rng: createSeededRandom(45) });
  const state = {
    ...original,
    day: 29,
    regionId: 'asia',
    cash: 100,
    savings: 1000,
    holdings: { ...original.holdings, llamas: 2, gpts: 1 },
  };
  const result = travel(state, 'europe', { rng: () => 0.5, randomEvents: false });

  assert.equal(result.ok, true);
  assert.equal(result.state.status, 'completed');
  assert.equal(result.state.day, 30);
  assert.ok(Object.values(result.state.holdings).every((quantity) => quantity === 0));
  assert.equal(result.state.finalScore, result.state.cash + result.state.savings);
  assert.equal(result.state.debt, 5940);
  assert.ok(result.state.finalScore > 1100);
});

test('travel integrates a random event and an escalating pursuit encounter', () => {
  const original = { ...startGame(30, { rng: createSeededRandom(46) }), regionId: 'asia' };
  const priceRolls = Array(10).fill(0.5);
  const rng = sequence(...priceRolls, 0.18, 0, 0, 0);
  const result = travel(original, 'europe', { rng });

  assert.equal(result.ok, true);
  assert.equal(result.state.lastEvent.kind, 'bonus');
  assert.equal(result.state.cash, 2300);
  assert.ok(result.state.pendingEncounter);
  assert.ok(result.state.pendingEncounter.bribeCost > 0);
});

test('Market Scraper reduces price volatility on later journeys', () => {
  const original = {
    ...startGame(30, { rng: createSeededRandom(47) }),
    regionId: 'asia',
    upgrades: ['market-scraper'],
  };
  const result = travel(original, 'europe', { rng: () => 0, randomEvents: false });

  assert.equal(result.ok, true);
  assert.equal(result.state.prices.llamas, 24);
});

test('deterministic 30, 60, and 90 day runs all reach a valid ending with debt allowed', () => {
  for (const maxDays of [30, 60, 90]) {
    const rng = createSeededRandom(maxDays);
    let state = startGame(maxDays, { rng });

    while (state.status === 'playing') {
      const currentIndex = REGIONS.findIndex(({ id }) => id === state.regionId);
      const targetRegionId = REGIONS[(currentIndex + 1) % REGIONS.length].id;
      state = travel(state, targetRegionId, { rng, randomEvents: false }).state;
    }

    assert.equal(state.status, 'completed');
    assert.equal(state.day, maxDays);
    assert.ok(state.debt > 0);
    assert.ok(Number.isSafeInteger(state.cash));
    assert.ok(Number.isSafeInteger(state.savings));
    assert.equal(state.finalScore, state.cash + state.savings);
  }
});

test('a reproducible normal-flow run can complete after events and an encounter while debt remains', () => {
  let completed = null;

  for (let seed = 1; seed <= 200 && !completed; seed += 1) {
    const rng = createSeededRandom(seed);
    let state = startGame(30, { rng });
    let sawEvent = false;
    let sawEncounter = false;

    while (state.status === 'playing') {
      if (state.pendingEncounter) {
        sawEncounter = true;
        const choice = state.cash >= state.pendingEncounter.bribeCost ? 'bribe' : 'flee';
        state = resolveEncounter(state, choice, rng).state;
        continue;
      }
      const currentIndex = REGIONS.findIndex(({ id }) => id === state.regionId);
      const targetRegionId = REGIONS[(currentIndex + 1) % REGIONS.length].id;
      state = travel(state, targetRegionId, { rng }).state;
      sawEvent ||= Boolean(state.lastEvent);
    }

    if (state.status === 'completed' && sawEvent && sawEncounter && state.debt > 0) completed = state;
  }

  assert.ok(completed);
  assert.equal(completed.finalScore, completed.cash + completed.savings);
});
