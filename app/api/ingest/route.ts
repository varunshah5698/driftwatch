import { createHmac, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { appendEvents, getStore } from "@/lib/store";
import { clientKey, jsonError, noStore, rateLimit } from "@/lib/http";
import type { AgentEvent } from "@/lib/types";
import { log, timer } from "@/lib/observability";

const action = z.enum(["read", "analyze", "write", "create", "send", "delete", "execute", "delegate"]);

const eventSchema = z
  .object({
    type: z.enum([
      "session.start",
      "session.end",
      "prompt",
      "content.read",
      "tool.call",
      "data.access",
      "network.egress",
      "delegation",
      "policy.decision",
    ]),
    ts: z.string().max(40).optional(),
    sessionId: z.string().min(1).max(100),
    action: action.optional(),
    tool: z.string().max(100).optional(),
    dataClass: z.string().max(100).optional(),
    destination: z.string().max(200).optional(),
    bytes: z.number().int().min(0).max(500_000_000).optional(),
    trust: z.enum(["trusted", "internal", "untrusted"]).optional(),
    sourceId: z.string().max(120).optional(),
    sourceName: z.string().max(200).optional(),
    summary: z.string().min(1).max(400),
    targetAgentId: z.string().max(100).optional(),
    callDepth: z.number().int().min(0).max(12).optional(),
    canary: z.boolean().optional(),
    resultSize: z.number().int().min(0).max(5_000_000_000).optional(),
  })
  .strict();

const bodySchema = z.object({
  events: z.array(eventSchema).min(1).max(100),
});

const idempotency = globalThis as unknown as { __dwIdempotency?: Map<string, number> };

function sanitizeSummary(value: string): string {
  return value
    .replace(/<[^>]*>/g, "")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 300);
}

/** HMAC: hex(sha256(secret, `${timestamp}.${rawBody}`)) */
function verifySignature(secret: string, timestamp: string, rawBody: string, signature: string): boolean {
  const expected = createHmac("sha256", secret).update(`${timestamp}.${rawBody}`).digest("hex");
  const provided = signature.replace(/^sha256=/, "");
  if (provided.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(expected), Buffer.from(provided));
}

export async function POST(request: Request) {
  const elapsed = timer();
  const secret = process.env.AGENT_INGEST_SECRET ?? "dev-ingest-secret";
  const agentId = request.headers.get("x-agent-id");
  const timestamp = request.headers.get("x-timestamp");
  const signature = request.headers.get("x-signature");
  const idempotencyKey = request.headers.get("x-idempotency-key");
  if (!agentId || !timestamp || !signature) {
    return jsonError("x-agent-id, x-timestamp and x-signature are required", 401);
  }

  const issuedAt = Number.isNaN(Number(timestamp)) ? Date.parse(timestamp) : Number(timestamp);
  if (!Number.isFinite(issuedAt) || Math.abs(Date.now() - issuedAt) > 5 * 60_000) {
    return jsonError("Timestamp outside the 5 minute replay window", 401);
  }

  const limit = rateLimit(clientKey(request, `ingest:${agentId}`), 120, 60_000);
  if (!limit.allowed) return jsonError("Ingestion rate limit exceeded", 429);

  const rawBody = await request.text();
  if (rawBody.length > 512_000) return jsonError("Payload too large", 413);
  const agent = getStore().agents.find((candidate) => candidate.id === agentId);
  if (!agent) return jsonError("Unknown agent identity", 404);
  if (!verifySignature(secret, timestamp, rawBody, signature)) {
    return jsonError("Invalid event signature", 401);
  }

  if (idempotencyKey) {
    idempotency.__dwIdempotency ??= new Map();
    const existing = idempotency.__dwIdempotency.get(idempotencyKey);
    if (existing && Date.now() - existing < 10 * 60_000) {
      return noStore(NextResponse.json({ accepted: 0, duplicate: true }));
    }
    idempotency.__dwIdempotency.set(idempotencyKey, Date.now());
    if (idempotency.__dwIdempotency.size > 5000) {
      const oldest = idempotency.__dwIdempotency.keys().next().value;
      if (oldest) idempotency.__dwIdempotency.delete(oldest);
    }
  }

  let parsed: z.infer<typeof bodySchema>;
  try {
    parsed = bodySchema.parse(JSON.parse(rawBody));
  } catch (error) {
    return jsonError(`Schema validation failed: ${(error as Error).message.slice(0, 200)}`, 422);
  }

  const base = getStore().events.length + 1;
  const events: AgentEvent[] = parsed.events.map((input, index) => ({
    id: `evt-ing-${Date.now().toString(36)}-${index}`,
    seq: base + index,
    agentId,
    sessionId: input.sessionId,
    ts: new Date(input.ts ?? Date.now()).toISOString(),
    type: input.type,
    action: input.action,
    tool: input.tool,
    dataClass: input.dataClass,
    destination: input.destination,
    bytes: input.bytes,
    trust: input.trust,
    sourceId: input.sourceId,
    sourceName: input.sourceName ? sanitizeSummary(input.sourceName) : undefined,
    summary: sanitizeSummary(input.summary),
    targetAgentId: input.targetAgentId,
    callDepth: input.callDepth,
    canary: input.canary,
    resultSize: input.resultSize,
    label: "normal",
  }));

  appendEvents(agentId, events);
  log("info", "ingest.accepted", {
    agentId,
    accepted: events.length,
    latencyMs: elapsed(),
  });
  return noStore(
    NextResponse.json({
      accepted: events.length,
      duplicate: false,
      agentId,
      receivedAt: new Date().toISOString(),
    }),
  );
}
