"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Pause, Play, Radio, Wifi } from "lucide-react";
import type { MonitorEvent } from "@/lib/types";
import { formatTime } from "@/lib/format";

export function MonitorFeed({ initialEvents }: { initialEvents: MonitorEvent[] }) {
  const [events, setEvents] = useState<MonitorEvent[]>(initialEvents);
  const [paused, setPaused] = useState(false);
  const [connected, setConnected] = useState(true);
  const [ticker, setTicker] = useState<
    { id: string; name: string; alignment: number; status: string }[]
  >([]);
  const [polls, setPolls] = useState(0);
  const pausedRef = useRef(paused);
  pausedRef.current = paused;

  const poll = useCallback(async () => {
    if (pausedRef.current) return;
    try {
      const response = await fetch("/api/monitor", { cache: "no-store" });
      if (!response.ok) {
        setConnected(false);
        return;
      }
      const payload = (await response.json()) as {
        events: MonitorEvent[];
        ticker: { id: string; name: string; alignment: number; status: string }[];
      };
      setConnected(true);
      setTicker(payload.ticker);
      setEvents((current) => {
        const seen = new Set(current.map((event) => event.id));
        const fresh = payload.events.filter((event) => !seen.has(event.id));
        return [...fresh.reverse(), ...current].slice(0, 48);
      });
      setPolls((value) => value + 1);
    } catch {
      setConnected(false);
    }
  }, []);

  useEffect(() => {
    void poll();
    const timer = setInterval(() => void poll(), 3500);
    return () => clearInterval(timer);
  }, [poll]);

  return (
    <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_300px]">
      <div className="panel overflow-hidden">
        <div className="flex flex-wrap items-center gap-2 border-b border-[var(--line)] px-4 py-3">
          <span className="flex items-center gap-2 text-[11px] font-medium">
            <Radio size={13} className="text-[var(--lime)]" aria-hidden /> Live ingestion
          </span>
          <span className={`chip ${connected && !paused ? "chip-lime" : "chip-orange"} !text-[9px]`}>
            <span className={`h-1.5 w-1.5 rounded-full ${connected && !paused ? "live-dot" : ""} ${connected ? "bg-[var(--lime)]" : "bg-[var(--orange)]"}`} />
            {!connected ? "reconnecting" : paused ? "paused" : "streaming"}
          </span>
          <span className="text-[9.5px] text-[var(--muted-dim)]">
            {events.length} events · {polls} polls · signed HMAC
          </span>
          <button
            type="button"
            onClick={() => setPaused((value) => !value)}
            className="btn !ml-auto !h-8 !px-3 !text-[10.5px]"
            aria-pressed={paused}
          >
            {paused ? <Play size={11} aria-hidden /> : <Pause size={11} aria-hidden />}
            {paused ? "Resume" : "Pause"}
          </button>
        </div>
        <div className="max-h-[520px] min-h-[420px] overflow-y-auto">
          {events.length === 0 ? (
            <p className="px-4 py-16 text-center text-[11px] text-[var(--muted)]">Waiting for the first signed event…</p>
          ) : (
            <ul className="divide-y divide-[var(--line)]">
              {events.map((event) => (
                <li key={event.id} className="animate-in flex items-start gap-3 px-4 py-2.5">
                  <span className="metric-sm mt-0.5 w-[46px] shrink-0 text-[9px] text-[var(--muted-dim)]">
                    {formatTime(event.ts)}
                  </span>
                  <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: event.trust === "untrusted" ? "var(--orange)" : "var(--lime)" }} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                      <span className="text-[11px] font-medium text-[var(--text)]">{event.agentName}</span>
                      <span className="text-[9px] uppercase tracking-[0.08em] text-[var(--muted-dim)]">
                        {event.type.replace(".", " ")}
                      </span>
                      {event.trust === "untrusted" ? <span className="chip chip-orange !px-1.5 !py-0 !text-[8px]">untrusted</span> : null}
                      {event.canary ? <span className="chip chip-red !px-1.5 !py-0 !text-[8px]">canary</span> : null}
                    </div>
                    <p className="truncate text-[10.5px] text-[var(--muted)]" title={event.summary}>{event.summary}</p>
                  </div>
                  <span className="metric-sm shrink-0 text-[9px] text-[var(--muted-dim)]">
                    {event.alignment}% aligned
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="flex items-center justify-between border-t border-[var(--line)] px-4 py-2 text-[9px] text-[var(--muted-dim)]">
          <span className="inline-flex items-center gap-1.5"><Wifi size={10} aria-hidden /> polling every 3.5s · backpressure aware</span>
          <span>redaction at edge · no raw content</span>
        </div>
      </div>

      <div className="space-y-3">
        <div className="panel p-4">
          <p className="eyebrow mb-3">Alignment ticker</p>
          {ticker.length === 0 ? (
            <p className="text-[10px] text-[var(--muted)]">All clear — no agent has an open alert.</p>
          ) : (
            <ul className="space-y-2">
              {ticker.map((agent) => (
                <li key={agent.id} className="flex items-center gap-2">
                  <span className="min-w-0 flex-1 truncate text-[10.5px] text-[var(--text-soft)]">{agent.name}</span>
                  <span className="h-1 w-16 overflow-hidden rounded-full bg-[var(--line)]">
                    <span
                      className="block h-full rounded-full"
                      style={{ width: `${agent.alignment}%`, background: agent.alignment < 30 ? "var(--red)" : "var(--orange)" }}
                    />
                  </span>
                  <span className="metric-sm w-6 text-right text-[10px] font-semibold">{agent.alignment}</span>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-3 border-t border-[var(--line)] pt-2 text-[9px] text-[var(--muted-dim)]">
            Scores refresh as new events arrive. Values are role alignment, not uptime.
          </p>
        </div>

        <div className="panel p-4">
          <p className="eyebrow mb-2">Stream controls</p>
          <dl className="space-y-2 text-[10px]">
            {[
              ["transport", "HTTPS / poll"],
              ["signature", "HMAC-SHA256"],
              ["replay window", "5 minutes"],
              ["idempotency", "x-idempotency-key"],
              ["retention", "raw 24h · hashes 400d"],
            ].map(([label, value]) => (
              <div key={label} className="flex items-center justify-between gap-3">
                <dt className="text-[var(--muted-dim)]">{label}</dt>
                <dd className="text-right text-[var(--text-soft)]">{value}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
    </div>
  );
}
