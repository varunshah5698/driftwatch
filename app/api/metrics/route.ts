import { metric, prometheusEscape } from "@/lib/observability";
import { getStore, overview } from "@/lib/store";

export const dynamic = "force-dynamic";

/**
 * Prometheus scrape endpoint. Protect it with METRICS_TOKEN in deployments
 * where the scraper reaches the app over a shared network.
 */
export async function GET(request: Request) {
  const expected = process.env.METRICS_TOKEN;
  if (expected) {
    const provided = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
    if (provided !== expected) {
      return new Response("Unauthorized\n", { status: 401 });
    }
  }

  const store = getStore();
  const summary = overview();
  const lines: string[] = [];

  lines.push(metric("driftwatch_up", 1, "1 when the application is serving requests."));
  lines.push(
    metric("driftwatch_agents_active", summary.activeAgents, "Agents currently active or learning."),
  );
  lines.push(
    metric("driftwatch_agents_at_risk", summary.agentsAtRisk, "Agents with open alerts or containment."),
  );
  lines.push(
    metric("driftwatch_events_total", store.events.length, "Telemetry events retained in the runtime store.", "counter"),
  );
  lines.push(
    metric("driftwatch_alerts_open", summary.openAlerts, "Alerts awaiting triage."),
  );
  lines.push(
    metric("driftwatch_incidents_open", summary.openIncidents, "Open incidents."),
  );
  lines.push(
    metric("driftwatch_fleet_alignment", summary.fleetAlignment, "Fleet-wide role alignment (0-100)."),
  );
  lines.push(
    metric("driftwatch_false_positive_rate", summary.falsePositiveRate, "Analyst-labelled false positive rate, percent."),
  );
  lines.push(
    metric("driftwatch_detection_p50_seconds", summary.detectionP50Seconds, "Median detection latency in seconds."),
  );
  lines.push(
    metric("driftwatch_audit_entries", store.audit.length, "Hash-chained audit entries.", "counter"),
  );

  for (const agent of store.agents) {
    const labels = { agent: prometheusEscape(agent.id), environment: agent.environment };
    lines.push(
      metric("driftwatch_agent_alignment", agent.alignment, "Per-agent role alignment (0-100).", "gauge", labels),
    );
    lines.push(
      metric(
        "driftwatch_agent_containment_level",
        agent.containment,
        "Current containment ladder level (0-5).",
        "gauge",
        labels,
      ),
    );
    lines.push(
      metric("driftwatch_agent_open_alerts", agent.openAlerts, "Open alerts per agent.", "gauge", labels),
    );
  }

  return new Response(`${lines.join("\n")}\n`, {
    headers: {
      "Content-Type": "text/plain; version=0.0.4; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
