import Link from "next/link";
import {
  ArrowRight,
  ShieldAlert,
  Sparkles,
  TimerReset,
  Users,
  Waypoints,
} from "lucide-react";
import {
  AlignmentDial,
  CapsuleCompare,
  DotMatrix,
  DriftPulse,
  Sparkline,
  TrendChart,
} from "@/components/charts";
import { CanaryMap, DestinationMap } from "@/components/visuals";
import {
  Card,
  CardHead,
  EmptyState,
  KpiCard,
  OwnerAvatar,
  PageHeader,
  SeverityBadge,
  SectionLink,
  StatusPill,
} from "@/components/ui";
import { FilterGroup, FilterMenu, SettingsFilter } from "@/components/filters";
import { getStore, overview } from "@/lib/store";
import { CONTAINMENT_LADDER, FACTOR_ORDER, FACTOR_META } from "@/lib/domain";
import { compact, formatDate, relativeTime } from "@/lib/format";

export const metadata = { title: "Overview" };

type Params = { env?: string; team?: string; range?: string };

export default async function OverviewPage({
  searchParams,
}: {
  searchParams: Promise<Params>;
}) {
  const params = await searchParams;
  const env = params.env ?? "all";
  const team = params.team ?? "all";
  const range = params.range === "7" ? 7 : 14;
  const store = getStore();
  const summary = overview();

  const scopedAgents = store.agents.filter(
    (agent) =>
      (env === "all" || agent.environment === env) &&
      (team === "all" || agent.owner.team === team),
  );
  const scopedIds = new Set(scopedAgents.map((agent) => agent.id));
  const scopedIncidents = store.incidents.filter((incident) =>
    incident.agentIds.some((id) => scopedIds.has(id)),
  );
  const scopedAlerts = store.alerts
    .filter(
      (alert) =>
        scopedIds.has(alert.agentId) &&
        ["open", "acknowledged", "escalated"].includes(alert.status),
    )
    .sort((a, b) => b.score - a.score);
  const scopedAlignment = scopedAgents.length
    ? Math.round(scopedAgents.reduce((total, agent) => total + agent.alignment, 0) / scopedAgents.length)
    : 100;
  const atRisk = [...scopedAgents]
    .sort(
      (a, b) =>
        b.openAlerts - a.openAlerts ||
        a.alignment - b.alignment ||
        b.containment - a.containment,
    )
    .slice(0, 5);
  const trend = store.fleetTrend.slice(-range);
  const openIncidents = scopedIncidents.filter((incident) => incident.status === "open");

  const weekAgo = new Date(Date.now() - 7 * 86_400_000).toISOString();
  const recentEvents = store.events.filter(
    (event) => event.ts >= weekAgo && scopedIds.has(event.agentId),
  );
  const gridCounts = Array(7 * 24).fill(0);
  for (const event of recentEvents) {
    const date = new Date(event.ts);
    const offset = Math.floor((Date.now() - date.getTime()) / 86_400_000);
    if (offset < 0 || offset > 6) continue;
    gridCounts[(6 - offset) * 24 + date.getUTCHours()] += 1;
  }

  const roles = [...new Set(scopedAgents.map((agent) => agent.roleTemplate))].slice(0, 5);
  const capsuleItems = roles.map((role) => {
    const roleEvents = recentEvents.filter((event) => scopedAgents.find((a) => a.id === event.agentId)?.roleTemplate === role);
    return {
      label: store.agents.find((agent) => agent.roleTemplate === role)?.role.split(" ")[0] ?? role,
      primary: roleEvents.filter((event) => event.type === "tool.call").length,
      secondary: roleEvents.filter((event) => event.type === "data.access").length,
    };
  });

  const posture = CONTAINMENT_LADDER.map((level) => ({
    ...level,
    count: scopedAgents.filter((agent) => agent.containment === level.level).length,
  }));

  const scopeTotals = FACTOR_ORDER.map((key) => ({
    key,
    label: FACTOR_META[key].label,
    total: scopedAlerts.reduce(
      (total, alert) => total + (alert.factors.find((factor) => factor.key === key)?.points ?? 0),
      0,
    ),
  })).sort((a, b) => b.total - a.total);

  const destinations = (() => {
    const map = new Map<string, { bytes: number; allowed: boolean; hits: number }>();
    for (const event of recentEvents) {
      if (event.type !== "network.egress" || !event.destination) continue;
      const agent = scopedAgents.find((candidate) => candidate.id === event.agentId);
      const existing = map.get(event.destination) ?? {
        bytes: 0,
        allowed: Boolean(agent?.manifest.spec.allowed.destinations.includes(event.destination)),
        hits: 0,
      };
      existing.bytes += event.bytes ?? 0;
      existing.hits += 1;
      map.set(event.destination, existing);
    }
    return [...map.entries()]
      .map(([destination, entry]) => ({ destination, ...entry }))
      .sort((a, b) => b.bytes - a.bytes)
      .slice(0, 8);
  })();

  const makeHref = (updates: Partial<Params>) => {
    const next = new URLSearchParams();
    const merged = { env, team, range: String(range), ...updates };
    if (merged.env !== "all") next.set("env", merged.env);
    if (merged.team !== "all") next.set("team", merged.team);
    if (merged.range !== "14") next.set("range", merged.range);
    const query = next.toString();
    return query ? `/overview?${query}` : "/overview";
  };
  const envOptions = [
    { label: "All environments", value: "all", href: makeHref({ env: "all" }) },
    { label: "Production", value: "production", href: makeHref({ env: "production" }) },
    { label: "Staging", value: "staging", href: makeHref({ env: "staging" }) },
    { label: "Development", value: "development", href: makeHref({ env: "development" }) },
  ];
  const teamOptions = [
    { label: "All teams", value: "all", href: makeHref({ team: "all" }) },
    ...["Procurement", "Platform", "Finance", "Data", "Support", "Security", "People", "Revenue"].map(
      (name) => ({ label: name, value: name, href: makeHref({ team: name }) }),
    ),
  ];
  const rangeOptions = [
    { label: "Last 14 days", value: "14", href: makeHref({ range: "14" }) },
    { label: "Last 7 days", value: "7", href: makeHref({ range: "7" }) },
  ];

  const sparkAlignment = trend.map((point) => point.alignment);
  const sparkAlerts = trend.map((point) => point.alerts);

  return (
    <div className="pb-4">
      <PageHeader
        eyebrow="Security operations · fleet"
        title="Control Room"
        description="Credentials are all valid. Behavior is where the compromise lives. Every agent below is compared with the role it was registered for, not just the permissions it holds."
        meta={
          <>
            <span className="chip chip-lime">
              <span className="live-dot" /> Telemetry healthy
            </span>
            <span className="chip">
              <Waypoints size={11} aria-hidden /> {compact(summary.eventsIngested24h)} events / 24h
            </span>
            <span className="chip">
              <TimerReset size={11} aria-hidden /> p50 detection {summary.detectionP50Seconds}s
            </span>
            <span className="chip">
              <ShieldAlert size={11} aria-hidden /> {summary.coveragePercent}% manifest coverage
            </span>
          </>
        }
        actions={
          <FilterGroup>
            <FilterMenu
              label="Date"
              value={range === 14 ? "14 days" : "7 days"}
              options={rangeOptions}
            />
            <FilterMenu
              label="Environment"
              value={env === "all" ? "All" : env[0].toUpperCase() + env.slice(1)}
              options={envOptions}
            />
            <FilterMenu label="Team" value={team === "all" ? "All" : team} options={teamOptions} />
            <SettingsFilter href="/settings" />
          </FilterGroup>
        }
      />

      <div className="stagger mb-4 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        <KpiCard
          label="Active agents"
          value={scopedAgents.filter((agent) => ["active", "learning", "degraded"].includes(agent.status)).length}
          delta="+4"
          hint="vs last week"
          spark={<Sparkline values={Array.from({ length: 12 }, (_, index) => 48 + index * 1.2)} color="var(--lime)" height={50} id="kpi-active" />}
        />
        <KpiCard
          label="Agents at risk"
          value={scopedAgents.filter((agent) => agent.alignment < 70 || agent.openAlerts > 0).length}
          delta="+2"
          direction="up"
          hint="needs review"
          invertDelta
          spark={<Sparkline values={[2, 3, 2, 4, 3, 5, 4, 6, 5, 7, 6, 7]} color="var(--orange)" height={50} id="kpi-risk" />}
        />
        <KpiCard
          label="Open incidents"
          value={openIncidents.length}
          delta="-1"
          direction="down"
          hint="vs yesterday"
          invertDelta
          spark={<Sparkline values={[5, 4, 6, 4, 5, 3, 4, 3, 4, 3, 3, 2]} color="var(--orange)" height={50} id="kpi-incidents" />}
        />
        <KpiCard
          label="Mean time to contain"
          value={summary.mttfMinutes}
          unit="min"
          delta="-8m"
          direction="down"
          hint="target < 45m"
          spark={<Sparkline values={[52, 48, 44, 46, 39, 41, 34, 36, 29, 31, 27, 26]} color="var(--lime)" height={50} id="kpi-mttf" />}
        />
        <KpiCard
          label="False positive rate"
          value={`${summary.falsePositiveRate.toFixed(1)}%`}
          delta="-1.2pp"
          direction="down"
          hint={`${summary.feedbackLabels} labels`}
          spark={<Sparkline values={[7.2, 6.4, 6.8, 5.6, 5.9, 4.8, 5.1, 4.4, 4.1, 4.6, 4.0, 3.7]} color="var(--lime)" height={50} id="kpi-fpr" />}
        />
      </div>

      <div className="mb-4 grid gap-3 xl:grid-cols-12">
        <Card className="xl:col-span-4">
          <CardHead
            eyebrow="Fleet posture"
            title="Role alignment"
            subtitle="How much of live behavior is covered by declared roles across the fleet."
            right={<SectionLink href="/agents">Directory <ArrowRight size={12} /></SectionLink>}
          />
          <div className="flex flex-col items-center gap-4 px-6 pb-5 sm:flex-row sm:items-center sm:justify-between xl:flex-col">
            <AlignmentDial score={scopedAlignment} size={196} confidence={0.86} />
            <div className="w-full space-y-3">
              <div className="flex items-center justify-between text-[11.5px]">
                <span className="inline-flex items-center gap-2 text-[var(--muted)]">
                  <span className="h-2 w-2 rounded-full bg-[var(--lime)]" /> In declared role
                </span>
                <span className="metric-sm font-semibold">{scopedAlignment}%</span>
              </div>
              <div className="flex items-center justify-between text-[11.5px]">
                <span className="inline-flex items-center gap-2 text-[var(--muted)]">
                  <span className="h-2 w-2 rounded-full bg-[var(--orange)]" /> Out of role
                </span>
                <span className="metric-sm font-semibold">{100 - scopedAlignment}%</span>
              </div>
              <div className="hairline" />
              <DriftPulse values={trend.map((point) => point.alignment)} label="14-day drift pulse" />
            </div>
          </div>
          <div className="mx-6 mb-5 rounded-2xl border border-[var(--line)] bg-[var(--panel-soft)] p-3">
            <p className="eyebrow mb-2">Largest risk contributions</p>
            <div className="space-y-2">
              {scopeTotals.slice(0, 3).map((factor) => (
                <div key={factor.key} className="flex items-center gap-2">
                  <span className="w-[104px] shrink-0 text-[10.5px] text-[var(--muted)]">{factor.label}</span>
                  <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-[var(--line)]">
                    <span
                      className="block h-full rounded-full bg-[var(--orange)]"
                      style={{ width: `${Math.min(100, (factor.total / Math.max(1, scopeTotals[0].total)) * 100)}%` }}
                    />
                  </span>
                  <span className="metric-sm text-[10px] text-[var(--muted)]">{factor.total}</span>
                </div>
              ))}
            </div>
          </div>
        </Card>

        <Card className="xl:col-span-8">
          <CardHead
            eyebrow="Continuous comparison"
            title="Drift trend"
            subtitle="Fleet role-alignment score with alerts and approved change events overlaid."
            right={<span className="chip chip-lime">Live</span>}
          />
          <div className="px-3 pb-4 sm:px-5">
            <TrendChart
              data={trend}
              annotations={store.changeEvents.map((change) => ({
                at: change.at,
                title: change.title,
                type: change.type,
              }))}
              height={252}
            />
          </div>
          <div className="grid grid-cols-3 divide-x divide-[var(--line)] border-t border-[var(--line)]">
            {[
              { label: "Detected today", value: scopedAlerts.filter((alert) => alert.ts >= new Date(Date.now() - 86_400_000).toISOString()).length, note: "alerts" },
              { label: "Taint trails", value: scopedAlerts.filter((alert) => alert.evidence.taint).length, note: "untrusted → action" },
              { label: "Canary hits", value: store.canaries.reduce((total, canary) => total + canary.hits.length, 0), note: "decoy resources" },
            ].map((stat) => (
              <div key={stat.label} className="px-5 py-3">
                <p className="metric-sm text-[21px] font-semibold leading-none">{stat.value}</p>
                <p className="mt-1 text-[9.5px] uppercase tracking-[0.1em] text-[var(--muted-dim)]">
                  {stat.label}
                </p>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <div className="mb-4 grid gap-3 xl:grid-cols-12">
        <Card className="xl:col-span-5">
          <CardHead
            eyebrow="Needs attention"
            title="Agents at risk"
            right={<SectionLink href="/agents">All agents <ArrowRight size={12} /></SectionLink>}
          />
          <div className="px-3 pb-4">
            {atRisk.length === 0 ? (
              <EmptyState title="No agents at risk" description="All scoped agents are inside their declared roles." />
            ) : (
              <ul className="divide-y divide-[var(--line)]">
                {atRisk.map((agent) => (
                  <li key={agent.id}>
                    <Link
                      href={`/agents/${agent.id}`}
                      className="flex items-center gap-3 rounded-xl px-3 py-3 transition-colors hover:bg-[var(--panel-hi)]"
                    >
                      <OwnerAvatar initials={agent.owner.initials} color={agent.owner.color} name={agent.owner.name} size={32} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[12.5px] font-medium text-[var(--text)]">{agent.name}</p>
                        <p className="truncate text-[10px] text-[var(--muted)]">
                          {agent.role} · {agent.owner.team}
                        </p>
                      </div>
                      <div className="hidden w-20 sm:block">
                        <Sparkline
                          values={Array.from({ length: 10 }, (_, index) => Math.max(4, agent.alignment - (9 - index) * 2.4))}
                          color={agent.alignment < 40 ? "var(--red)" : "var(--orange)"}
                          height={24}
                          area={false}
                          id={agent.id}
                        />
                      </div>
                      <span className="metric-sm w-8 text-right text-[14px] font-semibold" style={{ color: agent.alignment < 40 ? "var(--red)" : "var(--orange)" }}>
                        {agent.alignment}
                      </span>
                      <StatusPill status={agent.status} />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Card>

        <Card className="xl:col-span-4">
          <CardHead eyebrow="Fleet telemetry" title="Activity density" subtitle="Actions per hour, last 7 days. Brighter dots mean higher volume." />
          <div className="px-5 pb-3">
            <DotMatrix counts={gridCounts} cols={24} rows={7} hue="mixed" cell={7} gap={6} label="Fleet hourly action density" />
            <div className="mt-3 flex items-center justify-between text-[9.5px] text-[var(--muted-dim)]">
              <span>−7d</span>
              <span>00:00 → 23:00 UTC</span>
              <span>now</span>
            </div>
          </div>
          <div className="mx-5 mb-5 rounded-2xl border border-[var(--line)] bg-[var(--panel-soft)] px-4 py-3">
            <p className="eyebrow mb-3">Activity mix by role</p>
            <CapsuleCompare
              items={capsuleItems}
              primaryLabel="Tool calls"
              secondaryLabel="Data reads"
              height={160}
            />
          </div>
        </Card>

        <Card className="xl:col-span-3">
          <CardHead eyebrow="Response ladder" title="Containment posture" right={<SectionLink href="/policies">Policies <ArrowRight size={12} /></SectionLink>} />
          <div className="space-y-1.5 px-6 pb-5">
            {posture.map((level) => (
              <div key={level.level} className="flex items-center gap-2">
                <span
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-[10px] font-semibold"
                  style={{
                    borderColor: level.count > 0 ? "var(--lime)" : "var(--line)",
                    color: level.count > 0 ? "var(--lime)" : "var(--muted-dim)",
                    background: level.count > 0 ? "var(--lime-soft)" : "transparent",
                  }}
                >
                  {level.level}
                </span>
                <span className="flex-1 text-[11px] text-[var(--text-soft)]">{level.label}</span>
                <span className="metric-sm text-[12px] font-semibold">{level.count}</span>
              </div>
            ))}
            <div className="mt-3 rounded-xl border border-[var(--line)] bg-[var(--panel-soft)] p-3">
              <p className="text-[10.5px] leading-relaxed text-[var(--muted)]">
                Restrict is surgical: invalid HR and egress calls are denied while the
                agent&apos;s valid token keeps working for supplier tasks.
              </p>
              <Link href="/policies" className="mt-2 inline-flex items-center gap-1 text-[10.5px] font-medium text-[var(--lime)]">
                Inspect gateway dry-run <ArrowRight size={11} aria-hidden />
              </Link>
            </div>
          </div>
        </Card>
      </div>

      <div className="grid gap-3 xl:grid-cols-12">
        <Card className="xl:col-span-7">
          <CardHead
            eyebrow="Triage queue"
            title="Open alerts"
            right={<SectionLink href="/alerts">Open queue <ArrowRight size={12} /></SectionLink>}
          />
          <div className="px-3 pb-4">
            {scopedAlerts.length === 0 ? (
              <EmptyState title="Queue clear" description="No open alerts for the selected scope." />
            ) : (
              <ul className="divide-y divide-[var(--line)]">
                {scopedAlerts.slice(0, 5).map((alert) => (
                  <li key={alert.id}>
                    <Link
                      href={`/alerts?alert=${alert.id}`}
                      className="flex items-center gap-3 rounded-xl px-3 py-3 transition-colors hover:bg-[var(--panel-hi)]"
                    >
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border text-[12px] font-bold" style={{
                        borderColor: alert.severity === "critical" ? "var(--red)" : "var(--orange)",
                        color: alert.severity === "critical" ? "var(--red)" : "var(--orange)",
                        background: alert.severity === "critical" ? "var(--red-soft)" : "var(--orange-soft)",
                      }}>
                        {alert.score}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="truncate text-[12.5px] font-medium">{alert.title}</p>
                          <SeverityBadge severity={alert.severity} />
                        </div>
                        <p className="mt-0.5 truncate text-[10px] text-[var(--muted)]">
                          {alert.agentName} · {relativeTime(alert.ts)} · {alert.evidence.taint ? `taint: ${alert.evidence.taint.sourceName}` : `${alert.factors.filter((factor) => factor.points > 0).length} contributing factors`}
                        </p>
                      </div>
                      <span className="chip chip-lime hidden sm:inline-flex">{alert.factors[0]?.label}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Card>

        <Card className="xl:col-span-5">
          <CardHead eyebrow="Grouped investigations" title="Incidents" right={<SectionLink href="/alerts?view=incidents">All incidents <ArrowRight size={12} /></SectionLink>} />
          <div className="px-3 pb-3">
            {openIncidents.length === 0 ? (
              <EmptyState title="No open incidents" description="Incidents group correlated alerts automatically." />
            ) : (
              <ul className="space-y-1.5">
                {openIncidents.slice(0, 3).map((incident) => (
                  <li key={incident.id}>
                    <Link
                      href={`/alerts?incident=${incident.id}`}
                      className="block rounded-2xl border border-[var(--line)] bg-[var(--panel-soft)] px-3 py-3 transition-colors hover:border-[var(--line-strong)]"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[9px] uppercase tracking-[0.1em] text-[var(--muted-dim)]">{incident.id}</span>
                        <SeverityBadge severity={incident.severity} />
                      </div>
                      <p className="mt-2 text-[12px] font-medium leading-snug">{incident.title}</p>
                      <p className="mt-1 text-[10px] text-[var(--muted)]">
                        {incident.agentIds.length} agent{incident.agentIds.length === 1 ? "" : "s"} · blast radius {incident.blastRadius} · {relativeTime(incident.updatedAt)}
                      </p>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="px-6 pb-6">
            <CanaryMap canaries={store.canaries} />
          </div>
        </Card>
      </div>

      <div className="mt-3 grid gap-3 xl:grid-cols-12">
        <Card className="xl:col-span-5">
          <CardHead eyebrow="Egress" title="Destination map" subtitle="Allowlisted destinations sit inside the lime ring; unapproved egress sits outside." />
          <div className="px-6 pb-5">
            <DestinationMap entries={destinations} />
          </div>
        </Card>
        <Card className="xl:col-span-7">
          <CardHead eyebrow="Learning system" title="What the fleet is telling us" />
          <div className="grid gap-3 px-6 pb-6 sm:grid-cols-3">
            {[
              {
                icon: Sparkles,
                title: "Cold-start coverage",
                value: `${store.agents.filter((agent) => agent.status === "learning").length} agents`,
                note: "learning from role priors with wider bands",
              },
              {
                icon: Users,
                title: "Owners engaged",
                value: `${new Set(store.agents.map((agent) => agent.owner.id)).size} teams`,
                note: "notified within containment level 1",
              },
              {
                icon: TimerReset,
                title: "Baseline freshness",
                value: "6.2h",
                note: "median age of latest baseline version",
              },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.title} className="rounded-2xl border border-[var(--line)] bg-[var(--panel-soft)] p-4">
                  <Icon size={16} className="text-[var(--lime)]" aria-hidden />
                  <p className="metric-sm mt-3 text-[19px] font-semibold">{item.value}</p>
                  <p className="mt-1 text-[10.5px] font-medium text-[var(--text-soft)]">{item.title}</p>
                  <p className="mt-1 text-[10px] leading-relaxed text-[var(--muted-dim)]">{item.note}</p>
                </div>
              );
            })}
          </div>
          <div className="mx-6 mb-6 rounded-2xl border border-[var(--line)] p-4">
            <div className="flex items-start gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--lime-soft)] text-[var(--lime)]">
                <ShieldAlert size={16} aria-hidden />
              </span>
              <div>
                <p className="text-[11.5px] font-semibold">Change management is active</p>
                <p className="mt-1 max-w-[70ch] text-[10.5px] leading-relaxed text-[var(--muted)]">
                  {store.changeEvents.filter((change) => change.status === "active").length} approved change
                  events currently widen expectations. A legitimate task shift cannot page as
                  Critical unless restricted data or egress evidence appears.
                </p>
                <p className="mt-1 text-[9.5px] text-[var(--muted-dim)]">
                  Last accepted: {formatDate(store.changeEvents[0].at)} · {store.changeEvents[0].title}
                </p>
              </div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
