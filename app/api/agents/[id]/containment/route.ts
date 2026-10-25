import { NextResponse } from "next/server";
import { z } from "zod";
import { guard } from "@/lib/auth/api";
import { CONTAINMENT_LADDER } from "@/lib/domain";
import { decideGateway } from "@/lib/engine/policy";
import { isSameOrigin, jsonError, noStore } from "@/lib/http";
import { getAgent, getStore, setContainment } from "@/lib/store";

const schema = z.object({
  level: z.number().int().min(0).max(5),
  reason: z.string().max(400).optional(),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!isSameOrigin(request)) return jsonError("Cross-origin request rejected", 403);
  const auth = await guard("containment:apply");
  if ("response" in auth) return auth.response;
  const { id } = await params;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError("Invalid containment level", 422);

  const store = getStore();
  const current = getAgent(id);
  if (!current) return jsonError("Agent not found", 404);
  const label = CONTAINMENT_LADDER[parsed.data.level].label;

  const agent = setContainment(
    id,
    parsed.data.level,
    auth.user.name,
    parsed.data.reason ?? `${label} applied by ${auth.user.name}`,
  );
  if (!agent) return jsonError("Agent not found", 404);

  const allowed = agent.manifest.spec.allowed;
  const samples = [
    { action: "read" as const, dataClass: allowed.dataClasses[0], tool: allowed.tools[0] },
    { action: "send" as const, destination: allowed.destinations[0] },
    {
      action: "read" as const,
      dataClass: ["hr.salary", "customer.pii", "credential.store"].find(
        (dataClass) => !allowed.dataClasses.includes(dataClass),
      ) ?? "hr.salary",
    },
    { action: "send" as const, destination: "exfil-relay.top" },
  ].map((sample) => ({
    request: sample,
    decision: decideGateway({ agent, ...sample }, store.policies),
  }));

  return noStore(NextResponse.json({ agent, samples }));
}
