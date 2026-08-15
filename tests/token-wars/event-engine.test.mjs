import test from 'node:test';
import assert from 'node:assert/strict';

import { createSeededRandom } from '../../static/games/token-wars/js/random.mjs';
import { startGame } from '../../static/games/token-wars/js/game-engine.mjs';
import {
  applyTravelEvent,
  EVENT_DEFINITIONS,
  generateTravelEvent,
} from '../../static/games/token-wars/js/event-engine.mjs';

function sequence(...values) {
  let index = 0;
  return () => values[Math.min(index++, values.length - 1)];
}

test('event definitions declare roll range, eligibility, and effect data', () => {
  assert.ok(EVENT_DEFINITIONS.length >= 8);
  for (const definition of EVENT_DEFINITIONS) {
    assert.equal(typeof definition.eligibility, 'function');
    assert.ok(Number.isFinite(definition.roll.min));
    assert.ok(Number.isFinite(definition.roll.max));
    assert.equal(typeof definition.effect.type, 'string');
    assert.ok(Object.isFrozen(definition.effect));
    if (definition.effect.multipliers) assert.ok(Object.isFrozen(definition.effect.multipliers));
  }
});

test('generic market shocks are evenly split between price falls and rises', () => {
  const shock = EVENT_DEFINITIONS.find(({ id }) => id === 'market-shock');
  const downward = shock.effect.multipliers.filter((multiplier) => multiplier < 1);
  const upward = shock.effect.multipliers.filter((multiplier) => multiplier > 1);

  assert.ok(downward.length > 0);
  assert.equal(downward.length, upward.length);
});

test('generic market shock news names whether the token crashed or surged', () => {
  const state = startGame(30, { rng: createSeededRandom(57) });
  const crash = generateTravelEvent(state, sequence(0.01, 0, 0, 0));
  const surge = generateTravelEvent(state, sequence(0.01, 0, 0.99, 0));

  assert.ok(crash.effect.multiplier < 1);
  assert.match(crash.text, /crash/i);
  assert.ok(surge.effect.multiplier > 1);
  assert.match(surge.text, /surge/i);
});

test('generated events carry concrete effects resolved from eligible definitions', () => {
  const state = startGame(30, { rng: createSeededRandom(54) });
  const market = generateTravelEvent(state, sequence(0.01, 0, 0, 0));
  const bonus = generateTravelEvent(state, sequence(0.18, 0));

  assert.equal(market.effect.type, 'price-multiplier');
  assert.ok(Array.isArray(market.effect.tokenIds));
  assert.equal(market.effect.tokenIds.length, 1);
  assert.ok(Object.isFrozen(market.effect.tokenIds));
  assert.ok(Number.isFinite(market.effect.multiplier));
  assert.equal(bonus.effect.type, 'cash-delta');
  assert.ok(Number.isFinite(bonus.effect.amount));
});

test('market events modify only their named token prices', () => {
  const initial = startGame(30, { rng: createSeededRandom(50) });
  const state = {
    ...initial,
    prices: { ...initial.prices, llamas: 20, mistrals: 200 },
  };
  const event = {
    id: 'test-boom',
    kind: 'market',
    text: 'Test boom',
    effect: { type: 'price-multiplier', tokenIds: ['llamas'], multiplier: 2 },
  };
  const changed = applyTravelEvent(state, event);

  assert.equal(changed.prices.llamas, 40);
  assert.equal(changed.prices.mistrals, 200);
  assert.equal(state.prices.llamas, 20);
  assert.equal(changed.lastEvent.id, 'test-boom');
});

test('a GPT model release sends only GPT prices sky high', () => {
  const original = startGame(30, { rng: createSeededRandom(202) });
  const state = {
    ...original,
    prices: { ...original.prices, gpts: 10000, claudes: 9000 },
  };

  const event = generateTravelEvent(state, sequence(0.34));
  const changed = applyTravelEvent(state, event);

  assert.equal(event.id, 'gpt-model-release');
  assert.equal(event.kind, 'market');
  assert.match(event.text, /GPT releases a new model.*sky high/i);
  assert.deepEqual(event.effect.tokenIds, ['gpts']);
  assert.equal(changed.prices.gpts, 60000);
  assert.equal(changed.prices.claudes, 9000);
  assert.equal(changed.lastMessage, event.text);
});

test('mishap and bonus events adjust cash without allowing a negative balance', () => {
  const state = { ...startGame(30, { rng: createSeededRandom(51) }), cash: 100 };
  const mishap = applyTravelEvent(state, {
    id: 'repair', kind: 'mishap', text: 'Repair bill', effect: { type: 'cash-delta', amount: -250 },
  });
  const bonus = applyTravelEvent(state, {
    id: 'wallet', kind: 'bonus', text: 'Wallet recovered', effect: { type: 'cash-delta', amount: 300 },
  });

  assert.equal(mishap.cash, 0);
  assert.equal(bonus.cash, 400);
  assert.equal(state.cash, 100);
});

test('health and capacity effects apply bounded data-driven bonuses', () => {
  const state = { ...startGame(30, { rng: createSeededRandom(55) }), health: 92, capacity: 100 };
  const healed = applyTravelEvent(state, {
    id: 'heal', kind: 'bonus', text: 'Health patch', effect: { type: 'health-delta', amount: 15 },
  });
  const expanded = applyTravelEvent(state, {
    id: 'capacity', kind: 'bonus', text: 'Cloud trial', effect: { type: 'capacity-delta', amount: 10 },
  });

  assert.equal(healed.health, 100);
  assert.equal(expanded.capacity, 110);
  assert.equal(state.health, 92);
  assert.equal(state.capacity, 100);
});

test('invalid event effect data is rejected before corrupting numeric state', () => {
  const state = startGame(30, { rng: createSeededRandom(56) });
  assert.throws(
    () => applyTravelEvent(state, {
      id: 'bad-cash', kind: 'bonus', text: 'Bad cash', effect: { type: 'cash-delta', amount: Number.NaN },
    }),
    /finite safe integer/,
  );
  assert.throws(
    () => applyTravelEvent(state, {
      id: 'bad-market', kind: 'market', text: 'Bad market', effect: { type: 'price-multiplier', tokenIds: ['llamas'], multiplier: Number.POSITIVE_INFINITY },
    }),
    /positive finite multiplier/,
  );

  const badState = { ...state, cash: Number.NaN };
  assert.throws(
    () => applyTravelEvent(badState, {
      id: 'valid-cash', kind: 'bonus', text: 'Cash', effect: { type: 'cash-delta', amount: 300 },
    }),
    /numeric state/,
  );
  const overflowState = { ...state, cash: Number.MAX_SAFE_INTEGER };
  assert.throws(
    () => applyTravelEvent(overflowState, {
      id: 'overflow-cash', kind: 'bonus', text: 'Cash', effect: { type: 'cash-delta', amount: 300 },
    }),
    /safe numeric range/,
  );
});

test('upgrade events come only from the run subset and never repeat acquired upgrades', () => {
  const state = {
    ...startGame(30, { rng: createSeededRandom(52) }),
    availableUpgrades: ['server-rack', 'ghost-vpn', 'market-scraper'],
    upgrades: ['ghost-vpn'],
  };
  const event = generateTravelEvent(state, sequence(0.27, 0));
  const upgraded = applyTravelEvent(state, event);
  const upgradeId = event.effect.upgradeId;

  assert.equal(event.kind, 'upgrade');
  assert.ok(['server-rack', 'market-scraper'].includes(upgradeId));
  assert.ok(state.availableUpgrades.includes(upgradeId));
  assert.ok(!state.upgrades.includes(upgradeId));
  assert.ok(upgraded.upgrades.includes(upgradeId));
  if (upgradeId === 'server-rack') assert.equal(upgraded.capacity, 125);
});

test('event rolls can return no event and do not offer upgrades when none remain', () => {
  const state = startGame(30, { rng: createSeededRandom(53) });
  assert.equal(generateTravelEvent(state, () => 0.9), null);

  const exhausted = {
    ...state,
    availableUpgrades: ['ghost-vpn'],
    upgrades: ['ghost-vpn'],
  };
  assert.equal(generateTravelEvent(exhausted, sequence(0.27, 0)), null);
});
