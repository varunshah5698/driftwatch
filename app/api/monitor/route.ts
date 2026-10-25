import { NextResponse } from "next/server";
import { guard } from "@/lib/auth/api";
import { emitLiveEvents, getStore } from "@/lib/store";
import { jsonError, noStore } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await guard();
  if ("response" in auth) return auth.response;
  const store = getStore();
  const emitted = emitLiveEvents(4);
  const agents = new Map(store.agents.map((agent) => [agent.id, agent]));
  const events = emitted.map((event) => ({
    ...event,
    agentName: agents.get(event.agentId)?.name ?? event.agentId,
    alignment: agents.get(event.agentId)?.alignment ?? 100,
  }));

  return noStore(
    NextResponse.json({
      events,
      serverTime: new Date().toISOString(),
      ticker: store.agents
        .filter((agent) => agent.openAlerts > 0)
        .sort((a, b) => a.alignment - b.alignment)
        .slice(0, 6)
        .map((agent) => ({
          id: agent.id,
          name: agent.name,
          alignment: agent.alignment,
          status: agent.status,
        })),
      openAlerts: store.alerts.filter((alert) =>
        ["open", "acknowledged", "escalated"].includes(alert.status),
      ).length,
    }),
  );
}
