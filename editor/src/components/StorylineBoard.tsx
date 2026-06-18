// ABOUTME: 스토리라인 보드(2단계 워크플로우 1단계). 메인 화면 전체에서 슬라이드별 계획을 편집·보완하고 참고 자료를 붙여넣는다.
// ABOUTME: 헤드라인·목적·레이아웃·들어갈 요소·참고자료 편집 + 슬라이드 추가/삭제/이동. 확정 후 이 내용으로 프리젠테이션을 생성.

"use client";

import type { Outline, SlideLayout, SlidePlan } from "@/lib/slide-schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

const LAYOUTS: SlideLayout[] = ["title", "section", "standard", "split", "centered"];
const LAYOUT_LABEL: Record<SlideLayout, string> = { title: "표지", section: "간지", standard: "본문", split: "2단", centered: "강조" };

export function StorylineBoard({ outline, onChange }: { outline: Outline; onChange: (o: Outline) => void }) {
  const setSlide = (i: number, patch: Partial<SlidePlan>) =>
    onChange({ ...outline, slides: outline.slides.map((s, k) => (k === i ? { ...s, ...patch } : s)) });

  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= outline.slides.length) return;
    const next = [...outline.slides];
    [next[i], next[j]] = [next[j], next[i]];
    onChange({ ...outline, slides: next });
  };

  const remove = (i: number) => onChange({ ...outline, slides: outline.slides.filter((_, k) => k !== i) });

  const add = () =>
    onChange({
      ...outline,
      slides: [...outline.slides, { purpose: "", headline: "새 슬라이드", layout: "standard", blockHints: [], material: "" }],
    });

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 min-h-0 flex-col gap-3 overflow-y-auto p-6">
      <div className="text-sm text-muted-foreground">
        슬라이드별 스토리라인을 다듬고, 참고 자료를 붙여넣으세요. 확정하면 이 내용으로 발표를 생성합니다.
      </div>

      {outline.slides.map((s, i) => (
        <div key={i} className="rounded-xl border bg-card p-4 shadow-sm">
          <div className="mb-3 flex items-center gap-2">
            <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-medium">{i + 1}</span>
            <select
              value={s.layout}
              onChange={(e) => setSlide(i, { layout: e.target.value as SlideLayout })}
              className="h-8 rounded-md border bg-background px-2 text-sm"
            >
              {LAYOUTS.map((l) => (
                <option key={l} value={l}>{LAYOUT_LABEL[l]}</option>
              ))}
            </select>
            <div className="ml-auto flex gap-1">
              <Button variant="ghost" size="sm" onClick={() => move(i, -1)} disabled={i === 0} title="위로">↑</Button>
              <Button variant="ghost" size="sm" onClick={() => move(i, 1)} disabled={i === outline.slides.length - 1} title="아래로">↓</Button>
              <Button variant="ghost" size="sm" className="text-destructive" onClick={() => remove(i)} title="삭제">✕</Button>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Input value={s.headline} onChange={(e) => setSlide(i, { headline: e.target.value })} placeholder="헤드라인(결론 한 줄)" className="font-medium" />
            <Input value={s.purpose} onChange={(e) => setSlide(i, { purpose: e.target.value })} placeholder="이 슬라이드의 목적/메시지" className="text-sm" />
            <Textarea
              value={s.blockHints.join("\n")}
              onChange={(e) => setSlide(i, { blockHints: e.target.value.split("\n").map((x) => x.trim()).filter(Boolean) })}
              placeholder="들어갈 요소 (한 줄에 하나) — 예: bullets: 3대 원칙 / diagram: 데이터 흐름"
              rows={2}
              className="text-sm"
            />
            <Textarea
              value={s.material ?? ""}
              onChange={(e) => setSlide(i, { material: e.target.value })}
              placeholder="📋 참고 자료 붙여넣기 — 이 슬라이드에 반영할 사실·수치·문장 (붙여넣으면 생성 시 우선 반영)"
              rows={3}
              className="bg-muted/40 text-sm"
            />
          </div>
        </div>
      ))}

      <Button variant="outline" onClick={add} className="border-dashed">+ 슬라이드 추가</Button>
    </div>
  );
}
