import type { Agent, AgentEvent, Baseline, ChangePoint } from "@/lib/types";
import { cusum, normalize, percentile, sum } from "./math";

/** Canonical key for a Markov state. Kept coarse enough to learn from few events. */
export function stepKey(event: AgentEvent): string {
  switch (event.type) {
    case "tool.call":
      return `tool:${event.tool ?? "unknown"}`;
    case "data.access":
      return `data:${event.dataClass ?? "unknown"}`;
    case "network.egress":
      return `egress:${event.destination ?? "unknown"}`;
    case "content.read":
      return `content:${event.trust ?? "internal"}`;
    case "delegation":
      return `delegate:${event.targetAgentId ?? "unknown"}`;
    default:
      return event.type;
  }
}

export function distributionOf(
  events: AgentEvent[],
  pick: (event: AgentEvent) => string | undefined,
): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const event of events) {
    const value = pick(event);
    if (!value) continue;
    counts[value] = (counts[value] ?? 0) + 1;
  }
  return normalize(counts);
}

export function buildTransitions(events: AgentEvent[]): Record<string, Record<string, number>> {
  const transitions: Record<string, Record<string, number>> = {};
  for (let i = 0; i < events.length - 1; i++) {
    const from = stepKey(events[i]);
    const to = stepKey(events[i + 1]);
    transitions[from] ??= {};
    transitions[from][to] = (transitions[from][to] ?? 0) + 1;
  }
  // Normalize each row so downstream surprisal is a probability lookup.
  for (const [from, row] of Object.entries(transitions)) {
    transitions[from] = normalize(row);
  }
  return transitions;
}

export function hourDistribution(events: AgentEvent[]): Record<string, number> {
  return distributionOf(events, (event) => String(new Date(event.ts).getUTCHours()));
}

/**
 * Learn a behavior profile from a window of events.
 * Cold-start agents receive role-template priors (passed in as `prior`) and a
 * confidence that grows with sample count: n / (n + k).
 */
export function buildBaseline(
  agent: Agent,
  events: AgentEvent[],
  options: {
    version?: number;
    windowStart: string;
    windowEnd: string;
    prior?: {
      toolDist: Record<string, number>;
      dataDist: Record<string, number>;
      destDist: Record<string, number>;
    };
    k?: number;
  },
): Baseline {
  const k = options.k ?? 120;
  const prior = options.prior;
  const sampleCount = events.length;
  const priorWeight = prior ? Math.min(0.65, 90 / (sampleCount + 90)) : 0;
  const blend = (
    observed: Record<string, number>,
    priorDist?: Record<string, number>,
  ): Record<string, number> => {
    if (!priorDist || priorWeight === 0) return observed;
    const keys = new Set([...Object.keys(priorDist), ...Object.keys(observed)]);
    const blended: Record<string, number> = {};
    for (const key of keys) {
      blended[key] =
        (1 - priorWeight) * (observed[key] ?? 0) + priorWeight * (priorDist[key] ?? 0);
    }
    return blended;
  };

  const toolDist = blend(distributionOf(events, (e) => e.tool), prior?.toolDist);
  const dataDist = blend(distributionOf(events, (e) => e.dataClass), prior?.dataDist);
  const destDist = blend(distributionOf(events, (e) => e.destination), prior?.destDist);
  const egressBytes = events
    .map((event) => event.bytes ?? 0)
    .filter((bytes) => bytes > 0);
  const sessions = new Set(events.map((event) => event.sessionId)).size;

  const confidence = Math.min(0.99, sampleCount / (sampleCount + k)) * (0.85 + 0.15 * (prior ? 1 : 0));
  const status: Baseline["status"] =
    sampleCount < 40 ? "learning" : sampleCount < 900 ? "stable" : "stable";

  return {
    id: `bl-${agent.id}-${options.version ?? 1}`,
    agentId: agent.id,
    version: options.version ?? 1,
    createdAt: options.windowEnd,
    windowStart: options.windowStart,
    windowEnd: options.windowEnd,
    sampleCount,
    confidence: Number(confidence.toFixed(3)),
    status,
    toolDist,
    dataDist,
    destDist,
    hourDist: hourDistribution(events),
    transitions: buildTransitions(events),
    avgEgressBytes: Math.round(
      egressBytes.length ? sum(egressBytes) / egressBytes.length : 0,
    ),
    p95EgressBytes: Math.round(percentile(egressBytes, 0.95)),
    avgStepsPerSession: sessions ? Number((sampleCount / sessions).toFixed(1)) : 0,
    delegationRate: Number(
      (events.filter((e) => e.type === "delegation").length / Math.max(sampleCount, 1)).toFixed(3),
    ),
    changePoints: deriveChangePoints(events, options.windowEnd),
    alignmentSeries: [],
  };
}

/**
 * Change points over daily action volume. Sudden volume shifts are annotated in
 * the Baselines UI and matched against change-management events.
 */
export function deriveChangePoints(events: AgentEvent[], end: string): ChangePoint[] {
  if (events.length === 0) return [];
  const buckets = new Map<string, number>();
  for (const event of events) {
    const day = event.ts.slice(0, 10);
    buckets.set(day, (buckets.get(day) ?? 0) + 1);
  }
  const days = [...buckets.keys()].sort();
  const series = days.map((day) => buckets.get(day) ?? 0);
  const target = sum(series) / Math.max(series.length, 1);
  const points = cusum(series, target, target * 0.08, target * 0.9);
  return points.slice(0, 3).map((point) => ({
    at: `${days[point.index]}T12:00:00.000Z`,
    index: point.index,
    direction: point.direction,
    magnitude: Number(point.magnitude.toFixed(2)),
    explainedBy: point.direction === "up" ? "volume increase" : "volume drop",
  }));
}
