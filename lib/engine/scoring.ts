import { FACTOR_META, FACTOR_ORDER, SCORE_BIAS, severityFor } from "@/lib/domain";
import type { Factor, FactorKey, ScoreResult, Severity } from "@/lib/types";
import { clamp, round, sigmoid } from "./math";

export interface FeatureInput {
  value: number;
  observed: string;
  expected: string;
  detail: string;
}

const emptyFactor = (key: FactorKey): Factor => ({
  key,
  label: FACTOR_META[key].label,
  value: 0,
  observed: "none",
  expected: "learned baseline",
  weight: FACTOR_META[key].weight,
  points: 0,
  detail: FACTOR_META[key].short,
});

/**
 * Weighted logistic scorer.
 *
 *   z = bias + Σ w_i · x_i        (x_i normalized 0..1)
 *   score = 100 · σ(z)
 *
 * Contributions are the share of the final score attributable to each factor,
 * allocated from its log-odds contribution. They are rounded to integers and
 * the rounding remainder is assigned to the strongest factor, so the invariant
 * `Σ contributions.points === score` always holds. This is what makes every
 * alert decomposable and auditable.
 */
export function scoreSignals(
  signals: Partial<Record<FactorKey, FeatureInput>>,
  options: { confidence?: number; correlationPenalty?: number } = {},
): ScoreResult {
  const factors: Factor[] = FACTOR_ORDER.map((key) => {
    const signal = signals[key];
    const factor = emptyFactor(key);
    if (!signal) return factor;
    return {
      ...factor,
      value: round(clamp(signal.value), 4),
      observed: signal.observed,
      expected: signal.expected,
      detail: signal.detail,
    };
  });

  const logits = factors.map((factor) =>
    Math.max(0, factor.weight * factor.value),
  );
  const positive = logits.reduce((a, b) => a + b, 0);
  const z = SCORE_BIAS + positive - (options.correlationPenalty ?? 0);
  const score = clamp(Math.round(100 * sigmoid(z)), 0, 100);

  if (positive > 0 && score > 0) {
    let allocated = 0;
    factors.forEach((factor, index) => {
      factor.points = Math.max(
        0,
        Math.round((score * logits[index]) / positive),
      );
      allocated += factor.points;
    });
    let remainder = score - allocated;
    if (remainder !== 0) {
      const strongest = factors.reduce(
        (best, factor) => (factor.points > best.points ? factor : best),
        factors[0],
      );
      // Also guard the impossible case where rounding over-allocated.
      if (remainder > 0) {
        strongest.points += remainder;
      } else {
        while (remainder < 0) {
          const target = [...factors]
            .filter((factor) => factor.points > 0)
            .sort((a, b) => b.points - a.points)[0];
          if (!target) break;
          target.points -= 1;
          remainder += 1;
        }
      }
    }
  }

  return {
    score,
    severity: severityFor(score),
    confidence: options.confidence ?? 0.86,
    factors: factors.sort((a, b) => b.points - a.points),
    logit: round(z, 3),
  };
}

/** Rescale existing contributions so they sum exactly to `target`.
 * Used when change management lowers an alert score after scoring: the
 * decomposition must always add up to the displayed total. */
export function rebalanceFactors(factors: Factor[], target: number): Factor[] {
  const total = factors.reduce((sum, factor) => sum + factor.points, 0);
  const bounded = clamp(Math.round(target), 0, 100);
  if (total === 0) return factors;
  const scaled = factors.map((factor) => ({
    ...factor,
    points: Math.floor((factor.points / total) * bounded),
  }));
  let remainder = bounded - scaled.reduce((sum, factor) => sum + factor.points, 0);
  const order = [...scaled].sort((a, b) => b.points - a.points);
  let index = 0;
  while (remainder > 0) {
    order[index % order.length].points += 1;
    remainder -= 1;
    index += 1;
  }
  return scaled.sort((a, b) => b.points - a.points);
}

/** Points contributed by a subset — used by the "why not higher" preview. */
export function scoreWithFactors(factors: Factor[], keep: FactorKey[]): number {
  const inputs: Partial<Record<FactorKey, FeatureInput>> = {};
  for (const factor of factors) {
    if (!keep.includes(factor.key)) continue;
    inputs[factor.key] = {
      value: factor.value,
      observed: factor.observed,
      expected: factor.expected,
      detail: factor.detail,
    };
  }
  return scoreSignals(inputs).score;
}

export const severityRank: Record<Severity, number> = {
  critical: 5,
  high: 4,
  medium: 3,
  low: 2,
  info: 1,
};

export function topFactors(factors: Factor[], count = 3): Factor[] {
  return [...factors]
    .filter((factor) => factor.points > 0)
    .sort((a, b) => b.points - a.points)
    .slice(0, count);
}
