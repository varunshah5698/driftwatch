"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Download, ExternalLink, Search, X } from "lucide-react";
import type { Agent } from "@/lib/types";
import { Sparkline } from "@/components/charts";
import { OwnerAvatar, SeverityBadge, StatusPill } from "@/components/ui";
import { relativeTime } from "@/lib/format";

export interface AgentRow {
  id: string;
  name: string;
  role: string;
  roleTemplate: string;
  environment: string;
  status: Agent["status"];
  owner: Agent["owner"];
  alignment: number;
  openAlerts: number;
  containment: number;
  lastSeen: string;
  confidence: number;
  alertSeverity?: "critical" | "high" | "medium" | "low" | "info";
}

export function AgentsTable({
  agents,
  query,
  env,
  status,
  role,
  total,
}: {
  agents: AgentRow[];
  query: string;
  env: string;
  status: string;
  role: string;
  total: number;
}) {
  const [selected, setSelected] = useState<string[]>([]);
  const [search, setSearch] = useState(query);

  const allSelected = agents.length > 0 && selected.length === agents.length;
  const toggle = (id: string) =>
    setSelected((current) =>
      current.includes(id) ? current.filter((value) => value !== id) : [...current, id],
    );

  const exportCsv = () => {
    const rows = agents.filter((agent) => selected.includes(agent.id));
    const header = ["id", "name", "role", "environment", "status", "alignment", "open_alerts", "owner"];
    const csv = [
      header.join(","),
      ...rows.map((agent) =>
        [
          agent.id,
          `"${agent.name}"`,
          `"${agent.role}"`,
          agent.environment,
          agent.status,
          agent.alignment,
          agent.openAlerts,
          `"${agent.owner.name}"`,
        ].join(","),
      ),
    ].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `driftwatch-agents-${new Date().toISOString().slice(0, 10)}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const clearHref = useMemo(() => {
    const params = new URLSearchParams();
    if (query) params.set("q", query);
    return `/agents${params.toString() ? `?${params}` : ""}`;
  }, [query]);

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 border-b border-[var(--line)] px-5 py-3">
        <form action="/agents" method="get" className="relative min-w-[220px] flex-1 sm:max-w-[320px]">
          {env !== "all" ? <input type="hidden" name="env" value={env} /> : null}
          {status !== "all" ? <input type="hidden" name="status" value={status} /> : null}
          {role !== "all" ? <input type="hidden" name="role" value={role} /> : null}
          <Search
            size={14}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted-dim)]"
            aria-hidden
          />
          <input
            name="q"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search name, codename, owner…"
            aria-label="Search agents"
            className="h-9 w-full rounded-full border border-[var(--line)] bg-[var(--panel-soft)] pl-9 pr-8 text-[12px] outline-none focus:border-[var(--line-strong)]"
          />
          {query ? (
            <Link
              href={clearHref}
              aria-label="Clear search"
              className="absolute right-2 top-1/2 flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded-full text-[var(--muted)] hover:text-[var(--text)]"
            >
              <X size={12} aria-hidden />
            </Link>
          ) : null}
        </form>
        <span className="text-[11px] text-[var(--muted)]">
          Showing <span className="text-[var(--text)]">{agents.length}</span> of {total}
        </span>
        {selected.length > 0 ? (
          <div className="ml-auto flex items-center gap-2">
            <span className="chip chip-lime">{selected.length} selected</span>
            <button type="button" onClick={exportCsv} className="btn !h-8 !text-[11px]">
              <Download size={12} aria-hidden /> Export CSV
            </button>
            <button type="button" onClick={() => setSelected([])} className="chip">
              Clear
            </button>
          </div>
        ) : (
          <span className="ml-auto chip">
            <span className="h-1.5 w-1.5 rounded-full bg-[var(--lime)]" /> live registry
          </span>
        )}
      </div>

      <div className="scroll-x">
        <table className="w-full min-w-[860px] border-collapse text-left">
          <thead>
            <tr className="border-b border-[var(--line)] text-[9.5px] uppercase tracking-[0.1em] text-[var(--muted-dim)]">
              <th className="w-10 py-2.5 pl-5">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={() => setSelected(allSelected ? [] : agents.map((agent) => agent.id))}
                  aria-label="Select all agents"
                  className="h-3.5 w-3.5 accent-[var(--lime)]"
                />
              </th>
              <th className="py-2.5 pr-3 font-medium">Agent</th>
              <th className="py-2.5 pr-3 font-medium">Declared role</th>
              <th className="py-2.5 pr-3 font-medium">Environment</th>
              <th className="py-2.5 pr-3 font-medium">Alignment</th>
              <th className="py-2.5 pr-3 font-medium">Status</th>
              <th className="py-2.5 pr-3 font-medium">Owner</th>
              <th className="py-2.5 pr-3 font-medium">Signals</th>
              <th className="py-2.5 pr-5 font-medium">Last seen</th>
              <th className="w-8 pr-4" />
            </tr>
          </thead>
          <tbody>
            {agents.map((agent) => (
              <tr key={agent.id} className="group border-b border-[var(--line)] transition-colors hover:bg-[var(--panel-hi)]/50">
                <td className="py-3 pl-5">
                  <input
                    type="checkbox"
                    checked={selected.includes(agent.id)}
                    onChange={() => toggle(agent.id)}
                    aria-label={`Select ${agent.name}`}
                    className="h-3.5 w-3.5 accent-[var(--lime)]"
                  />
                </td>
                <td className="py-3 pr-3">
                  <Link href={`/agents/${agent.id}`} className="flex items-center gap-2.5">
                    <span className="text-[12.5px] font-medium text-[var(--text)] group-hover:text-[var(--lime)]">
                      {agent.name}
                    </span>
                    {agent.status === "learning" ? (
                      <span className="chip chip-violet !px-1.5 !py-0 !text-[8.5px]">cold start</span>
                    ) : null}
                  </Link>
                  <p className="mt-0.5 text-[9.5px] text-[var(--muted-dim)]">
                    {agent.id} · confidence {Math.round(agent.confidence * 100)}%
                  </p>
                </td>
                <td className="max-w-[190px] py-3 pr-3">
                  <p className="truncate text-[11.5px] text-[var(--text-soft)]" title={agent.role}>
                    {agent.role}
                  </p>
                  <p className="text-[9.5px] text-[var(--muted-dim)]">{agent.roleTemplate}</p>
                </td>
                <td className="py-3 pr-3">
                  <span className="text-[10.5px] capitalize text-[var(--muted)]">{agent.environment}</span>
                </td>
                <td className="py-3 pr-3">
                  <div className="flex items-center gap-2">
                    <span className="w-14">
                      <Sparkline
                        values={Array.from({ length: 12 }, (_, index) =>
                          Math.max(2, agent.alignment - Math.sin(index * 1.3) * (agent.alignment < 30 ? 6 : 3)),
                        )}
                        color={agent.alignment < 40 ? "var(--red)" : agent.alignment < 70 ? "var(--orange)" : "var(--lime)"}
                        height={22}
                        area={false}
                        id={`row-${agent.id}`}
                      />
                    </span>
                    <span
                      className="metric-sm text-[13px] font-semibold"
                      style={{
                        color:
                          agent.alignment < 40
                            ? "var(--red)"
                            : agent.alignment < 70
                              ? "var(--orange)"
                              : "var(--text)",
                      }}
                    >
                      {agent.alignment}
                    </span>
                  </div>
                </td>
                <td className="py-3 pr-3"><StatusPill status={agent.status} /></td>
                <td className="py-3 pr-3">
                  <span className="flex items-center gap-2">
                    <OwnerAvatar initials={agent.owner.initials} color={agent.owner.color} name={agent.owner.name} size={22} />
                    <span className="text-[10.5px] text-[var(--muted)]">{agent.owner.name}</span>
                  </span>
                </td>
                <td className="py-3 pr-3">
                  <div className="flex items-center gap-1.5">
                    {agent.openAlerts > 0 ? (
                      <span className="chip chip-red !px-2">{agent.openAlerts} alert{agent.openAlerts === 1 ? "" : "s"}</span>
                    ) : (
                      <span className="chip !px-2">quiet</span>
                    )}
                    {agent.containment > 0 ? (
                      <span className="chip chip-orange !px-2" title={`Containment level ${agent.containment}`}>
                        L{agent.containment}
                      </span>
                    ) : null}
                  </div>
                </td>
                <td className="py-3 pr-5 text-[10px] text-[var(--muted)]">{relativeTime(agent.lastSeen)}</td>
                <td className="py-3 pr-4">
                  <Link href={`/agents/${agent.id}`} aria-label={`Open ${agent.name}`} className="text-[var(--muted-dim)] hover:text-[var(--lime)]">
                    <ExternalLink size={13} aria-hidden />
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {agents.length === 0 ? (
          <p className="px-6 py-14 text-center text-[12px] text-[var(--muted)]">
            No agents match these filters. Clear the search or choose a different role.
          </p>
        ) : null}
      </div>
    </div>
  );
}
