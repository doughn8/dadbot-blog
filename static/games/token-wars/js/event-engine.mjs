import { TOKENS, getToken } from './config.mjs';
import { choose, nextRandom } from './random.mjs';

const defineEvent = (definition) => Object.freeze({
  ...definition,
  roll: Object.freeze(definition.roll),
  effect: Object.freeze({
    ...definition.effect,
    ...(definition.effect.multipliers
      ? { multipliers: Object.freeze([...definition.effect.multipliers]) }
      : {}),
    ...(definition.effect.tokenIds
      ? { tokenIds: Object.freeze([...definition.effect.tokenIds]) }
      : {}),
  }),
});
const alwaysEligible = () => true;
const upgradeEligible = (state) => state.availableUpgrades.some((id) => !state.upgrades.includes(id));

export const EVENT_DEFINITIONS = Object.freeze([
  defineEvent({ id: 'market-shock', kind: 'market', text: 'The token market lurches.', roll: { min: 0, max: 0.1 }, eligibility: alwaysEligible, effect: { type: 'random-price-multiplier', multipliers: [0.25, 0.5, 2, 4] } }),
  defineEvent({ id: 'server-repair', kind: 'mishap', text: 'A cooling fan develops opinions. Emergency server repair required.', roll: { min: 0.1, max: 0.17 }, eligibility: alwaysEligible, effect: { type: 'cash-delta', amount: -250 } }),
  defineEvent({ id: 'vpn-renewal', kind: 'mishap', text: 'Your bargain VPN remembers it has a billing department.', roll: { min: 0.1, max: 0.17 }, eligibility: alwaysEligible, effect: { type: 'cash-delta', amount: -150 } }),
  defineEvent({ id: 'keyboard-coffee', kind: 'mishap', text: 'Coffee meets keyboard. The keyboard loses.', roll: { min: 0.1, max: 0.17 }, eligibility: alwaysEligible, effect: { type: 'cash-delta', amount: -100 } }),
  defineEvent({ id: 'wallet-recovery', kind: 'bonus', text: 'An abandoned wallet cache comes back online.', roll: { min: 0.17, max: 0.24 }, eligibility: alwaysEligible, effect: { type: 'cash-delta', amount: 300 } }),
  defineEvent({ id: 'bug-bounty', kind: 'bonus', text: 'A bug bounty pays before Legal changes its mind.', roll: { min: 0.17, max: 0.24 }, eligibility: alwaysEligible, effect: { type: 'cash-delta', amount: 500 } }),
  defineEvent({ id: 'referral-credit', kind: 'bonus', text: 'A forgotten referral code finally does something useful.', roll: { min: 0.17, max: 0.24 }, eligibility: alwaysEligible, effect: { type: 'cash-delta', amount: 200 } }),
  defineEvent({ id: 'wellness-patch', kind: 'bonus', text: 'An ergonomic patch restores some health.', roll: { min: 0.17, max: 0.24 }, eligibility: (state) => state.health < 100, effect: { type: 'health-delta', amount: 15 } }),
  defineEvent({ id: 'cloud-trial', kind: 'bonus', text: 'A temporary cloud trial becomes suspiciously permanent.', roll: { min: 0.17, max: 0.24 }, eligibility: (state) => state.capacity < 150, effect: { type: 'capacity-delta', amount: 10 } }),
  defineEvent({ id: 'encrypted-upgrade', kind: 'upgrade', text: 'An encrypted vendor offers a run upgrade.', roll: { min: 0.24, max: 0.32 }, eligibility: upgradeEligible, effect: { type: 'random-upgrade' } }),
  defineEvent({ id: 'gpt-model-release', kind: 'market', text: 'GPT releases a new model. GPT prices are suddenly sky high.', roll: { min: 0.32, max: 0.37 }, eligibility: alwaysEligible, effect: { type: 'price-multiplier', tokenIds: ['gpts'], multiplier: 6 } }),
]);

export function generateTravelEvent(state, rng) {
  const roll = nextRandom(rng);
  const eligibleDefinitions = EVENT_DEFINITIONS.filter((definition) => (
    roll >= definition.roll.min
    && roll < definition.roll.max
    && definition.eligibility(state)
  ));
  if (eligibleDefinitions.length === 0) return null;

  const definition = choose(rng, eligibleDefinitions);
  if (definition.effect.type === 'random-price-multiplier') {
    const multiplier = choose(rng, definition.effect.multipliers);
    const token = choose(rng, TOKENS);
    return {
      id: `${definition.id}-${token.id}`,
      kind: definition.kind,
      text: `${definition.text} ${token.name} prices ${multiplier < 1 ? 'crash' : 'surge'}.`,
      effect: Object.freeze({
        type: 'price-multiplier',
        tokenIds: Object.freeze([token.id]),
        multiplier,
      }),
    };
  }

  if (definition.effect.type === 'random-upgrade') {
    const eligibleUpgrades = state.availableUpgrades.filter((id) => !state.upgrades.includes(id));
    if (eligibleUpgrades.length === 0) return null;
    const upgradeId = choose(rng, eligibleUpgrades);
    return {
      id: `upgrade-${upgradeId}`,
      kind: definition.kind,
      text: `An encrypted vendor offers a ${upgradeId.replaceAll('-', ' ')} upgrade.`,
      effect: Object.freeze({ type: 'upgrade', upgradeId }),
    };
  }

  return {
    id: definition.id,
    kind: definition.kind,
    text: definition.text,
    effect: definition.effect,
  };
}

function validateConcreteEffect(effect) {
  if (!effect || typeof effect.type !== 'string') throw new TypeError('Event effect is missing.');
  if (['cash-delta', 'health-delta', 'capacity-delta'].includes(effect.type)) {
    if (!Number.isSafeInteger(effect.amount)) {
      throw new RangeError('Event effect amount must be a finite safe integer.');
    }
  }
  if (effect.type === 'price-multiplier') {
    if (!Number.isFinite(effect.multiplier) || effect.multiplier <= 0) {
      throw new RangeError('Price event requires a positive finite multiplier.');
    }
    if (!Array.isArray(effect.tokenIds) || effect.tokenIds.length === 0) {
      throw new RangeError('Price event requires at least one token id.');
    }
  }
}

function validateNumericState(state) {
  const balancesAreValid = [state.cash, state.debt, state.savings]
    .every((value) => Number.isSafeInteger(value) && value >= 0);
  const vitalsAreValid = Number.isSafeInteger(state.health)
    && state.health >= 0
    && state.health <= 100
    && Number.isSafeInteger(state.capacity)
    && state.capacity > 0;
  const marketIsValid = TOKENS.every(({ id }) => (
    Number.isSafeInteger(state.prices?.[id])
    && state.prices[id] > 0
    && Number.isSafeInteger(state.holdings?.[id])
    && state.holdings[id] >= 0
  ));
  if (!balancesAreValid || !vitalsAreValid || !marketIsValid) {
    throw new RangeError('Existing numeric state is invalid.');
  }
}

export function applyTravelEvent(state, event) {
  if (!event) return { ...state, lastEvent: null };
  validateConcreteEffect(event.effect);
  validateNumericState(state);

  if (event.effect?.type === 'price-multiplier') {
    const prices = { ...state.prices };
    for (const tokenId of event.effect.tokenIds) {
      const token = getToken(tokenId);
      if (Number.isFinite(prices[tokenId])) {
        const changedPrice = Math.round(prices[tokenId] * event.effect.multiplier);
        prices[tokenId] = Math.min(token.maxPrice, Math.max(token.minPrice, changedPrice));
      }
    }
    return { ...state, prices, lastEvent: event, lastMessage: event.text };
  }

  if (event.effect?.type === 'cash-delta') {
    const cash = Math.max(0, state.cash + event.effect.amount);
    if (!Number.isSafeInteger(cash)) throw new RangeError('Event result exceeds the safe numeric range.');
    return {
      ...state,
      cash,
      lastEvent: event,
      lastMessage: event.text,
    };
  }

  if (event.effect?.type === 'health-delta') {
    return {
      ...state,
      health: Math.min(100, Math.max(0, state.health + event.effect.amount)),
      lastEvent: event,
      lastMessage: event.text,
    };
  }

  if (event.effect?.type === 'capacity-delta') {
    const capacity = Math.max(1, state.capacity + event.effect.amount);
    if (!Number.isSafeInteger(capacity)) throw new RangeError('Event result exceeds the safe numeric range.');
    return {
      ...state,
      capacity,
      lastEvent: event,
      lastMessage: event.text,
    };
  }

  if (event.effect?.type === 'upgrade') {
    const { upgradeId } = event.effect;
    if (!state.availableUpgrades.includes(upgradeId) || state.upgrades.includes(upgradeId)) {
      return { ...state, lastEvent: null };
    }
    const capacity = state.capacity + (upgradeId === 'server-rack' ? 25 : 0);
    if (!Number.isSafeInteger(capacity)) throw new RangeError('Event result exceeds the safe numeric range.');
    return {
      ...state,
      capacity,
      upgrades: [...state.upgrades, upgradeId],
      lastEvent: event,
      lastMessage: event.text,
    };
  }

  throw new RangeError(`Unknown event effect: ${event.effect?.type ?? 'missing'}`);
}
