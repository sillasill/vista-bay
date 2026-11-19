// A small seeded random number generator (mulberry32): the same seed gives the
// same city, traffic and pedestrians, which is what makes the screenshot scenes
// repeatable and the game deterministic from ?seed=N.
export function createRandom(seed) {
  let a = seed | 0;
  return function random() {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** An integer in [min, max] from the seeded generator. */
export function randInt(rng, min, max) {
  return min + Math.floor(rng() * (max - min + 1));
}

/** One item of an array, picked by the seeded generator. */
export function pick(rng, items) {
  return items[Math.floor(rng() * items.length)];
}
