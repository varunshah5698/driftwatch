import type {
  ActionType,
  Agent,
  AgentEvent,
  GatewayDecision,
  Policy,
} from "@/lib/types";
import { isRestricted } from "@/lib/domain";

export interface GatewayRequest {
  agent: Agent;
  action: ActionType;
  tool?: string;
  dataClass?: string;
  destination?: string;
}

const matches = (policy: Policy, request: GatewayRequest): boolean => {
  const { match } = policy;
  const matchTool = !match.tools?.length || (request.tool ? match.tools.includes(request.tool) : false);
  const matchData =
    !match.dataClasses?.length ||
    (request.dataClass ? match.dataClasses.includes(request.dataClass) : false);
  const matchDestination =
    !match.destinations?.length ||
    (request.destination ? match.destinations.includes(request.destination) : false);
  const matchAction = !match.actions?.length || match.actions.includes(request.action);
  if (match.tools?.length && !matchTool) return false;
  if (match.dataClasses?.length && !matchData) return false;
  if (match.destinations?.length && !matchDestination) return false;
  return matchAction;
};

const WRITE_ACTIONS: ActionType[] = ["write", "create", "send", "delete", "execute", "delegate"];

/**
 * Enforcement ladder. The agent's containment level is the floor; matching
 * policies can tighten it further. Restrict is surgical: only the out-of-scope
 * data classes, tools and destinations are blocked, so the agent's valid token
 * keeps working for its declared tasks.
 */
export function decideGateway(
  request: GatewayRequest,
  policies: Policy[],
): Omit<GatewayDecision, "auditSeq"> {
  const { agent } = request;
  const level = agent.containment;
  const active = policies.filter((policy) => policy.enabled);
  const applied = active.filter((policy) => matches(policy, request));
  const policyIds = applied.map((policy) => policy.id);

  const allowed = agent.manifest.spec.allowed;
  const inScope =
    (!request.tool || allowed.tools.includes(request.tool)) &&
    (!request.dataClass || allowed.dataClasses.includes(request.dataClass)) &&
    (!request.destination || allowed.destinations.includes(request.destination)) &&
    allowed.actions.includes(request.action);

  if (level >= 5) {
    return {
      decision: "deny",
      reason: "Agent is isolated: tokens revoked, all tool and network calls blocked.",
      policyIds,
      enforcementLevel: level,
    };
  }

  if (level === 4) {
    const readOnly =
      (request.action === "read" || request.action === "analyze") &&
      inScope &&
      !request.destination;
    return {
      decision: readOnly ? "allow" : "deny",
      reason: readOnly
        ? "Quarantined agent: read-only in-scope access permitted while safe tasks drain."
        : "Quarantined agent: writes, sends, delegation and egress are blocked.",
      policyIds,
      enforcementLevel: level,
    };
  }

  if (!inScope) {
    if (level >= 3) {
      return {
        decision: "deny",
        reason: `Restricted: ${
          request.dataClass && !allowed.dataClasses.includes(request.dataClass)
            ? `data class ${request.dataClass}`
            : request.destination && !allowed.destinations.includes(request.destination)
              ? `destination ${request.destination}`
              : request.tool && !allowed.tools.includes(request.tool)
                ? `tool ${request.tool}`
                : `action ${request.action}`
        } is outside the declared role.`,
        policyIds,
        enforcementLevel: level,
      };
    }
    if (level === 2) {
      return {
        decision: "approval_required",
        reason: "Step-up policy: out-of-scope or high-risk action needs a human approval.",
        policyIds,
        enforcementLevel: level,
      };
    }
    // Monitor / notify do not block at the gateway; the alert pipeline observes.
    return {
      decision: "allow",
      reason: "Out-of-scope call allowed but recorded: agent is in monitor mode.",
      policyIds,
      enforcementLevel: level,
    };
  }

  const blockingPolicy = applied.find((policy) => policy.kind === "block");
  if (blockingPolicy) {
    return {
      decision: "deny",
      reason: `Policy "${blockingPolicy.name}" blocks this action.`,
      policyIds,
      enforcementLevel: Math.max(level, 3),
    };
  }

  const approvalPolicy = applied.find((policy) => policy.kind === "require_approval");
  if (approvalPolicy) {
    return {
      decision: "approval_required",
      reason: `Policy "${approvalPolicy.name}" requires human approval.`,
      policyIds,
      enforcementLevel: Math.max(level, 2),
    };
  }

  if (level === 2 && WRITE_ACTIONS.includes(request.action)) {
    return {
      decision: "approval_required",
      reason: "Step-up approval required for write, send or destructive actions.",
      policyIds,
      enforcementLevel: level,
    };
  }

  if (level === 2 && isRestricted(request.dataClass ?? "")) {
    return {
      decision: "approval_required",
      reason: "Step-up approval required for restricted data access.",
      policyIds,
      enforcementLevel: level,
    };
  }

  return {
    decision: "allow",
    reason: "In scope, no blocking policy matched.",
    policyIds,
    enforcementLevel: level,
  };
}

/** Dry-run: what would this policy have blocked in the observed event window? */
export function dryRunPolicy(
  policy: Policy,
  agents: Agent[],
  events: AgentEvent[],
): { blocked: number; events: AgentEvent[]; agentsAffected: number } {
  const agentMap = new Map(agents.map((agent) => [agent.id, agent]));
  const matched = events.filter((event) => {
    const agent = agentMap.get(event.agentId);
    if (!agent) return false;
    return matches(policy, {
      agent,
      action: event.action ?? "read",
      tool: event.tool,
      dataClass: event.dataClass,
      destination: event.destination,
    });
  });
  return {
    blocked: matched.length,
    events: matched.slice(-12),
    agentsAffected: new Set(matched.map((event) => event.agentId)).size,
  };
}
