"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, CheckCircle2, Loader2, Play, RotateCcw, Save } from "lucide-react";
import type { AgentEvent } from "@/lib/types";

interface RoleDiff {
  field: string;
  added: string[];
  removed: string[];
}

interface SimulationResponse {
  ok: boolean;
  applied?: boolean;
  errors?: string[];
  diff?: (RoleDiff | null)[];
  simulation?: {
    events: number;
    violationEvents: number;
    violationTypes: number;
    candidateScore: number;
    currentScore: number;
    wouldAlert: boolean;
    samples: AgentEvent[];
  };
}

export function RoleEditor({
  agentId,
  initialYaml,
  canEdit,
}: {
  agentId: string;
  initialYaml: string;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [yaml, setYaml] = useState(initialYaml);
  const [pending, setPending] = useState<"validate" | "apply" | null>(null);
  const [result, setResult] = useState<SimulationResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const dirty = yaml !== initialYaml;

  const submit = async (apply: boolean) => {
    setPending(apply ? "apply" : "validate");
    setError(null);
    const response = await fetch("/api/roles", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ agentId, yaml, apply }),
    });
    const payload = (await response.json()) as SimulationResponse & { error?: string };
    setPending(null);
    if (!response.ok) {
      setError(payload.error ?? "Request failed");
      return;
    }
    setResult(payload);
    if (payload.applied) {
      router.refresh();
    }
  };

  const diff = result?.diff?.filter(Boolean) ?? [];

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span className="chip chip-violet">YAML · driftwatch/v1</span>
        <span className="text-[9.5px] text-[var(--muted-dim)]">
          {yaml.split("\n").length} lines · schema-validated server-side
        </span>
        <div className="ml-auto flex items-center gap-1.5">
          <button type="button" onClick={() => setYaml(initialYaml)} disabled={!dirty || pending !== null} className="btn !h-8 !text-[10.5px]">
            <RotateCcw size={11} aria-hidden /> Reset
          </button>
          <button type="button" onClick={() => submit(false)} disabled={pending !== null} className="btn !h-8 !text-[10.5px]">
            {pending === "validate" ? <Loader2 size={11} className="animate-spin" aria-hidden /> : <Play size={11} aria-hidden />}
            Validate & simulate 7d
          </button>
          <button
            type="button"
            onClick={() => submit(true)}
            disabled={!canEdit || !dirty || pending !== null}
            className="btn btn-primary !h-8 !text-[10.5px]"
            title={canEdit ? "Apply and open a 48h change window" : "Your role cannot edit manifests"}
          >
            {pending === "apply" ? <Loader2 size={11} className="animate-spin" aria-hidden /> : <Save size={11} aria-hidden />}
            Apply
          </button>
        </div>
      </div>

      <div className="relative overflow-hidden rounded-2xl border border-[var(--line)] bg-[#0d0f0c]">
        <div className="flex items-center justify-between border-b border-[var(--line)] px-3 py-2">
          <span className="font-mono text-[9px] text-[var(--muted-dim)]">agent-role.yaml</span>
          <span className={`text-[8.5px] ${dirty ? "text-[var(--orange)]" : "text-[var(--muted-dim)]"}`}>
            {dirty ? "unsaved changes" : "in sync with registry"}
          </span>
        </div>
        <div className="flex">
          <div aria-hidden className="select-none border-r border-[var(--line)] px-2 py-3 text-right font-mono text-[10px] leading-[1.55] text-[#4d5546]">
            {Array.from({ length: Math.max(yaml.split("\n").length, 22) }).map((_, index) => (
              <div key={index}>{index + 1}</div>
            ))}
          </div>
          <textarea
            value={yaml}
            onChange={(event) => setYaml(event.target.value)}
            spellCheck={false}
            aria-label="Role manifest YAML"
            className="min-h-[420px] w-full resize-y bg-transparent px-3 py-3 font-mono text-[11px] leading-[1.55] text-[#d7e6c2] outline-none"
          />
        </div>
        <div className="flex items-center justify-between border-t border-[var(--line)] px-3 py-1.5 text-[8.5px] text-[var(--muted-dim)]">
          <span>required: apiVersion, kind, metadata.name, spec.allowed, spec.operatingHours</span>
          <span>UTF-8 · LF</span>
        </div>
      </div>

      {error ? (
        <div className="mt-3 flex items-start gap-2 rounded-2xl border border-[var(--red)]/40 bg-[var(--red-soft)] p-3">
          <AlertTriangle size={14} className="mt-0.5 shrink-0 text-[var(--red)]" aria-hidden />
          <p className="text-[10.5px] text-[var(--red)]">{error}</p>
        </div>
      ) : null}

      {result ? (
        <div className="mt-3 space-y-3">
          {result.ok === false ? (
            <div className="rounded-2xl border border-[var(--red)]/40 bg-[var(--red-soft)] p-3">
              <p className="flex items-center gap-1.5 text-[10.5px] font-semibold text-[var(--red)]">
                <AlertTriangle size={13} aria-hidden /> Schema validation failed
              </p>
              <ul className="mt-1.5 space-y-1">
                {result.errors?.map((issue) => (
                  <li key={issue} className="text-[10px] text-[var(--red)]">• {issue}</li>
                ))}
              </ul>
            </div>
          ) : (
            <>
              <div className="grid gap-2 sm:grid-cols-4">
                {[
                  ["replayed events", String(result.simulation?.events ?? 0)],
                  ["would violate", String(result.simulation?.violationEvents ?? 0)],
                  ["candidate score", String(result.simulation?.candidateScore ?? 0)],
                  ["current score", String(result.simulation?.currentScore ?? 0)],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-xl border border-[var(--line)] bg-[var(--panel-soft)] px-3 py-2">
                    <p className="metric-sm text-[16px] font-semibold">{value}</p>
                    <p className="text-[8px] uppercase tracking-wide text-[var(--muted-dim)]">{label}</p>
                  </div>
                ))}
              </div>

              {result.applied ? (
                <p className="flex items-center gap-2 rounded-xl border border-[var(--lime)]/40 bg-[var(--lime-soft)] px-3 py-2 text-[10.5px] text-[var(--lime)]">
                  <CheckCircle2 size={13} aria-hidden /> Manifest applied. A 48-hour change window is now active.
                </p>
              ) : null}

              <div className="rounded-2xl border border-[var(--line)] p-3">
                <p className="eyebrow mb-2">Diff against current manifest</p>
                {diff.length === 0 ? (
                  <p className="text-[10px] text-[var(--muted)]">No scope changes. The manifest is semantically identical.</p>
                ) : (
                  <ul className="space-y-1.5">
                    {diff.map((entry) =>
                      entry ? (
                        <li key={entry.field} className="text-[10px]">
                          <span className="text-[var(--text-soft)]">{entry.field}</span>
                          <span className="ml-2 text-[var(--lime)]">+{entry.added.length ? entry.added.join(", ") : "none"}</span>
                          <span className="ml-2 text-[var(--red)]">−{entry.removed.length ? entry.removed.join(", ") : "none"}</span>
                        </li>
                      ) : null,
                    )}
                  </ul>
                )}
              </div>

              {result.simulation?.wouldAlert ? (
                <p className="rounded-xl border border-[var(--orange)]/40 bg-[var(--orange-soft)] px-3 py-2 text-[10px] text-[var(--orange)]">
                  This manifest would fire an alert at score {result.simulation.candidateScore} on the
                  last 7 days. Review the violations before applying.
                </p>
              ) : (
                <p className="rounded-xl border border-[var(--lime)]/30 bg-[var(--lime-soft)] px-3 py-2 text-[10px] text-[var(--lime)]">
                  No alert would fire against the new manifest over the last 7 days.
                </p>
              )}

              {result.simulation?.samples?.length ? (
                <div className="rounded-2xl border border-[var(--line)] p-3">
                  <p className="eyebrow mb-1.5">Events that would violate</p>
                  <ul className="space-y-1">
                    {result.simulation.samples.map((event) => (
                      <li key={event.id} className="truncate text-[9.5px] text-[var(--muted)]">
                        <span className="text-[var(--orange)]">{event.type}</span> · {event.summary}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}
