import { INITIAL_STATE, REGIONS, RUN_LENGTHS, TOKENS, UPGRADES, getToken, validateGameLength } from './config.mjs';
import { generatePrices } from './price-engine.mjs';
import { applyTravelEvent, generateTravelEvent } from './event-engine.mjs';
import { maybeCreateEncounter } from './encounter-engine.mjs';
import { choose, sample } from './random.mjs';

function createEmptyHoldings() {
  return Object.fromEntries(TOKENS.map(({ id }) => [id, 0]));
}

export function startGame(days, { rng = Math.random } = {}) {
  const maxDays = validateGameLength(days);
  const regionId = choose(rng, REGIONS).id;
  const availableUpgrades = sample(rng, UPGRADES, 3).map(({ id }) => id);

  return {
    maxDays,
    day: 1,
    cash: INITIAL_STATE.cash,
    debt: INITIAL_STATE.debt,
    savings: INITIAL_STATE.savings,
    health: INITIAL_STATE.health,
    capacity: INITIAL_STATE.capacity,
    regionId,
    holdings: createEmptyHoldings(),
    prices: generatePrices({ regionId, rng }),
    availableUpgrades,
    upgrades: [],
    pendingEncounter: null,
    lastEvent: null,
    lastMessage: 'VPN connection established. Market feed online.',
    status: 'playing',
    finalScore: null,
    lossReason: null,
  };
}

export function resetGame(_previousState, days, options = {}) {
  return startGame(days, options);
}

function rejected(state, message) {
  return { ok: false, state, message };
}

function accepted(state, message) {
  return { ok: true, state: { ...state, lastMessage: message }, message };
}

function canAct(state) {
  return state.status === 'playing' && !state.pendingEncounter;
}

function validQuantity(quantity) {
  return Number.isSafeInteger(quantity) && quantity > 0;
}

function validTradingState(state) {
  if (!Number.isSafeInteger(state.cash) || state.cash < 0
    || !Number.isSafeInteger(state.capacity) || state.capacity <= 0
    || !TOKENS.every(({ id }) => (
      Number.isSafeInteger(state.prices?.[id])
      && state.prices[id] > 0
      && Number.isSafeInteger(state.holdings?.[id])
      && state.holdings[id] >= 0
    ))) return false;

  const used = TOKENS.reduce((total, { id }) => total + state.holdings[id], 0);
  return Number.isSafeInteger(used) && used <= state.capacity;
}

function validFinancialState(state) {
  return [state.cash, state.savings, state.debt]
    .every((value) => Number.isSafeInteger(value) && value >= 0);
}

function validTravelState(state) {
  return validTradingState(state)
    && validFinancialState(state)
    && Number.isSafeInteger(state.day)
    && state.day >= 1
    && RUN_LENGTHS.includes(state.maxDays)
    && state.day < state.maxDays
    && Number.isSafeInteger(state.health)
    && state.health > 0
    && state.health <= 100;
}

export function inventoryUsed(state) {
  return Object.values(state.holdings).reduce((total, quantity) => total + quantity, 0);
}

export function buyToken(state, tokenId, quantity) {
  const token = getToken(tokenId);
  if (!canAct(state)) return rejected(state, 'Trading is unavailable right now.');
  if (!validTradingState(state)) return rejected(state, 'Market data is invalid. Refresh the run.');
  if (!validQuantity(quantity)) return rejected(state, 'Choose a positive whole-number quantity.');

  const price = state.prices[tokenId];
  const cost = price * quantity;
  if (!Number.isSafeInteger(cost)) return rejected(state, 'Purchase total is outside the safe numeric range.');
  if (cost > state.cash) return rejected(state, 'Not enough cash for that purchase.');
  if (inventoryUsed(state) + quantity > state.capacity) {
    return rejected(state, 'Not enough secure-server capacity.');
  }

  return accepted({
    ...state,
    cash: state.cash - cost,
    holdings: { ...state.holdings, [tokenId]: state.holdings[tokenId] + quantity },
  }, `Bought ${quantity} ${token.name} for $${cost}.`);
}

export function sellToken(state, tokenId, quantity) {
  const token = getToken(tokenId);
  if (!canAct(state)) return rejected(state, 'Trading is unavailable right now.');
  if (!validTradingState(state)) return rejected(state, 'Market data is invalid. Refresh the run.');
  if (!validQuantity(quantity)) return rejected(state, 'Choose a positive whole-number quantity.');
  if (quantity > state.holdings[tokenId]) return rejected(state, `Not enough ${token.name} to sell.`);

  const proceeds = state.prices[tokenId] * quantity;
  if (!Number.isSafeInteger(proceeds) || !Number.isSafeInteger(state.cash + proceeds)) {
    return rejected(state, 'Sale total is outside the safe numeric range.');
  }
  return accepted({
    ...state,
    cash: state.cash + proceeds,
    holdings: { ...state.holdings, [tokenId]: state.holdings[tokenId] - quantity },
  }, `Sold ${quantity} ${token.name} for $${proceeds}.`);
}

export function depositSavings(state, amount) {
  if (!canAct(state)) return rejected(state, 'Banking is unavailable right now.');
  if (state.regionId !== 'europe') return rejected(state, 'The bank is available only in Europe.');
  if (!validFinancialState(state)) return rejected(state, 'Financial data is invalid. Refresh the run.');
  if (!validQuantity(amount)) return rejected(state, 'Choose a positive whole-dollar amount.');
  if (amount > state.cash) return rejected(state, 'Not enough cash to deposit.');
  if (!Number.isSafeInteger(state.savings + amount)) return rejected(state, 'Deposit is outside the safe numeric range.');

  return accepted({ ...state, cash: state.cash - amount, savings: state.savings + amount }, `Deposited $${amount}.`);
}

export function withdrawSavings(state, amount) {
  if (!canAct(state)) return rejected(state, 'Banking is unavailable right now.');
  if (state.regionId !== 'europe') return rejected(state, 'The bank is available only in Europe.');
  if (!validFinancialState(state)) return rejected(state, 'Financial data is invalid. Refresh the run.');
  if (!validQuantity(amount)) return rejected(state, 'Choose a positive whole-dollar amount.');
  if (amount > state.savings) return rejected(state, 'Not enough savings to withdraw.');
  if (!Number.isSafeInteger(state.cash + amount)) return rejected(state, 'Withdrawal is outside the safe numeric range.');

  return accepted({ ...state, cash: state.cash + amount, savings: state.savings - amount }, `Withdrew $${amount}.`);
}

export function repayDebt(state, amount) {
  if (!canAct(state)) return rejected(state, 'Debt repayment is unavailable right now.');
  if (state.regionId !== 'north-america') {
    return rejected(state, 'CRED-I/O Recovery Systems is available only in North America.');
  }
  if (!validFinancialState(state)) return rejected(state, 'Financial data is invalid. Refresh the run.');
  if (!validQuantity(amount)) return rejected(state, 'Choose a positive whole-dollar amount.');
  if (amount > state.cash) return rejected(state, 'Not enough cash for that repayment.');
  if (amount > state.debt) return rejected(state, 'Repayment cannot exceed the outstanding debt.');

  return accepted({ ...state, cash: state.cash - amount, debt: state.debt - amount }, `Repaid $${amount} to CRED-I/O.`);
}

function finishRun(state) {
  let liquidation = 0;
  for (const token of TOKENS) {
    const value = state.holdings[token.id] * state.prices[token.id];
    if (!Number.isSafeInteger(value) || !Number.isSafeInteger(liquidation + value)) return null;
    liquidation += value;
  }
  const cash = state.cash + liquidation;
  if (!Number.isSafeInteger(cash) || !Number.isSafeInteger(cash + state.savings)) return null;
  const holdings = Object.fromEntries(TOKENS.map(({ id }) => [id, 0]));
  return {
    ...state,
    cash,
    holdings,
    status: 'completed',
    finalScore: cash + state.savings,
    pendingEncounter: null,
    lastMessage: 'Time expired. Remaining tokens were sold automatically.',
  };
}

export function travel(state, targetRegionId, { rng = Math.random, randomEvents = true } = {}) {
  if (!canAct(state)) return rejected(state, 'VPN travel is unavailable right now.');
  if (!validTravelState(state)) return rejected(state, 'Run data is invalid. Reset the game.');
  if (!REGIONS.some(({ id }) => id === targetRegionId)) return rejected(state, 'Unknown destination region.');
  if (targetRegionId === state.regionId) return rejected(state, 'Choose a different region.');

  const nextDay = state.day + 1;
  const nextDebt = Math.floor(state.debt * (1 + INITIAL_STATE.debtInterest));
  const nextSavings = Math.floor(state.savings * (1 + INITIAL_STATE.savingsInterest));
  if (!Number.isSafeInteger(nextDebt) || !Number.isSafeInteger(nextSavings)) {
    return rejected(state, 'Interest would exceed the safe numeric range.');
  }
  const travelled = {
    ...state,
    day: nextDay,
    regionId: targetRegionId,
    debt: nextDebt,
    savings: nextSavings,
    prices: generatePrices({
      regionId: targetRegionId,
      rng,
      volatilityScale: state.upgrades.includes('market-scraper') ? 0.75 : 1,
    }),
    lastEvent: null,
    lastMessage: `VPN jump complete: ${targetRegionId}.`,
  };

  if (nextDay >= state.maxDays) {
    const finished = finishRun(travelled);
    if (!finished) return rejected(state, 'Final liquidation would exceed the safe numeric range.');
    return { ok: true, state: finished, message: finished.lastMessage };
  }

  let nextState = travelled;
  if (randomEvents) {
    nextState = applyTravelEvent(nextState, generateTravelEvent(nextState, rng));
    const pendingEncounter = maybeCreateEncounter(nextState, rng);
    if (pendingEncounter) nextState = { ...nextState, pendingEncounter };
  }

  return { ok: true, state: nextState, message: nextState.lastMessage };
}
