import { NextResponse } from "next/server";
import { z } from "zod";
import { guard } from "@/lib/auth/api";
import { dryRunPolicy } from "@/lib/engine/policy";
import { appendAudit } from "@/lib/engine/audit";
import { isSameOrigin, jsonError, noStore } from "@/lib/http";
import { getStore } from "@/lib/store";

const toggleSchema = z.object({ id: z.string(), enabled: z.boolean() });
const dryRunSchema = z.object({ id: z.string() });

export async function PATCH(request: Request) {
  if (!isSameOrigin(request)) return jsonError("Cross-origin request rejected", 403);
  const auth = await guard("policy:edit");
  if ("response" in auth) return auth.response;
  const parsed = toggleSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError("Invalid policy update", 422);
  const store = getStore();
  const policy = store.policies.find((candidate) => candidate.id === parsed.data.id);
  if (!policy) return jsonError("Policy not found", 404);
  policy.enabled = parsed.data.enabled;
  policy.updatedAt = new Date().toISOString();
  appendAudit(store.audit, {
    actor: auth.user.name,
    actorType: "human",
    action: policy.enabled ? "policy.enable" : "policy.disable",
    target: policy.id,
    detail: `${policy.name} ${policy.enabled ? "enabled" : "disabled"} at the tool gateway`,
  });
  return noStore(NextResponse.json({ policy }));
}

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return jsonError("Cross-origin request rejected", 403);
  const auth = await guard();
  if ("response" in auth) return auth.response;
  const parsed = dryRunSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError("Invalid dry-run request", 422);
  const store = getStore();
  const policy = store.policies.find((candidate) => candidate.id === parsed.data.id);
  if (!policy) return jsonError("Policy not found", 404);
  const result = dryRunPolicy(policy, store.agents, store.events);
  appendAudit(store.audit, {
    actor: auth.user.name,
    actorType: "human",
    action: "policy.dry_run",
    target: policy.id,
    detail: `${policy.name}: ${result.blocked} historical events would be blocked across ${result.agentsAffected} agents`,
  });
  return noStore(NextResponse.json(result));
}
