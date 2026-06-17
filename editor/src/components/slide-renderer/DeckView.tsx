// ABOUTME: 미리보기의 무대. 1280x720 흰 캔버스를 가용 영역에 맞춰 스케일하고, 슬라이드 네비(←/→·클릭·dots)를 제공.
// ABOUTME: 슬라이드 변경 시 key를 바꿔 SlideView를 remount → 등장 애니메이션이 재생된다.

"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { SlideView, type RenderSlide } from "./SlideView";

export function DeckView({ slides, index, onIndexChange }: { slides: RenderSlide[]; index: number; onIndexChange: (i: number) => void }) {
  const frameRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);

  // 16:9 캔버스를 가용 영역에 맞춰 스케일
  useLayoutEffect(() => {
    const frame = frameRef.current;
    const canvas = canvasRef.current;
    if (!frame || !canvas) return;
    const ro = new ResizeObserver(() => {
      const { width, height } = frame.getBoundingClientRect();
      const scale = Math.min(width / 1280, height / 720);
      canvas.style.transform = `scale(${scale})`;
    });
    ro.observe(frame);
    return () => ro.disconnect();
  }, []);

  const go = useCallback(
    (n: number) => {
      if (n < 0 || n >= slides.length) return;
      onIndexChange(n);
    },
    [slides.length, onIndexChange],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
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
        <div ref={canvasRef} className="ppt-canvas play">
          {current && <SlideView key={index} slide={current} />}
        </div>
        {/* 클릭 네비 (좌 16% 이전 / 그 외 다음) */}
        <button aria-label="이전" className="absolute inset-y-0 left-0 w-[16%] cursor-w-resize" onClick={() => go(index - 1)} />
        <button aria-label="다음" className="absolute inset-y-0 right-0 w-[84%] cursor-e-resize" onClick={() => go(index + 1)} />
      </div>

      {/* dots + 카운터 */}
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
