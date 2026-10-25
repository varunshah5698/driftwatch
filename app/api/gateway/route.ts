import { NextResponse } from "next/server";
import { z } from "zod";
import { guard } from "@/lib/auth/api";
import { decideGateway } from "@/lib/engine/policy";
import { appendAudit } from "@/lib/engine/audit";
import { isSameOrigin, jsonError, noStore } from "@/lib/http";
import { getStore } from "@/lib/store";
import { log, timer } from "@/lib/observability";

const schema = z.object({
  agentId: z.string().min(1).max(80),
  action: z.enum(["read", "analyze", "write", "create", "send", "delete", "execute", "delegate"]),
  tool: z.string().max(80).optional(),
  dataClass: z.string().max(80).optional(),
  destination: z.string().max(160).optional(),
});

export async function POST(request: Request) {
  const elapsed = timer();
  if (!isSameOrigin(request)) return jsonError("Cross-origin request rejected", 403);
  const auth = await guard();
  if ("response" in auth) return auth.response;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError("Invalid gateway request", 422);

  const store = getStore();
  const agent = store.agents.find((candidate) => candidate.id === parsed.data.agentId);
  if (!agent) return jsonError("Agent not found", 404);

  const decision = decideGateway(
    {
      agent,
      action: parsed.data.action,
      tool: parsed.data.tool,
      dataClass: parsed.data.dataClass,
      destination: parsed.data.destination,
    },
    store.policies,
  );
  const audit = appendAudit(store.audit, {
    actor: auth.user.name,
    actorType: "human",
    action: `gateway.${decision.decision}`,
    target: agent.id,
    detail: `${parsed.data.action} ${parsed.data.tool ?? parsed.data.dataClass ?? parsed.data.destination ?? ""} — ${decision.reason}`,
  });

  log("info", "gateway.decision", {
    agentId: agent.id,
    decision: decision.decision,
    enforcementLevel: decision.enforcementLevel,
    latencyMs: elapsed(),
  });

  return noStore(
    NextResponse.json({
      courseOfAction: {
        allow: "allow",
        deny: "block",
        approval_required: "step_up",
      }[decision.decision],
      decision: decision.decision,
      reason: decision.reason,
      policyIds: decision.policyIds,
      enforcementLevel: decision.enforcementLevel,
      agent: { id: agent.id, name: agent.name, containment: agent.containment },
      auditSeq: audit.seq,
    }),
  );
}
