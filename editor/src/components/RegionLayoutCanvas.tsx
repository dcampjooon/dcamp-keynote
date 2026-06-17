// ABOUTME: 레이아웃의 영역(zone)들을 1280x720 캔버스에 % 위치로 그리는 미리보기/에디터. PDF에서 추출한 위치·선·샘플텍스트·차트자리·푸터를 그대로 보여준다.
// ABOUTME: editable이면 영역 박스를 드래그(이동)·코너 핸들로 리사이즈해 위치를 조정한다. 선택된 영역은 onSelect로 알린다.

"use client";

import { useCallback, useLayoutEffect, useRef, useState } from "react";
import type { LayoutSpec, Region } from "@/lib/themes";

export function RegionLayoutCanvas({
  spec,
  tokens,
  fallbackBg,
  editable = false,
  selectedId,
  overlayUrl,
  dims = { w: 1280, h: 720 },
  onSelect,
  onChange,
}: {
  spec: LayoutSpec;
  tokens?: Record<string, string>;
  fallbackBg?: string;
  editable?: boolean;
  selectedId?: string;
  overlayUrl?: string; // 원본 PDF 페이지 이미지(옅게 겹쳐 비교)
  dims?: { w: number; h: number };
  onSelect?: (id: string) => void;
  onChange?: (regions: Region[]) => void;
}) {
  const CW = dims.w;
  const CH = dims.h;
  const frameRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const scaleRef = useRef(1);
  const [, force] = useState(0);

  useLayoutEffect(() => {
    const frame = frameRef.current;
    const canvas = canvasRef.current;
    if (!frame || !canvas) return;
    const ro = new ResizeObserver(() => {
      const { width, height } = frame.getBoundingClientRect();
      const sc = Math.min(width / CW, height / CH);
      scaleRef.current = sc;
      canvas.style.transform = `scale(${sc})`;
      force((n) => n + 1);
    });
    ro.observe(frame);
    return () => ro.disconnect();
  }, [CW, CH]);

  const regions = spec.regions ?? [];

  const drag = useCallback(
    (e: React.PointerEvent, id: string, mode: "move" | "resize") => {
      if (!editable) return;
      e.preventDefault();
      e.stopPropagation();
      onSelect?.(id);
      const start = { x: e.clientX, y: e.clientY };
      const r0 = regions.find((r) => r.id === id);
      if (!r0) return;
      const base = { x: r0.x, y: r0.y, w: r0.w, h: r0.h };
      const sc = scaleRef.current || 1;

      const onMove = (ev: PointerEvent) => {
        const dxPct = ((ev.clientX - start.x) / sc / CW) * 100;
        const dyPct = ((ev.clientY - start.y) / sc / CH) * 100;
        const next = regions.map((r) => {
          if (r.id !== id) return r;
          if (mode === "move") {
            return { ...r, x: Math.max(0, Math.min(100 - base.w, base.x + dxPct)), y: Math.max(0, Math.min(100 - base.h, base.y + dyPct)) };
          }
          return { ...r, w: Math.max(4, Math.min(100 - base.x, base.w + dxPct)), h: Math.max(3, Math.min(100 - base.y, base.h + dyPct)) };
        });
        onChange?.(next);
      };
      const onUp = () => {
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
      };
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
    },
    [editable, regions, onChange, onSelect],
  );

  const bg = spec.bg || tokens?.["--canvas-bg"] || fallbackBg || "#ffffff";
  const fg = spec.fg || tokens?.["--ink"] || "#16233d";

  return (
    <div ref={frameRef} className="ppt-frame relative h-full min-w-0 flex-1 overflow-hidden">
      <div
        ref={canvasRef}
        className="ppt-canvas"
        style={{ ...(tokens as React.CSSProperties), background: bg, color: fg, width: CW, height: CH, transformOrigin: "center center" }}
        onPointerDown={() => onSelect?.("")}
      >
        {overlayUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={overlayUrl} alt="원본" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "contain", opacity: 0.45, pointerEvents: "none", zIndex: 0 }} />
        )}
        {regions.map((r) => {
          const sel = editable && r.id === selectedId;
          const common: React.CSSProperties = { position: "absolute", left: `${r.x}%`, top: `${r.y}%`, width: `${r.w}%`, height: `${r.h}%` };
          if (r.kind === "line") {
            const c = r.color || "var(--blue)";
            const t = r.thickness || 3;
            return (
              <div key={r.id} style={common} onPointerDown={(e) => drag(e, r.id, "move")}>
                <div style={{ background: c, position: "absolute", ...(r.orient === "v" ? { width: t, top: 0, bottom: 0, left: "50%" } : { height: t, left: 0, right: 0, top: "50%" }) }} />
                {sel && <Handles onResize={(e) => drag(e, r.id, "resize")} />}
              </div>
            );
          }
          if (r.kind === "placeholder") {
            return (
              <div key={r.id} style={{ ...common, border: "2px dashed var(--line)", borderRadius: 0, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--ink-faint)", fontSize: 16 }}
                onPointerDown={(e) => drag(e, r.id, "move")}>
                {r.label === "chart" ? "📊 차트 영역" : r.sampleText || r.label}
                {sel && <Handles onResize={(e) => drag(e, r.id, "resize")} />}
              </div>
            );
          }
          // text / footer
          const color = r.color || (r.kind === "footer" ? "var(--ink-faint)" : undefined);
          const fontWeight = r.weight === "black" ? 900 : r.weight === "bold" ? 700 : 400;
          return (
            <div
              key={r.id}
              style={{ ...common, fontSize: r.fontSize || (r.kind === "footer" ? 13 : 20), color, fontWeight, textAlign: r.align || "left", display: "flex", alignItems: "center", justifyContent: r.align === "center" ? "center" : r.align === "right" ? "flex-end" : "flex-start", lineHeight: 1.2, overflow: "hidden", outline: sel ? "2px solid var(--blue)" : editable ? "1px dashed rgba(47,109,246,.3)" : "none" }}
              onPointerDown={(e) => drag(e, r.id, "move")}
            >
              <span style={{ whiteSpace: "pre-wrap" }}>{r.sampleText || `〔${r.label}〕`}</span>
              {sel && <Handles onResize={(e) => drag(e, r.id, "resize")} />}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Handles({ onResize }: { onResize: (e: React.PointerEvent) => void }) {
  return (
    <div
      onPointerDown={onResize}
      style={{ position: "absolute", right: -6, bottom: -6, width: 14, height: 14, borderRadius: 0, background: "var(--blue)", border: "2px solid #fff", cursor: "nwse-resize", zIndex: 5 }}
    />
  );
}
