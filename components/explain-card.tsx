"use client";

import { useState } from "react";
import { ArrowDown, ArrowUp, Info } from "lucide-react";
import type { Factor } from "@/lib/types";
import { scoreWithFactors } from "@/lib/engine/scoring";

export function ExplainCard({
  explanation,
  factors,
  score,
  confidence,
}: {
  explanation: string;
  factors: Factor[];
  score: number;
  confidence: number;
}) {
  const [mode, setMode] = useState<"summary" | "higher" | "lower">("summary");
  const [selected, setSelected] = useState<string | null>(factors[0]?.key ?? null);
  const active = factors.find((factor) => factor.key === selected) ?? factors[0];
  const withoutTop = scoreWithFactors(
    factors,
    factors.map((factor) => factor.key).filter((key) => key !== factors[0]?.key),
  );
  const positive = factors.filter((factor) => factor.points > 0);
  const quiet = factors.filter((factor) => factor.points === 0);

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-1.5">
        {[
          { id: "summary" as const, label: "Why this fired" },
          { id: "higher" as const, label: "Why not higher?" },
          { id: "lower" as const, label: "Why not lower?" },
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setMode(tab.id)}
            className={`chip transition-colors ${mode === tab.id ? "chip-lime" : "hover:border-[var(--line-strong)]"}`}
            aria-pressed={mode === tab.id}
          >
            {tab.label}
          </button>
        ))}
        <span className="ml-auto inline-flex items-center gap-1.5 text-[9.5px] text-[var(--muted-dim)]">
          <Info size={10} aria-hidden /> calibrated at {Math.round(confidence * 100)}% confidence
        </span>
      </div>

      {mode === "summary" ? (
        <p className="text-[12px] leading-relaxed text-[var(--text-soft)]">{explanation}</p>
      ) : null}

      {mode === "higher" ? (
        <div className="space-y-2 text-[11.5px] leading-relaxed text-[var(--text-soft)]">
          <p>
            The strongest contribution is <span className="text-[var(--orange)]">{factors[0]?.label}</span> at{" "}
            <span className="metric-sm font-semibold">{factors[0]?.points} pts</span>. If that evidence were
            absent, the score would fall to about{" "}
            <span className="font-semibold text-[var(--lime)]">{withoutTop}/100</span>.
          </p>
          <p className="text-[var(--muted)]">
            The score is not higher because {quiet.length > 0 ? `${quiet.map((factor) => factor.label.toLowerCase()).join(", ")} show no signal` : "all six detectors are already contributing"}
            , and the weighted-logistic calibration keeps a single moderate signal below the review
            threshold. Evidence must co-occur to reach Critical.
          </p>
          <p className="text-[var(--muted-dim)]">
            Even at the current score, the alert is above the {score >= 85 ? "Critical" : "review"} band with{" "}
            {positive.length} of 6 detectors active.
          </p>
        </div>
      ) : null}

      {mode === "lower" ? (
        <div className="space-y-2 text-[11.5px] leading-relaxed text-[var(--text-soft)]">
          <p>
            The score is not lower because {positive.length} independent signals agree:{" "}
            {positive.map((factor) => `${factor.label.toLowerCase()} (${factor.points} pts)`).join(", ")}.
          </p>
          <p className="text-[var(--muted)]">
            {factors[0]?.detail} The observed values depart from the declared manifest and the learned
            baseline, not just from a static threshold.
          </p>
          <p className="text-[var(--muted-dim)]">
            To lower this alert, an analyst would need a matching approved change event and no
            restricted data, canary or egress evidence. Neither condition holds here.
          </p>
        </div>
      ) : null}

      <div className="mt-4 space-y-1.5">
        {factors.map((factor) => {
          const isActive = active?.key === factor.key;
          return (
            <button
              key={factor.key}
              type="button"
              onClick={() => setSelected(factor.key)}
              className={`flex w-full items-center gap-2 rounded-xl border px-2.5 py-2 text-left transition-colors ${
                isActive ? "border-[var(--line-strong)] bg-[var(--panel-hi)]" : "border-transparent hover:bg-[var(--panel-soft)]"
              }`}
              aria-expanded={isActive}
            >
              <span
                className="h-1.5 w-1.5 rounded-full"
                style={{ background: factor.points > 0 ? "var(--orange)" : "var(--line-strong)" }}
              />
              <span className="flex-1 text-[10.5px] text-[var(--text-soft)]">{factor.label}</span>
              <span className="metric-sm text-[9.5px] text-[var(--muted-dim)]">{factor.observed.slice(0, 48)}</span>
              <span className="metric-sm w-10 text-right text-[10px] font-semibold">{factor.points}</span>
              {factor.points > 0 ? <ArrowUp size={11} className="text-[var(--orange)]" aria-hidden /> : <ArrowDown size={11} className="text-[var(--muted-dim)]" aria-hidden />}
            </button>
          );
        })}
      </div>
      {active ? (
        <div className="mt-2 rounded-xl border border-[var(--line)] bg-[var(--panel-soft)] p-3">
          <p className="text-[10.5px] leading-relaxed text-[var(--text-soft)]">{active.detail}</p>
          <div className="mt-2 grid gap-1 text-[9.5px] sm:grid-cols-2">
            <p className="text-[var(--muted)]"><span className="text-[var(--muted-dim)]">Observed:</span> {active.observed}</p>
            <p className="text-[var(--muted)]"><span className="text-[var(--muted-dim)]">Expected:</span> {active.expected}</p>
          </div>
        </div>
      ) : null}
    </div>
  );
}
