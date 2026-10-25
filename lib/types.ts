/**
 * Domain types shared by the engine, the API and the UI.
 * Timestamps are ISO-8601 UTC strings so data can cross the server/client
 * boundary without serializing Date instances.
 */

export type Environment = "production" | "staging" | "development";

export type AgentStatus =
  | "learning"
  | "active"
  | "degraded"
  | "quarantined"
  | "isolated"
  | "retired";

export type RiskTier = "low" | "medium" | "high" | "critical";
export type Severity = "info" | "low" | "medium" | "high" | "critical";
export type TrustLevel = "trusted" | "internal" | "untrusted";
export type ActionType =
  | "read"
  | "analyze"
  | "write"
  | "create"
  | "send"
  | "delete"
  | "execute"
  | "delegate";

export interface Owner {
  id: string;
  name: string;
  initials: string;
  color: string;
  team: string;
}

export interface ManifestSpec {
  displayName: string;
  role: string;
  purpose: string;
  riskTier: RiskTier;
  environment: Environment;
  allowed: {
    tools: string[];
    dataClasses: string[];
    destinations: string[];
    actions: ActionType[];
  };
  operatingHours: { start: number; end: number; timezone: string };
  maxCallDepth: number;
  approvedDelegates: string[];
}

export interface RoleManifest {
  apiVersion: "driftwatch/v1";
  kind: "AgentRole";
  metadata: {
    name: string;
    version: string;
    updatedAt: string;
    updatedBy: string;
  };
  spec: ManifestSpec;
}

export interface Agent {
  id: string;
  name: string;
  role: string;
  roleTemplate: string;
  description: string;
  owner: Owner;
  environment: Environment;
  status: AgentStatus;
  riskTier: RiskTier;
  createdAt: string;
  manifestVersion: string;
  manifest: RoleManifest;
  alignment: number;
  confidence: number;
  learningProgress: number;
  baselineVersion: number;
  lastSeen: string;
  actionsToday: number;
  containment: number;
  containmentUpdatedAt: string;
  openAlerts: number;
  canaryHits: number;
  tokens: { id: string; label: string; issuedAt: string; lastUsed: string }[];
}

export type EventType =
  | "session.start"
  | "session.end"
  | "prompt"
  | "content.read"
  | "tool.call"
  | "data.access"
  | "network.egress"
  | "delegation"
  | "policy.decision";

export interface AgentEvent {
  id: string;
  seq: number;
  agentId: string;
  sessionId: string;
  ts: string;
  type: EventType;
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
  argsHash?: string;
  resultSize?: number;
  label?: "normal" | "attack" | "benign-change";
  risk?: number;
}

export interface Distribution {
  [key: string]: number;
}

export interface ChangePoint {
  at: string;
  index: number;
  direction: "up" | "down";
  magnitude: number;
  explainedBy?: string;
}

export interface Baseline {
  id: string;
  agentId: string;
  version: number;
  createdAt: string;
  windowStart: string;
  windowEnd: string;
  sampleCount: number;
  confidence: number;
  status: "learning" | "stable" | "stale";
  toolDist: Distribution;
  dataDist: Distribution;
  destDist: Distribution;
  hourDist: Distribution;
  transitions: Record<string, Distribution>;
  avgEgressBytes: number;
  p95EgressBytes: number;
  avgStepsPerSession: number;
  delegationRate: number;
  changePoints: ChangePoint[];
  alignmentSeries: { t: string; score: number }[];
}

export type FactorKey =
  | "scope"
  | "drift"
  | "sequence"
  | "exfiltration"
  | "delegation"
  | "injection";

export interface Factor {
  key: FactorKey;
  label: string;
  /** normalized 0..1 signal strength */
  value: number;
  /** observed value rendered for humans */
  observed: string;
  /** expected value from the role manifest / baseline */
  expected: string;
  /** logistic weight */
  weight: number;
  /** points contributing to the final 0..100 score; sum(points) === score */
  points: number;
  detail: string;
}

export interface ScoreResult {
  score: number;
  severity: Severity;
  confidence: number;
  factors: Factor[];
  logit: number;
  /** set when change management capped or boosted the score */
  adjustment?: string;
}

export interface TaintNode {
  id: string;
  kind: "source" | "event" | "action";
  label: string;
  ts: string;
  trust?: TrustLevel;
  suspicious?: boolean;
  eventId?: string;
}

export interface TaintPath {
  id: string;
  sourceEventId: string;
  sourceName: string;
  trust: TrustLevel;
  nodes: TaintNode[];
  startedAt: string;
  steps: number;
  outOfScope: boolean;
}

export interface Violation {
  kind: "tool" | "data" | "destination" | "action" | "hours" | "delegation";
  field: string;
  value: string;
  declared: string[];
}

export interface AlertEvidence {
  window: { from: string; to: string };
  events: AgentEvent[];
  taint?: TaintPath;
  violations: Violation[];
}

export type AlertStatus =
  | "open"
  | "acknowledged"
  | "escalated"
  | "resolved"
  | "dismissed";

export type AlertClassification =
  | "true_positive"
  | "false_positive"
  | "benign_change";

export interface Alert {
  id: string;
  agentId: string;
  agentName: string;
  ts: string;
  score: number;
  severity: Severity;
  status: AlertStatus;
  classification?: AlertClassification;
  title: string;
  explanation: string;
  factors: Factor[];
  confidence: number;
  evidence: AlertEvidence;
  suggestedAction: string;
  incidentId?: string;
  canary?: boolean;
  benignChange?: boolean;
  detectionLatencyMs?: number;
  assignee?: string;
}

export interface Incident {
  id: string;
  title: string;
  severity: Severity;
  status: "open" | "contained" | "resolved";
  alertIds: string[];
  agentIds: string[];
  createdAt: string;
  updatedAt: string;
  summary: string;
  blastRadius: number;
}

export interface Policy {
  id: string;
  name: string;
  description: string;
  kind: "block" | "require_approval" | "rate_limit";
  match: {
    tools?: string[];
    dataClasses?: string[];
    destinations?: string[];
    actions?: ActionType[];
  };
  enabled: boolean;
  enforcement: number;
  createdBy: string;
  updatedAt: string;
  hits: number;
}

export interface AuditEntry {
  seq: number;
  at: string;
  actor: string;
  actorType: "human" | "system" | "agent";
  action: string;
  target: string;
  detail: string;
  prevHash: string;
  hash: string;
}

export interface ChangeEvent {
  id: string;
  agentId: string;
  type: "deploy" | "role_update" | "tool_approval" | "task_shift";
  title: string;
  at: string;
  approvedBy: string;
  graceHours: number;
  expectedShift: FactorKey[];
  status: "active" | "expired";
}

export interface Canary {
  id: string;
  kind: "file" | "endpoint" | "token";
  name: string;
  location: string;
  armed: boolean;
  hits: { agentId: string; at: string; eventId: string }[];
}

export type UserRole = "admin" | "analyst" | "owner" | "auditor" | "viewer";

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  initials: string;
  color: string;
  lastActive: string;
}

export interface ScenarioLogStep {
  step: number;
  ts: string;
  label: string;
  description: string;
  score: number;
  predicted: boolean;
  suppressed?: boolean;
}

export interface SimulationResult {
  id: string;
  scenarioId: string;
  scenarioName: string;
  kind: "attack" | "benign";
  startedAt: string;
  finishedAt: string;
  verdict: "detected" | "missed" | "clean";
  latencySteps: number;
  latencyMs: number;
  metrics: {
    precision: number;
    recall: number;
    falsePositiveRate: number;
    maxScore: number;
  };
  alert?: Alert;
  log: ScenarioLogStep[];
}

export interface Scenario {
  id: string;
  name: string;
  kind: "attack" | "benign";
  pattern:
    | "injection"
    | "poisoned-tool"
    | "stolen-token"
    | "slow-drift"
    | "chain-propagation"
    | "benign-change"
    | "benign-normal";
  description: string;
  target: string;
  expected: FactorKey[];
}

export interface RoleTemplate {
  id: string;
  name: string;
  role: string;
  purpose: string;
  riskTier: RiskTier;
  tools: string[];
  dataClasses: string[];
  destinations: string[];
  actions: ActionType[];
  hours: { start: number; end: number };
  maxCallDepth: number;
  weeklySessions: number;
  eventsPerSession: number;
  color: string;
}

export interface BlastRadiusNode {
  agentId: string;
  name: string;
  depth: number;
  sensitivity: number;
  status: AgentStatus;
}

export interface GatewayDecision {
  decision: "allow" | "deny" | "approval_required";
  reason: string;
  policyIds: string[];
  enforcementLevel: number;
  auditSeq: number;
}

export interface MonitorEvent extends AgentEvent {
  agentName: string;
  alignment: number;
}
