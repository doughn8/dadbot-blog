import test from 'node:test';
import assert from 'node:assert/strict';
import { TOKENS } from '../../static/games/token-wars/js/config.mjs';
import { startGame, buyToken, sellToken, travel, resetGame } from '../../static/games/token-wars/js/game-engine.mjs';
import { resolveEncounter } from '../../static/games/token-wars/js/encounter-engine.mjs';

function fresh() { return startGame(30, { rng: () => 0.5 }); }
function buy(state, price, quantity) {
  return buyToken({ ...state, prices: { ...state.prices, llamas: price } }, 'llamas', quantity);
}

test('purchase cost is recorded by the engine and weighted by quantity without changing cash', () => {
  const initial = fresh();
  assert.deepEqual(initial.averagePrices, Object.fromEntries(TOKENS.map(({ id }) => [id, null])));
  const first = buy(initial, 36, 12);
  assert.equal(first.ok, true);
  assert.equal(first.state.averagePrices.llamas, 36);
  const next = buy(first.state, 42, 1);
  assert.equal(next.ok, true);
  assert.equal(next.state.averagePrices.llamas, 474 / 13);
  assert.equal(next.state.cash, 1526);
  assert.equal(first.state.averagePrices.llamas, 36, 'do not mutate prior state');
  assert.equal(initial.averagePrices.llamas, null);
});

test('sales preserve the remaining average and full liquidation/reset clear it', () => {
  const held = buy(fresh(), 36, 12).state;
  const partial = sellToken(held, 'llamas', 3);
  assert.equal(partial.ok, true);
  assert.equal(partial.state.averagePrices.llamas, 36);
  const all = sellToken(partial.state, 'llamas', 9);
  assert.equal(all.state.averagePrices.llamas, null);
  assert.equal(buy(all.state, 42, 1).state.averagePrices.llamas, 42);
  const end = travel({ ...held, day: 29, regionId: 'asia' }, 'europe', { rng: () => 0.5, randomEvents: false }).state;
  assert.equal(end.status, 'completed');
  assert.ok(Object.values(end.averagePrices).every(v => v === null));
  assert.equal(end.finalScore, end.cash + end.savings);
  assert.ok(Object.values(resetGame(held, 60).averagePrices).every(v => v === null));
});

test('seizure preserves average for remaining units and clears a fully seized position', () => {
  for (const quantity of [1, 12]) {
    const held = buy(fresh(), 36, quantity).state;
    const pendingEncounter = { source: 'Rival hackers', bribeCost: 300, damage: 20, reward: 100 };
    const failed = resolveEncounter({ ...held, pendingEncounter }, 'flee', () => 0.8);
    assert.equal(failed.ok, true);
    assert.equal(failed.state.averagePrices.llamas, failed.state.holdings.llamas > 0 ? 36 : null);
    assert.equal(held.averagePrices.llamas, 36);
  }
});

test('invalid cost data and rejected trades never corrupt holdings, cash or cost state', () => {
  const held = buy(fresh(), 36, 12).state;
  for (const bad of [NaN, Infinity, -1, 0, Number.MAX_SAFE_INTEGER]) {
    const state = { ...held, averagePrices: { ...held.averagePrices, llamas: bad } };
    assert.equal(buyToken(state, 'llamas', 1).ok, false);
    assert.equal(sellToken(state, 'llamas', 1).state, state);
  }
  for (const result of [buyToken(held, 'llamas', 9999), sellToken(held, 'llamas', 13)]) {
    assert.equal(result.ok, false);
    assert.equal(result.state, held);
  }
  const missingHoldings = { ...held, holdings: undefined };
  assert.equal(buyToken(missingHoldings, 'llamas', 1).state, missingHoldings);
  const missing = { ...held, averagePrices: { ...held.averagePrices, llamas: null } };
  assert.equal(buyToken(missing, 'llamas', 1).ok, false, 'never infer an unknown historical cost');
});
