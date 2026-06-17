// ABOUTME: 슬라이드 한 장을 레이아웃에 맞춰 렌더. title에 헤드라인, blocks를 full/left/right 컬럼에 배치.
// ABOUTME: 블록 순서대로 stagger delay를 부여한다.

"use client";

import type { Slide } from "@/lib/slide-schema";
import { BlockView } from "./BlockView";

export type RenderSlide = Omit<Slide, "id"> & { id?: string };

export function SlideView({ slide }: { slide: RenderSlide }) {
  const full = slide.blocks.filter((b) => b.column === "full");
  const left = slide.blocks.filter((b) => b.column === "left");
  const right = slide.blocks.filter((b) => b.column === "right");
  const hasCols = left.length > 0 || right.length > 0;

  let i = 0;
  const delay = () => 110 + i++ * 90;

  return (
    <section className={`ppt-slide layout-${slide.layout}`}>
      {(slide.layout === "title" || slide.layout === "section") && (
        <div className="ppt-brand" data-anim="fade" style={{ animationDelay: "40ms" }}>
          d·camp &nbsp;|&nbsp; IT팀
        </div>
      )}

      {slide.title && (
        <h2 className="ppt-headline" data-anim="rise" style={{ animationDelay: `${delay()}ms` }}>
          {slide.title}
        </h2>
      )}

      {full.map((b) => (
        <BlockView key={b.id} block={b} delay={delay()} />
      ))}

      {hasCols && (
        <div className="ppt-cols">
          <div className="ppt-col">
            {left.map((b) => (
              <BlockView key={b.id} block={b} delay={delay()} />
            ))}
          </div>
          <div className="ppt-col">
            {right.map((b) => (
              <BlockView key={b.id} block={b} delay={delay()} />
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
