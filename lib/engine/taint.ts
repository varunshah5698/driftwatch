import type { AgentEvent, AgentEvent as Event, RoleManifest, TaintNode, TaintPath } from "@/lib/types";
import { isRestricted } from "@/lib/domain";

const CAUSAL_WINDOW = 12;

const isOutOfScopeData = (manifest: RoleManifest, dataClass?: string): boolean =>
  Boolean(dataClass && !manifest.spec.allowed.dataClasses.includes(dataClass));

const isOutOfScopeDestination = (
  manifest: RoleManifest,
  destination?: string,
): boolean =>
  Boolean(destination && !manifest.spec.allowed.destinations.includes(destination));

/**
 * Taint tracking is deliberately simple and auditable: an untrusted read opens
 * a taint thread; any suspicious action within the next CAUSAL_WINDOW steps is
 * attached to that thread. This is the causal evidence the Evidence UI renders.
 * It is a correlation heuristic, not proof — the injection factor is weighted
 * accordingly and always shown with its source and step distance.
 */
export function buildTaintPaths(
  events: AgentEvent[],
  manifest: RoleManifest,
): TaintPath[] {
  const sorted = [...events].sort((a, b) => (a.ts < b.ts ? -1 : a.ts > b.ts ? 1 : 0));
  const paths: TaintPath[] = [];

  sorted.forEach((event, index) => {
    if (event.type !== "content.read" || event.trust !== "untrusted") return;

    const sourceId = event.sourceId ?? event.id;
    const nodes: TaintNode[] = [
      {
        id: `${sourceId}-source`,
        kind: "source",
        label: event.sourceName ?? event.summary,
        ts: event.ts,
        trust: "untrusted",
        eventId: event.id,
      },
    ];

    let outOfScope = false;
    let steps = 0;
    const observed: AgentEvent[] = [];

    for (let i = index + 1; i <= Math.min(index + CAUSAL_WINDOW, sorted.length - 1); i++) {
      const candidate = sorted[i];
      steps = i - index;

      const suspicious =
        (candidate.type === "data.access" &&
          (isOutOfScopeData(manifest, candidate.dataClass) || Boolean(candidate.canary))) ||
        (candidate.type === "network.egress" &&
          isOutOfScopeDestination(manifest, candidate.destination)) ||
        (candidate.type === "tool.call" &&
          !manifest.spec.allowed.tools.includes(candidate.tool ?? "")) ||
        (candidate.type === "delegation" &&
          !manifest.spec.approvedDelegates.includes(candidate.targetAgentId ?? ""));

      if (suspicious) {
        observed.push(candidate);
        nodes.push({
          id: `${sourceId}-evt-${candidate.id}`,
          kind: isRestricted(candidate.dataClass ?? "") ? "action" : "event",
          label: candidate.summary,
          ts: candidate.ts,
          trust: candidate.trust,
          suspicious: true,
          eventId: candidate.id,
        });
        outOfScope = true;
      } else if (
        observed.length === 0 &&
        (candidate.type === "tool.call" || candidate.type === "data.access") &&
        nodes.length < 4
      ) {
        // Keep one or two legitimate-looking hops to show the causal chain.
        nodes.push({
          id: `${sourceId}-evt-${candidate.id}`,
          kind: "event",
          label: candidate.summary,
          ts: candidate.ts,
          trust: candidate.trust,
          eventId: candidate.id,
        });
      }

      if (nodes.length >= 7) break;
    }

    if (nodes.length > 1) {
      paths.push({
        id: `taint-${sourceId}-${event.id}`,
        sourceEventId: event.id,
        sourceName: event.sourceName ?? "untrusted content",
        trust: event.trust,
        nodes,
        startedAt: event.ts,
        steps,
        outOfScope,
      });
    }
  });

  return paths.sort((a, b) => Number(b.outOfScope) - Number(a.outOfScope)).slice(0, 4);
}

/** Select the strongest thread for an alert. */
export function primaryTaintPath(paths: TaintPath[]): TaintPath | undefined {
  return paths.find((path) => path.outOfScope) ?? paths[0];
}
