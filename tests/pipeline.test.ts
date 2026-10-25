import { beforeEach, describe, expect, it } from "vitest";
import { createSeed } from "@/lib/data/seed";
import { verifyAuditChain } from "@/lib/engine/audit";
import { appendEvents, blastRadius, getStore, resetStore, securityGraph } from "@/lib/store";
import type { AgentEvent } from "@/lib/types";

describe("seeded control plane", () => {
  const seed = createSeed();

  it("builds a complete, deterministic fleet", () => {
    expect(seed.agents).toHaveLength(60);
    expect(new Set(seed.agents.map((agent) => agent.id)).size).toBe(60);
    for (const agent of seed.agents) {
      expect(seed.baselines[agent.id]).toBeDefined();
      expect(seed.baselineHistory[agent.id].length).toBeGreaterThanOrEqual(2);
      expect(agent.manifest.spec.allowed.tools.length).toBeGreaterThan(2);
      expect(agent.manifest.metadata.version).toMatch(/^\d{4}\.\d{2}\.\d/);
    }
  });

  it("keeps the audit hash chain valid and chronologically append-ordered", () => {
    const verdict = verifyAuditChain(seed.audit);
    expect(verdict.valid).toBe(true);
    expect(verdict.checked).toBe(seed.audit.length);
    expect(seed.audit.length).toBeGreaterThanOrEqual(8);
    for (let index = 1; index < seed.audit.length; index++) {
      expect(seed.audit[index].seq).toBe(seed.audit[index - 1].seq + 1);
      expect(seed.audit[index].at >= seed.audit[index - 1].at).toBe(true);
      expect(seed.audit[index].prevHash).toBe(seed.audit[index - 1].hash);
    }
  });

  it("links incidents to real alerts and computes blast radius through delegation", () => {
    for (const incident of seed.incidents) {
      expect(incident.alertIds.length).toBeGreaterThan(0);
      for (const alertId of incident.alertIds) {
        expect(seed.alerts.some((alert) => alert.id === alertId)).toBe(true);
      }
    }
    const radius = blastRadius("agt-procurement-1");
    expect(radius[0].agentId).toBe("agt-procurement-1");
    expect(radius.some((node) => node.agentId === "agt-hr-2")).toBe(true);
  });

  it("exposes delegation edges and ghost nodes in the security graph", () => {
    const graph = securityGraph();
    expect(graph.links.some((link) => link.kind === "delegation")).toBe(true);
    expect(graph.nodes.some((node) => node.id === "agent-ghost-7")).toBe(true);
  });
});

describe("ingestion to alert pipeline", () => {
  beforeEach(() => {
    resetStore();
  });

  it("accepts events and emits an explainable alert for a fresh attack", () => {
    const store = getStore();
    const agent = store.agents.find((candidate) => candidate.id === "agt-support-4")!;
    const beforeAlerts = store.alerts.length;
    const beforeEvents = store.events.length;
    const base = Date.now();

    const events: AgentEvent[] = [
      {
        id: "evt-test-1",
        seq: 900_001,
        agentId: agent.id,
        sessionId: "ses-test-ingest",
        ts: new Date(base).toISOString(),
        type: "content.read",
        action: "read",
        trust: "untrusted",
        sourceId: "doc-test-injection",
        sourceName: "customer-upload.pdf",
        summary: "Read customer-upload.pdf with a hidden instruction",
        canary: true,
      },
      {
        id: "evt-test-2",
        seq: 900_002,
        agentId: agent.id,
        sessionId: "ses-test-ingest",
        ts: new Date(base + 1_000).toISOString(),
        type: "data.access",
        action: "read",
        dataClass: "hr.salary",
        trust: "internal",
        summary: "Accessed hr.salary (420 records)",
        resultSize: 420_000,
      },
      {
        id: "evt-test-3",
        seq: 900_003,
        agentId: agent.id,
        sessionId: "ses-test-ingest",
        ts: new Date(base + 2_000).toISOString(),
        type: "tool.call",
        action: "execute",
        tool: "payroll.read",
        trust: "internal",
        summary: "Called payroll.read",
        resultSize: 420_000,
      },
      {
        id: "evt-test-4",
        seq: 900_004,
        agentId: agent.id,
        sessionId: "ses-test-ingest",
        ts: new Date(base + 3_000).toISOString(),
        type: "network.egress",
        action: "send",
        destination: "unknown-edge.xyz",
        bytes: 1_200_000,
        trust: "internal",
        summary: "Sent 1.1 MiB to unknown-edge.xyz",
      },
    ];

    appendEvents(agent.id, events);

    expect(store.events.length).toBe(beforeEvents + events.length);
    expect(agent.lastSeen).toBe(events[events.length - 1].ts);
    expect(store.alerts.length).toBeGreaterThan(beforeAlerts);
    const alert = store.alerts.find((candidate) => candidate.agentId === agent.id);
    expect(alert).toBeDefined();
    expect(alert!.score).toBeGreaterThanOrEqual(50);
    expect(alert!.factors.reduce((sum, factor) => sum + factor.points, 0)).toBe(alert!.score);
    expect(alert!.evidence.taint?.sourceName).toBe("customer-upload.pdf");
    expect(agent.openAlerts).toBeGreaterThan(0);
    expect(store.audit.at(-1)?.action).toBe("alert.create");
  });
});
