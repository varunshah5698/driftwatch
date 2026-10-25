import { describe, expect, it } from "vitest";
import { rebalanceFactors, scoreSignals, topFactors } from "@/lib/engine/scoring";
import { ALERT_THRESHOLD, severityFor } from "@/lib/domain";

const signal = (value: number, observed = "observed") => ({
  value,
  observed,
  expected: "baseline",
  detail: "test signal",
});

describe("weighted logistic scorer", () => {
  it("keeps quiet in-role behavior below the review threshold", () => {
    const result = scoreSignals({});
    expect(result.score).toBeLessThan(ALERT_THRESHOLD);
    expect(result.severity).toBe("info");
    expect(result.factors.every((factor) => factor.points === 0)).toBe(true);
  });

  it("always decomposes the score into integer contributions that sum to it", () => {
    const result = scoreSignals({
      scope: signal(0.82),
      injection: signal(0.63),
      exfiltration: signal(0.44),
      drift: signal(0.2),
    });
    const total = result.factors.reduce((sum, factor) => sum + factor.points, 0);
    expect(total).toBe(result.score);
    expect(result.factors.every((factor) => Number.isInteger(factor.points))).toBe(true);
    expect(result.factors.every((factor) => factor.points >= 0)).toBe(true);
  });

  it("maps scores to the documented severity bands", () => {
    expect(severityFor(100)).toBe("critical");
    expect(severityFor(85)).toBe("critical");
    expect(severityFor(84)).toBe("high");
    expect(severityFor(70)).toBe("high");
    expect(severityFor(69)).toBe("medium");
    expect(severityFor(50)).toBe("medium");
    expect(severityFor(49)).toBe("low");
    expect(severityFor(10)).toBe("info");
  });

  it("increases monotonically with stronger signals", () => {
    const low = scoreSignals({ scope: signal(0.1) }).score;
    const medium = scoreSignals({ scope: signal(0.5) }).score;
    const high = scoreSignals({ scope: signal(1) }).score;
    expect(low).toBeLessThan(medium);
    expect(medium).toBeLessThan(high);
  });

  it("rebalances capped scores without breaking the sum invariant", () => {
    const result = scoreSignals({ scope: signal(1), drift: signal(0.8), injection: signal(0.6) });
    const rebalanced = rebalanceFactors(result.factors, 58);
    expect(rebalanced.reduce((sum, factor) => sum + factor.points, 0)).toBe(58);
    expect(topFactors(rebalanced, 3).length).toBeGreaterThan(0);
  });
});
