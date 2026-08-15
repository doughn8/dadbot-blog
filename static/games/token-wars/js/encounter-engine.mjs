import { RUN_LENGTHS, TOKENS } from './config.mjs';
import { choose, nextRandom } from './random.mjs';

const ENCOUNTER_SOURCES = Object.freeze([
  'Corporate AI security',
  'Government regulators',
  'Rival hackers',
]);

function clamp(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, value));
}

function result(ok, state, message) {
  return { ok, state, message };
}

function validatePressureState({ day, maxDays, debt }) {
  if (!Number.isSafeInteger(day)
    || day < 1
    || !RUN_LENGTHS.includes(maxDays)
    || day > maxDays
    || !Number.isSafeInteger(debt)
    || debt < 0) {
    throw new RangeError('Encounter state requires a valid day, run length, and debt balance.');
  }
}

export function calculateDebtPressure({ day, maxDays, debt }) {
  validatePressureState({ day, maxDays, debt });
  if (debt <= 0) return 0;
  const timeRatio = clamp((day - 1) / Math.max(1, maxDays - 1), 0, 1);
  const debtRatio = clamp(debt / 5500, 0, 1.5) / 1.5;
  return Math.round(clamp((timeRatio * 55) + (debtRatio * 45), 0, 100));
}

export function maybeCreateEncounter(state, rng) {
  const pressure = calculateDebtPressure(state);
  const chance = 0.05 + (pressure * 0.004);
  if (nextRandom(rng) >= chance) return null;

  const source = pressure >= 70
    ? 'CRED-I/O Recovery Systems'
    : choose(rng, ENCOUNTER_SOURCES);
  const bribeDiscount = state.upgrades.includes('spoofed-credentials') ? 0.6 : 1;

  return {
    id: `${source.toLowerCase().replaceAll(/[^a-z0-9]+/g, '-')}-${state.day}`,
    source,
    pressure,
    bribeCost: Math.max(100, Math.round((200 + state.day * 25) * (1 + pressure / 100) * bribeDiscount)),
    damage: 15 + Math.round(pressure / 10),
    reward: 200 + state.day * 20,
  };
}

function acquireRandomUpgrade(state, rng) {
  const eligible = state.availableUpgrades.filter((id) => !state.upgrades.includes(id));
  if (eligible.length === 0 || nextRandom(rng) >= 0.35) return state;
  const upgradeId = choose(rng, eligible);
  const capacity = state.capacity + (upgradeId === 'server-rack' ? 25 : 0);
  if (!Number.isSafeInteger(capacity)) return state;
  return {
    ...state,
    capacity,
    upgrades: [...state.upgrades, upgradeId],
  };
}

function loseRun(state, reason, message) {
  return {
    ...state,
    health: reason === 'health' ? 0 : state.health,
    status: 'lost',
    lossReason: reason,
    pendingEncounter: null,
    lastMessage: message,
  };
}

function applyDamage(state, damage) {
  const adjustedDamage = state.upgrades.includes('hardened-firewall')
    ? Math.max(1, Math.round(damage * 0.6))
    : damage;
  const health = Math.max(0, state.health - adjustedDamage);

  if (health > 0) return { ...state, health };
  if (state.upgrades.includes('recovery-node')) {
    return {
      ...state,
      health: 25,
      upgrades: state.upgrades.filter((id) => id !== 'recovery-node'),
      lastMessage: 'Recovery Node burned out and restored emergency health.',
    };
  }
  return loseRun({ ...state, health: 0 }, 'health', 'Your health reached zero. Connection terminated.');
}

function seizeRandomTokens(holdings, rng) {
  const heldTokenIds = Object.entries(holdings)
    .filter(([, quantity]) => quantity > 0)
    .map(([tokenId]) => tokenId);
  if (heldTokenIds.length === 0) return { ...holdings };

  const tokenId = choose(rng, heldTokenIds);
  const fraction = 0.1 + nextRandom(rng) * 0.4;
  const seized = Math.ceil(holdings[tokenId] * fraction);
  return { ...holdings, [tokenId]: Math.max(0, holdings[tokenId] - seized) };
}

function validEncounterData(state, encounter) {
  const stateValuesAreValid = [state.cash, state.debt, state.savings, state.day, state.maxDays]
    .every((value) => Number.isSafeInteger(value) && value >= 0)
    && Number.isSafeInteger(state.health)
    && state.health >= 0
    && state.health <= 100
    && Number.isSafeInteger(state.capacity)
    && state.capacity > 0
    && Array.isArray(state.upgrades)
    && Array.isArray(state.availableUpgrades)
    && TOKENS.every(({ id }) => Number.isSafeInteger(state.holdings?.[id]) && state.holdings[id] >= 0);
  const encounterValuesAreValid = Number.isSafeInteger(encounter.bribeCost)
    && encounter.bribeCost >= 0
    && Number.isSafeInteger(encounter.damage)
    && encounter.damage > 0
    && Number.isSafeInteger(encounter.reward)
    && encounter.reward >= 0;
  return stateValuesAreValid
    && encounterValuesAreValid
    && Number.isSafeInteger(state.cash + encounter.reward);
}

export function resolveEncounter(state, choice, rng) {
  const encounter = state.pendingEncounter;
  if (!encounter || state.status !== 'playing') {
    return result(false, state, 'There is no active encounter to resolve.');
  }
  if (!['fight', 'bribe', 'flee'].includes(choice)) {
    return result(false, state, 'Choose Fight, Bribe, or Flee.');
  }
  if (!validEncounterData(state, encounter)) {
    return result(false, state, 'Encounter numeric data is invalid. Reset the run.');
  }

  if (choice === 'bribe') {
    if (state.cash < encounter.bribeCost) {
      return result(false, state, 'Not enough cash to pay the bribe.');
    }
    const next = {
      ...state,
      cash: state.cash - encounter.bribeCost,
      pendingEncounter: null,
      lastMessage: `Paid $${encounter.bribeCost}. The connection is clear.`,
    };
    return result(true, next, next.lastMessage);
  }

  const roll = nextRandom(rng);
  if (roll >= 0.97) {
    const lost = loseRun(state, 'captured', `${encounter.source} captured your connection.`);
    return result(true, lost, lost.lastMessage);
  }

  if (choice === 'fight') {
    const fightChance = 0.55;
    if (roll < fightChance) {
      let next = {
        ...state,
        cash: state.cash + encounter.reward,
        pendingEncounter: null,
        lastMessage: `Counterattack succeeded. Recovered $${encounter.reward}.`,
      };
      next = acquireRandomUpgrade(next, rng);
      return result(true, next, next.lastMessage);
    }

    const hadRecoveryNode = state.upgrades.includes('recovery-node');
    const damaged = applyDamage(state, encounter.damage);
    const usedRecoveryNode = hadRecoveryNode && !damaged.upgrades.includes('recovery-node');
    const next = damaged.status === 'lost'
      ? damaged
      : {
        ...damaged,
        pendingEncounter: null,
        lastMessage: usedRecoveryNode
          ? damaged.lastMessage
          : `Counterattack failed. Lost ${state.health - damaged.health} health.`,
      };
    return result(true, next, next.lastMessage);
  }

  const pressure = calculateDebtPressure(state);
  const fleeChance = clamp(0.55 + (state.upgrades.includes('ghost-vpn') ? 0.2 : 0) - pressure * 0.002, 0.2, 0.85);
  if (roll < fleeChance) {
    const next = { ...state, pendingEncounter: null, lastMessage: 'VPN route scrambled. You escaped.' };
    return result(true, next, next.lastMessage);
  }

  const next = {
    ...state,
    holdings: seizeRandomTokens(state.holdings, rng),
    pendingEncounter: null,
    lastMessage: 'Escape failed. A random portion of one token holding was seized.',
  };
  return result(true, next, next.lastMessage);
}
