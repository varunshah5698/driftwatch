"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, Check, Loader2, Lock, ShieldCheck } from "lucide-react";
import { CONTAINMENT_LADDER } from "@/lib/domain";

export function ContainmentLadder({
  agentId,
  agentName,
  level,
  allowed,
  canApply,
}: {
  agentId: string;
  agentName: string;
  level: number;
  allowed: {
    tools: string[];
    dataClasses: string[];
    destinations: string[];
  };
  canApply: boolean;
}) {
  const router = useRouter();
  const [pending, setPending] = useState<number | null>(null);
  const [target, setTarget] = useState<number>(Math.min(5, level + 1));
  const [reason, setReason] = useState("");
  const [result, setResult] = useState<{
    samples: { request: Record<string, string>; decision: { decision: string; reason: string } }[];
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const apply = async (nextLevel: number) => {
    if (!canApply) return;
    setPending(nextLevel);
    setError(null);
    const response = await fetch(`/api/agents/${agentId}/containment`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        level: nextLevel,
        reason: reason.trim() || `Containment ${levels[nextLevel]} applied by analyst`,
      }),
    });
    const payload = (await response.json()) as {
      error?: string;
      samples?: { request: Record<string, string>; decision: { decision: string; reason: string } }[];
    };
    setPending(null);
    if (!response.ok) {
      setError(payload.error ?? "Unable to change containment.");
      return;
    }
    setTarget(Math.min(5, nextLevel + 1));
    setResult({ samples: payload.samples ?? [] });
    router.refresh();
  };

  const levels = ["monitor", "notify", "step-up", "restrict", "quarantine", "isolate"];
  const decisionFor = (kind: "write" | "outsider" | "read") => {
    if (target === 5) return "blocked";
    if (target === 4) return kind === "read" ? "allowed" : "blocked";
    if (target === 3) return kind === "outsider" ? "blocked" : "allowed";
    if (target === 2) return kind === "outsider" || kind === "write" ? "approval" : "allowed";
    return "allowed";
  };
  const preview = [
    {
      label: "In-scope read",
      call: `${allowed.tools[0] ?? "read"} · declared`,
      state: decisionFor("read"),
    },
    {
      label: "Out-of-role data",
      call: "hr.salary · not declared",
      state: decisionFor("outsider"),
    },
    {
      label: "Unapproved egress",
      call: "exfil-relay.top",
      state: decisionFor("outsider"),
    },
  ];

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <span className="chip chip-lime">
          <ShieldCheck size={11} aria-hidden /> Level {level} · {CONTAINMENT_LADDER[level].label}
        </span>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            disabled={!canApply || level === 0 || pending !== null}
            onClick={() => apply(level - 1)}
            className="btn !h-8 !px-2.5 !text-[10.5px]"
            aria-label="De-escalate containment"
          >
            <ArrowDown size={12} aria-hidden /> De-escalate
          </button>
          <button
            type="button"
            disabled={!canApply || level === 5 || pending !== null}
            onClick={() => apply(level + 1)}
            className="btn btn-orange !h-8 !px-2.5 !text-[10.5px]"
            aria-label="Escalate containment"
          >
            <ArrowUp size={12} aria-hidden /> Escalate
          </button>
        </div>
      </div>

      <ol className="space-y-1">
        {CONTAINMENT_LADDER.map((step) => {
          const active = step.level === level;
          const past = step.level < level;
          return (
            <li key={step.level}>
              <button
                type="button"
                onClick={() => setTarget(step.level)}
                className="flex w-full items-start gap-3 rounded-xl px-2 py-2 text-left transition-colors hover:bg-[var(--panel-soft)]"
                aria-pressed={active}
              >
                <span
                  className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[9px] font-bold"
                  style={{
                    borderColor: active ? "var(--lime)" : past ? "var(--line-strong)" : "var(--line)",
                    background: active ? "var(--lime)" : "transparent",
                    color: active ? "var(--lime-ink)" : "var(--muted)",
                  }}
                >
                  {active || past ? <Check size={10} aria-hidden /> : step.level}
                </span>
                <span className="min-w-0 flex-1">
                  <span className={`block text-[11.5px] font-medium ${active ? "text-[var(--text)]" : "text-[var(--text-soft)]"}`}>
                    {step.label}
                  </span>
                  <span className="mt-0.5 block text-[9.5px] leading-relaxed text-[var(--muted-dim)]">
                    {step.description}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ol>

      <div className="mt-3 rounded-2xl border border-[var(--line)] bg-[var(--panel-soft)] p-3">
        <div className="mb-2 flex items-center justify-between">
          <span className="eyebrow">Dry-run at level {target}</span>
          <span className="text-[9px] text-[var(--muted-dim)]">no changes applied</span>
        </div>
        <ul className="space-y-1">
          {preview.map((item) => {
            const state = item.state;
            return (
              <li key={item.label} className="flex items-center justify-between gap-2 text-[10px]">
                <span className="min-w-0 truncate text-[var(--muted)]" title={item.call}>{item.call}</span>
                <span
                  className={`shrink-0 rounded-full px-1.5 py-0.5 text-[8.5px] font-semibold uppercase ${
                    state === "blocked"
                      ? "bg-[var(--red-soft)] text-[var(--red)]"
                      : state === "approval"
                        ? "bg-[var(--orange-soft)] text-[var(--orange)]"
                        : "bg-[var(--lime-soft)] text-[var(--lime)]"
                  }`}
                >
                  {state}
                </span>
              </li>
            );
          })}
        </ul>
        {canApply ? (
          <>
            <input
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="Reason (audit-logged)"
              maxLength={200}
              aria-label="Containment reason"
              className="mt-3 h-8 w-full rounded-full border border-[var(--line)] bg-[var(--panel)] px-3 text-[10.5px] outline-none focus:border-[var(--line-strong)]"
            />
            <button
              type="button"
              onClick={() => apply(target)}
              disabled={pending !== null || target === level}
              className="btn btn-primary !mt-2 !h-8 w-full !text-[11px]"
            >
              {pending !== null ? <Loader2 size={12} className="animate-spin" aria-hidden /> : null}
              {pending !== null ? "Applying…" : target === level ? "Current level" : `Apply ${CONTAINMENT_LADDER[target].label} to ${agentName}`}
            </button>
          </>
        ) : (
          <p className="mt-2 flex items-center gap-1.5 text-[10px] text-[var(--muted)]">
            <Lock size={11} aria-hidden /> Your role can view but not change containment.
          </p>
        )}
        {error ? <p role="alert" className="mt-2 text-[10.5px] text-[var(--red)]">{error}</p> : null}
        {result?.samples.length ? (
          <div className="mt-2 space-y-1 border-t border-[var(--line)] pt-2">
            {result.samples.map((sample, index) => (
              <p key={index} className="text-[9px] leading-relaxed text-[var(--muted-dim)]">
                <span className={sample.decision.decision === "allow" ? "text-[var(--lime)]" : "text-[var(--orange)]"}>
                  {sample.decision.decision}
                </span>{" "}
                {sample.request.tool ?? sample.request.dataClass ?? sample.request.destination} — {sample.decision.reason}
              </p>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
