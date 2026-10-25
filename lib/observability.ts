/**
 * Minimal, dependency-free observability primitives.
 *
 * Logs are single-line JSON so a collector can parse stdout without a parser
 * plugin. Metrics are exposed in Prometheus text format by /api/metrics. The
 * application deliberately keeps telemetry payloads small: no prompts, raw
 * documents, tokens or email addresses are logged.
 */

type Level = "debug" | "info" | "warn" | "error";

export interface LogFields {
  [key: string]: string | number | boolean | undefined;
}

const REDACTED_KEYS = new Set([
  "password",
  "authorization",
  "cookie",
  "token",
  "secret",
  "rawcontent",
  "prompt",
  "email",
]);

/** Drop known-sensitive keys at any depth before a record reaches stdout. */
export function redactFields(fields: LogFields): LogFields {
  const result: LogFields = {};
  for (const [key, value] of Object.entries(fields)) {
    if (REDACTED_KEYS.has(key.toLowerCase())) {
      result[key] = "[redacted]";
    } else if (typeof value === "string" && value.length > 500) {
      result[key] = `${value.slice(0, 500)}…`;
    } else {
      result[key] = value;
    }
  }
  return result;
}

export function log(level: Level, event: string, fields: LogFields = {}): void {
  const record = {
    ts: new Date().toISOString(),
    level,
    event,
    service: "driftwatch",
    ...redactFields(fields),
  };
  const line = JSON.stringify(record);
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

/** Start a monotonic timer for latency fields. */
export function timer(): () => number {
  const start = performance.now();
  return () => Math.round(performance.now() - start);
}

export function prometheusEscape(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/"/g, '\\"');
}

export function metric(
  name: string,
  value: number,
  help: string,
  type: "gauge" | "counter" = "gauge",
  labels: Record<string, string> = {},
): string {
  const labelText = Object.entries(labels)
    .map(([key, label]) => `${key}="${prometheusEscape(label)}"`)
    .join(",");
  const suffix = labelText ? `{${labelText}}` : "";
  return [
    `# HELP ${name} ${help}`,
    `# TYPE ${name} ${type}`,
    `${name}${suffix} ${Number.isFinite(value) ? value : 0}`,
  ].join("\n");
}
