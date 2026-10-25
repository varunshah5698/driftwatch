import { NextResponse } from "next/server";
import { guard } from "@/lib/auth/api";
import { isSameOrigin, jsonError } from "@/lib/http";
import { getStore } from "@/lib/store";

const csvEscape = (value: unknown): string => {
  const text = String(value ?? "");
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

const toCsv = (rows: Record<string, unknown>[]): string => {
  if (rows.length === 0) return "";
  const headers = Object.keys(rows[0]);
  return [
    headers.join(","),
    ...rows.map((row) => headers.map((header) => csvEscape(row[header])).join(",")),
  ].join("\n");
};

export async function GET(request: Request) {
  if (!isSameOrigin(request)) return jsonError("Cross-origin request rejected", 403);
  const auth = await guard();
  if ("response" in auth) return auth.response;
  const url = new URL(request.url);
  const type = url.searchParams.get("type") ?? "alerts";
  const format = url.searchParams.get("format") ?? "json";
  const store = getStore();

  let rows: Record<string, unknown>[] = [];
  if (type === "alerts") {
    rows = store.alerts.map((alert) => ({
      id: alert.id,
      agentId: alert.agentId,
      agent: alert.agentName,
      ts: alert.ts,
      score: alert.score,
      severity: alert.severity,
      status: alert.status,
      classification: alert.classification ?? "",
      title: alert.title,
      topFactor: alert.factors[0]?.key ?? "",
      taintSource: alert.evidence.taint?.sourceName ?? "",
    }));
  } else if (type === "audit") {
    rows = store.audit.map((entry) => ({
      seq: entry.seq,
      at: entry.at,
      actor: entry.actor,
      actorType: entry.actorType,
      action: entry.action,
      target: entry.target,
      detail: entry.detail,
      prevHash: entry.prevHash,
      hash: entry.hash,
    }));
  } else if (type === "events") {
    rows = store.events.slice(-5000).map((event) => ({
      id: event.id,
      ts: event.ts,
      agentId: event.agentId,
      sessionId: event.sessionId,
      type: event.type,
      action: event.action ?? "",
      tool: event.tool ?? "",
      dataClass: event.dataClass ?? "",
      destination: event.destination ?? "",
      bytes: event.bytes ?? "",
      trust: event.trust ?? "",
      canary: event.canary ? "true" : "false",
      summary: event.summary,
    }));
  } else {
    return jsonError("Unknown export type", 422);
  }

  let body: string;
  let contentType: string;
  if (format === "csv") {
    body = toCsv(rows);
    contentType = "text/csv; charset=utf-8";
  } else if (format === "ocsf") {
    body = JSON.stringify(
      {
        metadata: { version: "1.3.0", product: { name: "Driftwatch", vendor_name: "Driftwatch" } },
        findings: store.alerts.map((alert) => ({
          class_uid: 2004,
          class_name: "Detection Finding",
          activity_id: 1,
          severity_id: { critical: 5, high: 4, medium: 3, low: 2, info: 1 }[alert.severity],
          time: new Date(alert.ts).getTime(),
          finding_info: { uid: alert.id, title: alert.title },
          resources: [{ uid: alert.agentId, name: alert.agentName, type: "ai_agent" }],
          risk_score: alert.score,
          status_id: alert.status === "resolved" ? 4 : 1,
          evidence: alert.factors.map((factor) => ({
            name: factor.label,
            value: factor.points,
            observed: factor.observed,
          })),
        })),
      },
      null,
      2,
    );
    contentType = "application/json";
  } else if (format === "cef") {
    body = store.alerts
      .map((alert) => {
        const severity = { critical: 10, high: 8, medium: 5, low: 3, info: 1 }[alert.severity];
        const extension = [
          `src=${alert.agentId}`,
          `suser=${alert.agentName.replace(/\s/g, "_")}`,
          `cs1=${alert.score}`,
          `cs1Label=RoleAlignmentRisk`,
          `cs2=${alert.factors[0]?.key ?? ""}`,
          `cs2Label=TopFactor`,
          `msg=${alert.title}`,
        ].join(" ");
        return `CEF:0|Driftwatch|Identity Drift|1.0|${alert.severity.toUpperCase()}|${alert.title}|${severity}|${extension}`;
      })
      .join("\n");
    contentType = "text/plain; charset=utf-8";
  } else {
    body = JSON.stringify(rows, null, 2);
    contentType = "application/json";
  }

  return new NextResponse(body, {
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": `attachment; filename="driftwatch-${type}-${new Date().toISOString().slice(0, 10)}.${format === "csv" ? "csv" : format === "cef" ? "cef" : "json"}"`,
      "Cache-Control": "no-store",
    },
  });
}
