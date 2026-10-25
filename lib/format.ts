export const formatDate = (iso: string): string =>
  new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    timeZone: "UTC",
  }).format(new Date(iso));

export const formatDateTime = (iso: string): string =>
  new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
    hour12: false,
  }).format(new Date(iso));

export const formatTime = (iso: string): string =>
  new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
    hour12: false,
  }).format(new Date(iso));

export const formatHour = (hour: number): string =>
  `${String(hour % 24).padStart(2, "0")}:00`;

export function relativeTime(iso: string, now = Date.now()): string {
  const diff = now - new Date(iso).getTime();
  const minutes = Math.round(diff / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days}d ago`;
  return formatDate(iso);
}

export const compact = (value: number): string =>
  new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(value);

export const pct = (value: number, digits = 0): string => `${value.toFixed(digits)}%`;

export function duration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.round(ms / 60_000)}m`;
}

export const scoreColor = (score: number): string =>
  score >= 85
    ? "var(--red)"
    : score >= 70
      ? "var(--orange)"
      : score >= 50
        ? "var(--orange)"
        : "var(--lime)";

export const severityColor = (severity: string): string =>
  severity === "critical"
    ? "var(--red)"
    : severity === "high"
      ? "var(--orange)"
      : severity === "medium"
        ? "var(--orange)"
        : "var(--lime)";
