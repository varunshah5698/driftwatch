import type { AgentStatus, FactorKey, Severity } from "./types";

/** Data sensitivity 1 (public) .. 5 (highly restricted). */
export const SENSITIVITY: Record<string, number> = {
  public: 1,
  internal: 1,
  "support.ticket": 1,
  "marketing.audience": 2,
  "customer.profile": 2,
  "supplier.pricing": 2,
  invoice: 2,
  "purchase.request": 2,
  "source.code": 3,
  "deploy.config": 3,
  "finance.ledger": 3,
  "supplier.contract": 3,
  "legal.matter": 3,
  "customer.pii": 4,
  "payment.card": 4,
  payroll: 4,
  "hr.salary": 4,
  "hr.performance": 4,
  "credential.store": 5,
  "health.record": 5,
  "canary.decoy": 5,
};

export const sensitivityOf = (dataClass: string): number =>
  SENSITIVITY[dataClass] ?? 2;

export const isRestricted = (dataClass: string): boolean => sensitivityOf(dataClass) >= 4;

export const FACTOR_META: Record<
  FactorKey,
  { label: string; weight: number; short: string }
> = {
  scope: {
    label: "Role scope",
    weight: 4.6,
    short: "Actions outside the declared role manifest",
  },
  drift: {
    label: "Distributional drift",
    weight: 2.4,
    short: "Jensen-Shannon divergence from the learned baseline",
  },
  sequence: {
    label: "Sequence anomaly",
    weight: 2.2,
    short: "Low-probability Markov action transitions",
  },
  exfiltration: {
    label: "Exfiltration signal",
    weight: 3.8,
    short: "Sensitive reads followed by egress to new destinations",
  },
  delegation: {
    label: "Delegation anomaly",
    weight: 2.0,
    short: "Unknown sub-agents or privilege escalation through delegation",
  },
  injection: {
    label: "Injection taint",
    weight: 3.2,
    short: "Behavior change causally downstream of untrusted content",
  },
};

export const FACTOR_ORDER: FactorKey[] = [
  "scope",
  "injection",
  "exfiltration",
  "drift",
  "sequence",
  "delegation",
];

/** Logistic bias keeps quiet, in-role agents near zero. */
export const SCORE_BIAS = -4.6;

export const SEVERITY_THRESHOLDS: { severity: Severity; min: number }[] = [
  { severity: "critical", min: 85 },
  { severity: "high", min: 70 },
  { severity: "medium", min: 50 },
  { severity: "low", min: 30 },
  { severity: "info", min: 0 },
];

export const severityFor = (score: number): Severity =>
  SEVERITY_THRESHOLDS.find((band) => score >= band.min)?.severity ?? "info";

export const ALERT_THRESHOLD = 50;

export const CONTAINMENT_LADDER = [
  {
    level: 0,
    key: "monitor",
    label: "Monitor",
    description: "Observe only. No action is blocked.",
  },
  {
    level: 1,
    key: "notify",
    label: "Notify owner",
    description: "Page the owning team with the evidence bundle.",
  },
  {
    level: 2,
    key: "step-up",
    label: "Step-up approval",
    description: "High-risk writes, sends and destructive calls need a human approval.",
  },
  {
    level: 3,
    key: "restrict",
    label: "Restrict",
    description: "Block the specific out-of-scope tools, data classes and destinations.",
  },
  {
    level: 4,
    key: "quarantine",
    label: "Quarantine",
    description: "Read-only mode; in-flight safe tasks can finish, writes and egress stop.",
  },
  {
    level: 5,
    key: "isolate",
    label: "Isolate",
    description: "Revoke tokens, cut all tool and network access, snapshot state.",
  },
] as const;

export const SEVERITY_ORDER: Severity[] = ["critical", "high", "medium", "low", "info"];

export const RISK_TIER_ORDER = ["critical", "high", "medium", "low"] as const;

export const STATUS_ORDER: AgentStatus[] = [
  "active",
  "learning",
  "degraded",
  "quarantined",
  "isolated",
  "retired",
];

export const UNTRUSTED_SOURCES = new Set([
  "web.fetch",
  "email.body",
  "pdf.document",
  "tool.response",
  "agent.message",
  "upload",
]);

/** Deterministic display names for external destinations (no real domains). */
export const EGRESS_DESTINATIONS = {
  safe: ["erp.internal", "suppliers.internal", "docs.internal", "analytics.internal"],
  external: ["api.partner-gateway.io", "storage.cloudvault.io", "hooks.automation.dev"],
  suspicious: ["45.83.211.19", "exfil-relay.top", "unknown-edge.xyz"],
};
