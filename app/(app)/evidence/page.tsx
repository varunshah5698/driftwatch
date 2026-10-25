import Link from "next/link";
import { ArrowRight, EyeOff, FileWarning, Fingerprint, Lock, ShieldAlert } from "lucide-react";
import { Card, CardHead, EmptyState, PageHeader, SeverityBadge } from "@/components/ui";
import { TaintThread } from "@/components/visuals";
import { EventTimeline } from "@/components/event-timeline";
import { FilterMenu } from "@/components/filters";
import { getStore } from "@/lib/store";
import { formatDateTime, relativeTime } from "@/lib/format";
import { hashString } from "@/lib/engine/math";
import { sensitivityOf } from "@/lib/domain";

export const metadata = { title: "Evidence" };

export default async function EvidencePage({
  searchParams,
}: {
  searchParams: Promise<{ alert?: string }>;
}) {
  const params = await searchParams;
  const store = getStore();
  const withTaint = store.alerts.filter((alert) => alert.evidence.taint);
  const selected =
    store.alerts.find((alert) => alert.id === params.alert) ??
    withTaint.sort((a, b) => b.score - a.score)[0] ??
    store.alerts[0];
  const taint = selected?.evidence.taint;
  const agent = selected ? store.agents.find((candidate) => candidate.id === selected.agentId) : undefined;
  const sourceHash = taint ? hashString(taint.sourceName).toString(16).padStart(12, "0") : null;

  const alertOptions = store.alerts
    .filter((alert) => alert.evidence.taint)
    .map((alert) => ({
      label: `${alert.score} · ${alert.agentName}`,
      value: alert.id,
      href: `/evidence?alert=${alert.id}`,
    }));

  return (
    <div>
      <PageHeader
        eyebrow="Forensics · causality"
        title="Taint Explorer"
        description="Follow an untrusted input through the exact actions it influenced. Content is hashed and redacted at the edge; the chain is reconstructed from signed telemetry."
        meta={
          <>
            <span className="chip chip-orange">{withTaint.length} alerts with taint</span>
            <span className="chip">content snapshots redacted</span>
            <span className="chip">no HTML rendering</span>
          </>
        }
        actions={
          <FilterMenu
            label="Alert"
            value={selected ? `${selected.score} · ${selected.agentName}` : "none"}
            options={alertOptions.length ? alertOptions : [{ label: "No taint alerts", value: "none", href: "/evidence" }]}
          />
        }
      />

      {!selected || !taint ? (
        <Card><EmptyState title="No tainted alerts" description="Nothing untrusted is currently linked to an alert." /></Card>
      ) : (
        <>
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <SeverityBadge severity={selected.severity} showScore={selected.score} />
            <span className="text-[12px] font-medium">{selected.title}</span>
            <span className="text-[10px] text-[var(--muted)]">
              {selected.agentName} · {formatDateTime(selected.ts)} UTC
            </span>
            <Link href={`/alerts?alert=${selected.id}`} className="ml-auto chip hover:border-[var(--line-strong)]">
              Triage alert <ArrowRight size={10} aria-hidden />
            </Link>
          </div>

          <div className="mb-3 grid gap-3 xl:grid-cols-12">
            <Card className="xl:col-span-8">
              <CardHead
                eyebrow="Taint thread"
                title={`${taint.sourceName} → ${taint.nodes.filter((node) => node.suspicious).length} out-of-role actions`}
                subtitle={`Untrusted content read at ${formatDateTime(taint.startedAt)} UTC, ${taint.steps} steps before the first violation.`}
                right={<span className="chip chip-orange"><Fingerprint size={10} aria-hidden /> {taint.trust}</span>}
              />
              <div className="px-5 pb-5">
                <div className="rounded-2xl border border-[var(--line)] bg-[var(--panel-soft)] p-4">
                  <TaintThread path={taint} />
                </div>
                <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {[
                    ["source trust", taint.trust],
                    ["causal steps", String(taint.steps)],
                    ["out-of-scope", String(taint.nodes.filter((node) => node.suspicious).length)],
                    ["sensitivity reached", `${Math.max(...store.events.filter((event) => event.agentId === selected.agentId).map((event) => sensitivityOf(event.dataClass ?? "public")), 1)} / 5`],
                  ].map(([label, value]) => (
                    <div key={label} className="rounded-xl border border-[var(--line)] px-3 py-2">
                      <p className="metric-sm text-[15px] font-semibold">{value}</p>
                      <p className="text-[8.5px] uppercase tracking-wide text-[var(--muted-dim)]">{label}</p>
                    </div>
                  ))}
                </div>
              </div>
            </Card>

            <Card className="xl:col-span-4">
              <CardHead eyebrow="Source snapshot" title="What was ingested" right={<span className="chip chip-red"><EyeOff size={10} aria-hidden /> minimized</span>} />
              <div className="space-y-3 px-5 pb-5">
                <div className="rounded-2xl border border-[color-mix(in_srgb,var(--orange)_35%,transparent)] bg-[var(--orange-soft)] p-3">
                  <div className="flex items-start gap-2">
                    <FileWarning size={16} className="mt-0.5 shrink-0 text-[var(--orange)]" aria-hidden />
                    <div className="min-w-0">
                      <p className="truncate text-[12px] font-medium" title={taint.sourceName}>{taint.sourceName}</p>
                      <p className="mt-1 text-[9px] uppercase tracking-wide text-[var(--orange)]">untrusted · indirect prompt injection</p>
                    </div>
                  </div>
                  <p className="mt-2 text-[10px] leading-relaxed text-[var(--muted)]">
                    The document carried an instruction aimed at the agent. Extracted text is
                    withheld by default; only hashes, classifications and provenance are retained.
                  </p>
                </div>
                <dl className="space-y-1.5 text-[10px]">
                  <div className="flex justify-between gap-3">
                    <dt className="text-[var(--muted-dim)]">content hash</dt>
                    <dd className="font-mono text-[9px] text-[var(--text-soft)]">sha256:{sourceHash}…</dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-[var(--muted-dim)]">trust level</dt>
                    <dd className="text-[var(--orange)]">untrusted</dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-[var(--muted-dim)]">retention</dt>
                    <dd>hash + metadata only</dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-[var(--muted-dim)]">agent</dt>
                    <dd>
                      <Link href={`/agents/${selected.agentId}`} className="text-[var(--lime)] hover:underline">
                        {selected.agentName}
                      </Link>
                    </dd>
                  </div>
                </dl>
                <div className="flex items-start gap-2 rounded-xl border border-[var(--line)] p-2.5">
                  <Lock size={11} className="mt-0.5 shrink-0 text-[var(--muted-dim)]" aria-hidden />
                  <p className="text-[9px] leading-relaxed text-[var(--muted-dim)]">
                    Raw content is encrypted at rest in object storage with a 24h forensic TTL
                    and is never rendered in this UI.
                  </p>
                </div>
              </div>
            </Card>
          </div>

          <div className="grid gap-3 xl:grid-cols-12">
            <Card className="xl:col-span-7">
              <CardHead
                eyebrow="Causal steps"
                title="What the agent did next"
                subtitle="Every step below is signed by the runtime and stored with its argument hash."
              />
              <div className="px-4 pb-4">
                <EventTimeline events={selected.evidence.events} />
              </div>
            </Card>

            <div className="space-y-3 xl:col-span-5">
              <Card>
                <CardHead eyebrow="Authority" title="Role boundary" />
                <div className="px-5 pb-5">
                  {selected.evidence.violations.length === 0 ? (
                    <p className="text-[11px] text-[var(--muted)]">No declared-role violations were required for this alert.</p>
                  ) : (
                    <ul className="space-y-1.5">
                      {selected.evidence.violations.map((violation) => (
                        <li key={`${violation.kind}-${violation.value}`} className="rounded-xl border border-[var(--line)] bg-[var(--panel-soft)] px-3 py-2">
                          <div className="flex items-center justify-between">
                            <span className="text-[10.5px] font-medium text-[var(--orange)]">{violation.value}</span>
                            <span className="chip chip-red !px-1.5 !py-0 !text-[8px]">outside</span>
                          </div>
                          <p className="mt-1 text-[9px] leading-relaxed text-[var(--muted-dim)]">
                            {violation.field} declares: {violation.declared.join(", ") || "nothing"}
                          </p>
                        </li>
                      ))}
                    </ul>
                  )}
                  <div className="mt-3 rounded-xl border border-[var(--line)] p-3">
                    <p className="flex items-center gap-1.5 text-[10px] text-[var(--lime)]">
                      <ShieldAlert size={11} aria-hidden /> Valid token, valid permissions
                    </p>
                    <p className="mt-1 text-[9.5px] leading-relaxed text-[var(--muted)]">
                      Authorization checks passed for every call. The failure is behavioral:
                      the declared Procurement role never reaches HR compensation or external hosts.
                    </p>
                  </div>
                </div>
              </Card>

              <Card>
                <CardHead eyebrow="Analyst note" title="Why this matters" />
                <div className="px-5 pb-5 text-[11px] leading-relaxed text-[var(--text-soft)]">
                  <p>{selected.explanation.split(". ").slice(0, 3).join(". ")}.</p>
                  <p className="mt-2 text-[var(--muted)]">
                    The taint link is a correlation with a bounded causal window, not proof of
                    intent. It raises the injection signal by 30 points; scope and egress evidence
                    carry the alert on their own.
                  </p>
                  <p className="mt-2 text-[9px] text-[var(--muted-dim)]">
                    Observed {relativeTime(taint.startedAt)} · {agent?.environment ?? "unknown"} environment · retention 24h
                  </p>
                </div>
              </Card>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
