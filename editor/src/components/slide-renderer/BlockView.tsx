// ABOUTME: 블록 1개를 PPT 캔버스 위 요소로 렌더. heading 강조(hl), kpi 카운트업, diagram 위임을 담당.
// ABOUTME: data-anim 속성으로 등장 애니메이션을, animationDelay로 stagger를 건다.

"use client";

import { useEffect, useState } from "react";
import type { Block } from "@/lib/slide-schema";
import { Diagram } from "./Diagram";

/** 헤드라인의 accent 부분을 그라데이션 강조로 감싼다. */
function Highlighted({ text, accent }: { text: string; accent: string }) {
  if (accent && text.includes(accent)) {
    const [before, after] = text.split(accent);
    return (
      <>
        {before}
        <span className="hl">{accent}</span>
        {after}
      </>
    );
  }
  return <>{text}</>;
}

function CountUp({ to, suffix }: { to: number; suffix: string }) {
  const [v, setV] = useState(0);
  useEffect(() => {
    let raf = 0;
    const dur = 1100;
    const t0 = performance.now();
    const tick = (now: number) => {
      const p = Math.min(1, (now - t0) / dur);
      const e = 1 - Math.pow(1 - p, 3);
      setV(Math.round(to * e));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [to]);
  return (
    <span className="num">
      {v.toLocaleString()}
      {suffix}
    </span>
  );
}

export function BlockView({ block, delay }: { block: Block; delay: number }) {
  const anim = { "data-anim": block.anim, style: { animationDelay: `${delay}ms` } } as const;

  switch (block.type) {
    case "heading":
      return (
        <h2 className="ppt-headline" {...anim}>
          <Highlighted text={block.text} accent={block.accent} />
        </h2>
      );
    case "subhead":
      return (
        <div className="ppt-subhead" {...anim}>
          {block.text}
        </div>
      );
    case "paragraph":
      return (
        <p className="ppt-para" {...anim}>
          {block.text}
        </p>
      );
    case "bullets":
      return (
        <ul className="ppt-bullets" {...anim}>
          {block.items.map((it, i) => (
            <li key={i}>{it}</li>
          ))}
        </ul>
      );
    case "callout":
      return (
        <div className={`ppt-callout tone-${block.tone}`} {...anim}>
          {block.text}
        </div>
      );
    case "kpi":
      return (
        <div className="ppt-kpis" {...anim}>
          {block.items.map((k, i) => (
            <div className="ppt-kpi" key={i}>
              <CountUp to={k.value} suffix={k.suffix} />
              <span className="lbl">{k.label}</span>
            </div>
          ))}
        </div>
      );
    case "diagram":
      return (
        <div className="ppt-svgwrap" {...anim}>
          <Diagram block={block} />
        </div>
      );
    case "image":
      return (
        <div className="ppt-svgwrap" {...anim}>
          <div
            style={{
              width: "100%",
              height: "100%",
              border: "2px dashed var(--line)",
              borderRadius: 12,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "var(--ink-faint)",
              fontSize: 16,
            }}
          >
            🖼 {block.prompt || "이미지"}
          </div>
        </div>
      );
    default:
      return null;
  }
}
