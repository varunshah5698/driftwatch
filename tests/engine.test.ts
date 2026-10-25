import { describe, expect, it } from "vitest";
import { createSeed } from "@/lib/data/seed";
import { applyChangeManagement } from "@/lib/engine/detect";
import { scoreSignals } from "@/lib/engine/scoring";
import { factorTotal } from "@/lib/store";
import { isRestricted } from "@/lib/domain";
import type { ChangeEvent } from "@/lib/types";

const seed = createSeed();
const procurement = seed.agents.find((agent) => agent.id === "agt-procurement-1")!;
const procurementAlert = seed.alerts.find((alert) => alert.agentId === procurement.id)!;

describe("role-alignment engine", () => {
  it("detects the procurement PDF scenario with a critical alert", () => {
    expect(procurementAlert).toBeDefined();
    expect(procurementAlert.score).toBeGreaterThanOrEqual(85);
    expect(procurementAlert.severity).toBe("critical");
    expect(procurementAlert.title.toLowerCase()).toContain("injection");
  });

  it("decomposes every contributing factor and sums to the score", () => {
    expect(factorTotal(procurementAlert.factors)).toBe(procurementAlert.score);
    expect(procurementAlert.factors.length).toBe(6);
    expect(procurementAlert.factors.some((factor) => factor.key === "scope" && factor.points > 0)).toBe(true);
    expect(
      procurementAlert.factors.some((factor) => factor.key === "exfiltration" && factor.points > 0),
    ).toBe(true);
  });

  it("links the alert back to the untrusted supplier PDF", () => {
    const taint = procurementAlert.evidence.taint;
    expect(taint?.sourceName).toBe("supplier-acme-pricing.pdf");
    expect(taint?.trust).toBe("untrusted");
    expect(taint?.outOfScope).toBe(true);
    expect(taint?.nodes.some((node) => node.suspicious)).toBe(true);
    expect(procurementAlert.explanation).toContain("supplier-acme-pricing.pdf");
  });

  it("records the restricted data classes and unknown destinations it reached", () => {
    const values = procurementAlert.evidence.violations.map((violation) => violation.value);
    expect(values).toContain("hr.salary");
    expect(values).toContain("hr.performance");
    expect(values).toContain("45.83.211.19");
    expect(values.some((value) => isRestricted(value))).toBe(true);
    expect(procurementAlert.suggestedAction).toMatch(/Restrict/i);
    expect(procurementAlert.suggestedAction).toMatch(/supplier\.search/i);
  });

  it("does not page a change-managed task shift as critical", () => {
    const benign = seed.alerts.find((alert) => alert.benignChange);
    expect(benign).toBeDefined();
    expect(benign!.score).toBeLessThan(85);
    expect(benign!.severity).not.toBe("critical");
    expect(benign!.explanation).toContain("Capped at");
    expect(factorTotal(benign!.factors)).toBe(benign!.score);
  });

  it("caps an approved change but never suppresses canary or egress evidence", () => {
    const result = scoreSignals({
      scope: { value: 1, observed: "hr.salary", expected: "supplier pricing", detail: "Out of role" },
      drift: { value: 0.6, observed: "0.42 JS", expected: "0.1 JS", detail: "Shifted distribution" },
    });
    const change: ChangeEvent = {
      id: "chg-test",
      agentId: procurement.id,
      type: "task_shift",
      title: "Approved compensation review",
      at: new Date().toISOString(),
      approvedBy: "Maya Chen",
      graceHours: 24,
      expectedShift: ["scope"],
      status: "active",
    };
    const adjusted = applyChangeManagement(result, [change], new Date().toISOString(), procurement.id);
    expect(adjusted.score).toBeLessThanOrEqual(58);
    expect(adjusted.severity).not.toBe("critical");
    expect(adjusted.adjustment).toContain("Capped at");
  });

  it("gives cold-start agents lower confidence and a learning state", () => {
    const learning = seed.agents.filter((agent) => agent.status === "learning");
    expect(learning.length).toBeGreaterThanOrEqual(2);
    for (const agent of learning) {
      expect(agent.confidence).toBeLessThanOrEqual(0.5);
      expect(seed.baselines[agent.id].status).toBe("learning");
      expect(agent.learningProgress).toBeLessThan(1);
    }
  });

  it("keeps every alert decomposition valid, including the benign control", () => {
    expect(seed.alerts.length).toBeGreaterThanOrEqual(6);
    for (const alert of seed.alerts) {
      expect(factorTotal(alert.factors)).toBe(alert.score);
      expect(alert.score).toBeGreaterThanOrEqual(50);
      expect(alert.score).toBeLessThanOrEqual(100);
      expect(alert.explanation.length).toBeGreaterThan(40);
      expect(alert.evidence.events.length).toBeGreaterThan(0);
    }
  });
});
