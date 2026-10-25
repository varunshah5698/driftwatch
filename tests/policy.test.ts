import { describe, expect, it } from "vitest";
import { createSeed } from "@/lib/data/seed";
import { decideGateway, dryRunPolicy } from "@/lib/engine/policy";

const seed = createSeed();
const procurement = structuredClone(seed.agents.find((agent) => agent.id === "agt-procurement-1")!);
const policies = seed.policies;

describe("gateway containment ladder", () => {
  it("restricts only the out-of-scope classes while supplier work keeps flowing", () => {
    expect(procurement.containment).toBe(3);
    const allowed = decideGateway(
      { agent: procurement, action: "read", tool: "supplier.search" },
      policies,
    );
    expect(allowed.decision).toBe("allow");

    const blocked = decideGateway(
      { agent: procurement, action: "read", dataClass: "hr.salary" },
      policies,
    );
    expect(blocked.decision).toBe("deny");
    expect(blocked.reason).toContain("hr.salary");
    expect(blocked.enforcementLevel).toBe(3);
  });

  it("blocks unknown destinations under Restrict", () => {
    const blocked = decideGateway(
      { agent: procurement, action: "send", destination: "exfil-relay.top" },
      policies,
    );
    expect(blocked.decision).toBe("deny");
    expect(blocked.reason).toContain("exfil-relay.top");
  });

  it("quarantine keeps read-only in-scope work and stops writes and egress", () => {
    const quarantined = { ...procurement, containment: 4, status: "quarantined" as const };
    expect(
      decideGateway({ agent: quarantined, action: "read", tool: "supplier.search" }, policies).decision,
    ).toBe("allow");
    expect(
      decideGateway({ agent: quarantined, action: "create", tool: "purchase.request.create" }, policies)
        .decision,
    ).toBe("deny");
    expect(
      decideGateway({ agent: quarantined, action: "send", tool: "vendor.email.send" }, policies).decision,
    ).toBe("deny");
    expect(
      decideGateway({ agent: quarantined, action: "read", dataClass: "hr.salary" }, policies).decision,
    ).toBe("deny");
  });

  it("isolation revokes every call", () => {
    const isolated = { ...procurement, containment: 5, status: "isolated" as const };
    for (const action of ["read", "create", "send", "execute"] as const) {
      const decision = decideGateway(
        { agent: isolated, action, tool: "supplier.search" },
        policies,
      );
      expect(decision.decision).toBe("deny");
      expect(decision.reason).toMatch(/isolated/i);
    }
  });

  it("step-up approval gates writes without blocking in-scope reads", () => {
    const stepUp = { ...procurement, containment: 2 };
    expect(
      decideGateway({ agent: stepUp, action: "read", tool: "supplier.search" }, policies).decision,
    ).toBe("allow");
    expect(
      decideGateway(
        { agent: stepUp, action: "create", tool: "purchase.request.create" },
        policies,
      ).decision,
    ).toBe("approval_required");
  });

  it("dry-runs policies against recorded events", () => {
    const restrict = seed.policies.find((policy) => policy.id === "pol-101")!;
    const result = dryRunPolicy(restrict, seed.agents, seed.events);
    expect(result.blocked).toBeGreaterThan(0);
    expect(result.agentsAffected).toBeGreaterThan(0);
    expect(result.events.length).toBeGreaterThan(0);
  });
});
