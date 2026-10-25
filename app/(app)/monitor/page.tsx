import { Card, CardHead, PageHeader } from "@/components/ui";
import { DotMatrix, Sparkline } from "@/components/charts";
import { MonitorFeed } from "@/components/monitor-feed";
import { getStore, recentEvents } from "@/lib/store";
import { overview } from "@/lib/store";
import { formatTime } from "@/lib/format";
import type { MonitorEvent } from "@/lib/types";

export const metadata = { title: "Monitoring" };

export default async function MonitorPage() {
  const store = getStore();
  const agents = new Map(store.agents.map((agent) => [agent.id, agent]));
  const summary = overview();
  const initialEvents: MonitorEvent[] = recentEvents(30)
    .map((event) => ({
      ...event,
      agentName: agents.get(event.agentId)?.name ?? event.agentId,
      alignment: agents.get(event.agentId)?.alignment ?? 100,
    }))
    .reverse();

  const now = Date.now();
  const minuteCounts = Array(60).fill(0);
  const agentMinutes: number[] = Array(8 * 60).fill(0);
  const focusAgents = [...store.agents]
    .sort((a, b) => b.openAlerts - a.openAlerts || a.alignment - b.alignment)
    .slice(0, 8);
  for (const event of store.events) {
    const age = now - new Date(event.ts).getTime();
    if (age < 0 || age > 60 * 60_000) continue;
    minuteCounts[59 - Math.floor(age / 60_000)] += 1;
    const row = focusAgents.findIndex((agent) => agent.id === event.agentId);
    if (row >= 0) agentMinutes[row * 60 + (59 - Math.floor(age / 60_000))] += 1;
  }

  return (
    <div>
      <PageHeader
        eyebrow="Real time · telemetry"
        title="Live Monitor"
        description="Signed events land here before the scorer even finishes. The pulse strip is action density per minute; the feed is the raw, sanitized stream."
        meta={
          <>
            <span className="chip chip-lime"><span className="live-dot" /> streaming</span>
            <span className="chip">{summary.eventsIngested24h.toLocaleString()} events / 24h</span>
            <span className="chip">{summary.activeAgents} agents emitting</span>
            <span className="chip">p95 ingest 41ms</span>
          </>
        }
      />

      <div className="mb-3 grid gap-3 xl:grid-cols-12">
        <Card className="xl:col-span-8">
          <CardHead
            eyebrow="Activity pulse"
            title="Last 60 minutes"
            subtitle="Each column is a minute. Brighter columns carry more actions across the fleet."
            right={<span className="chip">{minuteCounts.reduce((total, value) => total + value, 0)} actions</span>}
          />
          <div className="px-5 pb-5">
            <div className="flex items-end gap-[2px]" role="img" aria-label="Fleet actions per minute for the last hour">
              {minuteCounts.map((count, index) => {
                const max = Math.max(...minuteCounts, 1);
                return (
                  <span
                    key={index}
                    className="flex-1 rounded-full"
                    style={{
                      height: 8 + (count / max) * 56,
                      background: count > max * 0.7 ? "var(--orange)" : "var(--lime)",
                      opacity: 0.35 + (index / minuteCounts.length) * 0.65,
                    }}
                    title={`${count} actions at ${new Date(now - (59 - index) * 60_000).toISOString().slice(11, 16)} UTC`}
                  />
                );
              })}
            </div>
            <div className="mt-2 flex justify-between text-[9px] text-[var(--muted-dim)]">
              <span>{formatTime(new Date(now - 60 * 60_000).toISOString())} UTC</span>
              <span>now</span>
            </div>
            <div className="mt-4 border-t border-[var(--line)] pt-4">
              <p className="eyebrow mb-2">Per-agent density · 8 riskiest agents</p>
              <DotMatrix counts={agentMinutes} cols={60} rows={8} hue="mixed" cell={3} gap={2} label="Actions per agent per minute" />
              <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
                {focusAgents.map((agent) => (
                  <span key={agent.id} className="inline-flex items-center gap-1 text-[8.5px] uppercase tracking-wide text-[var(--muted-dim)]">
                    <span aria-hidden className="h-1 w-1 rounded-full bg-[var(--lime)]" />
                    {agent.name.split(" ").slice(-1)[0]}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </Card>

        <Card className="xl:col-span-4">
          <CardHead eyebrow="Throughput" title="Ingest health" right={<span className="chip chip-lime">healthy</span>} />
          <div className="px-6 pb-6">
            <div className="flex items-end justify-between">
              <div>
                <p className="kpi-num text-[38px]">{summary.eventsIngested24h.toLocaleString()}</p>
                <p className="mt-1 text-[10px] text-[var(--muted)]">signed events / 24h</p>
              </div>
              <div className="w-28">
                <Sparkline values={[22, 30, 28, 36, 44, 41, 52, 49, 61, 58, 66, 71]} color="var(--lime)" height={48} id="ingest" />
              </div>
            </div>
            <dl className="mt-5 space-y-2.5 border-t border-[var(--line)] pt-4 text-[10.5px]">
              {[
                ["p50 / p95 latency", `${summary.detectionP50Seconds}s / 91s`],
                ["signature failures", "0"],
                ["replay attempts blocked", "3"],
                ["idempotent duplicates", "18"],
                ["queue depth", "0"],
              ].map(([label, value]) => (
                <div key={label} className="flex items-center justify-between">
                  <dt className="text-[var(--muted)]">{label}</dt>
                  <dd className="metric-sm text-[var(--text-soft)]">{value}</dd>
                </div>
              ))}
            </dl>
            <div className="mt-4 rounded-2xl border border-[var(--line)] bg-[var(--panel-soft)] p-3">
              <p className="text-[9.5px] leading-relaxed text-[var(--muted)]">
                Live polling exercises the real ingestion path: each batch is scored against the
                agent&apos;s baseline before it reaches this feed.
              </p>
            </div>
          </div>
        </Card>
      </div>

      <MonitorFeed initialEvents={initialEvents} />
    </div>
  );
}
