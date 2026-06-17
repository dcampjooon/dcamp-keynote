// ABOUTME: 블록 1개를 PPT 캔버스 위 요소로 렌더. heading 강조(hl), kpi 카운트업, diagram 위임, 인라인 편집을 담당.
// ABOUTME: editable이면 텍스트를 contentEditable로 직접 수정하고 onPatch로 변경분(부분 블록)을 올려보낸다.

"use client";

import { useEffect, useState } from "react";
import type { Block } from "@/lib/slide-schema";
import { Diagram } from "./Diagram";
import { Editable } from "./Editable";
import { sanitizeSvg } from "@/lib/sanitize-svg";

/** 헤드라인의 accent 부분을 그라데이션 강조로 감싼다(보기 모드 전용). */
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

export type BlockPatch = Partial<Block>;

export function BlockView({
  block,
  delay,
  editable = false,
  staticRender = false,
  onPatch,
}: {
  block: Block;
  delay: number;
  editable?: boolean;
  staticRender?: boolean; // HTML 익스포트(SSR)용: kpi를 최종값+data-to로 렌더(런타임 JS가 카운트업)
  onPatch?: (partial: BlockPatch) => void;
}) {
  const anim = { "data-anim": block.anim, style: { animationDelay: `${delay}ms` } } as const;
  const animStyle = { animationDelay: `${delay}ms` };
  const patch = (p: BlockPatch) => onPatch?.(p);

  switch (block.type) {
    case "heading":
      return editable ? (
        <Editable as="h2" className="ppt-headline" value={block.text} editable onCommit={(t) => patch({ text: t })} dataAnim={block.anim} style={animStyle} />
      ) : (
        <h2 className="ppt-headline" {...anim}>
          <Highlighted text={block.text} accent={block.accent} />
        </h2>
      );
    case "subhead":
      return <Editable as="div" className="ppt-subhead" value={block.text} editable={editable} onCommit={(t) => patch({ text: t })} dataAnim={block.anim} style={animStyle} />;
    case "paragraph":
      return <Editable as="p" className="ppt-para" value={block.text} editable={editable} onCommit={(t) => patch({ text: t })} dataAnim={block.anim} style={animStyle} />;
    case "bullets":
      return (
        <ul className="ppt-bullets" {...anim}>
          {block.items.map((it, i) => (
            <Editable
              key={i}
              as="li"
              value={it}
              editable={editable}
              onCommit={(t) => patch({ items: block.items.map((x, k) => (k === i ? t : x)) } as BlockPatch)}
            />
          ))}
        </ul>
      );
    case "callout":
      return (
        <Editable
          as="div"
          className={`ppt-callout tone-${block.tone}`}
          value={block.text}
          editable={editable}
          onCommit={(t) => patch({ text: t })}
          dataAnim={block.anim}
          style={animStyle}
        />
      );
    case "kpi":
      return (
        <div className="ppt-kpis" {...anim}>
          {block.items.map((k, i) => (
            <div className="ppt-kpi" key={i}>
              {editable ? (
                <Editable
                  as="span"
                  className="num"
                  value={`${k.value.toLocaleString()}${k.suffix}`}
                  editable
                  onCommit={(t) => {
                    const num = parseInt(t.replace(/[^\d-]/g, ""), 10);
                    const suffix = t.replace(/[\d,.\s-]/g, "");
                    patch({ items: block.items.map((x, j) => (j === i ? { ...x, value: isNaN(num) ? x.value : num, suffix } : x)) } as BlockPatch);
                  }}
                />
              ) : staticRender ? (
                <span className="num" data-to={k.value} data-suffix={k.suffix}>
                  {k.value.toLocaleString()}
                  {k.suffix}
                </span>
              ) : (
                <CountUp to={k.value} suffix={k.suffix} />
              )}
              <Editable
                as="span"
                className="lbl"
                value={k.label}
                editable={editable}
                onCommit={(t) => patch({ items: block.items.map((x, j) => (j === i ? { ...x, label: t } : x)) } as BlockPatch)}
              />
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
              borderRadius: 0,
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
    case "freecanvas":
      return <div className="ppt-svgwrap" {...anim} dangerouslySetInnerHTML={{ __html: sanitizeSvg(block.svg) }} />;
    default:
      return null;
  }
}
