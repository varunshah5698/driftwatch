"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronRight, Loader2, ShieldAlert, X } from "lucide-react";
import type { AlertClassification } from "@/lib/types";

export function AlertActions({
  alertId,
  status,
  classification,
  canTriage,
  agentId,
}: {
  alertId: string;
  status: string;
  classification?: AlertClassification;
  canTriage: boolean;
  agentId: string;
}) {
  const router = useRouter();
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const act = async (action: string, payload: Record<string, unknown> = {}) => {
    if (!canTriage) return;
    setPending(action);
    setError(null);
    const response = await fetch(`/api/alerts/${alertId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action, ...payload }),
    });
    setPending(null);
    if (!response.ok) {
      const parsed = (await response.json().catch(() => ({}))) as { error?: string };
      setError(parsed.error ?? "Action failed");
      return;
    }
    router.refresh();
  };

  return (
    <div>
      <div className="flex flex-wrap items-center gap-1.5">
        <button
          type="button"
          disabled={!canTriage || pending !== null || status === "acknowledged"}
          onClick={() => act("acknowledge")}
          className="btn !h-8 !px-3 !text-[10.5px]"
        >
          {pending === "acknowledge" ? <Loader2 size={12} className="animate-spin" aria-hidden /> : <Check size={12} aria-hidden />}
          Acknowledge
        </button>
        <button
          type="button"
          disabled={!canTriage || pending !== null}
          onClick={() => act("classify", { classification: "true_positive" })}
          className="btn !h-8 !px-3 !text-[10.5px]"
        >
          <ShieldAlert size={12} aria-hidden /> True positive
        </button>
        <button
          type="button"
          disabled={!canTriage || pending !== null}
          onClick={() => act("classify", { classification: "false_positive" })}
          className="btn !h-8 !px-3 !text-[10.5px]"
        >
          <X size={12} aria-hidden /> False positive
        </button>
        <button
          type="button"
          disabled={!canTriage || pending !== null}
          onClick={() => act("classify", { classification: "benign_change" })}
          className="btn !h-8 !px-3 !text-[10.5px]"
        >
          Benign change
        </button>
        <button
          type="button"
          disabled={!canTriage || pending !== null}
          onClick={() => act("escalate")}
          className="btn btn-danger !h-8 !px-3 !text-[10.5px]"
        >
          Escalate
        </button>
        <a href={`/agents/${agentId}`} className="btn !h-8 !px-3 !text-[10.5px]">
          Contain agent <ChevronRight size={12} aria-hidden />
        </a>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2 text-[9.5px]">
        <span className="text-[var(--muted-dim)]">
          Disposition:
          <span className="ml-1 text-[var(--text-soft)]">
            {classification ? classification.replace("_", " ") : status}
          </span>
        </span>
        {!canTriage ? <span className="text-[var(--orange)]">read-only role</span> : null}
        {error ? <span role="alert" className="text-[var(--red)]">{error}</span> : null}
      </div>
    </div>
  );
}
