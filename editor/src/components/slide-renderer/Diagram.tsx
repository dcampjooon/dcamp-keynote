// ABOUTME: 다이어그램 블록(graph/flow)을 애니메이션 SVG로 그리는 데이터 주도 빌더. 자유 SVG가 아니라 nodes/edges 데이터만 받는다.
// ABOUTME: 레이어 순서 edges<dots<nodes를 지켜 "노드 사이로 입자가 흐르는" 시그니처 연출을 만든다.

"use client";

import { useId } from "react";
import type { Block } from "@/lib/slide-schema";

type DiagramBlock = Extract<Block, { type: "diagram" }>;

const COLOR: Record<string, string> = {
  blue: "var(--blue)",
  cyan: "var(--cyan)",
  green: "var(--green)",
  purple: "var(--purple)",
  amber: "var(--amber)",
  gray: "var(--gray)",
};

const W = 640;
const H = 380;
const NW = 150;
const NH = 60;
const PAD = 18;

type Pos = { x: number; y: number };

/** flow: 좌→우 한 줄. graph: 원형 배치(2개 이하는 수평). */
function layout(nodes: DiagramBlock["nodes"], kind: "graph" | "flow"): Record<string, Pos> {
  const pos: Record<string, Pos> = {};
  const n = nodes.length;
  if (n === 0) return pos;
  const span = W - NW - 2 * PAD;
  if (kind === "flow") {
    nodes.forEach((node, i) => {
      pos[node.id] = { x: n === 1 ? W / 2 - NW / 2 : PAD + (i * span) / (n - 1), y: H / 2 - NH / 2 };
    });
    return pos;
  }
  if (n <= 2) {
    nodes.forEach((node, i) => {
      pos[node.id] = { x: n === 1 ? W / 2 - NW / 2 : PAD + i * span, y: H / 2 - NH / 2 };
    });
    return pos;
  }
  const cx = W / 2 - NW / 2;
  const cy = H / 2 - NH / 2;
  const r = Math.min(W, H) / 2 - NH;
  nodes.forEach((node, i) => {
    const a = (i / n) * Math.PI * 2 - Math.PI / 2;
    pos[node.id] = { x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r };
  });
  return pos;
}

function center(p: Pos): Pos {
  return { x: p.x + NW / 2, y: p.y + NH / 2 };
}

export function Diagram({ block }: { block: DiagramBlock }) {
  const uid = useId().replace(/:/g, "");
  const pos = layout(block.nodes, block.kind);

  const edges = block.edges
    .map((e, i) => {
      const a = pos[e.from];
      const b = pos[e.to];
      if (!a || !b) return null;
      const ca = center(a);
      const cb = center(b);
      const mx = (ca.x + cb.x) / 2;
      const d = `M${ca.x},${ca.y} C${mx},${ca.y} ${mx},${cb.y} ${cb.x},${cb.y}`;
      return { id: `${uid}-e${i}`, d, label: e.label, mid: { x: mx, y: (ca.y + cb.y) / 2 } };
    })
    .filter(Boolean) as { id: string; d: string; label: string; mid: Pos }[];

  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet">
      {/* edges */}
      {edges.map((e) => (
        <path key={e.id} id={e.id} className="ppt-edge draw" d={e.d} pathLength={1} />
      ))}
      {/* dots (입자) */}
      {edges.map((e) => (
        <circle key={`${e.id}-dot`} r={5} fill="var(--cyan)">
          <animateMotion dur="2.4s" repeatCount="indefinite">
            <mpath href={`#${e.id}`} />
          </animateMotion>
        </circle>
      ))}
      {/* edge labels */}
      {edges.map((e) =>
        e.label ? (
          <text key={`${e.id}-lbl`} x={e.mid.x} y={e.mid.y - 8} textAnchor="middle" fontSize={13} fill="var(--ink-faint)">
            {e.label}
          </text>
        ) : null,
      )}
      {/* nodes (맨 위 — 불투명 배경으로 선을 가린다) */}
      {block.nodes.map((node) => {
        const p = pos[node.id];
        if (!p) return null;
        const c = COLOR[node.color] ?? COLOR.blue;
        return (
          <g key={node.id} className="ppt-node">
            <rect x={p.x} y={p.y} width={NW} height={NH} rx={12} stroke={c} strokeWidth={2} />
            <text x={p.x + NW / 2} y={p.y + NH / 2 + 6} textAnchor="middle" fontSize={17} fill="var(--ink)">
              {node.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
