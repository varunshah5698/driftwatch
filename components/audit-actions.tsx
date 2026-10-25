"use client";

import { useState } from "react";
import { CheckCircle2, Download, Loader2, ShieldQuestion, XCircle } from "lucide-react";

export function AuditVerify({ initial }: { initial: { valid: boolean; checked: number } }) {
  const [result, setResult] = useState(initial);
  const [pending, setPending] = useState(false);

  const verify = async () => {
    setPending(true);
    const response = await fetch("/api/audit/verify", { cache: "no-store" });
    const payload = (await response.json()) as { valid: boolean; checked: number; brokenAt?: number };
    setPending(false);
    if (response.ok) setResult(payload);
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className={`chip ${result.valid ? "chip-lime" : "chip-red"}`}>
        {result.valid ? <CheckCircle2 size={11} aria-hidden /> : <XCircle size={11} aria-hidden />}
        {result.valid ? `chain valid · ${result.checked} entries` : "chain broken"}
      </span>
      <button type="button" onClick={verify} disabled={pending} className="btn !h-8 !text-[10.5px]">
        {pending ? <Loader2 size={11} className="animate-spin" aria-hidden /> : <ShieldQuestion size={11} aria-hidden />}
        Re-verify
      </button>
    </div>
  );
}

export function ExportMenu({
  type,
  label = "Export",
}: {
  type: "audit" | "alerts" | "events";
  label?: string;
}) {
  return (
    <details className="relative">
      <summary className="btn !h-8 cursor-pointer list-none !text-[10.5px]">
        <Download size={11} aria-hidden /> {label}
      </summary>
      <div className="panel absolute right-0 z-20 mt-2 w-44 p-1.5">
        {[
          { format: "csv", label: "CSV" },
          { format: "json", label: "JSON" },
          { format: "ocsf", label: "OCSF 1.3 (JSON)" },
          { format: "cef", label: "Syslog / CEF" },
        ].map((item) => (
          <a
            key={item.format}
            href={`/api/export?type=${type}&format=${item.format}`}
            className="block rounded-lg px-3 py-2 text-[11px] text-[var(--text-soft)] hover:bg-[var(--panel-hi)]"
          >
            {item.label}
          </a>
        ))}
      </div>
    </details>
  );
}
