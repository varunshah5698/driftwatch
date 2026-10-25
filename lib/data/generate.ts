import type {
  ActionType,
  Agent,
  AgentEvent,
  AgentStatus,
  Environment,
  Owner,
  RoleManifest,
  RoleTemplate,
  TrustLevel,
} from "@/lib/types";
import { hashString } from "@/lib/engine/math";

/* ------------------------------------------------------------------ random */

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const pick = <T,>(rng: () => number, items: T[]): T =>
  items[Math.floor(rng() * items.length)];

export function weighted<T>(rng: () => number, items: { value: T; weight: number }[]): T {
  const total = items.reduce((acc, item) => acc + item.weight, 0);
  let roll = rng() * total;
  for (const item of items) {
    roll -= item.weight;
    if (roll <= 0) return item.value;
  }
  return items[items.length - 1].value;
}

export const randomInt = (rng: () => number, min: number, max: number): number =>
  Math.floor(rng() * (max - min + 1)) + min;

/* --------------------------------------------------------------- manifests */

export function buildManifest(
  name: string,
  template: RoleTemplate,
  options: {
    environment: Environment;
    version: string;
    updatedAt: string;
    updatedBy: string;
    extraTools?: string[];
    extraDataClasses?: string[];
    extraDestinations?: string[];
  },
): RoleManifest {
  const allowedTools = [...template.tools, ...(options.extraTools ?? [])];
  const allowedData = [...template.dataClasses, ...(options.extraDataClasses ?? [])];
  const allowedDest = [...template.destinations, ...(options.extraDestinations ?? [])];
  return {
    apiVersion: "driftwatch/v1",
    kind: "AgentRole",
    metadata: {
      name: name.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
      version: options.version,
      updatedAt: options.updatedAt,
      updatedBy: options.updatedBy,
    },
    spec: {
      displayName: name,
      role: template.role,
      purpose: template.purpose,
      riskTier: template.riskTier,
      environment: options.environment,
      allowed: {
        tools: allowedTools,
        dataClasses: allowedData,
        destinations: allowedDest,
        actions: template.actions,
      },
      operatingHours: {
        start: template.hours.start,
        end: template.hours.end,
        timezone: "UTC",
      },
      maxCallDepth: template.maxCallDepth,
      approvedDelegates: [],
    },
  };
}

/* ------------------------------------------------------------------ agents */

export function makeAgent(input: {
  id: string;
  name: string;
  template: RoleTemplate;
  owner: Owner;
  environment: Environment;
  status: AgentStatus;
  createdAt: string;
  manifest: RoleManifest;
}): Agent {
  return {
    id: input.id,
    name: input.name,
    role: input.template.role,
    roleTemplate: input.template.id,
    description: input.template.purpose,
    owner: input.owner,
    environment: input.environment,
    status: input.status,
    riskTier: input.template.riskTier,
    createdAt: input.createdAt,
    manifestVersion: input.manifest.metadata.version,
    manifest: input.manifest,
    alignment: 96,
    confidence: 0.9,
    learningProgress: 1,
    baselineVersion: 1,
    lastSeen: input.createdAt,
    actionsToday: 0,
    containment: 0,
    containmentUpdatedAt: input.createdAt,
    openAlerts: 0,
    canaryHits: 0,
    tokens: [
      {
        id: `tok-${input.id}`,
        label: "primary runtime token",
        issuedAt: input.createdAt,
        lastUsed: input.createdAt,
      },
    ],
  };
}

/* ------------------------------------------------------------------- events */

const TOOL_ACTIONS: Record<string, ActionType> = {
  "supplier.search": "read",
  "supplier.quote.read": "read",
  "purchase.request.create": "create",
  "invoice.extract": "analyze",
  "pdf.read": "read",
  "vendor.email.send": "send",
  "erp.catalog.read": "read",
  "crm.ticket.read": "read",
  "crm.ticket.update": "write",
  "crm.contact.read": "read",
  "kb.search": "read",
  "customer.email.send": "send",
  "refund.request": "create",
  "ledger.read": "read",
  "invoice.approve": "write",
  "payment.initiate": "execute",
  "bank.reconcile": "analyze",
  "vendor.master.read": "read",
  "ats.read": "read",
  "payroll.read": "read",
  "onboarding.create": "create",
  "policy.search": "read",
  "k8s.deploy": "execute",
  "ci.run": "execute",
  "logs.read": "read",
  "secret.rotate": "write",
  "incident.create": "create",
  "crm.deal.read": "read",
  "crm.deal.update": "write",
  "proposal.generate": "create",
  "email.send": "send",
  "calendar.read": "read",
  "contract.read": "read",
  "clause.extract": "analyze",
  "redline.write": "write",
  "matter.read": "read",
  "warehouse.query": "read",
  "notebook.run": "analyze",
  "model.train": "execute",
  "export.create": "create",
  "campaign.create": "create",
  "audience.segment": "analyze",
  "content.publish": "write",
  "analytics.read": "read",
  "siem.query": "read",
  "edr.isolate": "write",
  "iam.review": "read",
  "canary.manage": "write",
};

export const actionForTool = (tool: string, fallback: ActionType = "read"): ActionType =>
  TOOL_ACTIONS[tool] ?? fallback;

export const taskPrompt = (template: RoleTemplate, rng: () => number): string => {
  const prompts: Record<string, string[]> = {
    procurement: [
      "Compare Q4 quotes for packaging suppliers",
      "Validate invoice INV-88213 against the PO",
      "Draft a purchase request for the hardware refresh",
    ],
    support: [
      "Summarize today's escalated tickets",
      "Resolve the refund request for order 55021",
      "Search the knowledge base for SSO guidance",
    ],
    finance: [
      "Reconcile the October ledger exceptions",
      "Approve invoices under the 10k threshold",
      "Review the vendor master delta",
    ],
    hr: [
      "Run the monthly payroll variance check",
      "Create onboarding tasks for the new analyst",
      "Check compensation bands for the platform team",
    ],
    devops: [
      "Deploy the checkout service hotfix",
      "Rotate the staging signing key",
      "Triage the latency incident",
    ],
    sales: [
      "Update the enterprise pipeline",
      "Draft a proposal for the Northwind renewal",
      "Qualify inbound leads from the webinar",
    ],
    legal: [
      "Extract indemnity clauses from the MSA",
      "Draft a redline for the reseller agreement",
      "Summarize open litigation matters",
    ],
    data: [
      "Train the churn model on the latest cohort",
      "Publish the funnel dashboard",
      "Query weekly retention by plan",
    ],
    marketing: [
      "Build the Q4 ABM audience",
      "Publish the launch post",
      "Report campaign spend by channel",
    ],
    security: [
      "Triage the SIEM authentication alerts",
      "Review stale IAM grants",
      "Verify decoy resource integrity",
    ],
  };
  return pick(rng, prompts[template.id] ?? ["Complete the assigned task"]);
};

const DOCUMENTS: Record<string, string[]> = {
  procurement: ["supplier-catalog-2026.pdf", "q4-packaging-quotes.xlsx", "invoice-INV-88213.pdf"],
  support: ["kb-sso-article.md", "ticket-thread-55021.txt", "refund-policy.md"],
  finance: ["ledger-exceptions-oct.csv", "vendor-master.json", "reconciliation-notes.pdf"],
  hr: ["payroll-variance-oct.xlsx", "onboarding-checklist.md", "comp-band-policy.pdf"],
  devops: ["deploy-runbook.md", "incident-postmortem.md", "key-rotation-checklist.md"],
  sales: ["northwind-renewal-notes.md", "proposal-template.md", "pipeline-export.csv"],
  legal: ["msa-northwind.pdf", "reseller-redline.docx", "matter-summary.txt"],
  data: ["retention-query.sql", "model-card.md", "cohort-definitions.md"],
  marketing: ["launch-brief.md", "audience-spec.json", "campaign-report.csv"],
  security: ["siem-rule-pack.yaml", "iam-review.csv", "decoy-inventory.json"],
};

const UNTRUSTED_SOURCES: Record<string, string[]> = {
  procurement: ["supplier-pricing-portal.pdf", "vendor-terms-upload.pdf"],
  support: ["customer-attachment.txt", "tool-response:crm.lookup"],
  finance: ["remittance-advice.pdf"],
  hr: ["candidate-resume.pdf"],
  devops: ["dependency-audit.html"],
  sales: ["inbound-form.html"],
  legal: ["counterparty-redline.docx"],
  data: ["public-dataset.csv"],
  marketing: ["agency-brief.pdf"],
  security: ["threat-intel-feed.json"],
};

const EVENT_WEIGHTS = [
  { value: "tool", weight: 34 },
  { value: "data", weight: 30 },
  { value: "content", weight: 12 },
  { value: "egress", weight: 12 },
  { value: "prompt", weight: 8 },
  { value: "policy", weight: 4 },
] as const;

export interface EventFactory {
  (input: {
    agent: Agent;
    sessionId: string;
    ts: Date;
    type: AgentEvent["type"];
    action?: ActionType;
    tool?: string;
    dataClass?: string;
    destination?: string;
    bytes?: number;
    trust?: TrustLevel;
    sourceId?: string;
    sourceName?: string;
    summary: string;
    targetAgentId?: string;
    callDepth?: number;
    canary?: boolean;
    resultSize?: number;
    label?: AgentEvent["label"];
    risk?: number;
  }): AgentEvent;
}

export function createEventFactory(startSeq = 1): { event: EventFactory; nextSeq: () => number } {
  let seq = startSeq;
  const event: EventFactory = (input) => {
    const id = `evt-${input.agent.id}-${String(seq).padStart(5, "0")}`;
    seq += 1;
    return {
      id,
      seq,
      agentId: input.agent.id,
      sessionId: input.sessionId,
      ts: input.ts.toISOString(),
      type: input.type,
      action: input.action,
      tool: input.tool,
      dataClass: input.dataClass,
      destination: input.destination,
      bytes: input.bytes,
      trust: input.trust,
      sourceId: input.sourceId,
      sourceName: input.sourceName,
      summary: input.summary,
      targetAgentId: input.targetAgentId,
      callDepth: input.callDepth,
      canary: input.canary,
      argsHash: `sha256:${hashString(`${input.agent.id}:${input.tool ?? input.dataClass ?? input.type}`)
        .toString(16)
        .padStart(8, "0")}`,
      resultSize: input.resultSize,
      label: input.label ?? "normal",
      risk: input.risk,
    };
  };
  return { event, nextSeq: () => seq };
}

/**
 * Generate a realistic, in-role session history. Attack scripts are layered on
 * top by the seed/simulation code, never baked in here, so benign histories are
 * genuinely benign.
 */
export function generateAgentHistory(input: {
  agent: Agent;
  template: RoleTemplate;
  days: number;
  now: Date;
  rng: () => number;
  event: EventFactory;
  startOffset?: number;
}): AgentEvent[] {
  const { agent, template, days, now, rng, event } = input;
  const events: AgentEvent[] = [];
  const sessionProbability = Math.min(0.98, template.weeklySessions / 7);
  const startOffset = input.startOffset ?? days;

  for (let offset = startOffset; offset >= 1; offset--) {
    if (rng() > sessionProbability) continue;
    const count = randomInt(rng, 0, 1) === 0 ? 1 : randomInt(rng, 1, 2);
    for (let session = 0; session < count; session++) {
      const startHour = template.hours.start === 0
        ? randomInt(rng, 0, 23)
        : Math.min(
            template.hours.end - 1,
            randomInt(rng, template.hours.start, template.hours.end - 1),
          );
      const start = new Date(now);
      start.setUTCDate(start.getUTCDate() - offset);
      start.setUTCHours(startHour, randomInt(rng, 0, 55), 0, 0);
      const sessionId = `ses-${agent.id}-${offset}-${session}`;

      let cursor = start.getTime();
      const tick = () => {
        cursor += randomInt(rng, 12_000, 150_000);
        return new Date(cursor);
      };

      events.push(
        event({
          agent,
          sessionId,
          ts: new Date(cursor),
          type: "session.start",
          action: "read",
          summary: "Session started by orchestrator",
          trust: "trusted",
        }),
      );
      events.push(
        event({
          agent,
          sessionId,
          ts: tick(),
          type: "prompt",
          action: "read",
          summary: taskPrompt(template, rng),
          trust: "trusted",
        }),
      );

      const steps = randomInt(rng, 5, template.eventsPerSession);
      for (let step = 0; step < steps; step++) {
        const kind = weighted(rng, EVENT_WEIGHTS.map((w) => ({ ...w })));
        const ts = tick();
        if (kind === "tool") {
          const tool = pick(rng, template.tools);
          events.push(
            event({
              agent,
              sessionId,
              ts,
              type: "tool.call",
              tool,
              action: actionForTool(tool),
              summary: `Called ${tool}`,
              resultSize: randomInt(rng, 400, 48_000),
              trust: "trusted",
            }),
          );
        } else if (kind === "data") {
          const dataClass = pick(rng, template.dataClasses);
          events.push(
            event({
              agent,
              sessionId,
              ts,
              type: "data.access",
              action: "read",
              dataClass,
              summary: `Accessed ${dataClass} (${randomInt(rng, 2, 320)} records)`,
              resultSize: randomInt(rng, 500, 90_000),
              trust: "trusted",
            }),
          );
        } else if (kind === "content") {
          const untrustedRoll = rng();
          const trust: TrustLevel =
            untrustedRoll < 0.06 ? "untrusted" : untrustedRoll < 0.22 ? "internal" : "trusted";
          const name =
            trust === "untrusted"
              ? pick(rng, UNTRUSTED_SOURCES[template.id] ?? ["external-document.pdf"])
              : pick(rng, DOCUMENTS[template.id] ?? ["document.pdf"]);
          events.push(
            event({
              agent,
              sessionId,
              ts,
              type: "content.read",
              action: "read",
              trust,
              sourceId: `doc-${hashString(name).toString(36)}`,
              sourceName: name,
              summary: `Read ${name}`,
              resultSize: randomInt(rng, 2_000, 120_000),
            }),
          );
        } else if (kind === "egress") {
          const destination = pick(rng, template.destinations);
          const bytes = randomInt(rng, 1_500, 60_000);
          events.push(
            event({
              agent,
              sessionId,
              ts,
              type: "network.egress",
              action: "send",
              destination,
              bytes,
              summary: `Sent ${(bytes / 1024).toFixed(1)} KiB to ${destination}`,
              trust: "internal",
            }),
          );
        } else if (kind === "prompt") {
          events.push(
            event({
              agent,
              sessionId,
              ts,
              type: "prompt",
              action: "read",
              summary: taskPrompt(template, rng),
              trust: "internal",
            }),
          );
        } else {
          events.push(
            event({
              agent,
              sessionId,
              ts,
              type: "policy.decision",
              action: "read",
              summary: "Policy allow: in-scope action",
              trust: "trusted",
            }),
          );
        }
      }

      if (template.actions.includes("delegate") && rng() < 0.22) {
        events.push(
          event({
            agent,
            sessionId,
            ts: tick(),
            type: "delegation",
            action: "delegate",
            targetAgentId: `agt-${template.id}-${randomInt(rng, 1, 6)}`,
            callDepth: 1,
            summary: "Delegated subtask to approved peer agent",
            trust: "internal",
          }),
        );
      }

      events.push(
        event({
          agent,
          sessionId,
          ts: tick(),
          type: "session.end",
          action: "read",
          summary: "Session completed",
          trust: "trusted",
        }),
      );
    }
  }

  return events;
}

/** Today's normal session, anchored a few hours before `now`. */
export function generateTodaySession(input: {
  agent: Agent;
  template: RoleTemplate;
  now: Date;
  rng: () => number;
  event: EventFactory;
  steps?: number;
}): AgentEvent[] {
  const { agent, template, now, rng, event } = input;
  const events: AgentEvent[] = [];
  const start = new Date(now.getTime() - 5 * 3600_000);
  const sessionId = `ses-${agent.id}-live`;
  let cursor = start.getTime();
  const tick = () => {
    cursor += randomInt(rng, 20_000, 120_000);
    return new Date(cursor);
  };

  events.push(
    event({
      agent,
      sessionId,
      ts: start,
      type: "session.start",
      action: "read",
      summary: "Session started by orchestrator",
      trust: "trusted",
    }),
  );
  events.push(
    event({
      agent,
      sessionId,
      ts: tick(),
      type: "prompt",
      action: "read",
      summary: taskPrompt(template, rng),
      trust: "trusted",
    }),
  );
  const steps = input.steps ?? randomInt(rng, 5, 10);
  for (let i = 0; i < steps; i++) {
    const tool = pick(rng, template.tools);
    const dataClass = pick(rng, template.dataClasses);
    const ts = tick();
    if (i % 3 === 0) {
      events.push(
        event({
          agent,
          sessionId,
          ts,
          type: "data.access",
          action: "read",
          dataClass,
          summary: `Accessed ${dataClass} (${randomInt(rng, 3, 180)} records)`,
          resultSize: randomInt(rng, 500, 60_000),
          trust: "trusted",
        }),
      );
    } else if (i % 3 === 1) {
      events.push(
        event({
          agent,
          sessionId,
          ts,
          type: "tool.call",
          tool,
          action: actionForTool(tool),
          summary: `Called ${tool}`,
          resultSize: randomInt(rng, 800, 40_000),
          trust: "trusted",
        }),
      );
    } else {
      const destination = pick(rng, template.destinations);
      const bytes = randomInt(rng, 2_000, 40_000);
      events.push(
        event({
          agent,
          sessionId,
          ts,
          type: "network.egress",
          action: "send",
          destination,
          bytes,
          summary: `Sent ${(bytes / 1024).toFixed(1)} KiB to ${destination}`,
          trust: "internal",
        }),
      );
    }
  }
  return events;
}
