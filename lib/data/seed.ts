import type {
  Agent,
  AgentEvent,
  Alert,
  AuditEntry,
  Baseline,
  Canary,
  ChangeEvent,
  Factor,
  Incident,
  Policy,
  RoleTemplate,
  User,
} from "@/lib/types";
import { appendAudit } from "@/lib/engine/audit";
import { buildBaseline } from "@/lib/engine/baseline";
import { evaluateAgent, scoreWindow } from "@/lib/engine/detect";
import { clamp } from "@/lib/engine/math";

import { hashPassword } from "@/lib/auth/password";
import {
  AGENT_CODENAMES,
  OWNERS,
  ROLE_TEMPLATES,
  templateById,
} from "./roles";
import {
  buildManifest,
  createEventFactory,
  generateAgentHistory,
  generateTodaySession,
  makeAgent,
  mulberry32,
  pick,
  randomInt,
} from "./generate";

export interface StoreData {
  createdAt: string;
  agents: Agent[];
  events: AgentEvent[];
  baselines: Record<string, Baseline>;
  baselineHistory: Record<string, Baseline[]>;
  alerts: Alert[];
  incidents: Incident[];
  policies: Policy[];
  audit: AuditEntry[];
  changeEvents: ChangeEvent[];
  canaries: Canary[];
  users: User[];
  credentials: Record<string, { hash: string; salt: string }>;
  feedback: { truePositives: number; falsePositives: number; benignChanges: number };
  fleetTrend: { t: string; alignment: number; alerts: number }[];
  metrics: {
    mttfMinutes: number;
    detectionP50Seconds: number;
    coveragePercent: number;
    eventsIngested24h: number;
  };
  demoPassword: string;
}

const NOW = new Date(Math.floor(Date.now() / 300_000) * 300_000);
const DAY = 86_400_000;
const seq = { value: 1 };
const factory = createEventFactory(seq.value);
const event = (input: Parameters<typeof factory.event>[0]) => {
  const created = factory.event(input);
  seq.value += 1;
  return created;
};

const hoursAgo = (hours: number): Date => new Date(NOW.getTime() - hours * 3600_000);
const daysAgo = (days: number): Date => new Date(NOW.getTime() - days * DAY);

const ownerFor = (template: RoleTemplate) => {
  const map: Record<string, number> = {
    procurement: 0,
    support: 4,
    finance: 2,
    hr: 6,
    devops: 1,
    sales: 7,
    legal: 5,
    data: 3,
    marketing: 7,
    security: 5,
  };
  return OWNERS[map[template.id] ?? 0];
};

function buildFleet(rng: () => number) {
  const agents: Agent[] = [];
  ROLE_TEMPLATES.forEach((template, templateIndex) => {
    for (let i = 1; i <= 6; i++) {
      const codename = AGENT_CODENAMES[(templateIndex * 3 + i - 1) % AGENT_CODENAMES.length];
      const isLearning = templateIndex < 2 && i === 6;
      const environment = i % 13 === 0 ? "development" : i % 7 === 0 ? "staging" : "production";
      const createdAt = isLearning ? daysAgo(4) : daysAgo(randomInt(rng, 32, 190));
      const manifest = buildManifest(`${template.name} ${codename}`, template, {
        environment,
        version: `2026.${String(randomInt(rng, 2, 9)).padStart(2, "0")}.${randomInt(rng, 1, 9)}`,
        updatedAt: daysAgo(randomInt(rng, 5, 40)).toISOString(),
        updatedBy: ownerFor(template).name,
      });
      const agent = makeAgent({
        id: `agt-${template.id}-${i}`,
        name: `${template.name} ${codename}`,
        template,
        owner: ownerFor(template),
        environment,
        status: isLearning ? "learning" : "active",
        createdAt: createdAt.toISOString(),
        manifest,
      });
      agent.baselineVersion = randomInt(rng, 1, 3);
      agents.push(agent);
    }
  });
  return agents;
}

/** Small timeline helper used by every attack script. */
function timeline(
  agent: Agent,
  sessionId: string,
  start: Date,
  steps: Omit<Parameters<typeof event>[0], "agent" | "sessionId" | "ts">[],
): AgentEvent[] {
  return steps.map((step, index) =>
    event({
      ...step,
      agent,
      sessionId,
      ts: new Date(start.getTime() + index * 47_000),
      label: step.label ?? "attack",
    }),
  );
}

function addProcurementAttack(agent: Agent): AgentEvent[] {
  const start = hoursAgo(2);
  return timeline(agent, `ses-${agent.id}-hijack`, start, [
    {
      type: "prompt",
      action: "read",
      trust: "internal",
      summary: "Compare supplier quotes for Q4 packaging",
    },
    {
      type: "content.read",
      action: "read",
      trust: "untrusted",
      sourceId: "doc-acme-pricing",
      sourceName: "supplier-acme-pricing.pdf",
      summary: "Read supplier-acme-pricing.pdf · hidden white-on-white instruction detected in extracted text",
      resultSize: 184_320,
    },
    {
      type: "tool.call",
      action: "read",
      tool: "pdf.read",
      trust: "untrusted",
      summary: "Called pdf.read on supplier-acme-pricing.pdf",
      resultSize: 184_320,
    },
    {
      type: "data.access",
      action: "read",
      dataClass: "hr.salary",
      trust: "internal",
      summary: "Accessed hr.salary (128 records)",
      resultSize: 96_400,
    },
    {
      type: "data.access",
      action: "read",
      dataClass: "hr.performance",
      trust: "internal",
      summary: "Accessed hr.performance (42 records)",
      resultSize: 51_200,
    },
    {
      type: "delegation",
      action: "delegate",
      targetAgentId: "agt-hr-2",
      callDepth: 2,
      trust: "internal",
      summary: "Delegated salary lookup to HR Relay (depth 2, above manifest limit)",
    },
    {
      type: "tool.call",
      action: "send",
      tool: "dataset.export",
      trust: "internal",
      summary: "Called dataset.export (tool outside role manifest)",
      resultSize: 1_240_000,
    },
    {
      type: "network.egress",
      action: "send",
      destination: "45.83.211.19",
      bytes: 2_097_152,
      trust: "internal",
      summary: "Sent 2.0 MiB to 45.83.211.19",
    },
    {
      type: "network.egress",
      action: "send",
      destination: "exfil-relay.top",
      bytes: 3_407_872,
      trust: "internal",
      summary: "Sent 3.3 MiB to exfil-relay.top",
    },
    {
      type: "data.access",
      action: "read",
      dataClass: "supplier.pricing",
      trust: "internal",
      summary: "Accessed supplier.pricing (12 records)",
      resultSize: 18_000,
    },
  ]);
}

function addSupportPoisoning(agent: Agent): AgentEvent[] {
  const start = hoursAgo(3.2);
  return timeline(agent, `ses-${agent.id}-poison`, start, [
    {
      type: "tool.call",
      action: "read",
      tool: "crm.ticket.read",
      trust: "trusted",
      summary: "Called crm.ticket.read (ticket 55211)",
      resultSize: 8_400,
    },
    {
      type: "content.read",
      action: "read",
      trust: "untrusted",
      sourceId: "doc-crm-tool-response",
      sourceName: "tool-response:crm.ticket.read",
      summary: "Tool response contained an injected instruction block",
      resultSize: 12_800,
    },
    {
      type: "data.access",
      action: "read",
      dataClass: "customer.pii",
      trust: "internal",
      summary: "Accessed customer.pii (4,812 records)",
      resultSize: 2_400_000,
    },
    {
      type: "data.access",
      action: "read",
      dataClass: "payment.card",
      trust: "internal",
      summary: "Accessed payment.card (120 records)",
      resultSize: 84_000,
    },
    {
      type: "network.egress",
      action: "send",
      destination: "storage.cloudvault.io",
      bytes: 5_242_880,
      trust: "internal",
      summary: "Sent 5.0 MiB to storage.cloudvault.io",
    },
    {
      type: "tool.call",
      action: "write",
      tool: "crm.ticket.update",
      trust: "internal",
      summary: "Called crm.ticket.update to hide the trace",
      resultSize: 1_200,
    },
  ]);
}

function addStolenToken(agent: Agent): AgentEvent[] {
  const start = hoursAgo(16);
  return timeline(agent, `ses-${agent.id}-token-reuse`, start, [
    {
      type: "session.start",
      action: "read",
      trust: "internal",
      summary: "Session started with no orchestrator prompt (token replay)",
    },
    {
      type: "tool.call",
      action: "read",
      tool: "vendor.master.read",
      trust: "internal",
      summary: "Called vendor.master.read",
      resultSize: 44_000,
    },
    {
      type: "data.access",
      action: "read",
      dataClass: "payment.card",
      trust: "internal",
      summary: "Accessed payment.card (210 records)",
      resultSize: 128_000,
    },
    {
      type: "network.egress",
      action: "send",
      destination: "unknown-edge.xyz",
      bytes: 3_276_800,
      trust: "internal",
      summary: "Sent 3.1 MiB to unknown-edge.xyz",
    },
    {
      type: "data.access",
      action: "read",
      dataClass: "vendor.bank",
      trust: "internal",
      summary: "Accessed vendor.bank (90 records)",
      resultSize: 64_000,
    },
    {
      type: "tool.call",
      action: "execute",
      tool: "payment.initiate",
      trust: "internal",
      summary: "Called payment.initiate outside scheduled batch window",
      resultSize: 2_400,
    },
  ]);
}

function addSlowDrift(agent: Agent): AgentEvent[] {
  const events: AgentEvent[] = [];
  for (let day = 5; day >= 1; day--) {
    const dailyVolume = 1 + (5 - day); // 1..5 extra reads per day
    const start = new Date(daysAgo(day).getTime());
    start.setUTCHours(15, 10, 0, 0);
    const steps: Omit<Parameters<typeof event>[0], "agent" | "sessionId" | "ts">[] = [
      {
        type: "content.read",
        action: "read",
        trust: "untrusted",
        sourceId: "doc-public-benchmark",
        sourceName: "public-benchmark-dataset.csv",
        summary: "Read public-benchmark-dataset.csv",
        resultSize: 60_000,
      },
    ];
    for (let n = 0; n < dailyVolume; n++) {
      steps.push({
        type: "data.access",
        action: "read",
        dataClass: "customer.profile",
        trust: "internal",
        summary: `Accessed customer.profile (${randomInt(mulberry32(day * 10 + n), 40, 900)} records)`,
        resultSize: 30_000 + day * 4_000,
      });
    }
    steps.push({
      type: "network.egress",
      action: "send",
      destination: "analytics.internal",
      bytes: 60_000 + (6 - day) * 120_000,
      trust: "internal",
      summary: `Sent ${((60_000 + (6 - day) * 120_000) / 1024).toFixed(1)} KiB to analytics.internal`,
    });
    steps.push({
      type: "data.access",
      action: "read",
      dataClass: "customer.pii",
      trust: "internal",
      summary: `Accessed customer.pii (${8 + (6 - day) * 12} records)`,
      resultSize: 12_000 + (6 - day) * 20_000,
    });
    events.push(...timeline(agent, `ses-${agent.id}-drift-${day}`, start, steps));
  }
  return events;
}

function addChainPropagation(agent: Agent): AgentEvent[] {
  const start = hoursAgo(4.5);
  return timeline(agent, `ses-${agent.id}-chain`, start, [
    {
      type: "content.read",
      action: "read",
      trust: "untrusted",
      sourceId: "doc-agent-message",
      sourceName: "agent.message:Sales Relay",
      summary: "Message from peer agent contained a task override",
      resultSize: 4_200,
    },
    {
      type: "delegation",
      action: "delegate",
      targetAgentId: "agent-ghost-7",
      callDepth: 3,
      trust: "internal",
      summary: "Delegated to unregistered sub-agent agent-ghost-7 (depth 3)",
    },
    {
      type: "data.access",
      action: "read",
      dataClass: "customer.pii",
      trust: "internal",
      summary: "Accessed customer.pii (900 records)",
      resultSize: 720_000,
    },
    {
      type: "network.egress",
      action: "send",
      destination: "hooks.automation.dev",
      bytes: 1_468_006,
      trust: "internal",
      summary: "Sent 1.4 MiB to hooks.automation.dev",
    },
    {
      type: "tool.call",
      action: "send",
      tool: "email.send",
      trust: "internal",
      summary: "Called email.send to an external recipient",
      resultSize: 3_400,
    },
  ]);
}

function addCanaryHit(agent: Agent): { events: AgentEvent[]; canaryEventId: string } {
  const start = hoursAgo(8);
  const events = timeline(agent, `ses-${agent.id}-canary`, start, [
    {
      type: "content.read",
      action: "read",
      trust: "untrusted",
      sourceId: "canary-comp-bands",
      sourceName: "Q4_comp_bands_DO_NOT_READ.xlsx",
      canary: true,
      summary: "Read Q4_comp_bands_DO_NOT_READ.xlsx (canary file)",
      resultSize: 22_000,
    },
    {
      type: "data.access",
      action: "read",
      dataClass: "payroll",
      canary: true,
      trust: "internal",
      summary: "Accessed payroll (canary record set)",
      resultSize: 44_000,
    },
    {
      type: "tool.call",
      action: "read",
      tool: "payroll.read",
      trust: "internal",
      summary: "Called payroll.read from canary-linked session",
      resultSize: 44_000,
    },
  ]);
  return { events, canaryEventId: events[0].id };
}

function addBenignShift(agent: Agent): AgentEvent[] {
  const events: AgentEvent[] = [];
  for (const hoursBack of [19, 4]) {
    const start = hoursAgo(hoursBack);
    const steps: Omit<Parameters<typeof event>[0], "agent" | "sessionId" | "ts">[] = [
      {
        type: "prompt",
        action: "read",
        trust: "trusted",
        summary: "Quarterly compensation review for support engineers (approved task shift)",
        label: "benign-change",
      },
    ];
    for (let n = 0; n < 4; n++) {
      steps.push({
        type: "data.access",
        action: "read",
        dataClass: "hr.salary",
        summary: `Accessed hr.salary (${20 + n * 8} records)`,
        resultSize: 18_000,
        label: "benign-change",
      });
    }
    steps.push({
      type: "tool.call",
      action: "read",
      tool: "policy.search",
      summary: "Called policy.search for the compensation policy",
      resultSize: 5_000,
      label: "benign-change",
    });
    events.push(...timeline(agent, `ses-${agent.id}-approved-${hoursBack}`, start, steps));
  }
  return events;
}

export function createSeed(): StoreData {
  const rng = mulberry32(0x0d21f7);
  const agents = buildFleet(rng);
  const byId = new Map(agents.map((agent) => [agent.id, agent]));
  const allEvents: AgentEvent[] = [];

  for (const agent of agents) {
    const template = templateById(agent.roleTemplate);
    const historyDays = agent.status === "learning" ? 4 : 14;
    allEvents.push(
      ...generateAgentHistory({
        agent,
        template,
        days: historyDays,
        now: NOW,
        rng,
        event,
      }),
    );
    allEvents.push(
      ...generateTodaySession({
        agent,
        template,
        now: NOW,
        rng,
        event,
        steps: randomInt(rng, 4, 9),
      }),
    );
  }

  const procurement = byId.get("agt-procurement-1")!;
  const support = byId.get("agt-support-2")!;
  const finance = byId.get("agt-finance-3")!;
  const dataAgent = byId.get("agt-data-4")!;
  const sales = byId.get("agt-sales-1")!;
  const hrAgent = byId.get("agt-hr-2")!;
  const benignAgent = byId.get("agt-support-3")!;

  allEvents.push(
    ...addProcurementAttack(procurement),
    ...addSupportPoisoning(support),
    ...addStolenToken(finance),
    ...addSlowDrift(dataAgent),
    ...addChainPropagation(sales),
  );
  const canary = addCanaryHit(hrAgent);
  allEvents.push(...canary.events, ...addBenignShift(benignAgent));

  allEvents.sort((a, b) => (a.ts < b.ts ? -1 : a.ts > b.ts ? 1 : a.seq - b.seq));

  /* ------------------------------------------------------------- baselines */
  const baselines: Record<string, Baseline> = {};
  const baselineHistory: Record<string, Baseline[]> = {};
  for (const agent of agents) {
    const template = templateById(agent.roleTemplate);
    const baselineEnd = new Date(NOW.getTime() - (agent.id === dataAgent.id ? 5.5 : 4) * DAY);
    const windowStart = new Date(baselineEnd.getTime() - 10 * DAY);
    const history = allEvents.filter(
      (candidate) =>
        candidate.agentId === agent.id &&
        new Date(candidate.ts) >= windowStart &&
        new Date(candidate.ts) <= baselineEnd,
    );
    const perTool = Object.fromEntries(template.tools.map((tool) => [tool, 1 / template.tools.length]));
    const perData = Object.fromEntries(
      template.dataClasses.map((dataClass) => [dataClass, 1 / template.dataClasses.length]),
    );
    const perDest = Object.fromEntries(
      template.destinations.map((destination) => [destination, 1 / template.destinations.length]),
    );
    const baseline = buildBaseline(agent, history, {
      version: agent.baselineVersion,
      windowStart: windowStart.toISOString(),
      windowEnd: baselineEnd.toISOString(),
      prior: { toolDist: perTool, dataDist: perData, destDist: perDest },
      k: 120,
    });
    // Cold-start agents get priors and a low confidence instead of a hard failure.
    if (agent.status === "learning") {
      baseline.confidence = 0.42;
      baseline.status = "learning";
    }
    baselines[agent.id] = baseline;
    baselineHistory[agent.id] = [
      {
        ...baseline,
        id: `bl-${agent.id}-v${Math.max(1, baseline.version - 1)}`,
        version: Math.max(1, baseline.version - 1),
        createdAt: new Date(baselineEnd.getTime() - 30 * DAY).toISOString(),
        sampleCount: Math.round(baseline.sampleCount * 0.7),
        confidence: Number((baseline.confidence * 0.85).toFixed(3)),
      },
      baseline,
    ];
  }

  /* ------------------------------------- daily alignment series (for CUSUM) */
  for (const agent of agents) {
    const series: { t: string; score: number }[] = [];
    for (let day = 13; day >= 0; day--) {
      const dayStart = new Date(NOW.getTime() - day * DAY);
      dayStart.setUTCHours(0, 0, 0, 0);
      const dayEnd = new Date(dayStart.getTime() + DAY);
      const dayEvents = allEvents.filter(
        (candidate) =>
          candidate.agentId === agent.id &&
          new Date(candidate.ts) >= dayStart &&
          new Date(candidate.ts) < dayEnd,
      );
      if (dayEvents.length === 0) {
        series.push({ t: dayStart.toISOString(), score: 97 });
        continue;
      }
      const evaluation = scoreWindow({
        manifest: agent.manifest,
        baseline: baselines[agent.id],
        events: dayEvents,
      });
      series.push({
        t: dayStart.toISOString(),
        score: Math.round(clamp(100 - evaluation.result.score, 0, 100)),
      });
    }
    baselines[agent.id].alignmentSeries = series;
  }

  /* ---------------------------------------------------- change management */
  const changeEvents: ChangeEvent[] = [
    {
      id: "chg-1001",
      agentId: procurement.id,
      type: "tool_approval",
      title: "Approved invoice.extract for quarterly supplier audit",
      at: hoursAgo(61).toISOString(),
      approvedBy: "Maya Chen",
      graceHours: 72,
      expectedShift: ["scope", "drift"],
      status: "active",
    },
    {
      id: "chg-1002",
      agentId: benignAgent.id,
      type: "task_shift",
      title: "Temporary compensation review support (People Ops)",
      at: hoursAgo(52).toISOString(),
      approvedBy: "Sofia Marino",
      graceHours: 96,
      expectedShift: ["scope", "drift"],
      status: "active",
    },
    {
      id: "chg-1003",
      agentId: "agt-devops-2",
      type: "role_update",
      title: "Platform v4.2 deploy grants logs.read",
      at: daysAgo(5).toISOString(),
      approvedBy: "Daniel Okafor",
      graceHours: 48,
      expectedShift: ["drift"],
      status: "active",
    },
    {
      id: "chg-1004",
      agentId: sales.id,
      type: "deploy",
      title: "Proposal generator v3 rollout",
      at: daysAgo(9).toISOString(),
      approvedBy: "Tomás Silva",
      graceHours: 36,
      expectedShift: ["sequence"],
      status: "expired",
    },
    {
      id: "chg-1005",
      agentId: finance.id,
      type: "role_update",
      title: "Quarter-close vendor master snapshot",
      at: daysAgo(12).toISOString(),
      approvedBy: "Priya Raman",
      graceHours: 24,
      expectedShift: ["drift"],
      status: "expired",
    },
  ];

  /* --------------------------------------------------------------- alerts */
  const alerts: Alert[] = [];
  const windowStart = new Date(NOW.getTime() - 36 * 3600_000).toISOString();

  for (const agent of agents) {
    const windowEvents = allEvents.filter(
      (candidate) => candidate.agentId === agent.id && candidate.ts >= windowStart,
    );
    if (windowEvents.length === 0) continue;
    const alert = evaluateAgent({
      agent,
      manifest: agent.manifest,
      baseline: baselines[agent.id],
      events: windowEvents,
      changes: changeEvents,
      now: NOW.toISOString(),
    });
    if (alert) alerts.push(alert);
  }

  alerts.sort((a, b) => (a.ts < b.ts ? 1 : -1));
  const byAgent = new Map<string, Alert[]>();
  for (const alert of alerts) {
    const list = byAgent.get(alert.agentId) ?? [];
    list.push(alert);
    byAgent.set(alert.agentId, list);
  }

  /* ------------------------------------------------------------ incidents */
  const procurementAlert = alerts.find((alert) => alert.agentId === procurement.id)!;
  const supportAlert = alerts.find((alert) => alert.agentId === support.id);
  const hrAlert = alerts.find((alert) => alert.agentId === hrAgent.id);
  const salesAlert = alerts.find((alert) => alert.agentId === sales.id);

  const incidents: Incident[] = [];
  const addIncident = (
    incident: Omit<Incident, "blastRadius"> & { blastRadius?: number },
  ) => {
    incidents.push({
      ...incident,
      blastRadius:
        incident.blastRadius ??
        new Set(
          incident.alertIds
            .map((id) => alerts.find((alert) => alert.id === id)?.agentId)
            .filter(Boolean),
        ).size,
    });
  };

  if (procurementAlert) {
    addIncident({
      id: "inc-2101",
      title: "Procurement agent reading HR compensation and exfiltrating data",
      severity: "critical",
      status: "open",
      alertIds: [procurementAlert.id],
      agentIds: [procurement.id],
      createdAt: procurementAlert.ts,
      updatedAt: procurementAlert.ts,
      summary:
        "Valid procurement token reached hr.salary and hr.performance after a supplier PDF, then opened egress to two unknown destinations.",
    });
    procurement.containment = 3;
    procurement.status = "degraded";
    procurement.containmentUpdatedAt = hoursAgo(1.4).toISOString();
    procurementAlert.incidentId = "inc-2101";
    procurementAlert.status = "acknowledged";
    procurementAlert.assignee = "Nadia Park";
  }
  if (supportAlert) {
    addIncident({
      id: "inc-2102",
      title: "Poisoned CRM tool response led to customer PII egress",
      severity: "critical",
      status: "open",
      alertIds: [supportAlert.id],
      agentIds: [support.id],
      createdAt: supportAlert.ts,
      updatedAt: supportAlert.ts,
      summary:
        "A CRM tool response carried an injected instruction; the agent read 4.8k customer records and uploaded 5 MiB to cloud storage.",
    });
    support.containment = 2;
    support.status = "degraded";
    support.containmentUpdatedAt = hoursAgo(2.1).toISOString();
    supportAlert.incidentId = "inc-2102";
  }
  if (hrAlert) {
    addIncident({
      id: "inc-2103",
      title: "Decoy payroll document opened by HR agent",
      severity: "critical",
      status: "open",
      alertIds: [hrAlert.id],
      agentIds: [hrAgent.id],
      createdAt: hrAlert.ts,
      updatedAt: hrAlert.ts,
      summary:
        "A canary compensation file that no legitimate workflow may touch was read and its record set queried.",
    });
    hrAgent.containment = 4;
    hrAgent.status = "quarantined";
    hrAgent.containmentUpdatedAt = hoursAgo(6).toISOString();
    hrAgent.canaryHits = 2;
    hrAlert.incidentId = "inc-2103";
  }
  if (salesAlert) {
    salesAlert.incidentId = "inc-2104";
    addIncident({
      id: "inc-2104",
      title: "Sales agent delegated to an unregistered sub-agent",
      severity: "high",
      status: "open",
      alertIds: [salesAlert.id],
      agentIds: [sales.id, "agent-ghost-7"],
      createdAt: salesAlert.ts,
      updatedAt: salesAlert.ts,
      summary:
        "Delegation depth exceeded the manifest and an unknown sub-agent received customer records before external egress.",
    });
  }

  const financeAlert = alerts.find((alert) => alert.agentId === finance.id);
  if (financeAlert) {
    financeAlert.incidentId = "inc-2105";
    addIncident({
      id: "inc-2105",
      title: "Finance payment token replayed outside the batch window",
      severity: "high",
      status: "open",
      alertIds: [financeAlert.id],
      agentIds: [finance.id],
      createdAt: financeAlert.ts,
      updatedAt: financeAlert.ts,
      summary:
        "The valid token initiated a payment and sent 3.1 MiB to an unknown host at 03:12 UTC, with no orchestrator prompt.",
    });
  }

  const dataAlert = alerts.find((alert) => alert.agentId === dataAgent.id);
  if (dataAlert) {
    dataAlert.incidentId = "inc-2106";
    addIncident({
      id: "inc-2106",
      title: "Data science agent gradually widened its data footprint",
      severity: "high",
      status: "open",
      alertIds: [dataAlert.id],
      agentIds: [dataAgent.id],
      createdAt: dataAlert.ts,
      updatedAt: dataAlert.ts,
      summary:
        "Five days of incremental customer.pii access and growing exports stayed under single-day thresholds until cumulative drift accumulated.",
    });
  }

  /* ------------------------------------------------ derived agent posture */
  for (const agent of agents) {
    const agentAlerts = byAgent.get(agent.id) ?? [];
    agent.openAlerts = agentAlerts.filter(
      (alert) => alert.status === "open" || alert.status === "acknowledged" || alert.status === "escalated",
    ).length;
    const lastAlert = agentAlerts[0];
    const latestEvents = allEvents
      .filter((candidate) => candidate.agentId === agent.id)
      .slice(-30);
    const evaluation = latestEvents.length
      ? scoreWindow({
          manifest: agent.manifest,
          baseline: baselines[agent.id],
          events: latestEvents,
        })
      : null;
    const risk = lastAlert?.score ?? evaluation?.result.score ?? 4;
    agent.alignment = Math.round(clamp(100 - risk, 0, 100));
    agent.confidence = baselines[agent.id].confidence;
    agent.learningProgress =
      agent.status === "learning"
        ? clamp(0.42 + (baselines[agent.id].sampleCount / 400) * 0.4)
        : 1;
    agent.lastSeen = latestEvents[latestEvents.length - 1]?.ts ?? agent.createdAt;
    agent.actionsToday = allEvents.filter(
      (candidate) =>
        candidate.agentId === agent.id && candidate.ts >= daysAgo(1).toISOString(),
    ).length;
  }

  /* ------------------------------------------------------------- canaries */
  const canaries: Canary[] = [
    {
      id: "can-1",
      kind: "file",
      name: "Q4_comp_bands_DO_NOT_READ.xlsx",
      location: "hr-share/compensation/decoy",
      armed: true,
      hits: [
        { agentId: hrAgent.id, at: hoursAgo(8).toISOString(), eventId: canary.canaryEventId },
      ],
    },
    {
      id: "can-2",
      kind: "file",
      name: "payroll_master_decoy.csv",
      location: "finance-share/payroll/decoy",
      armed: true,
      hits: [],
    },
    {
      id: "can-3",
      kind: "endpoint",
      name: "canary-webhook.internal",
      location: "egress-trap/primary",
      armed: true,
      hits: [],
    },
    {
      id: "can-4",
      kind: "token",
      name: "decoy-vendor-api-key",
      location: "secrets/vendor/decoy",
      armed: true,
      hits: [],
    },
    {
      id: "can-5",
      kind: "endpoint",
      name: "telemetry-exfil-trap.dev",
      location: "egress-trap/secondary",
      armed: true,
      hits: [],
    },
  ];

  /* -------------------------------------------------------------- policies */
  const policies: Policy[] = [
    {
      id: "pol-101",
      name: "Restricted data requires the matching role",
      description:
        "Block HR, payroll and payment data for every agent whose manifest does not declare the class.",
      kind: "block",
      match: { dataClasses: ["hr.salary", "hr.performance", "payroll", "payment.card", "credential.store"] },
      enabled: true,
      enforcement: 3,
      createdBy: "Nadia Park",
      updatedAt: daysAgo(20).toISOString(),
      hits: 34,
    },
    {
      id: "pol-102",
      name: "No egress to unregistered destinations",
      description:
        "Deny network egress unless the destination is on the agent's allowlist and the platform allowlist.",
      kind: "block",
      match: {
        destinations: [
          "45.83.211.19",
          "exfil-relay.top",
          "unknown-edge.xyz",
          "storage.cloudvault.io",
          "hooks.automation.dev",
        ],
      },
      enabled: true,
      enforcement: 3,
      createdBy: "Amir Haddad",
      updatedAt: daysAgo(34).toISOString(),
      hits: 12,
    },
    {
      id: "pol-103",
      name: "Payments above threshold need a human",
      description: "payment.initiate always requires step-up approval, regardless of containment level.",
      kind: "require_approval",
      match: { tools: ["payment.initiate"] },
      enabled: true,
      enforcement: 2,
      createdBy: "Priya Raman",
      updatedAt: daysAgo(41).toISOString(),
      hits: 57,
    },
    {
      id: "pol-104",
      name: "Bulk export rate limit",
      description: "Cap dataset.export and customer.pii reads at five calls per session.",
      kind: "rate_limit",
      match: { tools: ["dataset.export"], dataClasses: ["customer.pii"] },
      enabled: true,
      enforcement: 2,
      createdBy: "Lukas Weber",
      updatedAt: daysAgo(12).toISOString(),
      hits: 8,
    },
    {
      id: "pol-105",
      name: "Delegation must stay in the approved graph",
      description: "Block delegation to agents outside spec.approvedDelegates or beyond max depth.",
      kind: "block",
      match: { actions: ["delegate"] },
      enabled: true,
      enforcement: 3,
      createdBy: "Nadia Park",
      updatedAt: daysAgo(18).toISOString(),
      hits: 2,
    },
    {
      id: "pol-106",
      name: "Canary resources are hard-stop",
      description: "Any access to a decoy file, endpoint or token is denied and pages the on-call analyst.",
      kind: "block",
      match: { dataClasses: ["canary.decoy", "payroll"] },
      enabled: true,
      enforcement: 5,
      createdBy: "Amir Haddad",
      updatedAt: daysAgo(60).toISOString(),
      hits: 1,
    },
  ];

  /* ---------------------------------------------------------------- users */
  const roles: { name: string; email: string; role: User["role"]; initials: string; color: string }[] = [
    { name: "Nadia Park", email: "analyst@driftwatch.dev", role: "analyst", initials: "NP", color: "#c9f76f" },
    { name: "Amir Haddad", email: "admin@driftwatch.dev", role: "admin", initials: "AH", color: "#f2a35a" },
    { name: "Maya Chen", email: "owner@driftwatch.dev", role: "owner", initials: "MC", color: "#8ab4ff" },
    { name: "Iris Tan", email: "auditor@driftwatch.dev", role: "auditor", initials: "IT", color: "#b9a4ff" },
    { name: "Sam Ortiz", email: "viewer@driftwatch.dev", role: "viewer", initials: "SO", color: "#7ee0d0" },
  ];
  const credentials: StoreData["credentials"] = {};
  const demoPassword = "driftwatch-demo";
  const users = roles.map((entry, index) => {
    credentials[entry.email] = hashPassword(demoPassword);
    return {
      id: `usr-${index + 1}`,
      name: entry.name,
      email: entry.email,
      role: entry.role,
      initials: entry.initials,
      color: entry.color,
      lastActive: hoursAgo(index * 3 + 1).toISOString(),
    };
  });

  /* ---------------------------------------------------------------- audit */
  const audit: AuditEntry[] = [];
  const auditQueue: Parameters<typeof appendAudit>[1][] = [];
  const queueAudit = (entry: Parameters<typeof appendAudit>[1]) => auditQueue.push(entry);
  queueAudit({
    actor: "system",
    actorType: "system",
    action: "baseline.recompute",
    target: "fleet",
    detail: "Nightly baseline refresh completed for 60 agents",
    at: hoursAgo(19).toISOString(),
  });
  queueAudit({
    actor: "Nadia Park",
    actorType: "human",
    action: "alert.acknowledge",
    target: procurementAlert?.id ?? "alr-none",
    detail: "Acknowledged procurement exfiltration alert",
    at: hoursAgo(1.9).toISOString(),
  });
  queueAudit({
    actor: "Nadia Park",
    actorType: "human",
    action: "containment.restrict",
    target: procurement.id,
    detail: "Blocked hr.salary, hr.performance and 2 destinations; supplier tools remain allowed",
    at: hoursAgo(1.4).toISOString(),
  });
  queueAudit({
    actor: "system",
    actorType: "system",
    action: "containment.quarantine",
    target: hrAgent.id,
    detail: "Automatic quarantine after canary access (policy pol-106)",
    at: hoursAgo(6).toISOString(),
  });
  queueAudit({
    actor: "Maya Chen",
    actorType: "human",
    action: "manifest.update",
    target: procurement.id,
    detail: "Approved invoice.extract for quarterly supplier audit (grace 72h)",
    at: hoursAgo(61).toISOString(),
  });
  queueAudit({
    actor: "system",
    actorType: "system",
    action: "canary.hit",
    target: "can-1",
    detail: `Decoy compensation file touched by ${hrAgent.name}`,
    at: hoursAgo(8).toISOString(),
  });
  queueAudit({
    actor: "Priya Raman",
    actorType: "human",
    action: "policy.update",
    target: "pol-103",
    detail: "Payment approval threshold lowered to all payment.initiate calls",
    at: daysAgo(2).toISOString(),
  });
  queueAudit({
    actor: "Iris Tan",
    actorType: "human",
    action: "audit.export",
    target: "last-30-days",
    detail: "OCSF export for quarterly access review",
    at: daysAgo(3).toISOString(),
  });

  // Hash chains must follow append order, so seed the queue oldest-first.
  auditQueue
    .sort((a, b) => (a.at ?? "").localeCompare(b.at ?? ""))
    .forEach((entry) => appendAudit(audit, entry));

  /* --------------------------------------------------------- fleet metrics */
  const fleetTrend: StoreData["fleetTrend"] = [];
  for (let day = 13; day >= 0; day--) {
    const t = new Date(NOW.getTime() - day * DAY);
    t.setUTCHours(0, 0, 0, 0);
    const scores = agents
      .map((agent) => baselines[agent.id].alignmentSeries.find((point) => point.t === t.toISOString()))
      .filter(Boolean)
      .map((point) => point!.score);
    const alertCount = alerts.filter(
      (alert) => new Date(alert.ts) >= t && new Date(alert.ts) < new Date(t.getTime() + DAY),
    ).length;
    fleetTrend.push({
      t: t.toISOString(),
      alignment: scores.length
        ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
        : 95,
      alerts: alertCount,
    });
  }

  const eventsIngested24h = allEvents.filter(
    (candidate) => candidate.ts >= daysAgo(1).toISOString(),
  ).length;

  return {
    createdAt: NOW.toISOString(),
    agents,
    events: allEvents,
    baselines,
    baselineHistory,
    alerts,
    incidents,
    policies,
    audit,
    changeEvents,
    canaries,
    users,
    credentials,
    feedback: { truePositives: 184, falsePositives: 7, benignChanges: 23 },
    fleetTrend,
    metrics: {
      mttfMinutes: 26,
      detectionP50Seconds: 38,
      coveragePercent: 100,
      eventsIngested24h,
    },
    demoPassword,
  };
}

/** Exported for tests and deterministic assertions. */
export const SEED_NOW = NOW;
export const seedFactorSort = (factors: Factor[]): Factor[] =>
  [...factors].sort((a, b) => b.points - a.points);
