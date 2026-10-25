import type { ChangeEvent, ChangePoint } from "@/lib/types";
import { formatDate } from "@/lib/format";

export function ConfidenceChart({
  series,
  confidence,
  changePoints,
  changes,
  height = 220,
}: {
  series: { t: string; score: number }[];
  confidence: number;
  changePoints: ChangePoint[];
  changes: ChangeEvent[];
  height?: number;
}) {
  if (series.length === 0) {
    return <p className="py-10 text-center text-[11px] text-[var(--muted)]">No baseline series yet.</p>;
  }
  const width = 720;
  const margin = { left: 30, right: 12, top: 18, bottom: 26 };
  const innerW = width - margin.left - margin.right;
  const innerH = height - margin.top - margin.bottom;
  const x = (index: number) => margin.left + (index / Math.max(series.length - 1, 1)) * innerW;
  const y = (value: number) => margin.top + innerH - (value / 100) * innerH;
  const band = Math.max(3, (1 - confidence) * 38);
  const points: [number, number][] = series.map((point, index) => [x(index), y(point.score)]);
  const line = points
    .map(([cx, cy], index) => {
      if (index === 0) return `M${cx} ${cy}`;
      const [px, py] = points[index - 1];
      const mid = (px + cx) / 2;
      return `C${mid} ${py}, ${mid} ${cy}, ${cx} ${cy}`;
    })
    .join(" ");
  const upper = series.map((point, index) => [x(index), y(Math.min(100, point.score + band))] as [number, number]);
  const lower = series.map((point, index) => [x(index), y(Math.max(0, point.score - band))] as [number, number]);
  const bandPath = [
    `M${upper[0][0]} ${upper[0][1]}`,
    ...upper.slice(1).map(([cx, cy]) => `L${cx} ${cy}`),
    ...lower
      .slice()
      .reverse()
      .map(([cx, cy]) => `L${cx} ${cy}`),
    "Z",
  ].join(" ");

  const changePointIndex = (at: string) => {
    const target = new Date(at).getTime();
    let best = 0;
    let distance = Number.POSITIVE_INFINITY;
    series.forEach((point, index) => {
      const diff = Math.abs(new Date(point.t).getTime() - target);
      if (diff < distance) {
        best = index;
        distance = diff;
      }
    });
    return best;
  };

  return (
    <svg viewBox={`0 0 ${width} ${height}`} width="100%" height={height} role="img" aria-label="Baseline alignment with confidence band and change points">
      {[100, 75, 50, 25].map((tick) => (
        <g key={tick}>
          <line x1={margin.left} x2={width - margin.right} y1={y(tick)} y2={y(tick)} stroke="var(--grid-line)" strokeDasharray="3 5" />
          <text x={6} y={y(tick) + 3} fontSize="8" fill="var(--muted-dim)">{tick}</text>
        </g>
      ))}
      <path d={bandPath} fill="var(--lime)" opacity="0.1" />
      <path d={line} fill="none" stroke="var(--lime)" strokeWidth="1.8" />
      {changePoints.map((point, index) => (
        <g key={`${point.at}-${index}`}>
          <line x1={x(Math.min(point.index, series.length - 1))} x2={x(Math.min(point.index, series.length - 1))} y1={margin.top} y2={margin.top + innerH} stroke="var(--orange)" strokeDasharray="2 4" opacity="0.5" />
          <circle cx={x(Math.min(point.index, series.length - 1))} cy={y(series[Math.min(point.index, series.length - 1)]?.score ?? 90)} r="2.4" fill="var(--orange)" />
          <title>{`Change point · ${point.direction} ${point.magnitude.toFixed(1)} · ${point.explainedBy}`}</title>
        </g>
      ))}
      {changes.map((change) => {
        const index = changePointIndex(change.at);
        return (
          <g key={change.id}>
            <line x1={x(index)} x2={x(index)} y1={margin.top} y2={margin.top + innerH} stroke="var(--violet)" strokeDasharray="2 4" opacity="0.6" />
            <circle cx={x(index)} cy={margin.top} r="2.4" fill="var(--violet)" />
            <title>{`${change.title} · ${change.approvedBy}`}</title>
          </g>
        );
      })}
      {series.map((point, index) =>
        index % 2 === 0 || index === series.length - 1 ? (
          <text key={point.t} x={x(index)} y={height - 6} textAnchor="middle" fontSize="8" fill="var(--muted-dim)">
            {formatDate(point.t)}
          </text>
        ) : null,
      )}
    </svg>
  );
}
