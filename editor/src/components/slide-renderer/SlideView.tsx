// ABOUTME: 슬라이드 한 장을 '레이아웃 스펙'에 따라 렌더. 배경·텍스트색·정렬·세로위치·제목크기·강조요소·브랜드·푸터를 스펙이 결정한다.
// ABOUTME: 스펙은 템플릿(PDF 분석 또는 수동)에서 오며, 고정 프리셋 대신 데이터로 레이아웃을 그린다. editable이면 인라인 편집.

"use client";

import type { Block, Slide } from "@/lib/slide-schema";
import { type LayoutSpec, DEFAULT_LAYOUTS } from "@/lib/themes";
import { BlockView, type BlockPatch } from "./BlockView";
import { Editable } from "./Editable";

export type RenderSlide = Omit<Slide, "id"> & { id?: string; version?: number };

export function SlideView({
  slide,
  spec = DEFAULT_LAYOUTS[2],
  editable = false,
  staticRender = false,
  pageNo,
  onBlockPatch,
  onTitleCommit,
}: {
  slide: RenderSlide;
  spec?: LayoutSpec;
  editable?: boolean;
  staticRender?: boolean;
  pageNo?: string;
  onBlockPatch?: (blockId: string, partial: BlockPatch) => void;
  onTitleCommit?: (text: string) => void;
}) {
  const full = slide.blocks.filter((b) => b.column === "full");
  const left = slide.blocks.filter((b) => b.column === "left");
  const right = slide.blocks.filter((b) => b.column === "right");
  const hasCols = left.length > 0 || right.length > 0;

  let i = 0;
  const delay = () => 110 + i++ * 90;

  const isCenter = spec.align === "center";
  const isMiddle = spec.vAlign === "middle";
  const hasHeading = slide.blocks.some((b) => b.type === "heading");
  const heroLike = spec.role === "cover" || spec.role === "section";
  const showTitle = (slide.title || editable) && !(heroLike && hasHeading);

  const sectionStyle: React.CSSProperties = {
    background: spec.bg || undefined,
    color: spec.fg || undefined,
    alignItems: isCenter ? "center" : "stretch",
    justifyContent: isMiddle ? "center" : "flex-start",
    textAlign: isCenter ? "center" : "left",
  };

  const renderBlock = (b: Block) => (
    <BlockView key={b.id} block={b} delay={delay()} editable={editable} staticRender={staticRender} onPatch={(p) => onBlockPatch?.(b.id, p)} />
  );

  const accentBar = spec.accent !== "none" && spec.accent !== "underline" && (
    <div
      data-anim="scale"
      style={{
        width: spec.accent === "block" ? 28 : 56,
        height: spec.accent === "block" ? 28 : 6,
        borderRadius: 0,
        background: "var(--grad)",
        margin: isCenter ? "0 auto 14px" : "0 0 14px",
        animationDelay: "60ms",
      }}
    />
  );

  const titleStyle: React.CSSProperties = {
    fontSize: spec.titleSize,
    animationDelay: `${delay()}ms`,
    ...(spec.accent === "underline" ? { borderBottom: "4px solid var(--blue)", paddingBottom: 8, display: "inline-block" } : {}),
  };

  return (
    <section className="ppt-slide" style={sectionStyle}>
      {accentBar}

      {showTitle && (
        <Editable as="h2" className="ppt-headline" value={slide.title} editable={editable} onCommit={(t) => onTitleCommit?.(t)} dataAnim="rise" style={titleStyle} />
      )}

      {full.map(renderBlock)}

      {hasCols && (
        <div className="ppt-cols">
          <div className="ppt-col">{left.map(renderBlock)}</div>
          <div className="ppt-col">{right.map(renderBlock)}</div>
        </div>
      )}

      {spec.footer && pageNo && (
        <div style={{ position: "absolute", bottom: 28, right: 36, fontSize: 14, color: "var(--ink-faint)", opacity: 0.8 }}>{pageNo}</div>
      )}
    </section>
  );
}
