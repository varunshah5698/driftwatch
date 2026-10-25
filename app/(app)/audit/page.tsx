import Link from "next/link";
import { Card, CardHead, PageHeader } from "@/components/ui";
import { AuditVerify, ExportMenu } from "@/components/audit-actions";
import { auditEntries, getStore } from "@/lib/store";
import { verifyAuditChain } from "@/lib/engine/audit";
import { formatDateTime } from "@/lib/format";
import { Search } from "lucide-react";

export const metadata = { title: "Audit log" };

export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const params = await searchParams;
  const query = params.q?.trim().toLowerCase() ?? "";
  const store = getStore();
  const entries = auditEntries();
  const verified = verifyAuditChain(store.audit);
  const filtered = entries.filter(
    (entry) =>
      !query ||
      entry.actor.toLowerCase().includes(query) ||
      entry.action.toLowerCase().includes(query) ||
      entry.target.toLowerCase().includes(query) ||
      entry.detail.toLowerCase().includes(query),
  );

  return (
    <div>
      <PageHeader
        eyebrow="Compliance · immutable"
        title="Audit Log"
        description="Every decision, containment change and analyst label is appended to a hash chain. Editing an earlier entry breaks every subsequent hash."
        meta={
          <>
            <span className="chip chip-lime">SHA-256 chained</span>
            <span className="chip">{entries.length} entries</span>
            <span className="chip">retention 400 days (hashes)</span>
            <span className="chip">OCSF / CEF ready</span>
          </>
        }
        actions={
          <>
            <AuditVerify initial={{ valid: verified.valid, checked: verified.checked }} />
            <ExportMenu type="audit" />
          </>
        }
      />

      <div className="grid gap-3 xl:grid-cols-12">
        <div className="space-y-3 xl:col-span-8">
          <Card>
            <div className="flex flex-wrap items-center gap-2 border-b border-[var(--line)] px-4 py-3">
              <form action="/audit" method="get" className="relative min-w-[220px] flex-1">
                <Search size={13} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted-dim)]" aria-hidden />
                <input
                  name="q"
                  defaultValue={params.q}
                  placeholder="Search actor, action, target…"
                  aria-label="Search audit log"
                  className="h-8 w-full rounded-full border border-[var(--line)] bg-[var(--panel-soft)] pl-8 pr-3 text-[11px] outline-none focus:border-[var(--line-strong)]"
                />
              </form>
              <span className="text-[9.5px] text-[var(--muted-dim)]">{filtered.length} entries</span>
              {query ? (
                <Link href="/audit" className="chip !text-[9px]">clear</Link>
              ) : null}
            </div>
            <div className="scroll-x">
              <table className="w-full min-w-[820px] border-collapse text-left">
                <thead>
                  <tr className="border-b border-[var(--line)] text-[8.5px] uppercase tracking-[0.1em] text-[var(--muted-dim)]">
                    <th className="py-2.5 pl-5 pr-3 font-medium">#</th>
                    <th className="py-2.5 pr-3 font-medium">Time</th>
                    <th className="py-2.5 pr-3 font-medium">Actor</th>
                    <th className="py-2.5 pr-3 font-medium">Action</th>
                    <th className="py-2.5 pr-3 font-medium">Target</th>
                    <th className="py-2.5 pr-3 font-medium">Detail</th>
                    <th className="py-2.5 pr-5 font-medium">Hash</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((entry) => (
                    <tr key={entry.seq} className="border-b border-[var(--line)] align-top transition-colors hover:bg-[var(--panel-hi)]/40">
                      <td className="py-2.5 pl-5 pr-3 metric-sm text-[9px] text-[var(--muted-dim)]">{entry.seq}</td>
                      <td className="py-2.5 pr-3 text-[9px] text-[var(--muted)]">{formatDateTime(entry.at)}</td>
                      <td className="py-2.5 pr-3">
                        <span className="text-[10px] text-[var(--text-soft)]">{entry.actor}</span>
                        <span className="block text-[8px] uppercase tracking-wide text-[var(--muted-dim)]">{entry.actorType}</span>
                      </td>
                      <td className="py-2.5 pr-3">
                        <span className="chip !px-1.5 !py-0 !text-[8.5px]">{entry.action}</span>
                      </td>
                      <td className="max-w-[120px] truncate py-2.5 pr-3 font-mono text-[9px] text-[var(--muted)]" title={entry.target}>{entry.target}</td>
                      <td className="max-w-[280px] py-2.5 pr-3 text-[9.5px] leading-relaxed text-[var(--text-soft)]">{entry.detail}</td>
                      <td className="py-2.5 pr-5">
                        <span className="block font-mono text-[8px] text-[var(--muted-dim)]" title={entry.hash}>{entry.hash.slice(0, 12)}…</span>
                        <span className="block font-mono text-[7.5px] text-[var(--muted-dim)]" title={`previous ${entry.prevHash}`}>
                          ↖ {entry.prevHash.slice(0, 8)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filtered.length === 0 ? (
                <p className="px-5 py-12 text-center text-[11px] text-[var(--muted)]">No entries match “{params.q}”.</p>
              ) : null}
            </div>
          </Card>
        </div>

        <div className="space-y-3 xl:col-span-4">
          <Card>
            <CardHead eyebrow="Chain" title="Integrity" subtitle="Each entry commits to the SHA-256 hash of the previous one." />
            <div className="px-5 pb-5">
              <div className="rounded-2xl border border-[var(--line)] bg-[var(--panel-soft)] p-3">
                <div className="flex items-center justify-between text-[9.5px]">
                  <span className="text-[var(--muted-dim)]">genesis</span>
                  <span className={verified.valid ? "text-[var(--lime)]" : "text-[var(--red)]"}>{verified.valid ? "verified" : "broken"}</span>
                </div>
                <div className="mt-2 space-y-1">
                  {entries.slice(0, 4).map((entry) => (
                    <div key={entry.seq} className="flex items-center gap-1.5">
                      <span className="metric-sm w-6 text-[8px] text-[var(--muted-dim)]">#{entry.seq}</span>
                      <span className="h-1.5 w-1.5 rounded-full bg-[var(--lime)]" />
                      <span className="h-px flex-1 bg-[var(--line-strong)]" />
                      <span className="font-mono text-[7.5px] text-[var(--muted-dim)]">{entry.hash.slice(0, 10)}</span>
                    </div>
                  ))}
                  <p className="pt-1 text-center text-[8px] text-[var(--muted-dim)]">…{Math.max(0, entries.length - 4)} earlier/later links</p>
                </div>
              </div>
              <p className="mt-3 text-[9.5px] leading-relaxed text-[var(--muted)]">
                Export the log and recompute the chain independently. The verification endpoint
                returns the first broken sequence if any link was altered.
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-1.5">
                <ExportMenu type="audit" label="Audit log" />
                <a className="btn !h-8 !text-[10.5px]" href="/api/export?type=alerts&format=ocsf">
                  Alert evidence (OCSF)
                </a>
                <a className="btn !h-8 !text-[10.5px]" href="/api/export?type=events&format=cef">
                  Event sample (CEF)
                </a>
              </div>
            </div>
          </Card>

          <Card>
            <CardHead eyebrow="Retention" title="Data minimization" />
            <div className="px-5 pb-5">
              <dl className="space-y-2 text-[10px]">
                {[
                  ["raw event content", "24 hours"],
                  ["hashes + classifications", "400 days"],
                  ["alerts + evidence", "400 days"],
                  ["audit chain", "immutable · 400 days"],
                  ["sanitized snapshots", "encrypted · 24h forensic TTL"],
                ].map(([label, value]) => (
                  <div key={label} className="flex justify-between gap-3">
                    <dt className="text-[var(--muted-dim)]">{label}</dt>
                    <dd className="text-right text-[var(--text-soft)]">{value}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </Card>

          <Card>
            <CardHead eyebrow="Actors" title="Who changed what" />
            <div className="px-5 pb-5">
              {[...new Set(entries.map((entry) => entry.actor))].slice(0, 8).map((actor) => (
                <div key={actor} className="flex items-center justify-between border-b border-[var(--line)] py-1.5 text-[10px] last:border-0">
                  <span className="text-[var(--text-soft)]">{actor}</span>
                  <span className="metric-sm text-[var(--muted-dim)]">
                    {entries.filter((entry) => entry.actor === actor).length} entries
                  </span>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
