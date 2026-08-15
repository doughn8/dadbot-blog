export const RUN_LENGTHS = Object.freeze([30, 60, 90]);

export const INITIAL_STATE = Object.freeze({
  cash: 2000,
  debt: 5500,
  savings: 0,
  health: 100,
  capacity: 100,
  debtInterest: 0.08,
  savingsInterest: 0.05,
});

export const REGIONS = Object.freeze([
  Object.freeze({ id: 'north-america', name: 'North America', service: 'lender', tierModifiers: Object.freeze({ low: 1.08, mid: 1.08, high: 1.14 }) }),
  Object.freeze({ id: 'south-america', name: 'South America', service: null, tierModifiers: Object.freeze({ low: 0.82, mid: 0.94, high: 1.05 }) }),
  Object.freeze({ id: 'europe', name: 'Europe', service: 'bank', tierModifiers: Object.freeze({ low: 1.02, mid: 1.0, high: 1.03 }) }),
  Object.freeze({ id: 'africa', name: 'Africa', service: null, tierModifiers: Object.freeze({ low: 0.88, mid: 0.97, high: 1.08 }) }),
  Object.freeze({ id: 'asia', name: 'Asia', service: null, tierModifiers: Object.freeze({ low: 0.95, mid: 0.92, high: 0.98 }) }),
  Object.freeze({ id: 'oceania', name: 'Oceania', service: null, tierModifiers: Object.freeze({ low: 1.1, mid: 1.12, high: 1.18 }) }),
]);

export const TOKENS = Object.freeze([
  Object.freeze({ id: 'llamas', name: 'LLaMAs', tier: 'low', minPrice: 5, basePrice: 35, maxPrice: 80, volatility: 0.45 }),
  Object.freeze({ id: 'mistrals', name: 'Mistrals', tier: 'low', minPrice: 25, basePrice: 110, maxPrice: 250, volatility: 0.38 }),
  Object.freeze({ id: 'deepseeks', name: 'DeepSeeks', tier: 'low', minPrice: 75, basePrice: 320, maxPrice: 700, volatility: 0.5 }),
  Object.freeze({ id: 'copilots', name: 'Copilots', tier: 'low', minPrice: 150, basePrice: 680, maxPrice: 1400, volatility: 0.3 }),
  Object.freeze({ id: 'groks', name: 'Groks', tier: 'mid', minPrice: 300, basePrice: 1250, maxPrice: 3000, volatility: 0.48 }),
  Object.freeze({ id: 'geminis', name: 'Geminis', tier: 'mid', minPrice: 500, basePrice: 2400, maxPrice: 6000, volatility: 0.32 }),
  Object.freeze({ id: 'perplexities', name: 'Perplexities', tier: 'mid', minPrice: 1000, basePrice: 4800, maxPrice: 12000, volatility: 0.4 }),
  Object.freeze({ id: 'claudes', name: 'Claudes', tier: 'high', minPrice: 2500, basePrice: 8500, maxPrice: 30000, volatility: 0.3 }),
  Object.freeze({ id: 'gpts', name: 'GPTs', tier: 'high', minPrice: 4000, basePrice: 14500, maxPrice: 60000, volatility: 0.36 }),
  Object.freeze({ id: 'midjourneys', name: 'Midjourneys', tier: 'high', minPrice: 6000, basePrice: 24000, maxPrice: 120000, volatility: 0.52 }),
]);

export const UPGRADES = Object.freeze([
  Object.freeze({ id: 'server-rack', name: 'Server Rack', effect: 'capacity' }),
  Object.freeze({ id: 'ghost-vpn', name: 'Ghost VPN', effect: 'flee' }),
  Object.freeze({ id: 'hardened-firewall', name: 'Hardened Firewall', effect: 'damage' }),
  Object.freeze({ id: 'spoofed-credentials', name: 'Spoofed Credentials', effect: 'bribe' }),
  Object.freeze({ id: 'market-scraper', name: 'Market Scraper', effect: 'market' }),
  Object.freeze({ id: 'recovery-node', name: 'Recovery Node', effect: 'rescue' }),
]);

export function validateGameLength(days) {
  if (!RUN_LENGTHS.includes(days)) {
    throw new RangeError('Game length must be 30, 60, or 90 days.');
  }
  return days;
}

export function getRegion(regionId) {
  const region = REGIONS.find(({ id }) => id === regionId);
  if (!region) throw new RangeError(`Unknown region: ${regionId}`);
  return region;
}

export function getToken(tokenId) {
  const token = TOKENS.find(({ id }) => id === tokenId);
  if (!token) throw new RangeError(`Unknown token: ${tokenId}`);
  return token;
}
