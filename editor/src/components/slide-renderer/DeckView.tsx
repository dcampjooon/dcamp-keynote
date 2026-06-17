// ABOUTME: 미리보기의 무대. 1280x720 흰 캔버스를 가용 영역에 맞춰 스케일하고, 슬라이드 네비(←/→·클릭·dots)를 제공.
// ABOUTME: editable이면 인라인 편집 콜백을 SlideView로 내리고, 텍스트 클릭을 막지 않도록 클릭 네비를 끈다.

"use client";

import { useCallback, useEffect, useLayoutEffect, useRef } from "react";
import { SlideView, type RenderSlide } from "./SlideView";
import type { BlockPatch } from "./BlockView";
import { layoutForSlide, type LayoutSpec } from "@/lib/themes";

export function DeckView({
  slides,
  index,
  onIndexChange,
  editable = false,
  themeTokens,
  layouts,
  dims = { w: 1280, h: 720 },
  onBlockPatch,
  onTitleCommit,
}: {
  slides: RenderSlide[];
  index: number;
  onIndexChange: (i: number) => void;
  editable?: boolean;
  themeTokens?: Record<string, string>;
  layouts?: LayoutSpec[];
  dims?: { w: number; h: number };
  onBlockPatch?: (blockId: string, partial: BlockPatch) => void;
  onTitleCommit?: (text: string) => void;
}) {
  const frameRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const frame = frameRef.current;
    const canvas = canvasRef.current;
    if (!frame || !canvas) return;
    const ro = new ResizeObserver(() => {
      const { width, height } = frame.getBoundingClientRect();
      const scale = Math.min(width / dims.w, height / dims.h);
      canvas.style.transform = `scale(${scale})`;
    });
    ro.observe(frame);
    return () => ro.disconnect();
  }, [dims.w, dims.h]);

  const go = useCallback(
    (n: number) => {
      if (n < 0 || n >= slides.length) return;
      onIndexChange(n);
    },
    [slides.length, onIndexChange],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t?.tagName === "INPUT" || t?.tagName === "TEXTAREA" || t?.isContentEditable) return;
      if (["ArrowRight", " "].includes(e.key)) { e.preventDefault(); go(index + 1); }
      else if (e.key === "ArrowLeft") { e.preventDefault(); go(index - 1); }
      else if (e.key === "Home") go(0);
      else if (e.key === "End") go(slides.length - 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [index, go, slides.length]);

  const current = slides[index];

  return (
    <div className="flex h-full min-w-0 flex-col gap-3">
      <div ref={frameRef} className="ppt-frame relative min-w-0 flex-1 overflow-hidden">
        <div ref={canvasRef} className="ppt-canvas play" style={{ ...(themeTokens as React.CSSProperties), width: dims.w, height: dims.h }}>
          {current && (
            <SlideView
              key={index}
              slide={current}
              spec={layoutForSlide(current.layout, layouts)}
              editable={editable}
              pageNo={`${index + 1} / ${slides.length}`}
              onBlockPatch={onBlockPatch}
              onTitleCommit={onTitleCommit}
            />
          )}
        </div>
        {/* 클릭 네비 — 편집 모드에서는 텍스트 클릭을 막지 않도록 끈다 */}
        {!editable && (
          <>
            <button aria-label="이전" className="absolute inset-y-0 left-0 w-[16%] cursor-w-resize" onClick={() => go(index - 1)} />
            <button aria-label="다음" className="absolute inset-y-0 right-0 w-[84%] cursor-e-resize" onClick={() => go(index + 1)} />
          </>
        )}
      </div>

      <div className="flex items-center justify-center gap-3">
        <div className="flex flex-wrap items-center justify-center gap-1.5">
          {slides.map((_, i) => (
            <button
              key={i}
              onClick={() => go(i)}
              className={`h-2 rounded-full transition-all ${i === index ? "w-6 bg-primary" : "w-2 bg-muted-foreground/30 hover:bg-muted-foreground/60"}`}
              aria-label={`슬라이드 ${i + 1}`}
            />
          ))}
        </div>
        <span className="text-xs tabular-nums text-muted-foreground">
          {String(index + 1).padStart(2, "0")} / {String(slides.length).padStart(2, "0")}
        </span>
      </div>
    </div>
  );
}
