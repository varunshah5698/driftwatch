"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Ban,
  CheckCircle2,
  FlaskConical,
  Loader2,
  Play,
  ShieldQuestion,
  Timer,
} from "lucide-react";
import type { Agent, AgentEvent, Policy } from "@/lib/types";

export function PolicyRow({
  policy,
  dryRun,
  canEdit,
}: {
  policy: Policy;
  dryRun: { blocked: number; agentsAffected: number };
  canEdit: boolean;
}) {
  const router = useRouter();
  const [enabled, setEnabled] = useState(policy.enabled);
  const [pending, setPending] = useState(false);
  const [preview, setPreview] = useState<{
    blocked: number;
    agentsAffected: number;
    events: AgentEvent[];
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const toggle = async () => {
    if (!canEdit) return;
    setPending(true);
    const response = await fetch("/api/policies", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id: policy.id, enabled: !enabled }),
    });
    setPending(false);
    if (!response.ok) {
      setError("Unable to update policy");
      return;
    }
    setEnabled((value) => !value);
    router.refresh();
  };

  const runDryRun = async () => {
    setPending(true);
    const response = await fetch("/api/policies", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id: policy.id }),
    });
    const payload = (await response.json()) as {
      blocked?: number;
      agentsAffected?: number;
      events?: AgentEvent[];
      error?: string;
    };
    setPending(false);
    if (!response.ok) {
      setError(payload.error ?? "Dry-run failed");
      return;
    }
    setPreview({
      blocked: payload.blocked ?? 0,
      agentsAffected: payload.agentsAffected ?? 0,
      events: payload.events ?? [],
    });
  };

  const KindIcon = policy.kind === "block" ? Ban : policy.kind === "require_approval" ? ShieldQuestion : Timer;

  return (
    <div className={`rounded-2xl border p-4 transition-colors ${enabled ? "border-[var(--line)] bg-[var(--panel-soft)]" : "border-[var(--line)] bg-transparent opacity-70"}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <KindIcon size={13} className="text-[var(--orange)]" aria-hidden />
            <p className="text-[12px] font-semibold">{policy.name}</p>
            <span className="chip !px-1.5 !py-0 !text-[8px]">{policy.kind.replace("_", " ")}</span>
            <span className="chip !px-1.5 !py-0 !text-[8px]">enforcement L{policy.enforcement}</span>
          </div>
          <p className="mt-1.5 max-w-[75ch] text-[10.5px] leading-relaxed text-[var(--muted)]">{policy.description}</p>
        </div>
        <button
          type="button"
          onClick={toggle}
          disabled={!canEdit || pending}
          role="switch"
          aria-checked={enabled}
          aria-label={`${enabled ? "Disable" : "Enable"} ${policy.name}`}
          className="relative h-5 w-9 shrink-0 rounded-full border transition-colors disabled:opacity-50"
          style={{ background: enabled ? "var(--lime)" : "var(--line)", borderColor: enabled ? "var(--lime)" : "var(--line-strong)" }}
        >
          <span
            className="absolute top-0.5 h-3.5 w-3.5 rounded-full bg-[var(--bg)] transition-transform"
            style={{ left: 2, transform: enabled ? "translateX(16px)" : "none" }}
          />
        </button>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        {policy.match.tools?.map((tool) => <span key={tool} className="chip !px-2 !py-0.5 !text-[8.5px]">tool: {tool}</span>)}
        {policy.match.dataClasses?.map((dataClass) => <span key={dataClass} className="chip !px-2 !py-0.5 !text-[8.5px]">data: {dataClass}</span>)}
        {policy.match.destinations?.map((destination) => <span key={destination} className="chip !px-2 !py-0.5 !text-[8.5px]">dest: {destination}</span>)}
        {policy.match.actions?.map((action) => <span key={action} className="chip !px-2 !py-0.5 !text-[8.5px]">action: {action}</span>)}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-[var(--line)] pt-2.5 text-[9px] text-[var(--muted-dim)]">
        <span>{policy.hits} gateway hits</span>
        <span>· updated {new Date(policy.updatedAt).toISOString().slice(0, 10)} by {policy.createdBy}</span>
        <span className="ml-auto inline-flex items-center gap-2">
          <span className="text-[var(--muted)]">
            dry-run: <span className="text-[var(--orange)]">{preview?.blocked ?? dryRun.blocked}</span> events / {preview?.agentsAffected ?? dryRun.agentsAffected} agents
          </span>
          <button type="button" onClick={runDryRun} disabled={pending} className="btn !h-7 !px-2 !text-[9px]">
            {pending ? <Loader2 size={10} className="animate-spin" aria-hidden /> : <FlaskConical size={10} aria-hidden />}
            Preview
          </button>
        </span>
      </div>

      {preview ? (
        <div className="mt-2 rounded-xl border border-[var(--line)] bg-[var(--panel)] p-2.5">
          <p className="mb-1 text-[9px] uppercase tracking-wide text-[var(--muted-dim)]">Historical matches · no changes applied</p>
          <ul className="space-y-1">
            {preview.events.slice(0, 4).map((event) => (
              <li key={event.id} className="truncate text-[9px] text-[var(--muted)]">
                <span className="text-[var(--text-soft)]">{event.agentId}</span> · {event.summary}
              </li>
            ))}
            {preview.events.length === 0 ? <li className="text-[9px] text-[var(--muted)]">No matching historical events.</li> : null}
          </ul>
        </div>
      ) : null}
      {error ? <p role="alert" className="mt-1 text-[9px] text-[var(--red)]">{error}</p> : null}
    </div>
  );
}

export function GatewayTester({
  agents,
}: {
  agents: Pick<Agent, "id" | "name" | "containment" | "manifest">[];
}) {
  const [agentId, setAgentId] = useState(agents[0]?.id ?? "");
  const [action, setAction] = useState("read");
  const [tool, setTool] = useState(agents[0]?.manifest.spec.allowed.tools[0] ?? "");
  const [dataClass, setDataClass] = useState("");
  const [destination, setDestination] = useState("");
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<{
    decision: string;
    reason: string;
    policyIds: string[];
    enforcementLevel: number;
    auditSeq: number;
    agent: { name: string; containment: number };
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const agent = agents.find((candidate) => candidate.id === agentId);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setPending(true);
    setError(null);
    const response = await fetch("/api/gateway", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        agentId,
        action,
        tool: tool || undefined,
        dataClass: dataClass || undefined,
        destination: destination || undefined,
      }),
    });
    const payload = (await response.json()) as typeof result & { error?: string };
    setPending(false);
    if (!response.ok || !payload) {
      setError(payload?.error ?? "Gateway request failed");
      return;
    }
    setResult(payload);
  };

  return (
    <div>
      <form onSubmit={submit} className="space-y-2">
        <label className="block">
          <span className="eyebrow mb-1 block">Agent</span>
          <select
            value={agentId}
            onChange={(event) => {
              setAgentId(event.target.value);
              const next = agents.find((candidate) => candidate.id === event.target.value);
              setTool(next?.manifest.spec.allowed.tools[0] ?? "");
              setDataClass("");
              setDestination("");
            }}
            className="h-9 w-full rounded-full border border-[var(--line)] bg-[var(--panel-soft)] px-3 text-[10.5px] outline-none"
          >
            {agents.map((candidate) => (
              <option key={candidate.id} value={candidate.id}>
                {candidate.name} · L{candidate.containment}
              </option>
            ))}
          </select>
        </label>
        <div className="grid grid-cols-2 gap-2">
          <label className="block">
            <span className="eyebrow mb-1 block">Action</span>
            <select
              value={action}
              onChange={(event) => setAction(event.target.value)}
              className="h-9 w-full rounded-full border border-[var(--line)] bg-[var(--panel-soft)] px-3 text-[10.5px] outline-none"
            >
              {["read", "analyze", "write", "create", "send", "execute", "delete", "delegate"].map((value) => (
                <option key={value} value={value}>{value}</option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="eyebrow mb-1 block">Tool</span>
            <input
              value={tool}
              onChange={(event) => setTool(event.target.value)}
              placeholder="supplier.search"
              className="h-9 w-full rounded-full border border-[var(--line)] bg-[var(--panel-soft)] px-3 text-[10.5px] outline-none"
            />
          </label>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <label className="block">
            <span className="eyebrow mb-1 block">Data class</span>
            <input
              value={dataClass}
              onChange={(event) => setDataClass(event.target.value)}
              placeholder="hr.salary"
              className="h-9 w-full rounded-full border border-[var(--line)] bg-[var(--panel-soft)] px-3 text-[10.5px] outline-none"
            />
          </label>
          <label className="block">
            <span className="eyebrow mb-1 block">Destination</span>
            <input
              value={destination}
              onChange={(event) => setDestination(event.target.value)}
              placeholder="exfil-relay.top"
              className="h-9 w-full rounded-full border border-[var(--line)] bg-[var(--panel-soft)] px-3 text-[10.5px] outline-none"
            />
          </label>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => {
              if (!agent) return;
              setAction("read");
              setTool(agent.manifest.spec.allowed.tools[0] ?? "");
              setDataClass(agent.manifest.spec.allowed.dataClasses[0] ?? "");
              setDestination("");
            }}
            className="chip !text-[8.5px] hover:border-[var(--line-strong)]"
          >
            legitimate call
          </button>
          <button
            type="button"
            onClick={() => {
              setAction("send");
              setTool("dataset.export");
              setDataClass("hr.salary");
              setDestination("exfil-relay.top");
            }}
            className="chip !text-[8.5px] hover:border-[var(--line-strong)]"
          >
            attack call
          </button>
        </div>
        <button type="submit" disabled={pending} className="btn btn-primary w-full !h-9 !text-[11px]">
          {pending ? <Loader2 size={12} className="animate-spin" aria-hidden /> : <Play size={12} aria-hidden />}
          Evaluate at the gateway
        </button>
      </form>

      {error ? <p role="alert" className="mt-2 text-[9.5px] text-[var(--red)]">{error}</p> : null}
      {result ? (
        <div
          className="mt-3 rounded-2xl border p-3"
          style={{
            borderColor:
              result.decision === "allow"
                ? "color-mix(in srgb, var(--lime) 40%, transparent)"
                : result.decision === "deny"
                  ? "color-mix(in srgb, var(--red) 40%, transparent)"
                  : "color-mix(in srgb, var(--orange) 40%, transparent)",
            background:
              result.decision === "allow"
                ? "var(--lime-soft)"
                : result.decision === "deny"
                  ? "var(--red-soft)"
                  : "var(--orange-soft)",
          }}
        >
          <div className="flex items-center gap-2">
            {result.decision === "allow" ? (
              <CheckCircle2 size={14} className="text-[var(--lime)]" aria-hidden />
            ) : (
              <Ban size={14} className={result.decision === "deny" ? "text-[var(--red)]" : "text-[var(--orange)]"} aria-hidden />
            )}
            <p className="text-[11px] font-semibold uppercase tracking-wide">{result.decision.replace("_", " ")}</p>
            <span className="ml-auto text-[8.5px] text-[var(--muted)]">L{result.enforcementLevel}</span>
          </div>
          <p className="mt-1.5 text-[10px] leading-relaxed text-[var(--text-soft)]">{result.reason}</p>
          <p className="mt-2 text-[8.5px] text-[var(--muted-dim)]">
            policies: {result.policyIds.length ? result.policyIds.join(", ") : "none"} · audit #{result.auditSeq}
          </p>
        </div>
      ) : null}
    </div>
  );
}
