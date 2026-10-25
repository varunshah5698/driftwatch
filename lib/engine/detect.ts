import type {
  Agent,
  AgentEvent,
  Alert,
  Baseline,
  ChangeEvent,
  Factor,
  RoleManifest,
  ScoreResult,
  Severity,
} from "@/lib/types";
import { ALERT_THRESHOLD, isRestricted } from "@/lib/domain";
import { extractFeatures, type FeatureBundle } from "./features";
import { rebalanceFactors, scoreSignals, topFactors } from "./scoring";
import { hashString, round } from "./math";

export interface Evaluation {
  result: ScoreResult;
  bundle: FeatureBundle;
  capped?: string;
}

export function scoreWindow(input: {
  manifest: RoleManifest;
  baseline: Baseline;
  events: AgentEvent[];
}): Evaluation {
  const bundle = extractFeatures(input);
  const result = scoreSignals(bundle.signals, {
    confidence: input.baseline.confidence,
  });
  return { result, bundle };
}

/**
 * Change management: an approved deploy / role update / task shift opens a
 * grace window. If the anomalous behavior matches the declared expected shift
 * and there is no canary or restricted-data evidence, the score is capped at
 * "medium" so legit change never pages as Critical.
 */
export function applyChangeManagement(
  result: ScoreResult,
  changes: ChangeEvent[],
  nowIso: string,
  agentId?: string,
): { score: number; severity: Severity; adjustment?: string } {
  const now = new Date(nowIso).getTime();
  const topKeys = new Set(topFactors(result.factors, 2).map((factor) => factor.key));
  const matching = changes.find((change) => {
    if (agentId && change.agentId !== agentId) return false;
    const age = now - new Date(change.at).getTime();
    return (
      age >= 0 &&
      age <= change.graceHours * 3600_000 &&
      change.expectedShift.some((key) => topKeys.has(key))
    );
  });

  if (!matching || result.score < ALERT_THRESHOLD) {
    return { score: result.score, severity: result.severity };
  }

  // Canary evidence and actual egress are never suppressed by a change event.
  const cannotSuppress = result.factors.some(
    (factor) =>
      factor.observed.toLowerCase().includes("canary") ||
      (factor.key === "exfiltration" && factor.value >= 0.5),
  );
  if (cannotSuppress) {
    return {
      score: result.score,
      severity: result.severity,
      adjustment: `Change event "${matching.title}" reviewed; cannot suppress because restricted data or taint evidence is present.`,
    };
  }

  const cappedScore = Math.min(result.score, 58);
  const severity: Severity = cappedScore >= 50 ? "medium" : "low";
  return {
    score: cappedScore,
    severity,
    adjustment: `Capped at ${cappedScore} by approved change "${matching.title}" (${matching.type}, approved by ${matching.approvedBy}). Expectation updated for ${matching.expectedShift.join(", ")}.`,
  };
}

const humanList = (items: string[]): string => {
  if (items.length === 0) return "none";
  if (items.length === 1) return items[0];
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
};

export function buildExplanation(agent: Agent, evalResult: Evaluation, taint?: Alert["evidence"]["taint"]): string {
  const { result, bundle, capped } = evalResult;
  const leaders = topFactors(result.factors, 4);
  const sentences: string[] = [];

  sentences.push(
    `${agent.name} scored ${result.score}/100 (${result.severity}) against its declared ${agent.role} role while its credentials remained valid.`,
  );

  for (const factor of leaders) {
    if (factor.points === 0) continue;
    sentences.push(
      `${factor.label} contributes ${factor.points} points — ${factor.detail} Observed: ${factor.observed}.`,
    );
  }

  if (taint?.outOfScope) {
    sentences.push(
      `The causal thread starts at "${taint.sourceName}" (${taint.trust}) and reaches an out-of-scope action ${taint.steps} steps later.`,
    );
  }

  const restricted = bundle.violations.filter(
    (violation) => violation.kind === "data" && isRestricted(violation.value),
  );
  if (restricted.length > 0) {
    sentences.push(
      `Restricted data reached: ${humanList(restricted.map((violation) => violation.value))}. No declared Procurement task requires it.`,
    );
  }

  if (capped) sentences.push(capped);
  else if (result.factors.find((factor) => factor.key === "scope")?.value === 0) {
    sentences.push(
      "Every individual action is still inside the role manifest; the score comes from distributional and sequence drift, so permission checks alone would not flag it.",
    );
  }

  return sentences.join(" ");
}

function suggestedActionFor(
  agent: Agent,
  severity: Severity,
  factors: Factor[],
  bundle: FeatureBundle,
): string {
  const top = topFactors(factors, 2).map((factor) => factor.key);
  const restricted = bundle.violations
    .filter((violation) => violation.kind === "data" && isRestricted(violation.value))
    .map((violation) => violation.value);
  const destinations = bundle.violations
    .filter((violation) => violation.kind === "destination")
    .map((violation) => violation.value);

  if (severity === "critical" && (top.includes("injection") || top.includes("exfiltration"))) {
    const blocks = [
      restricted.length ? `data classes ${humanList([...new Set(restricted)])}` : null,
      destinations.length ? `destination ${humanList([...new Set(destinations)])}` : null,
    ].filter(Boolean);
    return `Apply Restrict at the tool gateway for ${blocks.join(" and ")}. Keep ${
      agent.manifest.spec.allowed.tools.slice(0, 2).join(" and ")
    } available so legitimate work continues; quarantine if a second egress attempt appears.`;
  }
  if (severity === "critical") {
    return `Quarantine ${agent.name} read-only, notify ${agent.owner.name}, and snapshot session state for forensics.`;
  }
  if (severity === "high") {
    return `Require step-up approval for out-of-scope tools and data, then review the last session with the agent owner.`;
  }
  if (severity === "medium") {
    return `Notify ${agent.owner.name} and confirm whether the change is covered by an approved change event.`;
  }
  return "Keep monitoring; add analyst feedback to calibrate this agent's threshold.";
}

function titleFor(severity: Severity, factors: Factor[], bundle: FeatureBundle): string {
  if (bundle.events.some((event) => event.canary)) return "Canary resource touched";
  const keys = topFactors(factors, 2).map((factor) => factor.key);
  const taintedEgress =
    factors.some((factor) => factor.key === "injection" && factor.value >= 0.3) &&
    factors.some((factor) => factor.key === "exfiltration" && factor.value >= 0.3);
  if (taintedEgress) return "Prompt injection with outbound data exfiltration";
  if (keys.includes("delegation") && keys.includes("scope"))
    return "Privilege escalation through delegation";
  if (keys.includes("exfiltration")) return "Sensitive data routed to an unapproved destination";
  if (keys.includes("injection")) return "Behavior changed after untrusted input";
  if (keys.includes("drift") || keys.includes("sequence"))
    return "Sustained drift from declared role";
  if (keys.includes("scope")) return "Out-of-role data and tool access";
  return `${severity[0].toUpperCase()}${severity.slice(1)} role alignment anomaly`;
}

/**
 * Evaluate a window and emit an alert when the calibrated score crosses the
 * review threshold. This is the single entry point used by ingestion, the seed
 * pipeline and the simulation lab.
 */
export function evaluateAgent(input: {
  agent: Agent;
  manifest: RoleManifest;
  baseline: Baseline;
  events: AgentEvent[];
  changes?: ChangeEvent[];
  now?: string;
  force?: boolean;
}): Alert | null {
  const { agent, manifest, baseline } = input;
  if (input.events.length === 0) return null;

  const evaluation = scoreWindow({ manifest, baseline, events: input.events });
  const sorted = [...input.events].sort((a, b) => (a.ts < b.ts ? -1 : 1));
  const lastEventTs = sorted[sorted.length - 1].ts;
  const lastTs = input.now ?? lastEventTs;
  const adjusted = applyChangeManagement(
    evaluation.result,
    input.changes ?? [],
    lastTs,
    agent.id,
  );

  const score = evaluation.result.score;
  const finalScore = adjusted.score;
  const severity = adjusted.severity;
  const isBenignChange = finalScore < score;
  const displayFactors = isBenignChange
    ? rebalanceFactors(evaluation.result.factors, finalScore)
    : evaluation.result.factors;

  if (!input.force && finalScore < ALERT_THRESHOLD) return null;

  const taint = evaluation.bundle.paths.find((path) => path.outOfScope);
  const suspiciousEvents = new Set(
    taint?.nodes.map((node) => node.eventId).filter(Boolean) as string[],
  );
  const violationEvents = new Set(evaluation.bundle.outOfScopeEvents.map((event) => event.id));
  const evidenceEvents = sorted
    .filter(
      (event) =>
        suspiciousEvents.has(event.id) ||
        violationEvents.has(event.id) ||
        event.type === "content.read" ||
        event.type === "network.egress",
    )
    .slice(-16);
  const firstSuspicious =
    sorted.find((event) => event.label === "attack" || event.canary) ??
    sorted.find((event) => violationEvents.has(event.id) || suspiciousEvents.has(event.id));
  const latency = firstSuspicious
    ? new Date(lastEventTs).getTime() - new Date(firstSuspicious.ts).getTime()
    : undefined;

  const id = `alr-${agent.id}-${(hashString(sorted.map((e) => e.id).join(":")) % 100000)
    .toString(36)
    .padStart(3, "0")}`;

  return {
    id,
    agentId: agent.id,
    agentName: agent.name,
    ts: lastEventTs,
    score: finalScore,
    severity,
    status: "open",
    classification: isBenignChange ? "benign_change" : undefined,
    title: titleFor(severity, displayFactors, evaluation.bundle),
    explanation: buildExplanation(
      agent,
      {
        ...evaluation,
        result: { ...evaluation.result, score: finalScore, severity, factors: displayFactors },
        capped: adjusted.adjustment,
      },
      taint,
    ),
    factors: displayFactors,
    confidence: round(evaluation.result.confidence, 2),
    evidence: {
      window: { from: sorted[0].ts, to: lastEventTs },
      events: evidenceEvents,
      taint,
      violations: evaluation.bundle.violations,
    },
    suggestedAction: suggestedActionFor(agent, severity, displayFactors, evaluation.bundle),
    canary: evaluation.bundle.events.some((event) => event.canary),
    benignChange: isBenignChange,
    detectionLatencyMs: latency,
  };
}
