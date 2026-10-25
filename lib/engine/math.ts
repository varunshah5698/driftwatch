/** Small, dependency-free numeric helpers used by the drift engine. */

export const clamp = (value: number, min = 0, max = 1): number =>
  Math.min(max, Math.max(min, value));

export const sigmoid = (x: number): number => 1 / (1 + Math.exp(-x));

export const mean = (values: number[]): number =>
  values.length === 0 ? 0 : values.reduce((a, b) => a + b, 0) / values.length;

export const sum = (values: number[]): number =>
  values.reduce((a, b) => a + b, 0);

export const round = (value: number, digits = 0): number => {
  const f = 10 ** digits;
  return Math.round(value * f) / f;
};

export function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = clamp(p, 0, 1) * (sorted.length - 1);
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
}

/** Normalize raw counts into a probability distribution. */
export function normalize(counts: Record<string, number>): Record<string, number> {
  const total = sum(Object.values(counts));
  if (total <= 0) return {};
  const out: Record<string, number> = {};
  for (const [key, value] of Object.entries(counts)) {
    out[key] = value / total;
  }
  return out;
}

/**
 * Jensen-Shannon divergence, base 2, bounded 0..1.
 * 0 means identical distributions, 1 means disjoint support.
 */
export function jsDivergence(
  p: Record<string, number>,
  q: Record<string, number>,
): number {
  const keys = new Set([...Object.keys(p), ...Object.keys(q)]);
  if (keys.size === 0) return 0;

  // A tiny floor keeps KL finite for unseen categories, but remains far below
  // any meaningful mass so disjoint supports still score close to 1.
  const eps = 1e-6;
  let divergence = 0;
  for (const key of keys) {
    const pv = Math.max(p[key] ?? 0, eps);
    const qv = Math.max(q[key] ?? 0, eps);
    const mid = (pv + qv) / 2;
    divergence += 0.5 * pv * Math.log2(pv / mid) + 0.5 * qv * Math.log2(qv / mid);
  }
  return clamp(divergence);
}

/** Laplace-smoothed surprisal for a transition under a Markov model. */
export function surprisal(
  transitions: Record<string, Record<string, number>>,
  from: string,
  to: string,
  vocabulary: string[],
): number {
  const row = transitions[from];
  const smoothing = 1 / Math.max(vocabulary.length, 8);
  if (!row) return -Math.log2(smoothing);
  const total = sum(Object.values(row));
  if (total === 0) return -Math.log2(smoothing);
  const probability = ((row[to] ?? 0) + smoothing) / (total + 1);
  return -Math.log2(probability);
}

/**
 * Two-sided CUSUM change-point detector. Emits an index each time the
 * cumulative deviation from `target` exceeds `threshold`, then resets.
 */
export function cusum(
  series: number[],
  target: number,
  slack: number,
  threshold: number,
): { index: number; direction: "up" | "down"; magnitude: number }[] {
  let positive = 0;
  let negative = 0;
  const points: { index: number; direction: "up" | "down"; magnitude: number }[] = [];

  series.forEach((value, index) => {
    positive = Math.max(0, positive + (value - target) - slack);
    negative = Math.max(0, negative + (target - value) - slack);
    if (positive > threshold || negative > threshold) {
      points.push({
        index,
        direction: positive > threshold ? "up" : "down",
        magnitude: Math.max(positive, negative),
      });
      positive = 0;
      negative = 0;
    }
  });

  return points;
}

/** Deterministic 32-bit string hash (FNV-1a) for stable pseudo-random choices. */
export function hashString(input: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/** Approximate Shannon entropy in bits, normalized by log2(cardinality). */
export function normalizedEntropy(values: number[]): number {
  const total = sum(values);
  if (total <= 0 || values.length < 2) return 0;
  let entropy = 0;
  for (const value of values) {
    if (value <= 0) continue;
    const p = value / total;
    entropy -= p * Math.log2(p);
  }
  return clamp(entropy / Math.log2(values.length));
}
