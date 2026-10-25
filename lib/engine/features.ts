import { isRestricted, sensitivityOf } from "@/lib/domain";
import type {
  AgentEvent,
  Baseline,
  FactorKey,
  RoleManifest,
  TaintPath,
  Violation,
} from "@/lib/types";
import { distributionOf, hourDistribution, stepKey } from "./baseline";
import type { FeatureInput } from "./scoring";
import { buildTaintPaths } from "./taint";
import { clamp, cusum, jsDivergence, mean, surprisal } from "./math";

export interface FeatureBundle {
  signals: Record<FactorKey, FeatureInput>;
  violations: Violation[];
  paths: TaintPath[];
  events: AgentEvent[];
  outOfScopeEvents: AgentEvent[];
}

const declared = (values: string[]): string =>
  values.length ? values.join(", ") : "none declared";

const inHours = (event: AgentEvent, manifest: RoleManifest): boolean => {
  const date = new Date(event.ts);
  const hour = date.getUTCHours();
  const { start, end } = manifest.spec.operatingHours;
  if (start === end) return true;
  return start < end ? hour >= start && hour < end : hour >= start || hour < end;
};

const isDelegationAllowed = (manifest: RoleManifest, target?: string): boolean =>
  Boolean(target && manifest.spec.approvedDelegates.includes(target));

/**
 * Build the six signals that make up the Role Alignment Score.
 * Each signal is normalized to 0..1 and carries human-readable evidence so the
 * alert UI can explain itself without recomputing anything.
 */
export function extractFeatures(input: {
  manifest: RoleManifest;
  baseline: Baseline;
  events: AgentEvent[];
}): FeatureBundle {
  const { manifest, baseline } = input;
  const events = [...input.events].sort((a, b) => (a.ts < b.ts ? -1 : 1));
  const total = Math.max(events.length, 1);
  const allowed = manifest.spec.allowed;
  const violationMap = new Map<string, Violation>();
  const violationEventIds = new Set<string>();

  const addViolation = (violation: Violation, event: AgentEvent) => {
    const key = `${violation.kind}:${violation.value}`;
    if (!violationMap.has(key)) violationMap.set(key, violation);
    violationEventIds.add(event.id);
  };

  for (const event of events) {
    if (event.type === "tool.call" && event.tool && !allowed.tools.includes(event.tool)) {
      addViolation(
        { kind: "tool", field: "allowed.tools", value: event.tool, declared: allowed.tools },
        event,
      );
    }
    if (
      event.type === "data.access" &&
      event.dataClass &&
      !allowed.dataClasses.includes(event.dataClass)
    ) {
      addViolation(
        {
          kind: "data",
          field: "allowed.dataClasses",
          value: event.dataClass,
          declared: allowed.dataClasses,
        },
        event,
      );
    }
    if (
      event.type === "network.egress" &&
      event.destination &&
      !allowed.destinations.includes(event.destination)
    ) {
      addViolation(
        {
          kind: "destination",
          field: "allowed.destinations",
          value: event.destination,
          declared: allowed.destinations,
        },
        event,
      );
    }
    if (event.action && !allowed.actions.includes(event.action)) {
      addViolation(
        {
          kind: "action",
          field: "allowed.actions",
          value: event.action,
          declared: allowed.actions,
        },
        event,
      );
    }
    if (event.type === "delegation" && !isDelegationAllowed(manifest, event.targetAgentId)) {
      addViolation(
        {
          kind: "delegation",
          field: "spec.approvedDelegates",
          value: event.targetAgentId ?? "unknown",
          declared: manifest.spec.approvedDelegates,
        },
        event,
      );
    }
  }

  const hoursViolation = events.some((event) => !inHours(event, manifest));
  if (hoursViolation) {
    const event = events.find((candidate) => !inHours(candidate, manifest))!;
    addViolation(
      {
        kind: "hours",
        field: "spec.operatingHours",
        value: "outside operating window",
        declared: [
          `${String(manifest.spec.operatingHours.start).padStart(2, "0")}:00–${String(
            manifest.spec.operatingHours.end,
          ).padStart(2, "0")} UTC`,
        ],
      },
      event,
    );
  }

  const violations = [...violationMap.values()];
  const restrictedReads = events.filter(
    (event) => event.type === "data.access" && isRestricted(event.dataClass ?? ""),
  );
  const canaryHits = events.filter((event) => event.canary);

  const scopeValue = clamp(
    (violationEventIds.size / total) * 2.1 +
      (restrictedReads.length > 0 ? 0.3 : 0) +
      (canaryHits.length > 0 ? 0.35 : 0),
  );

  // ---- distributional drift -------------------------------------------------
  // Small windows are noisy. Shrink each observed distribution toward the
  // learned baseline before measuring divergence so a quiet 20-event window
  // does not read as dramatic drift.
  const shrink = (observed: Record<string, number>, baselineDist: Record<string, number>, count: number) => {
    const strength = clamp(35 / (count + 35), 0.12, 0.7);
    const keys = new Set([...Object.keys(observed), ...Object.keys(baselineDist)]);
    const blended: Record<string, number> = {};
    for (const key of keys) {
      blended[key] = (1 - strength) * (observed[key] ?? 0) + strength * (baselineDist[key] ?? 0);
    }
    return blended;
  };
  const toolEvents = events.filter((event) => event.tool).length;
  const dataEvents = events.filter((event) => event.dataClass).length;
  const destEvents = events.filter((event) => event.destination).length;
  const toolDist = shrink(distributionOf(events, (event) => event.tool), baseline.toolDist, toolEvents);
  const dataDist = shrink(distributionOf(events, (event) => event.dataClass), baseline.dataDist, dataEvents);
  const destDist = shrink(distributionOf(events, (event) => event.destination), baseline.destDist, destEvents);
  const hourDist = shrink(hourDistribution(events), baseline.hourDist, events.length);
  const divergences = {
    tools: jsDivergence(toolDist, baseline.toolDist),
    data: jsDivergence(dataDist, baseline.dataDist),
    destinations: jsDivergence(destDist, baseline.destDist),
    hours: jsDivergence(hourDist, baseline.hourDist),
  };
  const maxDivergence = Math.max(...Object.values(divergences));
  const meanDivergence = mean(Object.values(divergences));

  // Slow drift: compare the behavior of the window's first and second halves.
  // A gradual slide never trips a single-window threshold, but accumulates in
  // the sensitivity of the data being read. CUSUM on the daily alignment series
  // provides an additional, lower-weight signal for the evidence panel.
  const half = Math.floor(events.length / 2);
  const earlyEvents = events.slice(0, half);
  const lateEvents = events.slice(half);
  const dataShift =
    events.length >= 16
      ? jsDivergence(
          distributionOf(earlyEvents, (event) => event.dataClass),
          distributionOf(lateEvents, (event) => event.dataClass),
        )
      : 0;
  const earlySensitivity = mean(
    earlyEvents
      .filter((event) => event.type === "data.access")
      .map((event) => sensitivityOf(event.dataClass ?? "public")),
  );
  const lateSensitivity = mean(
    lateEvents
      .filter((event) => event.type === "data.access")
      .map((event) => sensitivityOf(event.dataClass ?? "public")),
  );
  const sensitivityDelta = clamp((lateSensitivity - earlySensitivity) / 1.5);
  const series = baseline.alignmentSeries.map((point) => point.score).slice(-14);
  const slowPoints = series.length >= 8 ? cusum(series, mean(series), 3.5, 12) : [];
  const sustainedDrop = series.length >= 6 ? clamp((mean(series.slice(0, 4)) - mean(series.slice(-4)) - 8) / 40) : 0;
  const slowDrift = clamp(
    dataShift * 0.75 +
      sensitivityDelta * 0.85 +
      sustainedDrop * 0.5 +
      (slowPoints.length ? clamp(Math.max(...slowPoints.map((point) => Math.abs(point.magnitude))) / 40) : 0) * 0.3,
  );

  const sampleFactor = clamp(events.length / 45, 0.25, 1);
  const driftValue = clamp(
    (maxDivergence * 0.85 + meanDivergence * 0.28) * sampleFactor + slowDrift * 0.35,
  );

  // ---- Markov sequence anomaly ---------------------------------------------
  const transitions: [string, string][] = [];
  for (let i = 0; i < events.length - 1; i++) {
    transitions.push([stepKey(events[i]), stepKey(events[i + 1])]);
  }
  const vocabulary = Array.from(
    new Set([
      ...Object.keys(baseline.transitions),
      ...transitions.flat(),
    ]),
  );
  const scores =
    transitions.length > 0
      ? transitions.map(([from, to]) =>
          surprisal(baseline.transitions, from, to, vocabulary),
        )
      : [];
  const meanSurprisal = mean(scores);
  const improbable = scores.filter((value) => value > 6).length;
  const improbableRatio = scores.length ? improbable / scores.length : 0;
  const sequenceValue =
    transitions.length < 3
      ? 0
      : clamp(
          clamp((meanSurprisal - 1.9) / 5) * 0.7 + improbableRatio * 0.55,
        );

  // ---- exfiltration ---------------------------------------------------------
  const allowedDestinations = new Set(allowed.destinations);
  const knownDestinations = new Set(Object.keys(baseline.destDist));
  const windowDestinations = events
    .map((event) => event.destination)
    .filter((destination): destination is string => Boolean(destination));
  const newDestinations = Array.from(
    new Set(windowDestinations.filter((destination) => !knownDestinations.has(destination))),
  );
  const externalDestinations = windowDestinations.filter(
    (destination) => !allowedDestinations.has(destination),
  );

  const sensitiveReadIndexes = events
    .map((event, index) =>
      event.type === "data.access" &&
      (isRestricted(event.dataClass ?? "") ||
        !allowed.dataClasses.includes(event.dataClass ?? ""))
        ? index
        : -1,
    )
    .filter((index) => index >= 0);

  let adjacencyHits = 0;
  const exfilTargets = new Set<string>();
  for (const index of sensitiveReadIndexes) {
    for (let j = index + 1; j <= Math.min(index + 8, events.length - 1); j++) {
      const candidate = events[j];
      if (candidate.type !== "network.egress") continue;
      if (!candidate.destination || allowedDestinations.has(candidate.destination)) continue;
      adjacencyHits++;
      exfilTargets.add(candidate.destination);
      break;
    }
  }

  const maxEgress = Math.max(0, ...events.map((event) => event.bytes ?? 0));
  const byteRatio = maxEgress / Math.max(baseline.p95EgressBytes, 5000);
  const canaryEgress = canaryHits.some((event) => event.type === "network.egress");

  const exfilValue = clamp(
    0.2 * clamp(newDestinations.length / 3) +
      0.22 * clamp((byteRatio - 1) / 6) +
      0.58 * clamp(adjacencyHits) +
      (canaryEgress ? 0.2 : 0),
  );

  // ---- delegation -----------------------------------------------------------
  const delegations = events.filter((event) => event.type === "delegation");
  const unknownDelegates = delegations.filter(
    (event) => !isDelegationAllowed(manifest, event.targetAgentId),
  );
  const depthViolations = delegations.filter(
    (event) => (event.callDepth ?? 1) > manifest.spec.maxCallDepth,
  );
  const delegationRate = delegations.length / total;
  const delegationSpike =
    baseline.delegationRate > 0
      ? delegationRate / baseline.delegationRate
      : delegationRate > 0.08
        ? 4
        : 1;
  const delegationValue = clamp(
    clamp(unknownDelegates.length / 2) * 0.7 +
      clamp(depthViolations.length) * 0.35 +
      clamp((delegationSpike - 2) / 5) * 0.35,
  );

  // ---- injection taint ------------------------------------------------------
  const paths = buildTaintPaths(events, manifest);
  const strongest = paths.find((path) => path.outOfScope) ?? paths[0];
  const taintRestricted = Boolean(
    strongest &&
      events.some(
        (event) =>
          event.canary ||
          (event.type === "data.access" &&
            isRestricted(event.dataClass ?? "") &&
            strongest.nodes.some((node) => node.eventId === event.id)),
      ),
  );
  // A canary resource is a hard signal: no legitimate workflow touches it, so
  // the taint link is maximal even if the individual action is in scope.
  const injectionValue = canaryHits.length
    ? 1
    : strongest
      ? strongest.outOfScope
        ? taintRestricted
          ? 1
          : 0.88
        : 0.28
      : 0;

  const topDestination = [...exfilTargets][0] ?? externalDestinations[0];

  return {
    events,
    paths,
    violations,
    outOfScopeEvents: events.filter((event) => violationEventIds.has(event.id)),
    signals: {
      scope: {
        value: scopeValue,
        observed: `${violations.length} violation type${violations.length === 1 ? "" : "s"} across ${
          violationEventIds.size
        } events · ${restrictedReads.length} restricted read${restrictedReads.length === 1 ? "" : "s"}`,
        expected: `tools: ${declared(allowed.tools)}; data: ${declared(allowed.dataClasses)}`,
        detail: restrictedReads.length
          ? `Reached restricted data (${[...new Set(restrictedReads.map((e) => e.dataClass))].join(", ")}) that the role never declares.`
          : "Actions fall outside the declared role manifest.",
      },
      drift: {
        value: driftValue,
        observed: `JS divergence ${maxDivergence.toFixed(2)} max / ${meanDivergence.toFixed(
          2,
        )} mean${slowPoints.length ? ` · slow-drift CUSUM +${slowDrift.toFixed(2)}` : ""}`,
        expected: `baseline v${baseline.version} (${baseline.sampleCount.toLocaleString()} events)`,
        detail: slowPoints.length
          ? "Cumulative drift over the long window indicates a gradual shift, not a single spike."
          : "Current feature distributions diverge from the learned behavior profile.",
      },
      sequence: {
        value: sequenceValue,
        observed: `${meanSurprisal.toFixed(1)} bits mean surprisal · ${improbable} improbable transition${
          improbable === 1 ? "" : "s"
        }`,
        expected: `baseline Markov chain (${Object.keys(baseline.transitions).length} states)`,
        detail:
          "The order of actions is unlikely under the agent's learned transition model.",
      },
      exfiltration: {
        value: exfilValue,
        observed: `${newDestinations.length} new destination${
          newDestinations.length === 1 ? "" : "s"
        }${topDestination ? ` (${topDestination})` : ""} · max egress ${(
          maxEgress / 1024
        ).toFixed(1)} KiB`,
        expected: `destinations: ${declared(allowed.destinations)} · p95 ${(
          baseline.p95EgressBytes / 1024
        ).toFixed(1)} KiB`,
        detail: adjacencyHits
          ? `${adjacencyHits} sensitive read${adjacencyHits === 1 ? "" : "s"} followed by external egress within 8 steps.`
          : "Outbound volume or destinations deviate from the learned egress profile.",
      },
      delegation: {
        value: delegationValue,
        observed: `${delegations.length} delegation${delegations.length === 1 ? "" : "s"} · ${
          unknownDelegates.length
        } unknown target${unknownDelegates.length === 1 ? "" : "s"}`,
        expected: `approved: ${declared(manifest.spec.approvedDelegates)} · max depth ${
          manifest.spec.maxCallDepth
        }`,
        detail: depthViolations.length
          ? "Delegation depth exceeds the declared maximum, indicating privilege propagation."
          : "Delegation pattern differs from the learned graph.",
      },
      injection: {
        value: injectionValue,
        observed: canaryHits.length
          ? `canary resource touched (${canaryHits.length} event${
              canaryHits.length === 1 ? "" : "s"
            })`
          : strongest
            ? `${strongest.sourceName} → ${strongest.steps} step${
                strongest.steps === 1 ? "" : "s"
              } → ${strongest.nodes.filter((node) => node.suspicious).length} out-of-scope action${
                strongest.nodes.filter((node) => node.suspicious).length === 1 ? "" : "s"
              }`
            : "no untrusted content in causal window",
        expected: "no untrusted input precedes out-of-scope behavior",
        detail: canaryHits.length
          ? "A decoy resource that no legitimate workflow may touch was read and followed by further access."
          : strongest
            ? `Behavior changed after ingesting untrusted content (${strongest.sourceName}, trust: ${strongest.trust}).`
            : "No taint thread connects untrusted content to current behavior.",
      },
    },
  };
}

/** Convenience for UI: highest sensitivity reached in a set of events. */
export function maxSensitivity(events: AgentEvent[]): number {
  return events.reduce(
    (max, event) =>
      event.type === "data.access"
        ? Math.max(max, sensitivityOf(event.dataClass ?? "public"))
        : max,
    1,
  );
}
