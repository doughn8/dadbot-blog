import test from 'node:test';
import assert from 'node:assert/strict';

import { createSeededRandom } from '../../static/games/token-wars/js/random.mjs';
import { startGame } from '../../static/games/token-wars/js/game-engine.mjs';
import {
  calculateDebtPressure,
  maybeCreateEncounter,
  resolveEncounter,
} from '../../static/games/token-wars/js/encounter-engine.mjs';

function sequence(...values) {
  let index = 0;
  return () => values[Math.min(index++, values.length - 1)];
}

function withEncounter(overrides = {}) {
  const state = startGame(30, { rng: createSeededRandom(60) });
  return {
    ...state,
    pendingEncounter: {
      id: 'test-encounter',
      source: 'Rival hackers',
      bribeCost: 300,
      damage: 20,
      reward: 400,
      ...overrides,
    },
  };
}

test('debt pressure rises with time and debt and falls after repayment', () => {
  const early = calculateDebtPressure({ day: 1, maxDays: 30, debt: 5500 });
  const late = calculateDebtPressure({ day: 25, maxDays: 30, debt: 5500 });
  const reduced = calculateDebtPressure({ day: 25, maxDays: 30, debt: 500 });

  assert.equal(calculateDebtPressure({ day: 25, maxDays: 30, debt: 0 }), 0);
  assert.ok(late > early);
  assert.ok(late > reduced);
  assert.ok(late <= 100);
});

test('encounter chance escalates and high pressure summons CRED-I/O', () => {
  const state = { ...startGame(30, { rng: createSeededRandom(61) }), day: 29, debt: 50000 };
  const encounter = maybeCreateEncounter(state, () => 0);
  const none = maybeCreateEncounter(state, () => 0.99);

  assert.equal(encounter.source, 'CRED-I/O Recovery Systems');
  assert.ok(encounter.bribeCost > 0);
  assert.ok(encounter.damage > 0);
  assert.equal(none, null);
});

test('encounter creation rejects malformed or overflowing state before arithmetic', () => {
  const valid = startGame(30, { rng: createSeededRandom(63) });
  const malformedStates = [
    { ...valid, day: Number.NaN },
    { ...valid, day: Number.MAX_SAFE_INTEGER },
    { ...valid, maxDays: Number.POSITIVE_INFINITY },
    { ...valid, debt: Number.NaN },
    { ...valid, debt: Number.POSITIVE_INFINITY },
  ];

  for (const state of malformedStates) {
    assert.throws(
      () => calculateDebtPressure(state),
      /Encounter state/,
    );
    assert.throws(
      () => maybeCreateEncounter(state, () => 0),
      /Encounter state/,
    );
  }
});

test('encounter creation and resolution reject invalid RNG output', () => {
  const highPressure = { ...startGame(30, { rng: createSeededRandom(62) }), day: 29, debt: 50000 };
  assert.throws(() => maybeCreateEncounter(highPressure, () => Number.NaN), /RNG/);
  assert.throws(() => resolveEncounter(withEncounter(), 'fight', () => Number.NaN), /RNG/);
});

test('encounter resolution rejects malformed or overflowing numeric data without mutation', () => {
  const badBribe = withEncounter({ bribeCost: Number.NaN });
  const badReward = withEncounter({ reward: Number.POSITIVE_INFINITY });
  const badDamage = withEncounter({ damage: -1 });
  const badDebt = withEncounter();
  badDebt.debt = Number.NaN;
  const overflowingReward = withEncounter({ reward: 1 });
  overflowingReward.cash = Number.MAX_SAFE_INTEGER;

  for (const [state, choice] of [
    [badBribe, 'bribe'],
    [badReward, 'fight'],
    [badDamage, 'fight'],
    [badDebt, 'flee'],
    [overflowingReward, 'fight'],
  ]) {
    const resolved = resolveEncounter(state, choice, () => 0);
    assert.equal(resolved.ok, false);
    assert.equal(resolved.state, state);
  }
});

test('Fight risks health but can award cash and a run-eligible upgrade', () => {
  const state = {
    ...withEncounter(),
    availableUpgrades: ['ghost-vpn', 'market-scraper', 'server-rack'],
    upgrades: [],
  };
  const won = resolveEncounter(state, 'fight', sequence(0.1, 0.1, 0));
  const hurt = resolveEncounter(withEncounter(), 'fight', () => 0.8);

  assert.equal(won.ok, true);
  assert.equal(won.state.cash, state.cash + 400);
  assert.equal(won.state.pendingEncounter, null);
  assert.equal(won.state.upgrades.length, 1);
  assert.ok(state.availableUpgrades.includes(won.state.upgrades[0]));
  assert.equal(hurt.ok, true);
  assert.equal(hurt.state.health, 80);
  assert.equal(hurt.state.pendingEncounter, null);
});

test('a Fight reward never installs a Server Rack beyond the safe numeric range', () => {
  const state = withEncounter({ reward: 0 });
  state.capacity = Number.MAX_SAFE_INTEGER;
  state.availableUpgrades = ['server-rack'];
  const fought = resolveEncounter(state, 'fight', sequence(0.1, 0.1, 0));

  assert.equal(fought.ok, true);
  assert.equal(fought.state.capacity, Number.MAX_SAFE_INTEGER);
  assert.ok(!fought.state.upgrades.includes('server-rack'));
});

test('Hardened Firewall reduces damage without increasing Fight success chance', () => {
  const state = withEncounter({ damage: 20 });
  state.upgrades = ['hardened-firewall'];
  const result = resolveEncounter(state, 'fight', () => 0.6);

  assert.equal(result.ok, true);
  assert.equal(result.state.health, 88);
  assert.equal(result.state.cash, state.cash);
  assert.equal(result.state.pendingEncounter, null);
});

test('Recovery Node rescue preserves its message and reports no negative health loss', () => {
  const state = withEncounter({ damage: 20 });
  state.health = 10;
  state.upgrades = ['recovery-node'];
  const result = resolveEncounter(state, 'fight', () => 0.6);

  assert.equal(result.ok, true);
  assert.equal(result.state.health, 25);
  assert.ok(!result.state.upgrades.includes('recovery-node'));
  assert.match(result.message, /Recovery Node burned out/);
  assert.doesNotMatch(result.message, /Lost -/);
  assert.equal(result.state.pendingEncounter, null);
});

test('Bribe costs cash and remains unresolved when unaffordable', () => {
  const paid = resolveEncounter(withEncounter(), 'bribe', () => 0.5);
  const poor = withEncounter();
  poor.cash = 100;
  const rejected = resolveEncounter(poor, 'bribe', () => 0.5);

  assert.equal(paid.ok, true);
  assert.equal(paid.state.cash, 1700);
  assert.equal(paid.state.pendingEncounter, null);
  assert.equal(rejected.ok, false);
  assert.equal(rejected.state.pendingEncounter.id, 'test-encounter');
  assert.equal(rejected.state.cash, 100);
});

test('failed Flee randomly seizes one held token while a successful Flee clears the encounter', () => {
  const state = withEncounter();
  state.holdings = { ...state.holdings, llamas: 8, gpts: 3 };
  const llamasSeized = resolveEncounter(state, 'flee', sequence(0.8, 0, 0.5));
  const gptsSeized = resolveEncounter(state, 'flee', sequence(0.8, 0.99, 0));
  const escaped = resolveEncounter(state, 'flee', () => 0.1);

  assert.equal(llamasSeized.ok, true);
  assert.equal(llamasSeized.state.holdings.llamas, 5);
  assert.equal(llamasSeized.state.holdings.gpts, 3);
  assert.equal(gptsSeized.state.holdings.llamas, 8);
  assert.equal(gptsSeized.state.holdings.gpts, 2);
  assert.equal(llamasSeized.state.pendingEncounter, null);
  assert.equal(escaped.state.holdings.llamas, 8);
  assert.equal(escaped.state.pendingEncounter, null);
});

test('capture or zero health ends the run immediately', () => {
  const captured = resolveEncounter(withEncounter(), 'fight', () => 0.99);
  const fragile = withEncounter({ damage: 20 });
  fragile.health = 10;
  const defeated = resolveEncounter(fragile, 'fight', () => 0.8);

  assert.equal(captured.state.status, 'lost');
  assert.equal(captured.state.lossReason, 'captured');
  assert.equal(defeated.state.status, 'lost');
  assert.equal(defeated.state.health, 0);
  assert.equal(defeated.state.lossReason, 'health');
});

test('unknown encounter choices are rejected without changing state', () => {
  const state = withEncounter();
  const result = resolveEncounter(state, 'negotiate', () => 0.5);
  assert.equal(result.ok, false);
  assert.equal(result.state, state);
});
