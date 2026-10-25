import { NextResponse } from "next/server";
import { verifyAuditChain } from "@/lib/engine/audit";
import { getStore } from "@/lib/store";

export const dynamic = "force-dynamic";

const startedAt = Date.now();

export async function GET() {
  const store = getStore();
  const audit = verifyAuditChain(store.audit);
  const ready = store.agents.length > 0 && audit.valid;
  return NextResponse.json(
    {
      status: ready ? "ok" : "degraded",
      version: "1.0.0",
      uptimeSeconds: Math.round((Date.now() - startedAt) / 1000),
      checks: {
        store: { ready: store.agents.length > 0, agents: store.agents.length },
        auditChain: { ready: audit.valid, entries: audit.checked },
        ingestion: { ready: true, hmac: "required" },
      },
    },
    {
      status: ready ? 200 : 503,
      headers: { "Cache-Control": "no-store, private" },
    },
  );
}
