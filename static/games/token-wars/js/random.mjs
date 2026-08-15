export function createSeededRandom(seed) {
  let state = Number(seed) >>> 0;
  return function seededRandom() {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

export function nextRandom(rng) {
  if (typeof rng !== 'function') throw new TypeError('RNG must be a function.');
  const value = rng();
  if (!Number.isFinite(value) || value < 0 || value >= 1) {
    throw new RangeError('RNG must return a finite number from 0 up to, but not including, 1.');
  }
  return value;
}

export function randomInt(rng, minimum, maximum) {
  if (!Number.isInteger(minimum) || !Number.isInteger(maximum) || maximum < minimum) {
    throw new RangeError('randomInt requires integer bounds with maximum >= minimum.');
  }
  return minimum + Math.floor(nextRandom(rng) * (maximum - minimum + 1));
}

export function choose(rng, values) {
  if (!Array.isArray(values) || values.length === 0) {
    throw new RangeError('choose requires at least one value.');
  }
  return values[randomInt(rng, 0, values.length - 1)];
}

export function sample(rng, values, count) {
  if (!Array.isArray(values) || !Number.isInteger(count) || count < 0 || count > values.length) {
    throw new RangeError('sample count must fit inside the source array.');
  }

  const shuffled = [...values];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = randomInt(rng, 0, index);
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }
  return shuffled.slice(0, count);
}
