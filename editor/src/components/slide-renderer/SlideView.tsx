// ABOUTME: 슬라이드 한 장을 레이아웃에 맞춰 렌더. title에 헤드라인, blocks를 full/left/right 컬럼에 배치.
// ABOUTME: editable이면 제목·블록을 인라인 편집하고 onBlockPatch/onTitleCommit으로 변경분을 올려보낸다.

"use client";

import type { Block, Slide } from "@/lib/slide-schema";
import { BlockView, type BlockPatch } from "./BlockView";
import { Editable } from "./Editable";

export type RenderSlide = Omit<Slide, "id"> & { id?: string; version?: number };

export function SlideView({
  slide,
  editable = false,
  staticRender = false,
  onBlockPatch,
  onTitleCommit,
}: {
  slide: RenderSlide;
  editable?: boolean;
  staticRender?: boolean;
  onBlockPatch?: (blockId: string, partial: BlockPatch) => void;
  onTitleCommit?: (text: string) => void;
}) {
  const full = slide.blocks.filter((b) => b.column === "full");
  const left = slide.blocks.filter((b) => b.column === "left");
  const right = slide.blocks.filter((b) => b.column === "right");
  const hasCols = left.length > 0 || right.length > 0;

  let i = 0;
  const delay = () => 110 + i++ * 90;

  const isHero = slide.layout === "title" || slide.layout === "section";
  const hasHeading = slide.blocks.some((b) => b.type === "heading");
  const showTitle = (slide.title || editable) && !(isHero && hasHeading);

  const renderBlock = (b: Block) => (
    <BlockView key={b.id} block={b} delay={delay()} editable={editable} staticRender={staticRender} onPatch={(p) => onBlockPatch?.(b.id, p)} />
  );

  return (
    <section className={`ppt-slide layout-${slide.layout}`}>
      {isHero && (
        <div className="ppt-brand" data-anim="fade" style={{ animationDelay: "40ms" }}>
          d·camp &nbsp;|&nbsp; IT팀
        </div>
      )}

      {showTitle && (
        <Editable
          as="h2"
          className="ppt-headline"
          value={slide.title}
          editable={editable}
          onCommit={(t) => onTitleCommit?.(t)}
          dataAnim="rise"
          style={{ animationDelay: `${delay()}ms` }}
        />
      )}

      {full.map(renderBlock)}

      {hasCols && (
        <div className="ppt-cols">
          <div className="ppt-col">{left.map(renderBlock)}</div>
          <div className="ppt-col">{right.map(renderBlock)}</div>
        </div>
      )}
    </section>
  );
}
