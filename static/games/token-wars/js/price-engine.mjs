import { TOKENS, getRegion } from './config.mjs';
import { nextRandom } from './random.mjs';

export function generatePrices({ regionId, rng, event = null, volatilityScale = 1 }) {
  const region = getRegion(regionId);
  if (typeof rng !== 'function') throw new TypeError('rng must be a function.');
  if (!Number.isFinite(volatilityScale) || volatilityScale <= 0 || volatilityScale > 1) {
    throw new RangeError('Price volatility scale must be greater than 0 and no more than 1.');
  }
  if (event && (!Number.isFinite(event.multiplier) || event.multiplier <= 0)) {
    throw new RangeError('A price event requires a positive multiplier.');
  }

  return Object.fromEntries(TOKENS.map((token) => {
    const randomFactor = 1 + ((nextRandom(rng) * 2 - 1) * token.volatility * volatilityScale);
    const regionFactor = region.tierModifiers[token.tier];
    const eventFactor = event?.tokenIds?.includes(token.id) ? event.multiplier : 1;
    const rawPrice = Math.round(token.basePrice * regionFactor * randomFactor * eventFactor);
    const price = Math.min(token.maxPrice, Math.max(token.minPrice, rawPrice));
    return [token.id, price];
  }));
}
