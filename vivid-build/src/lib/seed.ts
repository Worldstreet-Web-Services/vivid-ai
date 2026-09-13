/**
 * Deterministic pseudo-randomness.
 *
 * Every generated project derives its look and copy from a seed hashed off the
 * prompt, so the same prompt always produces the same app (good for demos and
 * screenshots) while different prompts diverge visibly.
 */

/** FNV-1a. Stable across reloads, unlike anything involving Math.random. */
export function hash32(input: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

export type Rng = {
  /** Float in [0, 1). */
  next: () => number;
  /** Integer in [min, max]. */
  int: (min: number, max: number) => number;
  /** An element of `items`. */
  pick: <T>(items: readonly T[]) => T;
  /** True with probability `p`. */
  chance: (p: number) => boolean;
};

/** mulberry32 — small, fast, good enough for picking colours and copy. */
export function createRng(seed: number): Rng {
  let state = seed >>> 0;
  const next = () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const int = (min: number, max: number) => min + Math.floor(next() * (max - min + 1));
  return {
    next,
    int,
    pick: (items) => items[int(0, items.length - 1)],
    chance: (p) => next() < p,
  };
}
