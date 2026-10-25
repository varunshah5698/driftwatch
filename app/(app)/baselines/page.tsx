import Link from "next/link";
import { Activity, ArrowRight, GitCommitHorizontal, Sparkles } from "lucide-react";
import { Card, CardHead, PageHeader, StatusPill } from "@/components/ui";
import { ConfidenceChart } from "@/components/baseline-chart";
import { DriftPulse, Sparkline } from "@/components/charts";
import { getStore } from "@/lib/store";
import { changesForAgent } from "@/lib/store";
import { formatDate, formatDateTime } from "@/lib/format";

export const metadata = { title: "Baselines" };

export default async function BaselinesPage({
  searchParams,
}: {
  searchParams: Promise<{ agent?: string }>;
}) {
  const params = await searchParams;
  const store = getStore();
  const selected =
    store.agents.find((agent) => agent.id === params.agent) ??
    [...store.agents].sort((a, b) => a.confidence - b.confidence)[0];
  const baseline = store.baselines[selected.id];
  const history = store.baselineHistory[selected.id] ?? [baseline];
  const changes = changesForAgent(selected.id);
  const learningAgents = store.agents.filter((agent) => agent.status === "learning");
  const distribution = (dist: Record<string, number>) =>
    Object.entries(dist)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6);

  return (
    <div>
      <PageHeader
        eyebrow="Learning · change"
        title="Baselines & Learning"
        description="A baseline is a versioned expectation, not a permanent truth. See what the agent learned, how confident it is, and which approved changes moved the line."
        meta={
          <>
            <span className="chip chip-violet">{learningAgents.length} agents in cold start</span>
            <span className="chip">{store.agents.length} baselines</span>
            <span className="chip chip-lime">{store.changeEvents.filter((change) => change.status === "active").length} active change windows</span>
            <span className="chip">CUSUM change points</span>
          </>
        }
      />

      <div className="grid gap-3 xl:grid-cols-12">
        <div className="space-y-3 xl:col-span-4">
          <Card>
            <CardHead eyebrow="Cold start" title="New agents" subtitle="Priors keep coverage honest while history accumulates." />
            <div className="space-y-2 px-5 pb-5">
              {learningAgents.length === 0 ? (
                <p className="text-[11px] text-[var(--muted)]">All agents have a stable baseline.</p>
              ) : (
                learningAgents.map((agent) => (
                  <Link
                    key={agent.id}
                    href={`/baselines?agent=${agent.id}`}
                    className="flex items-center gap-3 rounded-2xl border border-[var(--line)] bg-[var(--panel-soft)] px-3 py-2.5 hover:border-[var(--line-strong)]"
                  >
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--violet-soft)] text-[var(--violet)]">
                      <Sparkles size={13} aria-hidden />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[11px] font-medium">{agent.name}</p>
                      <p className="text-[9px] text-[var(--muted)]">
                        {store.baselines[agent.id].sampleCount} events · {Math.round(agent.learningProgress * 100)}% learned
                      </p>
                      <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-[var(--line)]">
                        <span className="block h-full rounded-full bg-[var(--violet)]" style={{ width: `${agent.learningProgress * 100}%` }} />
                      </div>
                    </div>
                    <span className="text-[10px] text-[var(--muted)]">{Math.round(agent.confidence * 100)}%</span>
                  </Link>
                ))
              )}
            </div>
          </Card>

          <Card className="overflow-hidden">
            <CardHead eyebrow="Fleet" title="Every baseline" right={<span className="chip">{store.agents.length}</span>} />
            <ul className="max-h-[420px] divide-y divide-[var(--line)] overflow-y-auto">
              {[...store.agents]
                .sort((a, b) => a.confidence - b.confidence)
                .map((agent) => (
                  <li key={agent.id}>
                    <Link
                      href={`/baselines?agent=${agent.id}`}
                      className={`flex items-center gap-2 px-4 py-2 transition-colors hover:bg-[var(--panel-hi)] ${agent.id === selected.id ? "bg-[var(--panel-hi)]" : ""}`}
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[10.5px] text-[var(--text-soft)]">{agent.name}</span>
                        <span className="text-[8.5px] text-[var(--muted-dim)]">
                          v{store.baselines[agent.id].version} · {store.baselines[agent.id].sampleCount} events
                        </span>
                      </span>
                      <span className="w-14">
                        <Sparkline
                          values={store.baselines[agent.id].alignmentSeries.slice(-8).map((point) => point.score)}
                          color={agent.alignment < 60 ? "var(--orange)" : "var(--lime)"}
                          height={18}
                          area={false}
                          id={`bl-${agent.id}`}
                        />
                      </span>
                      <span className="metric-sm w-7 text-right text-[9px] text-[var(--muted)]">{Math.round(agent.confidence * 100)}</span>
                    </Link>
                  </li>
                ))}
            </ul>
          </Card>
        </div>

        <div className="space-y-3 xl:col-span-8">
          <Card>
            <CardHead
              eyebrow={`${selected.roleTemplate} · ${selected.environment}`}
              title={selected.name}
              subtitle={`Baseline v${baseline.version} · ${baseline.sampleCount.toLocaleString()} events · window ${formatDate(baseline.windowStart)} → ${formatDate(baseline.windowEnd)}`}
              right={<StatusPill status={selected.status} />}
            />
            <div className="grid grid-cols-2 gap-2 px-6 pb-4 sm:grid-cols-4">
              {[
                ["confidence", `${Math.round(baseline.confidence * 100)}%`],
                ["learning state", baseline.status],
                ["change points", String(baseline.changePoints.length)],
                ["avg steps/session", String(baseline.avgStepsPerSession)],
              ].map(([label, value]) => (
                <div key={label} className="rounded-xl border border-[var(--line)] bg-[var(--panel-soft)] px-3 py-2">
                  <p className="metric-sm text-[15px] font-semibold capitalize">{value}</p>
                  <p className="text-[8px] uppercase tracking-wide text-[var(--muted-dim)]">{label}</p>
                </div>
              ))}
            </div>
            <div className="px-4 pb-5">
              <ConfidenceChart
                series={baseline.alignmentSeries}
                confidence={baseline.confidence}
                changePoints={baseline.changePoints}
                changes={changes}
              />
              <div className="flex flex-wrap items-center gap-4 text-[9px] text-[var(--muted)]">
                <span className="inline-flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-[var(--lime)]" /> alignment</span>
                <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-[var(--lime)]/15" /> confidence band</span>
                <span className="inline-flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-[var(--orange)]" /> CUSUM change point</span>
                <span className="inline-flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-[var(--violet)]" /> approved change</span>
              </div>
            </div>
          </Card>

          <div className="grid gap-3 md:grid-cols-2">
            <Card>
              <CardHead eyebrow="Distribution" title="Tool profile" subtitle="Share of tool calls in the learning window." />
              <DistributionList entries={distribution(baseline.toolDist)} color="var(--lime)" />
            </Card>
            <Card>
              <CardHead eyebrow="Distribution" title="Data profile" subtitle="Share of data reads in the learning window." />
              <DistributionList entries={distribution(baseline.dataDist)} color="var(--orange)" />
            </Card>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <Card>
              <CardHead eyebrow="Version control" title="Baseline history" right={<GitCommitHorizontal size={13} className="text-[var(--muted)]" aria-hidden />} />
              <div className="px-5 pb-5">
                <ol className="relative space-y-3 before:absolute before:bottom-2 before:left-[7px] before:top-2 before:w-px before:bg-[var(--line)]">
                  {history
                    .slice()
                    .reverse()
                    .map((version) => (
                      <li key={version.id} className="relative flex gap-3">
                        <span className="relative z-10 mt-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full border border-[var(--line-strong)] bg-[var(--panel)]">
                          <span className="h-1.5 w-1.5 rounded-full bg-[var(--lime)]" />
                        </span>
                        <div>
                          <p className="text-[10.5px] font-medium">v{version.version} · {version.sampleCount.toLocaleString()} events</p>
                          <p className="text-[9px] text-[var(--muted-dim)]">
                            {formatDateTime(version.createdAt)} · {Math.round(version.confidence * 100)}% confidence
                          </p>
                        </div>
                      </li>
                    ))}
                  {history.length === 1 ? (
                    <li className="relative flex gap-3">
                      <span className="relative z-10 mt-0.5 h-3.5 w-3.5 rounded-full border border-[var(--line)] bg-[var(--panel)]" />
                      <div>
                        <p className="text-[10.5px] text-[var(--muted)]">v{Math.max(1, baseline.version - 1)} · superseded</p>
                        <p className="text-[9px] text-[var(--muted-dim)]">initial privacy-safe baseline</p>
                      </div>
                    </li>
                  ) : null}
                </ol>
              </div>
            </Card>

            <Card>
              <CardHead eyebrow="Approved" title="Change events" right={<span className="chip">{changes.length}</span>} />
              <div className="px-5 pb-5">
                {changes.length === 0 ? (
                  <p className="text-[10.5px] text-[var(--muted)]">No change events for this agent.</p>
                ) : (
                  <ul className="space-y-2">
                    {changes.map((change) => (
                      <li key={change.id} className="rounded-xl border border-[var(--line)] bg-[var(--panel-soft)] p-2.5">
                        <div className="flex items-center justify-between">
                          <span className="chip !px-1.5 !py-0 !text-[8px]">{change.type}</span>
                          <span className={`chip !px-1.5 !py-0 !text-[8px] ${change.status === "active" ? "chip-lime" : ""}`}>{change.status}</span>
                        </div>
                        <p className="mt-1 text-[10px] font-medium">{change.title}</p>
                        <p className="text-[8.5px] text-[var(--muted-dim)]">
                          {formatDate(change.at)} · {change.approvedBy} · {change.graceHours}h grace
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
                <div className="mt-3 rounded-xl border border-[var(--line)] p-2.5">
                  <p className="eyebrow mb-1.5">Drift pulse</p>
                  <DriftPulse values={baseline.alignmentSeries.slice(-14).map((point) => point.score)} label="14 days" />
                </div>
              </div>
            </Card>
          </div>

          <Card>
            <CardHead
              eyebrow="Replay before applying"
              title="Test a threshold or manifest change"
              subtitle="Role edits can be replayed against the last 7 days before they are applied."
              right={<Link href={`/roles?agent=${selected.id}`} className="btn !h-8 !text-[10px]">Manifest editor <ArrowRight size={11} aria-hidden /></Link>}
            />
            <div className="grid gap-2 px-6 pb-6 sm:grid-cols-3">
              {[
                { title: "Violation preview", note: "Counts events that would become out of role", Icon: Activity },
                { title: "Score preview", note: "Re-scores the same window with the new manifest", Icon: Sparkles },
                { title: "Grace window", note: "48h change window opens on apply", Icon: GitCommitHorizontal },
              ].map(({ title, note, Icon }) => (
                <div key={title} className="rounded-xl border border-[var(--line)] bg-[var(--panel-soft)] p-3">
                  <span className="text-[var(--lime)]"><Icon size={13} aria-hidden /></span>
                  <p className="mt-2 text-[10px] font-medium">{title}</p>
                  <p className="mt-0.5 text-[9px] leading-relaxed text-[var(--muted-dim)]">{note}</p>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

function DistributionList({
  entries,
  color,
}: {
  entries: [string, number][];
  color: string;
}) {
  const max = Math.max(0.0001, ...entries.map(([, value]) => value));
  return (
    <div className="space-y-2 px-6 pb-6">
      {entries.map(([label, value]) => (
        <div key={label}>
          <div className="flex items-center justify-between text-[9.5px]">
            <span className="truncate text-[var(--muted)]" title={label}>{label}</span>
            <span className="metric-sm text-[var(--text-soft)]">{(value * 100).toFixed(1)}%</span>
          </div>
          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-[var(--panel-soft)]">
            <div className="h-full rounded-full" style={{ width: `${(value / max) * 100}%`, background: color }} />
          </div>
        </div>
      ))}
    </div>
  );
}
