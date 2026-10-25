import Link from "next/link";
import {
  ArrowRight,
  Clock,
  Fingerprint,
  GitBranch,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { Card, CardHead, EmptyState, PageHeader, SeverityBadge, SectionLink } from "@/components/ui";
import { ExplainCard } from "@/components/explain-card";
import { AlertActions } from "@/components/alert-actions";
import { EventTimeline } from "@/components/event-timeline";
import { TaintThread } from "@/components/visuals";
import { FilterGroup, FilterMenu } from "@/components/filters";
import { FactorBars } from "@/components/charts";
import { getStore } from "@/lib/store";
import { getSessionUser } from "@/lib/auth/session";
import { can } from "@/lib/auth/rbac";
import { formatDateTime, relativeTime } from "@/lib/format";
import { SEVERITY_ORDER } from "@/lib/domain";

export const metadata = { title: "Alerts" };

type Params = { alert?: string; status?: string; severity?: string };

const STATUS_TABS = [
  { id: "open", label: "Open", statuses: ["open", "acknowledged", "escalated"] },
  { id: "acknowledged", label: "Acknowledged", statuses: ["acknowledged"] },
  { id: "resolved", label: "Closed", statuses: ["resolved", "dismissed"] },
  { id: "all", label: "All", statuses: [] },
];

export default async function AlertsPage({ searchParams }: { searchParams: Promise<Params> }) {
  const params = await searchParams;
  const store = getStore();
  const user = await getSessionUser();
  const statusTab = params.status ?? "open";
  const severity = params.severity ?? "all";
  const tab = STATUS_TABS.find((candidate) => candidate.id === statusTab) ?? STATUS_TABS[0];

  const filtered = store.alerts
    .filter((alert) => {
      const matchesStatus = tab.statuses.length === 0 || tab.statuses.includes(alert.status);
      const matchesSeverity = severity === "all" || alert.severity === severity;
      return matchesStatus && matchesSeverity;
    })
    .sort((a, b) => b.score - a.score || (a.ts < b.ts ? 1 : -1));

  const selected = store.alerts.find((alert) => alert.id === params.alert) ?? filtered[0] ?? store.alerts[0];
  const agent = selected ? store.agents.find((candidate) => candidate.id === selected.agentId) : undefined;
  const incident = selected
    ? store.incidents.find(
        (candidate) =>
          candidate.id === selected.incidentId || candidate.alertIds.includes(selected.id),
      )
    : undefined;
  const canTriage = Boolean(user && can(user.role, "alert:triage"));
  const counts = {
    open: store.alerts.filter((alert) => ["open", "acknowledged", "escalated"].includes(alert.status)).length,
    critical: store.alerts.filter((alert) => alert.severity === "critical" && ["open", "acknowledged", "escalated"].includes(alert.status)).length,
    resolved: store.alerts.filter((alert) => ["resolved", "dismissed"].includes(alert.status)).length,
  };

  const makeHref = (updates: Partial<Params>) => {
    const next = new URLSearchParams();
    const merged = { status: statusTab, severity, alert: params.alert, ...updates };
    if (merged.status !== "open") next.set("status", merged.status);
    if (merged.severity !== "all") next.set("severity", merged.severity);
    if (merged.alert) next.set("alert", merged.alert);
    const query = next.toString();
    return `/alerts${query ? `?${query}` : ""}`;
  };

  const severityOptions = [
    { label: "All severities", value: "all", href: makeHref({ severity: "all", alert: undefined }) },
    ...SEVERITY_ORDER.map((value) => ({
      label: value[0].toUpperCase() + value.slice(1),
      value,
      href: makeHref({ severity: value, alert: undefined }),
    })),
  ];

  const factorSum = selected?.factors.reduce((total, factor) => total + factor.points, 0) ?? 0;

  return (
    <div>
      <PageHeader
        eyebrow="Detection · triage"
        title="Alert Queue"
        description="Every alert is a decomposition, not a black box. Triage with the observed values, the baseline it departed from, and the causal trail."
        meta={
          <>
            <span className="chip chip-red">{counts.critical} critical open</span>
            <span className="chip chip-orange">{counts.open} open overall</span>
            <span className="chip chip-lime">{counts.resolved} closed with feedback</span>
            <span className="chip">Σ contributions = risk score</span>
          </>
        }
        actions={
          <FilterGroup>
            <FilterMenu label="Severity" value={severity === "all" ? "All" : severity} options={severityOptions} />
            <Link href="/evidence" className="pill !h-10 !text-[12px]">
              <Fingerprint size={13} aria-hidden /> Evidence explorer
            </Link>
          </FilterGroup>
        }
      />

      {store.incidents.filter((incident) => incident.status === "open").length > 0 ? (
        <div className="mb-3 flex gap-2 overflow-x-auto pb-1">
          {store.incidents
            .filter((incident) => incident.status === "open")
            .slice(0, 4)
            .map((incident) => (
              <Link
                key={incident.id}
                href={`/alerts?status=open&alert=${incident.alertIds[0]}`}
                className="flex min-w-[240px] items-center gap-2 rounded-2xl border border-[var(--line)] bg-[var(--panel)] px-3 py-2 transition-colors hover:border-[var(--line-strong)]"
              >
                <GitBranch size={13} className="text-[var(--orange)]" aria-hidden />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[10.5px] text-[var(--text-soft)]">{incident.title}</span>
                  <span className="block text-[8.5px] uppercase tracking-wide text-[var(--muted-dim)]">
                    {incident.id} · {incident.alertIds.length} alert{incident.alertIds.length === 1 ? "" : "s"} · {incident.status}
                  </span>
                </span>
                <SeverityBadge severity={incident.severity} />
              </Link>
            ))}
        </div>
      ) : null}

      <div className="grid gap-3 xl:grid-cols-[360px_minmax(0,1fr)]">
        <Card className="h-fit xl:sticky xl:top-24">
          <div className="flex items-center gap-1 border-b border-[var(--line)] px-3 py-2.5" role="tablist" aria-label="Alert status">
            {STATUS_TABS.slice(0, 3).map((tabItem) => (
              <Link
                key={tabItem.id}
                href={makeHref({ status: tabItem.id, alert: undefined })}
                role="tab"
                aria-selected={tab.id === tabItem.id}
                className={`rounded-full px-3 py-1.5 text-[10.5px] font-medium transition-colors ${
                  tab.id === tabItem.id ? "bg-[var(--white)] text-[var(--bg)]" : "text-[var(--muted)] hover:text-[var(--text)]"
                }`}
              >
                {tabItem.label}
              </Link>
            ))}
            <span className="ml-auto text-[9.5px] text-[var(--muted-dim)]">{filtered.length} shown</span>
          </div>
          <div className="max-h-[calc(100dvh-300px)] overflow-y-auto p-2">
            {filtered.length === 0 ? (
              <EmptyState title="Nothing here" description="No alerts match this status and severity." />
            ) : (
              <ul className="space-y-1">
                {filtered.map((alert) => {
                  const active = selected?.id === alert.id;
                  return (
                    <li key={alert.id}>
                      <Link
                        href={makeHref({ alert: alert.id })}
                        className={`block rounded-2xl border px-3 py-2.5 transition-colors ${
                          active
                            ? "border-[var(--line-strong)] bg-[var(--panel-hi)]"
                            : "border-transparent hover:border-[var(--line)] hover:bg-[var(--panel-soft)]"
                        }`}
                        aria-current={active ? "true" : undefined}
                      >
                        <div className="flex items-center gap-2">
                          <span
                            className="metric-sm flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-[10px] font-bold"
                            style={{
                              borderColor: alert.severity === "critical" ? "var(--red)" : "var(--orange)",
                              color: alert.severity === "critical" ? "var(--red)" : "var(--orange)",
                              background: alert.severity === "critical" ? "var(--red-soft)" : "var(--orange-soft)",
                            }}
                          >
                            {alert.score}
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-[11px] font-medium">{alert.title}</p>
                            <p className="truncate text-[9px] text-[var(--muted)]">
                              {alert.agentName} · {relativeTime(alert.ts)}
                            </p>
                          </div>
                          <ArrowRight size={11} className={active ? "text-[var(--lime)]" : "text-[var(--muted-dim)]"} aria-hidden />
                        </div>
                        <div className="mt-1.5 flex items-center gap-1.5">
                          <SeverityBadge severity={alert.severity} />
                          <span className="chip !px-1.5 !py-0 !text-[8px]">{alert.status}</span>
                          {alert.classification ? (
                            <span className="chip !px-1.5 !py-0 !text-[8px]">{alert.classification.replace("_", " ")}</span>
                          ) : null}
                          {alert.benignChange ? <span className="chip chip-violet !px-1.5 !py-0 !text-[8px]">change</span> : null}
                        </div>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </Card>

        <div className="min-w-0 space-y-3">
          {!selected ? (
            <Card><EmptyState title="Queue clear" description="No alerts match the selected filters." /></Card>
          ) : (
            <>
              <Card>
                <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-start">
                  <span
                    className="metric-sm flex h-16 w-16 shrink-0 items-center justify-center rounded-full border text-[22px] font-bold"
                    style={{
                      borderColor: selected.severity === "critical" ? "var(--red)" : "var(--orange)",
                      color: selected.severity === "critical" ? "var(--red)" : "var(--orange)",
                      background: selected.severity === "critical" ? "var(--red-soft)" : "var(--orange-soft)",
                    }}
                    aria-label={`Risk score ${selected.score}`}
                  >
                    {selected.score}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <SeverityBadge severity={selected.severity} />
                      <span className="chip">{selected.status}</span>
                      {selected.incidentId ? (
                        <Link href={`/alerts?status=all&alert=${store.incidents.find((item) => item.id === selected.incidentId)?.alertIds[0] ?? selected.id}`} className="chip chip-orange">
                          <GitBranch size={10} aria-hidden /> {selected.incidentId}
                        </Link>
                      ) : null}
                      <span className="chip !text-[8.5px]">confidence {Math.round(selected.confidence * 100)}%</span>
                      {selected.detectionLatencyMs !== undefined ? (
                        <span className="chip !text-[8.5px]">
                          <Clock size={10} aria-hidden /> detected in {Math.round(selected.detectionLatencyMs / 60_000)}m
                        </span>
                      ) : null}
                    </div>
                    <h2 className="display-tight mt-2 text-[24px] uppercase leading-tight">{selected.title}</h2>
                    <p className="mt-1 text-[11px] text-[var(--muted)]">
                      <Link href={`/agents/${selected.agentId}`} className="text-[var(--text-soft)] underline-offset-2 hover:underline">
                        {selected.agentName}
                      </Link>{" "}
                      · {formatDateTime(selected.ts)} UTC ·{" "}
                      {selected.assignee ? `assigned to ${selected.assignee}` : "unassigned"}
                    </p>
                    <div className="mt-3">
                      <AlertActions
                        alertId={selected.id}
                        status={selected.status}
                        classification={selected.classification}
                        canTriage={canTriage}
                        agentId={selected.agentId}
                      />
                    </div>
                  </div>
                  {agent ? (
                    <div className="shrink-0 rounded-2xl border border-[var(--line)] bg-[var(--panel-soft)] px-3 py-2.5">
                      <p className="eyebrow mb-1">Agent posture</p>
                      <p className="text-[12px] font-semibold">alignment {agent.alignment}</p>
                      <p className="mt-0.5 text-[9.5px] text-[var(--muted)]">
                        {agent.status} · containment L{agent.containment}
                      </p>
                      <Link href={`/agents/${agent.id}`} className="mt-2 inline-flex items-center gap-1 text-[9.5px] text-[var(--lime)]">
                        Open agent <ArrowRight size={10} aria-hidden />
                      </Link>
                    </div>
                  ) : null}
                </div>
                <div className="border-t border-[var(--line)] px-5 py-4">
                  <ExplainCard
                    explanation={selected.explanation}
                    factors={selected.factors}
                    score={selected.score}
                    confidence={selected.confidence}
                  />
                </div>
                <div className="grid gap-4 border-t border-[var(--line)] px-5 py-4 sm:grid-cols-[1fr_240px]">
                  <div>
                    <p className="eyebrow mb-2">Score decomposition</p>
                    <FactorBars factors={selected.factors} compact />
                  </div>
                  <div className="rounded-2xl border border-[var(--line)] bg-[var(--panel-soft)] p-3">
                    <p className="eyebrow mb-2">Audit invariant</p>
                    <p className="metric-sm text-[22px] font-semibold">
                      {factorSum} / {selected.score}
                    </p>
                    <p className="mt-1 text-[9.5px] leading-relaxed text-[var(--muted)]">
                      Σ named contributions equals the displayed risk score. The
                      weighted-logistic decomposition is recomputed on every read.
                    </p>
                    <p className="mt-2 flex items-center gap-1.5 text-[9px] text-[var(--lime)]">
                      <ShieldCheck size={11} aria-hidden /> verified
                    </p>
                  </div>
                </div>
              </Card>

              <div className="grid gap-3 xl:grid-cols-2">
                <Card>
                  <CardHead
                    eyebrow="Triggering sequence"
                    title="Evidence timeline"
                    subtitle="Sanitized events leading to the alert. Ingested text is never rendered as HTML."
                    right={<SectionLink href={`/evidence?alert=${selected.id}`}>Explorer <ArrowRight size={11} /></SectionLink>}
                  />
                  <div className="px-4 pb-4">
                    <EventTimeline events={selected.evidence.events} dense />
                  </div>
                </Card>

                <div className="space-y-3">
                  <Card>
                    <CardHead eyebrow="Causal chain" title="Taint path" subtitle="Untrusted source → out-of-role action." />
                    <div className="px-4 pb-4">
                      {selected.evidence.taint ? (
                        <TaintThread path={selected.evidence.taint} compact />
                      ) : (
                        <p className="py-6 text-center text-[11px] text-[var(--muted)]">
                          No untrusted content is linked to this alert.
                        </p>
                      )}
                    </div>
                  </Card>
                  <Card>
                    <CardHead eyebrow="Policy mismatch" title="Role diff" />
                    <div className="px-5 pb-5">
                      {selected.evidence.violations.length === 0 ? (
                        <p className="text-[11px] text-[var(--muted)]">
                          No hard-rule violations; this alert came from distributional and causal signals.
                        </p>
                      ) : (
                        <ul className="space-y-1.5">
                          {selected.evidence.violations.map((violation) => (
                            <li key={`${violation.kind}-${violation.value}`} className="rounded-xl border border-[var(--line)] bg-[var(--panel-soft)] px-3 py-2">
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-[10.5px] font-medium text-[var(--orange)]">{violation.value}</span>
                                <span className="text-[8.5px] uppercase tracking-wide text-[var(--muted-dim)]">{violation.kind}</span>
                              </div>
                              <p className="mt-0.5 truncate text-[9px] text-[var(--muted-dim)]" title={violation.declared.join(", ")}>
                                declared: {violation.declared.join(", ") || "none"}
                              </p>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </Card>
                </div>
              </div>

              <Card className="border-[var(--lime)]/20">
                <div className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--lime-soft)] text-[var(--lime)]">
                    <Sparkles size={16} aria-hidden />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="eyebrow mb-1">Suggested next action</p>
                    <p className="text-[11.5px] leading-relaxed text-[var(--text-soft)]">{selected.suggestedAction}</p>
                  </div>
                  <Link href={`/agents/${selected.agentId}`} className="btn btn-primary !h-9 shrink-0">
                    Review containment <ArrowRight size={12} aria-hidden />
                  </Link>
                </div>
              </Card>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
