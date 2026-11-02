import { TOKENS } from './config.mjs';

// null means no known purchase price, never an inferred current-market price.
export function emptyAveragePrices() {
  return Object.fromEntries(TOKENS.map(({ id }) => [id, null]));
}

export function validAveragePrices(state) {
  return state.averagePrices != null && TOKENS.every(({ id }) => {
    const value = state.averagePrices[id];
    return value === null || (Number.isFinite(value) && value > 0
      && state.holdings?.[id] > 0 && value * state.holdings[id] <= Number.MAX_SAFE_INTEGER);
  });
}

export function clearEmptyAveragePrices(state, holdings) {
  return Object.fromEntries(TOKENS.map(({ id }) => [id, holdings[id] > 0 ? state.averagePrices[id] : null]));
}
