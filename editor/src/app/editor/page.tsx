// ABOUTME: 발표 에디터(/editor). 좌측 챗/편집 패널 + 우측 PPT 미리보기. ?deck=ID면 기존 발표 로드, 없으면 새 발표.
// ABOUTME: 상단 "홈" 버튼으로 대시보드(/)로 이동. 템플릿은 /templates에서 만든 것 + 빌트인을 합쳐 선택.

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { toast, Toaster } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { DeckView } from "@/components/slide-renderer/DeckView";
import type { RenderSlide } from "@/components/slide-renderer/SlideView";
import type { Outline } from "@/lib/slide-schema";
import { SEED_SLIDES } from "@/lib/seed-deck";
import { THEMES, DEFAULT_THEME, type Theme } from "@/lib/themes";

type Stage = "idle" | "outlining" | "outline" | "generating" | "ready";

export default function EditorPage() {
  const [stage, setStage] = useState<Stage>("idle");
  const [brief, setBrief] = useState("");
  const [sources, setSources] = useState("");
  const [outline, setOutline] = useState<Outline | null>(null);
  const [slides, setSlides] = useState<RenderSlide[]>([]);
  const [index, setIndex] = useState(0);
  const [deckId, setDeckId] = useState<string | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [patchInput, setPatchInput] = useState("");
  const [patching, setPatching] = useState(false);
  const [themeId, setThemeId] = useState("dcamp-white");
  const [templates, setTemplates] = useState<Theme[]>(THEMES);

  const theme = templates.find((t) => t.id === themeId) ?? DEFAULT_THEME;

  // 템플릿(빌트인+사용자) 로드
  useEffect(() => {
    void fetch("/api/templates")
      .then((r) => r.json())
      .then((d) => { if (Array.isArray(d.templates)) setTemplates(d.templates); })
      .catch(() => {});
  }, []);

  // ?deck=ID 가 있으면 해당 발표 로드
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("deck");
    if (id) void openDeck(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function openDeck(id: string) {
    try {
      const res = await fetch(`/api/deck/${id}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "불러오기 실패");
      setSlides(data.slides);
      setDeckId(data.deckId);
      setThemeId(data.themeId);
      setIndex(0);
      setEditMode(false);
      setStage("ready");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "오류");
    }
  }

  // 개발용: 생성된 덱 JSON 주입 렌더 확인
  useEffect(() => {
    (window as unknown as { __loadSlides?: (s: RenderSlide[]) => void }).__loadSlides = (s) => {
      setSlides(s);
      setIndex(0);
      setStage("ready");
    };
  }, []);

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
        body: JSON.stringify({ outline, themeId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "슬라이드 생성 실패");
      setSlides(data.slides);
      setDeckId(data.deckId);
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
    setDeckId(null);
    setEditMode(false);
    setIndex(0);
  }

  function commitSlide(updated: RenderSlide) {
    setSlides((prev) => prev.map((s, i) => (i === index ? updated : s)));
    void saveSlide(updated);
  }

  async function saveSlide(s: RenderSlide) {
    if (!s.id || s.version == null) return;
    try {
      const res = await fetch("/api/slide", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slideId: s.id, version: s.version, title: s.title, notes: s.notes, layout: s.layout, blocks: s.blocks }),
      });
      const data = await res.json();
      if (res.ok) setSlides((prev) => prev.map((x) => (x.id === s.id ? { ...x, version: data.version } : x)));
      else if (res.status === 409) toast.error("편집 충돌 — 다른 곳에서 먼저 수정됨. 새로고침이 필요합니다.");
      else toast.error(data.error || "저장 실패");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "저장 오류");
    }
  }

  function editBlock(blockId: string, partial: Record<string, unknown>) {
    const s = slides[index];
    commitSlide({ ...s, blocks: s.blocks.map((b) => (b.id === blockId ? { ...b, ...partial } : b)) as RenderSlide["blocks"] });
  }
  function editTitle(text: string) {
    commitSlide({ ...slides[index], title: text });
  }

  async function sendPatch() {
    const s = slides[index];
    if (!patchInput.trim() || patching) return;
    if (!s.id || s.version == null) {
      toast.error("샘플 덱은 채팅 수정 대상이 아닙니다. 먼저 발표를 생성하세요.");
      return;
    }
    setPatching(true);
    try {
      const res = await fetch("/api/patch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slideId: s.id, version: s.version, instruction: patchInput, slide: { layout: s.layout, title: s.title, blocks: s.blocks, notes: s.notes } }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "수정 실패");
      setSlides((prev) => prev.map((x, i) => (i === index ? (data.slide as RenderSlide) : x)));
      setPatchInput("");
      toast.success(data.reply || "수정 완료");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "수정 오류");
    } finally {
      setPatching(false);
    }
  }

  return (
    <>
      <Toaster richColors position="top-center" />
      <main className="grid h-screen grid-cols-[400px_1fr] overflow-hidden">
        <aside className="flex h-full flex-col gap-4 overflow-y-auto border-r bg-card p-5">
          <div className="flex items-center gap-2">
            <Link href="/" className="rounded-md border px-2.5 py-1 text-sm hover:bg-accent">← 홈</Link>
            <h1 className="text-lg font-bold">키노트 에디터</h1>
          </div>

          {(stage === "idle" || stage === "outlining") && (
            <div className="flex flex-col gap-3">
              <label className="text-sm font-medium">발표 내용 설명</label>
              <Textarea value={brief} onChange={(e) => setBrief(e.target.value)} placeholder="예: 디캠프 통합DB와 전사 AX의 지금까지 실적과 다음 단계를 전 직원에게 공유하는 발표" rows={5} disabled={stage === "outlining"} />
              <label className="text-sm font-medium">참고 소스 (선택)</label>
              <Textarea value={sources} onChange={(e) => setSources(e.target.value)} placeholder="붙여넣을 사실·수치·맥락 자료" rows={4} disabled={stage === "outlining"} />
              <div>
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium">템플릿</label>
                  <Link href="/templates" className="text-xs text-muted-foreground hover:underline">템플릿 관리 →</Link>
                </div>
                <div className="mt-2 grid grid-cols-5 gap-1.5">
                  {templates.map((t) => (
                    <button key={t.id} onClick={() => setThemeId(t.id)} disabled={stage === "outlining"} title={`${t.name} · ${t.desc}`}
                      className={`flex flex-col items-center gap-1 rounded-md border p-1.5 transition ${themeId === t.id ? "border-primary ring-2 ring-primary/30" : "border-border hover:border-muted-foreground/40"}`}>
                      <span className="h-5 w-full rounded" style={{ background: `linear-gradient(120deg, ${t.swatch[0]}, ${t.swatch[1]})` }} />
                      <span className="truncate text-[10px] leading-tight text-muted-foreground">{t.name}</span>
                    </button>
                  ))}
                </div>
              </div>
              <Button onClick={makeOutline} disabled={stage === "outlining" || !brief.trim()}>
                {stage === "outlining" ? "기획 설계 중…" : "기획 시작"}
              </Button>
              <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={() => { setSlides(SEED_SLIDES); setIndex(0); setStage("ready"); }}>
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
                <div className="font-semibold">{slides.length}장 · {index + 1}번째</div>
                <p className="mt-1 text-muted-foreground">{editMode ? "텍스트를 클릭해 직접 수정하세요. (자동 저장)" : "미리보기에서 ←/→ 로 이동하세요."}</p>
              </div>
              <div className="flex gap-2">
                <Button className="flex-1" variant={editMode ? "default" : "outline"} onClick={() => setEditMode((v) => !v)}>{editMode ? "편집 종료" : "✏️ 인라인 편집"}</Button>
                <Button variant="outline" disabled={!deckId} onClick={() => deckId && window.open(`/api/export/html?deckId=${deckId}`, "_blank")} title="HTML 파일로 내보내기">⬇ HTML</Button>
                <Button variant="outline" disabled={!deckId} onClick={() => deckId && window.open(`/api/export/pptx?deckId=${deckId}`, "_blank")} title="PowerPoint(.pptx)로 내보내기">⬇ PPTX</Button>
              </div>
              <div className="flex flex-col gap-2 rounded-md border p-3">
                <div className="text-xs font-bold text-muted-foreground">이 슬라이드 수정 요청 · {index + 1}장</div>
                <Textarea value={patchInput} onChange={(e) => setPatchInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); void sendPatch(); } }}
                  placeholder="예: 헤드라인을 더 강하게 / 불릿 하나 추가 / 마지막 항목 삭제 (⌘+Enter)" rows={2} disabled={patching} />
                <Button size="sm" onClick={() => void sendPatch()} disabled={patching || !patchInput.trim()}>{patching ? "수정 중…" : "수정 요청"}</Button>
              </div>
              {slides[index]?.notes && (
                <div className="rounded-md border p-3 text-sm">
                  <div className="mb-1 text-xs font-bold text-muted-foreground">발표자 노트 · {index + 1}장</div>
                  {slides[index].notes}
                </div>
              )}
              <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={reset}>새 발표 만들기</Button>
            </div>
          )}
        </aside>

        <section className="flex h-full min-w-0 flex-col bg-muted/40 p-6">
          {slides.length > 0 ? (
            <DeckView slides={slides} index={index} onIndexChange={setIndex} editable={editMode} themeTokens={theme.tokens} onBlockPatch={editBlock} onTitleCommit={editTitle} />
          ) : (
            <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">왼쪽에서 발표를 설계하면 여기에 16:9 미리보기가 나타납니다.</div>
          )}
        </section>
      </main>
    </>
  );
}
