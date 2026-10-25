import { NextResponse } from "next/server";
import { parse as parseYaml } from "yaml";
import { z } from "zod";
import { guard } from "@/lib/auth/api";
import { extractFeatures } from "@/lib/engine/features";
import { scoreWindow } from "@/lib/engine/detect";
import { appendAudit } from "@/lib/engine/audit";
import { isSameOrigin, jsonError, noStore } from "@/lib/http";
import { getStore, updateManifest } from "@/lib/store";
import type { ChangeEvent, RoleManifest } from "@/lib/types";

const actionSchema = z.enum(["read", "analyze", "write", "create", "send", "delete", "execute", "delegate"]);

const manifestSchema = z.object({
  apiVersion: z.literal("driftwatch/v1"),
  kind: z.literal("AgentRole"),
  metadata: z.object({
    name: z.string().min(2).max(80),
    version: z.string().min(1).max(32),
    updatedAt: z.string().max(40),
    updatedBy: z.string().max(80),
  }),
  spec: z.object({
    displayName: z.string().min(2).max(80),
    role: z.string().min(2).max(120),
    purpose: z.string().min(2).max(600),
    riskTier: z.enum(["low", "medium", "high", "critical"]),
    environment: z.enum(["production", "staging", "development"]),
    allowed: z.object({
      tools: z.array(z.string().min(1).max(80)).max(80),
      dataClasses: z.array(z.string().min(1).max(80)).max(80),
      destinations: z.array(z.string().min(1).max(160)).max(80),
      actions: z.array(actionSchema).max(12),
    }),
    operatingHours: z.object({
      start: z.number().int().min(0).max(24),
      end: z.number().int().min(0).max(24),
      timezone: z.string().max(40),
    }),
    maxCallDepth: z.number().int().min(1).max(8),
    approvedDelegates: z.array(z.string().max(80)).max(40),
  }),
});

const requestSchema = z.object({
  agentId: z.string().min(1),
  yaml: z.string().min(10).max(20_000),
  apply: z.boolean().optional(),
});

const diffArrays = (label: string, before: string[], after: string[]) => {
  const added = after.filter((item) => !before.includes(item));
  const removed = before.filter((item) => !after.includes(item));
  return added.length || removed.length ? { field: label, added, removed } : null;
};

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return jsonError("Cross-origin request rejected", 403);
  const auth = await guard("manifest:edit");
  if ("response" in auth) return auth.response;
  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError("Invalid manifest request", 422);

  let ast: unknown;
  try {
    ast = parseYaml(parsed.data.yaml);
  } catch (error) {
    return noStore(
      NextResponse.json(
        { ok: false, errors: [`YAML parse error: ${(error as Error).message}`] },
        { status: 200 },
      ),
    );
  }

  const validated = manifestSchema.safeParse(ast);
  if (!validated.success) {
    return noStore(
      NextResponse.json({
        ok: false,
        errors: validated.error.issues.map(
          (issue) => `${issue.path.join(".") || "manifest"}: ${issue.message}`,
        ),
      }),
    );
  }

  const store = getStore();
  const agent = store.agents.find((candidate) => candidate.id === parsed.data.agentId);
  if (!agent) return jsonError("Agent not found", 404);
  const candidateManifest = validated.data as RoleManifest;
  const current = agent.manifest;
  const diff = [
    diffArrays("allowed.tools", current.spec.allowed.tools, candidateManifest.spec.allowed.tools),
    diffArrays("allowed.dataClasses", current.spec.allowed.dataClasses, candidateManifest.spec.allowed.dataClasses),
    diffArrays("allowed.destinations", current.spec.allowed.destinations, candidateManifest.spec.allowed.destinations),
    diffArrays("allowed.actions", current.spec.allowed.actions, candidateManifest.spec.allowed.actions),
    diffArrays("approvedDelegates", current.spec.approvedDelegates, candidateManifest.spec.approvedDelegates),
  ].filter(Boolean);

  if (current.spec.operatingHours.start !== candidateManifest.spec.operatingHours.start ||
      current.spec.operatingHours.end !== candidateManifest.spec.operatingHours.end) {
    diff.push({
      field: "operatingHours",
      added: [
        `${String(candidateManifest.spec.operatingHours.start).padStart(2, "0")}:00–${String(
          candidateManifest.spec.operatingHours.end,
        ).padStart(2, "0")}:00 UTC`,
      ],
      removed: [
        `${String(current.spec.operatingHours.start).padStart(2, "0")}:00–${String(
          current.spec.operatingHours.end,
        ).padStart(2, "0")}:00 UTC`,
      ],
    });
  }

  // Replay the last 7 days against the candidate manifest.
  const since = new Date(Date.now() - 7 * 86_400_000).toISOString();
  const events = store.events.filter(
    (event) => event.agentId === agent.id && event.ts >= since,
  );
  const bundle = extractFeatures({
    manifest: candidateManifest,
    baseline: store.baselines[agent.id],
    events,
  });
  const simulated = scoreWindow({
    manifest: candidateManifest,
    baseline: store.baselines[agent.id],
    events,
  });
  const currentEvaluation = scoreWindow({
    manifest: current,
    baseline: store.baselines[agent.id],
    events,
  });

  const violations = bundle.violations;
  const violationEvents = bundle.outOfScopeEvents;

  let applied = false;
  if (parsed.data.apply && diff.length > 0) {
    updateManifest(agent.id, candidateManifest, auth.user.name);
    const change: ChangeEvent = {
      id: `chg-${Date.now().toString(36)}`,
      agentId: agent.id,
      type: "role_update",
      title: `Role manifest ${candidateManifest.metadata.version} applied`,
      at: new Date().toISOString(),
      approvedBy: auth.user.name,
      graceHours: 48,
      expectedShift: diff.some((entry) => entry?.field.includes("dataClasses")) ? ["scope", "drift"] : ["drift"],
      status: "active",
    };
    store.changeEvents.unshift(change);
    appendAudit(store.audit, {
      actor: auth.user.name,
      actorType: "human",
      action: "manifest.update",
      target: agent.id,
      detail: `Manifest ${candidateManifest.metadata.version}: ${diff.map((entry) => entry?.field).join(", ")} (48h grace)`,
    });
    applied = true;
  }

  return noStore(
    NextResponse.json({
      ok: true,
      applied,
      manifest: candidateManifest,
      diff,
      simulation: {
        events: events.length,
        violationEvents: violationEvents.length,
        violationTypes: violations.length,
        violations,
        candidateScore: simulated.result.score,
        currentScore: currentEvaluation.result.score,
        wouldAlert: simulated.result.score >= 50,
        samples: violationEvents.slice(-8),
      },
    }),
  );
}
