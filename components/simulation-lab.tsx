"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, Download, Loader2, Play, ShieldAlert, ShieldCheck } from "lucide-react";
import type { Scenario, SimulationResult } from "@/lib/types";
import type { SimulationSummary } from "@/lib/engine/simulate";
import { SCENARIOS } from "@/lib/engine/simulate";
import { relativeTime } from "@/lib/format";

export function SimulationLab({
  initialResults,
  initialSummary,
  canRun,
}: {
  initialResults: SimulationResult[];
  initialSummary: SimulationSummary;
  canRun: boolean;
}) {
  const [results, setResults] = useState(initialResults);
  const [summary, setSummary] = useState(initialSummary);
  const [selectedId, setSelectedId] = useState(
    initialResults.find((result) => result.kind === "attack")?.scenarioId ??
      initialResults[0]?.scenarioId,
  );
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastRun, setLastRun] = useState<string | null>(null);

  const selected = results.find((result) => result.scenarioId === selectedId);
  const scenario = SCENARIOS.find((item) => item.id === selectedId);

  const run = async () => {
    setRunning(true);
    setError(null);
    const response = await fetch("/api/simulation", { method: "POST" });
    const payload = (await response.json()) as {
      results?: SimulationResult[];
      summary?: SimulationSummary;
      error?: string;
      ranAt?: string;
    };
    setRunning(false);
    if (!response.ok || !payload.results || !payload.summary) {
      setError(payload.error ?? "Simulation failed");
      return;
    }
    setResults(payload.results);
    setSummary(payload.summary);
    setLastRun(payload.ranAt ?? new Date().toISOString());
  };

  const download = () => {
    const blob = new Blob(
      [
        JSON.stringify(
          {
            generatedAt: new Date().toISOString(),
            summary,
            scenarios: SCENARIOS,
            results,
          },
          null,
          2,
        ),
      ],
      { type: "application/json" },
    );
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `driftwatch-simulation-${new Date().toISOString().slice(0, 10)}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      <div className="mb-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "Precision", value: `${Math.round(summary.precision * 100)}%`, note: `${summary.truePositives} TP / ${summary.falsePositives} FP` },
          { label: "Recall", value: `${Math.round(summary.recall * 100)}%`, note: `${summary.truePositives} of ${summary.truePositives + summary.falseNegatives} attack scenarios` },
          { label: "False positive rate", value: `${(summary.falsePositiveRate * 100).toFixed(1)}%`, note: `${summary.falsePositives} of ${summary.trueNegatives + summary.falsePositives} benign` },
          { label: "Mean latency", value: `${summary.meanLatencySteps.toFixed(1)} steps`, note: `${Math.round(summary.meanLatencyMs / 1000)}s of telemetry` },
        ].map((metric) => (
          <div key={metric.label} className="panel px-4 py-3.5">
            <p className="eyebrow">{metric.label}</p>
            <p className="kpi-num mt-3 text-[30px]">{metric.value}</p>
            <p className="mt-1 text-[9px] text-[var(--muted-dim)]">{metric.note}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-3 xl:grid-cols-[330px_minmax(0,1fr)]">
        <div className="panel">
          <div className="flex items-center justify-between border-b border-[var(--line)] px-4 py-3">
            <span className="eyebrow">Scenario suite</span>
            <span className="text-[9px] text-[var(--muted-dim)]">{results.length} runs</span>
          </div>
          <ul className="p-2">
            {SCENARIOS.map((item) => {
              const result = results.find((candidate) => candidate.scenarioId === item.id);
              const active = selectedId === item.id;
              return (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedId(item.id)}
                    className={`mb-0.5 flex w-full items-start gap-2 rounded-2xl border px-3 py-2.5 text-left transition-colors ${
                      active ? "border-[var(--line-strong)] bg-[var(--panel-hi)]" : "border-transparent hover:bg-[var(--panel-soft)]"
                    }`}
                  >
                    <span
                      className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${
                        result?.verdict === "detected" && item.kind === "attack"
                          ? "bg-[var(--red-soft)] text-[var(--red)]"
                          : result?.verdict === "clean"
                            ? "bg-[var(--lime-soft)] text-[var(--lime)]"
                            : result?.verdict === "missed"
                              ? "bg-[var(--orange-soft)] text-[var(--orange)]"
                              : "bg-[var(--panel-soft)] text-[var(--muted)]"
                      }`}
                    >
                      {item.kind === "attack" ? <ShieldAlert size={10} aria-hidden /> : <ShieldCheck size={10} aria-hidden />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[10.5px] font-medium text-[var(--text-soft)]">{item.name}</span>
                      <span className="mt-0.5 flex items-center gap-1.5 text-[8.5px] text-[var(--muted-dim)]">
                        {item.kind} · {result?.latencySteps ?? 0} steps · max {result?.metrics.maxScore ?? 0}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
          <div className="border-t border-[var(--line)] p-3">
            <button
              type="button"
              onClick={run}
              disabled={running || !canRun}
              className="btn btn-primary w-full"
              title={canRun ? "Run every scenario against the live engine" : "Your role cannot run simulations"}
            >
              {running ? <Loader2 size={13} className="animate-spin" aria-hidden /> : <Play size={13} aria-hidden />}
              {running ? "Running against engine…" : "Run full suite"}
            </button>
            <button type="button" onClick={download} className="btn mt-1.5 w-full !text-[11px]">
              <Download size={12} aria-hidden /> Download results
            </button>
            {lastRun ? <p className="mt-2 text-center text-[8.5px] text-[var(--muted-dim)]">ran {relativeTime(lastRun)}</p> : null}
            {error ? <p role="alert" className="mt-2 text-[9.5px] text-[var(--red)]">{error}</p> : null}
          </div>
        </div>

        {selected ? (
          <div className="panel">
            <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[var(--line)] p-5">
              <div>
                <p className="eyebrow mb-1.5">{selected.kind === "attack" ? "Adversarial scenario" : "Benign scenario"}</p>
                <h2 className="display-tight text-[24px] uppercase">{selected.scenarioName}</h2>
                <p className="mt-2 max-w-[62ch] text-[11px] leading-relaxed text-[var(--muted)]">
                  {scenario?.description}
                </p>
              </div>
              <span
                className={`chip ${selected.verdict === "detected" && selected.kind === "attack" ? "chip-red" : selected.verdict === "clean" ? "chip-lime" : "chip-orange"}`}
              >
                {selected.verdict}
              </span>
            </div>

            <div className="grid gap-3 p-5 sm:grid-cols-4">
              {[
                ["max score", String(selected.metrics.maxScore)],
                ["detection", selected.latencySteps ? `${selected.latencySteps} steps` : selected.kind === "benign" ? "none" : "missed"],
                ["latency", selected.latencyMs ? `${Math.round(selected.latencyMs / 1000)}s` : "—"],
                ["alert", selected.alert ? selected.alert.severity : "—"],
              ].map(([label, value]) => (
                <div key={label} className="rounded-2xl border border-[var(--line)] bg-[var(--panel-soft)] px-3 py-2.5">
                  <p className="metric-sm text-[17px] font-semibold">{value}</p>
                  <p className="text-[8.5px] uppercase tracking-wide text-[var(--muted-dim)]">{label}</p>
                </div>
              ))}
            </div>

            <div className="px-5">
              <p className="eyebrow mb-2">Detection timeline · threshold {50}</p>
              <div className="relative rounded-2xl border border-[var(--line)] bg-[var(--panel-soft)] p-3">
                {/* Fixed-width bars: `flex-1` would stretch six steps into
                    150px slabs. The leftover width pools into the trailing
                    gutter so the bars keep a capsule proportion. */}
                <div
                  className="flex items-end gap-[9px] px-1"
                  style={{ height: 110 }}
                  role="img"
                  aria-label="Score per scenario step"
                >
                  {selected.log.map((step) => (
                    <span
                      key={step.step}
                      className="w-[16px] shrink-0 rounded-t-[8px]"
                      style={{
                        height: `${Math.max(2, step.score)}%`,
                        background: step.predicted
                          ? "var(--red)"
                          : step.score > 35
                            ? "var(--orange)"
                            : "var(--lime)",
                        opacity: step.predicted ? 1 : 0.6,
                      }}
                      title={`Step ${step.step} · ${step.description} · score ${step.score}`}
                    />
                  ))}
                </div>
                <div className="absolute inset-x-3 top-1/2 border-t border-dashed border-[var(--red)]/50">
                  <span className="absolute -top-2 right-0 bg-[var(--panel-soft)] px-1 text-[8px] text-[var(--red)]">review threshold</span>
                </div>
                <div className="mt-2 flex justify-between text-[8px] text-[var(--muted-dim)]">
                  <span>step 1</span>
                  <span>each bar = one signed event</span>
                  <span>step {selected.log.length}</span>
                </div>
              </div>
            </div>

            <div className="px-5 py-4">
              <p className="eyebrow mb-2">Step log</p>
              <div className="max-h-[260px] overflow-y-auto rounded-2xl border border-[var(--line)]">
                <table className="w-full border-collapse text-left">
                  <thead className="sticky top-0 bg-[var(--panel)]">
                    <tr className="border-b border-[var(--line)] text-[8px] uppercase tracking-wide text-[var(--muted-dim)]">
                      <th className="px-3 py-2 font-medium">#</th>
                      <th className="px-3 py-2 font-medium">Event</th>
                      <th className="px-3 py-2 font-medium">Score</th>
                      <th className="px-3 py-2 font-medium">State</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selected.log.map((step) => (
                      <tr key={step.step} className="border-b border-[var(--line)] text-[9.5px] last:border-0">
                        <td className="px-3 py-1.5 text-[var(--muted-dim)]">{step.step}</td>
                        <td className="max-w-[280px] truncate px-3 py-1.5 text-[var(--text-soft)]" title={step.description}>{step.description}</td>
                        <td className="px-3 py-1.5 metric-sm">{step.score}</td>
                        <td className="px-3 py-1.5">
                          <span className={step.predicted ? "text-[var(--red)]" : step.suppressed ? "text-[var(--violet)]" : "text-[var(--muted-dim)]"}>
                            {step.predicted ? "above threshold" : step.suppressed ? "change-managed" : "quiet"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {selected.alert ? (
              <div className="mx-5 mb-5 rounded-2xl border border-[var(--line)] bg-[var(--panel-soft)] p-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="eyebrow mb-1">Produced alert</p>
                    <p className="text-[11.5px] font-medium">{selected.alert.title}</p>
                    <p className="mt-1 line-clamp-2 text-[10px] text-[var(--muted)]">{selected.alert.explanation}</p>
                  </div>
                  <Link href={`/alerts?alert=${selected.alert.id}`} className="btn !h-8 shrink-0 !text-[10px]">
                    Open <ArrowRight size={11} aria-hidden />
                  </Link>
                </div>
              </div>
            ) : null}
          </div>
        ) : (
          <div className="panel flex items-center justify-center p-10 text-[12px] text-[var(--muted)]">
            Select a scenario to inspect its detection timeline.
          </div>
        )}
      </div>
    </div>
  );
}
