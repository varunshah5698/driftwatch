import { PageHeader, StatusPill } from "@/components/ui";
import { AgentsTable, type AgentRow } from "@/components/agents-table";
import { RegisterAgent } from "@/components/register-agent";
import { FilterGroup, FilterMenu, SettingsFilter } from "@/components/filters";
import { getStore } from "@/lib/store";
import { getSessionUser } from "@/lib/auth/session";
import { can } from "@/lib/auth/rbac";
import { ROLE_TEMPLATES } from "@/lib/data/roles";
import Link from "next/link";

export const metadata = { title: "Agents" };

type Params = { q?: string; env?: string; status?: string; role?: string };

export default async function AgentsPage({ searchParams }: { searchParams: Promise<Params> }) {
  const params = await searchParams;
  const store = getStore();
  const user = await getSessionUser();
  const query = params.q?.trim() ?? "";
  const env = params.env ?? "all";
  const status = params.status ?? "all";
  const role = params.role ?? "all";

  const filtered = store.agents.filter((agent) => {
    const needle = query.toLowerCase();
    const matchesQuery =
      !needle ||
      agent.name.toLowerCase().includes(needle) ||
      agent.id.toLowerCase().includes(needle) ||
      agent.role.toLowerCase().includes(needle) ||
      agent.owner.name.toLowerCase().includes(needle) ||
      agent.roleTemplate.toLowerCase().includes(needle);
    return (
      matchesQuery &&
      (env === "all" || agent.environment === env) &&
      (status === "all" || agent.status === status) &&
      (role === "all" || agent.roleTemplate === role)
    );
  });

  const severityRank = { critical: 5, high: 4, medium: 3, low: 2, info: 1 } as const;
  const rows: AgentRow[] = filtered
    .sort(
      (a, b) =>
        b.openAlerts - a.openAlerts ||
        a.alignment - b.alignment ||
        a.name.localeCompare(b.name),
    )
    .map((agent) => {
      const open = store.alerts.filter(
        (alert) =>
          alert.agentId === agent.id &&
          ["open", "acknowledged", "escalated"].includes(alert.status),
      );
      const worst = open.sort(
        (a, b) => severityRank[b.severity] - severityRank[a.severity] || b.score - a.score,
      )[0];
      return {
        id: agent.id,
        name: agent.name,
        role: agent.role,
        roleTemplate: agent.roleTemplate,
        environment: agent.environment,
        status: agent.status,
        owner: agent.owner,
        alignment: agent.alignment,
        openAlerts: open.length,
        containment: agent.containment,
        lastSeen: agent.lastSeen,
        confidence: agent.confidence,
        alertSeverity: worst?.severity,
      };
    });

  const makeHref = (updates: Partial<Params>) => {
    const next = new URLSearchParams();
    const merged = { q: query, env, status, role, ...updates };
    if (merged.q) next.set("q", merged.q);
    if (merged.env !== "all") next.set("env", merged.env);
    if (merged.status !== "all") next.set("status", merged.status);
    if (merged.role !== "all") next.set("role", merged.role);
    const suffix = next.toString();
    return `/agents${suffix ? `?${suffix}` : ""}`;
  };

  const envOptions = [
    { label: "All environments", value: "all", href: makeHref({ env: "all" }) },
    { label: "Production", value: "production", href: makeHref({ env: "production" }) },
    { label: "Staging", value: "staging", href: makeHref({ env: "staging" }) },
    { label: "Development", value: "development", href: makeHref({ env: "development" }) },
  ];
  const statusOptions = [
    { label: "All states", value: "all", href: makeHref({ status: "all" }) },
    { label: "Active", value: "active", href: makeHref({ status: "active" }) },
    { label: "Learning", value: "learning", href: makeHref({ status: "learning" }) },
    { label: "Degraded", value: "degraded", href: makeHref({ status: "degraded" }) },
    { label: "Quarantined", value: "quarantined", href: makeHref({ status: "quarantined" }) },
    { label: "Isolated", value: "isolated", href: makeHref({ status: "isolated" }) },
  ];
  const roleOptions = [
    { label: "All roles", value: "all", href: makeHref({ role: "all" }) },
    ...ROLE_TEMPLATES.map((template) => ({
      label: template.name,
      value: template.id,
      href: makeHref({ role: template.id }),
    })),
  ];

  const stats = {
    healthy: store.agents.filter((agent) => agent.alignment >= 80 && agent.openAlerts === 0).length,
    learning: store.agents.filter((agent) => agent.status === "learning").length,
    contained: store.agents.filter((agent) => agent.containment >= 3).length,
    alerts: store.alerts.filter((alert) => ["open", "acknowledged", "escalated"].includes(alert.status)).length,
  };

  return (
    <div>
      <PageHeader
        eyebrow="Registry · identity"
        title="Agent Directory"
        description="Every autonomous identity, its declared role, and the distance between the two. Sorted by risk, not by name."
        meta={
          <>
            <span className="chip chip-lime">{stats.healthy} healthy</span>
            <span className="chip chip-violet">{stats.learning} learning</span>
            <span className="chip chip-orange">{stats.contained} contained</span>
            <span className="chip chip-red">{stats.alerts} open alerts</span>
            <span className="chip">
              <Link href="/baselines" className="hover:text-[var(--text)]">baseline freshness 6.2h</Link>
            </span>
          </>
        }
        actions={
          <FilterGroup>
            <FilterMenu label="Environment" value={env === "all" ? "All" : env} options={envOptions} />
            <FilterMenu label="State" value={status === "all" ? "All" : status} options={statusOptions} />
            <FilterMenu
              label="Role"
              value={role === "all" ? "All" : ROLE_TEMPLATES.find((template) => template.id === role)?.name ?? role}
              options={roleOptions}
            />
            <SettingsFilter href="/agents" />
            <RegisterAgent
              owners={store.agents.map((agent) => agent.owner).filter((owner, index, self) => self.findIndex((item) => item.id === owner.id) === index).map((owner) => ({ id: owner.id, name: owner.name }))}
              canRegister={Boolean(user && can(user.role, "agent:register"))}
            />
          </FilterGroup>
        }
      />

      <div className="mb-3 flex flex-wrap items-center gap-2">
        {(query || env !== "all" || status !== "all" || role !== "all") && (
          <>
            <span className="eyebrow">Active filters</span>
            {query ? <span className="chip">search: {query}</span> : null}
            {env !== "all" ? <Link href={makeHref({ env: "all" })} className="chip hover:border-[var(--line-strong)]">env: {env} ×</Link> : null}
            {status !== "all" ? <Link href={makeHref({ status: "all" })} className="chip hover:border-[var(--line-strong)]">state: {status} ×</Link> : null}
            {role !== "all" ? <Link href={makeHref({ role: "all" })} className="chip hover:border-[var(--line-strong)]">role: {role} ×</Link> : null}
            <Link href="/agents" className="text-[10.5px] text-[var(--muted)] underline-offset-2 hover:underline">clear all</Link>
          </>
        )}
      </div>

      <section className="panel overflow-hidden">
        <AgentsTable
          agents={rows}
          query={query}
          env={env}
          status={status}
          role={role}
          total={store.agents.length}
        />
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--line)] px-5 py-3 text-[10px] text-[var(--muted-dim)]">
          <span className="inline-flex items-center gap-4">
            <span className="inline-flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-[var(--lime)]" /> inside declared role
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-[var(--orange)]" /> drift detected
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-[var(--red)]" /> contained
            </span>
          </span>
          <span className="inline-flex items-center gap-2">
            <StatusPill status="active" /> rows update from signed telemetry
          </span>
        </div>
      </section>
    </div>
  );
}
