// ABOUTME: 에디터 메인 화면. 좌측 챗 패널(기획→생성), 우측 PPT 미리보기. M1 수직 슬라이스의 진입점.
// ABOUTME: 자연어 brief → 아웃라인 → 확정 → 슬라이드 생성 → 미리보기까지 한 줄기로 연결한다.

"use client";

import { useState } from "react";
import { toast, Toaster } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { DeckView } from "@/components/slide-renderer/DeckView";
import type { RenderSlide } from "@/components/slide-renderer/SlideView";
import type { Outline } from "@/lib/slide-schema";
import { SEED_SLIDES } from "@/lib/seed-deck";

type Stage = "idle" | "outlining" | "outline" | "generating" | "ready";

export default function Home() {
  const [stage, setStage] = useState<Stage>("idle");
  const [brief, setBrief] = useState("");
  const [sources, setSources] = useState("");
  const [outline, setOutline] = useState<Outline | null>(null);
  const [slides, setSlides] = useState<RenderSlide[]>([]);
  const [index, setIndex] = useState(0);

  async function makeOutline() {
    if (!brief.trim()) return;
    setStage("outlining");
    try {
      const res = await fetch("/api/outline", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brief, sources }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "아웃라인 생성 실패");
      setOutline(data.outline);
      setStage("outline");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "오류");
      setStage("idle");
    }
  }

  async function generate() {
    if (!outline) return;
    setStage("generating");
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ outline }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "슬라이드 생성 실패");
      setSlides(data.slides);
      setIndex(0);
      setStage("ready");
      toast.success(`${data.slides.length}장 생성 완료`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "오류");
      setStage("outline");
    }
  }

  function reset() {
    setStage("idle");
    setOutline(null);
    setSlides([]);
    setIndex(0);
  }

  return (
    <>
      <Toaster richColors position="top-center" />
      <main className="grid h-screen grid-cols-[400px_1fr] overflow-hidden">
      {/* 좌: 챗 패널 */}
      <aside className="flex h-full flex-col gap-4 overflow-y-auto border-r bg-card p-5">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-bold">키노트 에디터</h1>
            <Badge variant="secondary">M1</Badge>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">자연어로 설명하면 발표를 설계·생성합니다.</p>
        </div>

        {(stage === "idle" || stage === "outlining") && (
          <div className="flex flex-col gap-3">
            <label className="text-sm font-medium">발표 내용 설명</label>
            <Textarea
              value={brief}
              onChange={(e) => setBrief(e.target.value)}
              placeholder="예: 디캠프 통합DB와 전사 AX의 지금까지 실적과 다음 단계를 전 직원에게 공유하는 발표"
              rows={5}
              disabled={stage === "outlining"}
            />
            <label className="text-sm font-medium">참고 소스 (선택)</label>
            <Textarea
              value={sources}
              onChange={(e) => setSources(e.target.value)}
              placeholder="붙여넣을 사실·수치·맥락 자료"
              rows={4}
              disabled={stage === "outlining"}
            />
            <Button onClick={makeOutline} disabled={stage === "outlining" || !brief.trim()}>
              {stage === "outlining" ? "기획 설계 중…" : "기획 시작"}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="text-muted-foreground"
              onClick={() => { setSlides(SEED_SLIDES); setIndex(0); setStage("ready"); }}
            >
              샘플 미리보기 (키 없이 렌더 확인)
            </Button>
          </div>
        )}

        {stage === "outline" && outline && (
          <div className="flex flex-col gap-3">
            <div>
              <div className="text-base font-bold">{outline.title}</div>
              <p className="mt-1 text-sm text-muted-foreground">{outline.storyline}</p>
            </div>
            <div className="flex flex-col gap-2">
              {outline.slides.map((s, i) => (
                <div key={i} className="rounded-md border p-2.5 text-sm">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-muted-foreground">{i + 1}</span>
                    <Badge variant="outline" className="text-[10px]">{s.layout}</Badge>
                  </div>
                  <div className="mt-1 font-semibold">{s.headline}</div>
                  <div className="mt-0.5 text-xs text-muted-foreground">{s.blockHints.join(" · ")}</div>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <Button onClick={generate} className="flex-1">이대로 장표 생성</Button>
              <Button variant="outline" onClick={reset}>처음부터</Button>
            </div>
          </div>
        )}

        {stage === "generating" && (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 text-sm text-muted-foreground">
            <div className="size-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            슬라이드를 한 장씩 생성하는 중…
          </div>
        )}

        {stage === "ready" && (
          <div className="flex flex-col gap-3">
            <div className="rounded-md bg-primary/10 p-3 text-sm">
              <div className="font-semibold">{slides.length}장 생성 완료</div>
              <p className="mt-1 text-muted-foreground">미리보기에서 ←/→ 로 이동하세요.</p>
            </div>
            {slides[index]?.notes && (
              <div className="rounded-md border p-3 text-sm">
                <div className="mb-1 text-xs font-bold text-muted-foreground">발표자 노트 · {index + 1}장</div>
                {slides[index].notes}
              </div>
            )}
            <Button variant="outline" onClick={reset}>새 발표 만들기</Button>
          </div>
        )}
      </aside>

      {/* 우: 미리보기 */}
      <section className="flex h-full min-w-0 flex-col bg-muted/40 p-6">
        {slides.length > 0 ? (
          <DeckView slides={slides} index={index} onIndexChange={setIndex} />
        ) : (
          <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
            왼쪽에서 발표를 설계하면 여기에 16:9 미리보기가 나타납니다.
          </div>
        )}
      </section>
      </main>
    </>
  );
}
