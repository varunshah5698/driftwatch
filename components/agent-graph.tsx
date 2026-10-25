"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, Boxes, GitBranch, Server, ShieldAlert, X } from "lucide-react";
import type { GraphLink, GraphNode } from "@/lib/store";

interface Positioned extends GraphNode {
  x: number;
  y: number;
}

const WIDTH = 860;
const HEIGHT = 520;

function layout(nodes: GraphNode[], links: GraphLink[]): Positioned[] {
  const positions: Positioned[] = nodes.map((node, index) => {
    const angle = (index / Math.max(nodes.length, 1)) * Math.PI * 2;
    const radius = node.kind === "agent" ? 150 : node.kind === "tool" ? 280 : 330;
    return {
      ...node,
      x: WIDTH / 2 + Math.cos(angle) * radius,
      y: HEIGHT / 2 + Math.sin(angle) * radius,
    };
  });
  const indexOf = new Map(positions.map((node, index) => [node.id, index]));

  for (let iteration = 0; iteration < 240; iteration++) {
    // Repulsion between every pair.
    for (let i = 0; i < positions.length; i++) {
      for (let j = i + 1; j < positions.length; j++) {
        let dx = positions[i].x - positions[j].x;
        let dy = positions[i].y - positions[j].y;
        let distance = Math.hypot(dx, dy);
        if (distance < 1) {
          dx = (i % 3) - 1 || 0.5;
          dy = (j % 3) - 1 || 0.5;
          distance = 1.4;
        }
        const repulsion = 4200 / (distance * distance);
        const fx = (dx / distance) * repulsion;
        const fy = (dy / distance) * repulsion;
        positions[i].x += fx;
        positions[i].y += fy;
        positions[j].x -= fx;
        positions[j].y -= fy;
      }
    }
    // Spring attraction along edges.
    for (const link of links) {
      const a = positions[indexOf.get(link.source) ?? -1];
      const b = positions[indexOf.get(link.target) ?? -1];
      if (!a || !b) continue;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const distance = Math.max(1, Math.hypot(dx, dy));
      const desired = a.kind === "agent" && b.kind === "agent" ? 130 : 155;
      const force = (distance - desired) * 0.022;
      const fx = (dx / distance) * force;
      const fy = (dy / distance) * force;
      a.x += fx;
      a.y += fy;
      b.x -= fx;
      b.y -= fy;
    }
    // Center gravity and bounds.
    for (const node of positions) {
      node.x += (WIDTH / 2 - node.x) * 0.006;
      node.y += (HEIGHT / 2 - node.y) * 0.006;
      node.x = Math.max(46, Math.min(WIDTH - 46, node.x));
      node.y = Math.max(40, Math.min(HEIGHT - 34, node.y));
    }
  }
  return positions;
}

export function AgentGraph({
  nodes,
  links,
  focusId,
}: {
  nodes: GraphNode[];
  links: GraphLink[];
  focusId?: string;
}) {
  const [selected, setSelected] = useState<string | null>(focusId ?? null);
  const [showLabels, setShowLabels] = useState(true);
  const positioned = useMemo(() => layout(nodes, links), [nodes, links]);
  const byId = new Map(positioned.map((node) => [node.id, node]));

  const neighbours = useMemo(() => {
    if (!selected) return new Set<string>();
    const set = new Set<string>([selected]);
    for (const link of links) {
      if (link.source === selected) set.add(link.target);
      if (link.target === selected) set.add(link.source);
    }
    return set;
  }, [links, selected]);

  const active = selected ? byId.get(selected) : undefined;
  const connections = active
    ? links.filter((link) => link.source === active.id || link.target === active.id)
    : [];

  const colorFor = (node: GraphNode) => {
    if (node.kind === "external") return "var(--red)";
    if (node.kind === "tool") return "var(--muted)";
    if (node.status === "quarantined" || node.status === "isolated") return "var(--red)";
    if (node.risk >= 60) return "var(--red)";
    if (node.risk >= 25) return "var(--orange)";
    return "var(--lime)";
  };
  const radiusFor = (node: GraphNode) =>
    node.kind === "agent" ? 11 + Math.min(node.risk, 90) * 0.09 : node.kind === "tool" ? 7 : 8;

  return (
    <div className="relative">
      <div className="flex flex-wrap items-center gap-2 px-1 pb-2">
        <span className="chip chip-lime">live call graph</span>
        <span className="chip">{nodes.filter((node) => node.kind === "agent").length} agents</span>
        <span className="chip">{nodes.filter((node) => node.kind === "tool").length} tools</span>
        <span className="chip">{links.length} edges</span>
        <label className="ml-auto inline-flex cursor-pointer items-center gap-1.5 text-[9.5px] text-[var(--muted)]">
          <input
            type="checkbox"
            checked={showLabels}
            onChange={(event) => setShowLabels(event.target.checked)}
            className="h-3 w-3 accent-[var(--lime)]"
          />
          labels
        </label>
      </div>
      <div className="relative overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--panel-soft)] dot-canvas">
        <svg
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          width="100%"
          role="img"
          aria-label="Agent-to-agent, agent-to-tool and egress call graph"
          className="block"
        >
          <defs>
            <marker id="arrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
              <path d="M0 0 L8 4 L0 8 z" fill="var(--muted-dim)" />
            </marker>
          </defs>
          {links.map((link, index) => {
            const a = byId.get(link.source);
            const b = byId.get(link.target);
            if (!a || !b) return null;
            const dimmed = selected ? !(neighbours.has(link.source) && neighbours.has(link.target)) : false;
            const isDelegation = link.kind === "delegation";
            const external = link.kind === "egress";
            return (
              <line
                key={`${link.source}-${link.target}-${index}`}
                x1={a.x}
                y1={a.y}
                x2={b.x}
                y2={b.y}
                stroke={external ? "var(--red)" : isDelegation ? "var(--orange)" : "var(--line-strong)"}
                strokeWidth={Math.min(3.2, 0.7 + Math.log1p(link.value) * 0.7)}
                strokeDasharray={isDelegation ? "4 4" : undefined}
                markerEnd="url(#arrow)"
                opacity={dimmed ? 0.08 : external ? 0.5 : 0.4}
              />
            );
          })}
          {positioned.map((node) => {
            const dimmed = selected ? !neighbours.has(node.id) : false;
            const isActive = selected === node.id;
            const color = colorFor(node);
            return (
              <g
                key={node.id}
                transform={`translate(${node.x},${node.y})`}
                onClick={() => setSelected(node.id)}
                style={{ cursor: "pointer" }}
                opacity={dimmed ? 0.25 : 1}
                tabIndex={0}
                role="button"
                aria-label={`${node.name}, ${node.kind}, risk ${node.risk}`}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") setSelected(node.id);
                }}
              >
                {isActive ? <circle r={radiusFor(node) + 8} fill="none" stroke={color} strokeOpacity="0.45" /> : null}
                {node.kind === "tool" ? (
                  <rect
                    x={-6}
                    y={-6}
                    width={12}
                    height={12}
                    rx={3}
                    fill={color}
                    fillOpacity={dimmed ? 0.4 : 0.85}
                    stroke="var(--panel)"
                    strokeWidth="1.4"
                  />
                ) : (
                  <circle
                    r={radiusFor(node)}
                    fill={node.kind === "external" ? "var(--red-soft)" : "var(--panel-hi)"}
                    stroke={color}
                    strokeWidth={isActive ? 2.2 : 1.5}
                  />
                )}
                {node.kind === "agent" ? (
                  <circle r={radiusFor(node) * 0.42} fill={color} opacity="0.9" />
                ) : null}
                {showLabels ? (
                  <text
                    y={radiusFor(node) + 12}
                    textAnchor="middle"
                    fontSize="7.6"
                    fill={isActive ? "var(--text)" : "var(--muted)"}
                    style={{ textTransform: "uppercase", letterSpacing: "0.04em" }}
                  >
                    {node.name.length > 26 ? `${node.name.slice(0, 24)}…` : node.name}
                  </text>
                ) : null}
              </g>
            );
          })}
        </svg>
        <div className="pointer-events-none absolute bottom-2 left-3 flex flex-wrap gap-3 text-[8.5px] uppercase tracking-wide text-[var(--muted-dim)]">
          <span className="inline-flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-[var(--lime)]" /> healthy</span>
          <span className="inline-flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-[var(--orange)]" /> drift</span>
          <span className="inline-flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-[var(--red)]" /> contained</span>
          <span className="inline-flex items-center gap-1"><Boxes size={9} /> tool</span>
        </div>
      </div>

      {active ? (
        <div className="absolute right-2 top-12 w-[230px] rounded-2xl border border-[var(--line-strong)] bg-[var(--panel)]/95 p-3 shadow-xl backdrop-blur">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="eyebrow">{active.kind}</p>
              <p className="mt-1 truncate text-[11.5px] font-semibold" title={active.name}>{active.name}</p>
            </div>
            <button type="button" onClick={() => setSelected(null)} className="icon-btn h-6 w-6" aria-label="Clear selection">
              <X size={11} aria-hidden />
            </button>
          </div>
          <div className="mt-2 space-y-1 text-[9.5px]">
            <p className="flex justify-between"><span className="text-[var(--muted-dim)]">risk</span><span>{active.risk}</span></p>
            <p className="flex justify-between"><span className="text-[var(--muted-dim)]">status</span><span>{active.status}</span></p>
            <p className="flex justify-between"><span className="text-[var(--muted-dim)]">edges</span><span>{connections.length}</span></p>
          </div>
          <ul className="mt-2 space-y-0.5 border-t border-[var(--line)] pt-2">
            {connections.slice(0, 5).map((link) => {
              const otherId = link.source === active.id ? link.target : link.source;
              const other = byId.get(otherId);
              return (
                <li key={`${link.source}-${link.target}`} className="flex items-center gap-1.5 text-[8.5px] text-[var(--muted)]">
                  {link.kind === "delegation" ? <GitBranch size={9} aria-hidden /> : link.kind === "tool" ? <Server size={9} aria-hidden /> : <ShieldAlert size={9} aria-hidden />}
                  <span className="truncate">{other?.name ?? otherId}</span>
                </li>
              );
            })}
          </ul>
          {active.kind === "agent" ? (
            <Link href={`/agents/${active.id}`} className="mt-2 inline-flex items-center gap-1 text-[9px] text-[var(--lime)]">
              Open agent <ArrowRight size={9} aria-hidden />
            </Link>
          ) : null}
        </div>
      ) : (
        <p className="absolute right-3 top-12 max-w-[180px] rounded-xl border border-[var(--line)] bg-[var(--panel)]/90 px-2.5 py-2 text-[9px] leading-relaxed text-[var(--muted)]">
          Select a node to trace its propagation.
        </p>
      )}
    </div>
  );
}
