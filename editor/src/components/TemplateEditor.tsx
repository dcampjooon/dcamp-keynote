// ABOUTME: 템플릿 에디터. 샘플 PDF를 분석해 '레이아웃들(표지/간지/본문 등)'과 전역 디자인(색·폰트·여백)을 채우고, 레이아웃별로 영역/배치를 세세히 편집·미리보기 후 저장.
// ABOUTME: 고정 프리셋이 아니라 PDF에서 발견된(또는 직접 추가한) 레이아웃이 기준. 각 레이아웃을 데이터로 정의하면 렌더러가 그대로 그린다.

"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { toast, Toaster } from "sonner";
import { renderPdfPageToDataUrl } from "@/lib/pdf-render";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { DeckView } from "@/components/slide-renderer/DeckView";
import { RegionLayoutCanvas } from "@/components/RegionLayoutCanvas";
import type { RenderSlide } from "@/components/slide-renderer/SlideView";
import { FONTS, DEFAULT_SETTINGS, DEFAULT_LAYOUTS, DEFAULT_PAGE, pageDims, settingsToTokens, tokensToSettings, type Theme, type TemplateSettings, type Density, type LayoutSpec, type LayoutRole, type AccentStyle, type Region, type RegionKind, type PageSpec, type PageSize, type Orientation } from "@/lib/themes";

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="flex items-center justify-between gap-3 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="flex items-center gap-2">
        <Input value={value} onChange={(e) => onChange(e.target.value)} className="h-8 w-24 font-mono text-xs" />
        <input type="color" value={value} onChange={(e) => onChange(e.target.value)} className="h-8 w-9 cursor-pointer rounded border" />
      </span>
    </label>
  );
}
function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="flex items-center justify-between gap-3 text-sm"><span className="text-muted-foreground">{label}</span>{children}</label>;
}
function ToggleColor({ label, value, fallback, onChange }: { label: string; value: string; fallback: string; onChange: (v: string) => void }) {
  const on = !!value;
  return (
    <Row label={label}>
      <span className="flex items-center gap-2">
        <input type="checkbox" checked={on} onChange={(e) => onChange(e.target.checked ? fallback : "")} className="size-4" />
        <input type="color" value={on ? value : fallback} disabled={!on} onChange={(e) => onChange(e.target.value)} className="h-8 w-9 cursor-pointer rounded border disabled:opacity-40" />
      </span>
    </Row>
  );
}

const ROLE_LABEL: Record<LayoutRole, string> = { cover: "표지", section: "간지", body: "본문" };
const ACCENTS: AccentStyle[] = ["none", "bar-top", "bar-left", "underline", "block"];
const ACCENT_LABEL: Record<AccentStyle, string> = { none: "없음", "bar-top": "가로 바", "bar-left": "세로 바", underline: "밑줄", block: "블록" };

function sampleForRole(role: LayoutRole): RenderSlide {
  if (role === "cover")
    return { layout: "title", title: "발표 제목 예시", notes: "", blocks: [{ id: "s", type: "subhead", text: "부제 — 한 줄 설명", column: "full", anim: "fade" }] };
  if (role === "section")
    return { layout: "section", title: "섹션 제목 예시", notes: "", blocks: [] };
  return {
    layout: "standard", title: "본문 헤드라인 예시", notes: "",
    blocks: [{ id: "b", type: "bullets", column: "full", anim: "rise", items: ["핵심 포인트 하나", "핵심 포인트 둘", "핵심 포인트 셋"] }],
  };
}

export function TemplateEditor({ initial, templateId }: { initial?: Theme; templateId?: string }) {
  const readOnly = !!initial?.builtin;
  const [name, setName] = useState(initial ? (readOnly ? `${initial.name} 복사본` : initial.name) : "새 템플릿");
  const [s, setS] = useState<TemplateSettings>(initial ? tokensToSettings(initial.tokens, initial.surround) : DEFAULT_SETTINGS);
  const [layouts, setLayouts] = useState<LayoutSpec[]>(initial?.layouts?.length ? initial.layouts : DEFAULT_LAYOUTS);
  const [sel, setSel] = useState(0);
  const [selReg, setSelReg] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [tid, setTid] = useState<string | undefined>(templateId);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [pdfBuf, setPdfBuf] = useState<ArrayBuffer | null>(null);
  const [overlayOn, setOverlayOn] = useState(false);
  const [overlayUrl, setOverlayUrl] = useState("");
  const pageCache = useRef<Map<number, string>>(new Map());
  const [ready, setReady] = useState(!!initial); // 신규 PDF 흐름은 분석 후 카드 표시
  const [logs, setLogs] = useState<string[]>([]);
  const [pdfPath, setPdfPath] = useState(initial?.pdfPath ?? "");
  const [pdfDirty, setPdfDirty] = useState(false);
  const [page, setPage] = useState<PageSpec>(initial?.page ?? DEFAULT_PAGE);
  const dims = useMemo(() => pageDims(page), [page]);

  // 기존 템플릿에 저장된 원본 PDF가 있으면 불러와 '원본 보기' 가능하게
  useEffect(() => {
    if (initial?.pdfPath && !pdfBuf) {
      void fetch(`/api/templates/pdf?path=${encodeURIComponent(initial.pdfPath)}`)
        .then((r) => (r.ok ? r.arrayBuffer() : null))
        .then((b) => { if (b) setPdfBuf(b); })
        .catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const set = <K extends keyof TemplateSettings>(k: K, v: TemplateSettings[K]) => setS((p) => ({ ...p, [k]: v }));
  const tokens = useMemo(() => settingsToTokens(s), [s]);
  const cur = layouts[Math.min(sel, layouts.length - 1)] ?? DEFAULT_LAYOUTS[0];
  const setLayout = (patch: Partial<LayoutSpec>) => setLayouts((ls) => ls.map((l, i) => (i === sel ? { ...l, ...patch } : l)));
  const regions = cur.regions ?? [];
  const region = regions.find((r) => r.id === selReg);
  const setRegions = (rs: Region[]) => setLayout({ regions: rs });
  const setRegion = (patch: Partial<Region>) => setRegions(regions.map((r) => (r.id === selReg ? { ...r, ...patch } : r)));
  const addRegion = () => {
    const id = `${cur.id}-r${Date.now().toString(36)}`;
    setRegions([...regions, { id, kind: "text", label: "text", x: 12, y: 12, w: 40, h: 10, sampleText: "텍스트", fontSize: 20, color: "", bg: "", weight: "normal", align: "left", orient: "h", thickness: 3 }]);
    setSelReg(id);
  };
  const removeRegion = () => { if (region) { setRegions(regions.filter((r) => r.id !== selReg)); setSelReg(""); } };

  async function analyzePdf(file: File) {
    setAnalyzing(true);
    const STEPS = [
      `📄 PDF 업로드 (${(file.size / 1048576).toFixed(1)}MB) · ${file.name}`,
      "🔍 페이지 전체를 함께 분석 중…",
      "🎨 색 팔레트·폰트·여백 추출 중…",
      "🧩 레이아웃 종류(표지/간지/본문…) 발견 중…",
      "📐 영역 위치·선·텍스트·차트 자리 추출 중…",
      "🖊 실제 텍스트를 영역에 매핑 중…",
    ];
    setLogs([STEPS[0]]);
    let i = 1;
    const t0 = Date.now();
    const iv = setInterval(() => {
      if (i < STEPS.length) { setLogs((l) => [...l, STEPS[i++]]); return; }
      // 단계 안내가 끝나면 경과 시간을 갱신해 '멈춘 것처럼' 보이지 않게(분석은 보통 1~3분, 페이지 많으면 더).
      const sec = Math.round((Date.now() - t0) / 1000);
      setLogs((l) => [...l.slice(0, STEPS.length), `⏳ 모델이 PDF를 읽고 분석 중… (${sec}s 경과 · 보통 1~3분, 페이지가 많으면 더 걸립니다)`]);
    }, 1000);
    try {
      const buf = await file.arrayBuffer();
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/templates/analyze", { method: "POST", body: fd });
      const data = await res.json();
      clearInterval(iv);
      if (!res.ok) throw new Error(data.error || "분석 실패");
      setS((prev) => ({ ...prev, ...data.settings }));
      const n = Array.isArray(data.layouts) ? data.layouts.length : 0;
      if (n) { setLayouts(data.layouts); setSel(0); setSelReg(""); }
      if (data.name) setName(data.name);
      if (data.page?.size) setPage(data.page);
      setPdfBuf(buf);
      setPdfDirty(true);
      pageCache.current.clear();
      setLogs([]); // 완료되면 로그 숨김
      forceSaveOnce.current = true; // 업로드 완료 → 새 템플릿으로 자동 생성
      setReady(true);
    } catch (e) {
      clearInterval(iv);
      setLogs((l) => [...l, `⚠ 실패 — ${e instanceof Error ? e.message : "오류"}`]);
      toast.error(e instanceof Error ? e.message : "오류");
    } finally {
      setAnalyzing(false);
    }
  }

  function addLayout() {
    setLayouts((ls) => [...ls, { ...DEFAULT_LAYOUTS[2], id: `body-${ls.length + 1}`, name: "새 레이아웃" }]);
    setSel(layouts.length);
  }
  function removeLayout(i: number) {
    if (layouts.length <= 1) return;
    setLayouts((ls) => ls.filter((_, k) => k !== i));
    setSel(0);
  }

  // 자동저장: 생성/수정을 자동 판별. 동시 저장 방지 + 저장 중 변경되면 재실행.
  const savingRef = useRef(false);
  const rerunRef = useRef(false);
  const tidRef = useRef<string | undefined>(templateId);
  async function persist() {
    if (savingRef.current) { rerunRef.current = true; return; }
    savingRef.current = true;
    setSaveState("saving");
    try {
      // 새로 분석한 PDF가 있으면 Storage에 저장해 언제든 원본 비교 가능하게
      let savedPdfPath = pdfPath;
      if (pdfDirty && pdfBuf) {
        const fd = new FormData();
        fd.append("file", new Blob([pdfBuf], { type: "application/pdf" }), "source.pdf");
        const up = await fetch("/api/templates/pdf", { method: "POST", body: fd });
        const upd = await up.json();
        if (up.ok && upd.path) { savedPdfPath = upd.path; setPdfPath(upd.path); setPdfDirty(false); }
      }
      const id = tidRef.current;
      const isUpdate = !!id && !(readOnly && id === templateId);
      const res = await fetch(isUpdate ? `/api/templates/${id}` : "/api/templates", {
        method: isUpdate ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim() || "새 템플릿", desc: "", tokens, surround: s.surround, swatch: [s.accent1, s.accent2], layouts, pdfPath: savedPdfPath, page }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "저장 실패");
      if (!isUpdate && data.template?.id) { tidRef.current = data.template.id; setTid(data.template.id); }
      setSaveState("saved");
    } catch (e) {
      setSaveState("error");
      toast.error(e instanceof Error ? e.message : "오류");
    } finally {
      savingRef.current = false;
      if (rerunRef.current) { rerunRef.current = false; void persist(); }
    }
  }

  // 변경 디바운스 자동저장(기존 템플릿 최초 로드는 건너뜀, PDF 분석 직후엔 강제 1회 저장)
  const snap = useMemo(
    () => JSON.stringify({ name, tokens, layouts, page, surround: s.surround, swatch: [s.accent1, s.accent2] }),
    [name, tokens, layouts, page, s.surround, s.accent1, s.accent2],
  );
  const initialSnap = useRef<string | null>(null);
  const forceSaveOnce = useRef(false);
  useEffect(() => {
    if (!ready || analyzing) return;
    if (initialSnap.current === null && !forceSaveOnce.current) { initialSnap.current = snap; return; }
    forceSaveOnce.current = false;
    initialSnap.current = snap;
    const t = setTimeout(() => { void persist(); }, 800);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [snap, ready, analyzing]);

  const sample = sampleForRole(cur.role);
  const canOverlay = !!pdfBuf && !!cur.sourcePage;

  // 원본 보기: 현재 레이아웃의 소스 페이지를 이미지로 렌더(캐시)
  useEffect(() => {
    if (!overlayOn || !pdfBuf || !cur.sourcePage) { setOverlayUrl(""); return; }
    const page = cur.sourcePage;
    const cached = pageCache.current.get(page);
    if (cached) { setOverlayUrl(cached); return; }
    let alive = true;
    void renderPdfPageToDataUrl(pdfBuf, page)
      .then((url) => { if (alive) { pageCache.current.set(page, url); setOverlayUrl(url); } })
      .catch(() => { if (alive) setOverlayUrl(""); });
    return () => { alive = false; };
  }, [overlayOn, pdfBuf, cur.sourcePage]);

  return (
    <>
      <Toaster richColors position="top-center" />
      <main className="grid h-screen grid-cols-[400px_1fr] overflow-hidden">
        <aside className="flex h-full flex-col gap-4 overflow-y-auto border-r bg-card p-5">
          <div className="flex items-center gap-2">
            <Link href="/templates" className="rounded-md border px-2.5 py-1 text-sm hover:bg-accent">← 템플릿</Link>
            <h1 className="text-lg font-medium">{templateId && !readOnly ? "템플릿 수정" : "새 템플릿"}</h1>
          </div>
          {readOnly && <div className="rounded-md bg-muted p-2.5 text-xs text-muted-foreground">빌트인 템플릿입니다. 값을 바꿔 새 템플릿으로 저장하세요.</div>}

          {/* PDF 분석 */}
          <div className="flex flex-col gap-2 rounded-md border border-primary/40 bg-primary/5 p-3">
            <div className="text-xs font-medium text-primary">샘플 PDF로 템플릿 만들기</div>
            <p className="text-xs text-muted-foreground">잘 만든 발표 PDF를 올리면 레이아웃(표지·간지·본문)과 색·폰트·여백을 분석해 아래를 채웁니다.</p>
            <label className="inline-flex cursor-pointer items-center justify-center rounded-md border bg-background px-3 py-2 text-sm font-medium hover:bg-accent">
              {analyzing ? "분석 중…" : "📄 PDF 업로드 분석"}
              <input type="file" accept="application/pdf" className="hidden" disabled={analyzing}
                onChange={(e) => { const f = e.target.files?.[0]; if (f) void analyzePdf(f); e.target.value = ""; }} />
            </label>
            {/* 진행 로그 */}
            {logs.length > 0 && (
              <div className="mt-1 flex flex-col gap-0.5 rounded-md border bg-background p-2.5 font-mono text-[11px] leading-relaxed text-muted-foreground">
                {logs.map((l, i) => (<div key={i} className="whitespace-pre-wrap">{l}</div>))}
                {analyzing && <div className="animate-pulse">▍</div>}
              </div>
            )}
          </div>

          {!ready && !analyzing && (
            <button className="self-start text-xs text-muted-foreground hover:underline" onClick={() => setReady(true)}>또는 빈 템플릿으로 직접 만들기 →</button>
          )}

          {ready && (
          <>
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium">이름</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="템플릿 이름" />
          </div>

          {/* 레이아웃 목록 */}
          <div className="flex flex-col gap-2.5 rounded-md border p-3">
            <div className="flex items-center justify-between">
              <div className="text-xs font-medium text-muted-foreground">레이아웃 ({layouts.length})</div>
              <button className="text-xs text-primary hover:underline" onClick={addLayout}>+ 추가</button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {layouts.map((l, i) => (
                <button key={l.id + i} onClick={() => setSel(i)}
                  className={`rounded-md border px-2.5 py-1 text-xs ${i === sel ? "border-primary bg-primary/10 font-medium" : "hover:border-muted-foreground/40"}`}>
                  {l.name || ROLE_LABEL[l.role]}
                </button>
              ))}
            </div>

            {/* 선택 레이아웃 편집 */}
            <div className="mt-1 flex flex-col gap-2 border-t pt-2.5">
              <Row label="이름"><Input value={cur.name} onChange={(e) => setLayout({ name: e.target.value })} className="h-8 w-40 text-sm" /></Row>
              <Row label="종류">
                <select value={cur.role} onChange={(e) => setLayout({ role: e.target.value as LayoutRole })} className="h-8 rounded-md border bg-background px-2 text-sm">
                  {(["cover", "section", "body"] as LayoutRole[]).map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
                </select>
              </Row>
              <div className="flex flex-col gap-1 rounded-md bg-primary/5 p-2">
                <label className="text-xs font-bold text-primary">이 장표 규칙 (생성 시 강제)</label>
                <Textarea value={cur.rule ?? ""} onChange={(e) => setLayout({ rule: e.target.value })} rows={3} className="text-xs"
                  placeholder={"이 장표 전체에 적용할 규칙·금지사항.\n예) 정의된 영역 외 임의 텍스트·정렬 금지. 한글 keep-all. 강조색은 헤드라인에만."} />
              </div>
              <ToggleColor label="배경색 지정" value={cur.bg} fallback={s.surround} onChange={(v) => setLayout({ bg: v })} />
              <ToggleColor label="텍스트색 지정" value={cur.fg} fallback="#ffffff" onChange={(v) => setLayout({ fg: v })} />
              <Row label="가로 정렬">
                <select value={cur.align} onChange={(e) => setLayout({ align: e.target.value as "left" | "center" })} className="h-8 rounded-md border bg-background px-2 text-sm">
                  <option value="left">왼쪽</option><option value="center">가운데</option>
                </select>
              </Row>
              <Row label="세로 위치">
                <select value={cur.vAlign} onChange={(e) => setLayout({ vAlign: e.target.value as "top" | "middle" })} className="h-8 rounded-md border bg-background px-2 text-sm">
                  <option value="top">상단</option><option value="middle">중앙</option>
                </select>
              </Row>
              <Row label={`제목 크기 ${cur.titleSize}px`}><input type="range" min={24} max={84} value={cur.titleSize} onChange={(e) => setLayout({ titleSize: +e.target.value })} /></Row>
              <Row label="강조 요소">
                <select value={cur.accent} onChange={(e) => setLayout({ accent: e.target.value as AccentStyle })} className="h-8 rounded-md border bg-background px-2 text-sm">
                  {ACCENTS.map((a) => <option key={a} value={a}>{ACCENT_LABEL[a]}</option>)}
                </select>
              </Row>
              <Row label="상단 브랜드"><input type="checkbox" checked={cur.kicker} onChange={(e) => setLayout({ kicker: e.target.checked })} className="size-4" /></Row>
              <Row label="하단 푸터/페이지번호"><input type="checkbox" checked={cur.footer} onChange={(e) => setLayout({ footer: e.target.checked })} className="size-4" /></Row>
              <Row label="본문 컬럼">
                <select value={cur.columns} onChange={(e) => setLayout({ columns: (+e.target.value as 1 | 2 | 3) })} className="h-8 rounded-md border bg-background px-2 text-sm">
                  <option value={1}>1단</option><option value={2}>2단</option><option value={3}>3단</option>
                </select>
              </Row>
              {cur.columns >= 2 && (
                <>
                  <ToggleColor label="컬럼 배경" value={cur.colBg ?? ""} fallback="#f4f6fa" onChange={(v) => setLayout({ colBg: v })} />
                  <Row label={`컬럼 간격 ${cur.colGap ?? 36}px`}><input type="range" min={0} max={80} value={cur.colGap ?? 36} onChange={(e) => setLayout({ colGap: +e.target.value })} /></Row>
                  <Row label={`컬럼 R값 ${cur.colRadius ?? 0}px`}><input type="range" min={0} max={32} value={cur.colRadius ?? 0} onChange={(e) => setLayout({ colRadius: +e.target.value })} /></Row>
                </>
              )}
              {layouts.length > 1 && <button className="self-start text-xs text-destructive hover:underline" onClick={() => removeLayout(sel)}>이 레이아웃 삭제</button>}
            </div>

            {/* 영역(zone) 편집 */}
            <div className="mt-1 flex flex-col gap-2 border-t pt-2.5">
              <div className="flex items-center justify-between">
                <div className="text-xs font-medium text-muted-foreground">영역 ({regions.length}) — 미리보기에서 드래그·리사이즈</div>
                <button className="text-xs text-primary hover:underline" onClick={addRegion}>+ 영역</button>
              </div>
              <div className="flex flex-wrap gap-1">
                {regions.map((r) => (
                  <button key={r.id} onClick={() => setSelReg(r.id)}
                    className={`rounded border px-1.5 py-0.5 text-[10px] ${r.id === selReg ? "border-primary bg-primary/10 font-medium" : "hover:border-muted-foreground/40"}`}>
                    {r.label}{r.kind !== "text" ? `·${r.kind}` : ""}
                  </button>
                ))}
                {regions.length === 0 && <span className="text-xs text-muted-foreground">PDF를 분석하거나 + 영역으로 추가하세요.</span>}
              </div>
              {region && (
                <div className="flex flex-col gap-1.5 rounded-md bg-muted/40 p-2">
                  <Row label="역할"><Input value={region.label} onChange={(e) => setRegion({ label: e.target.value })} className="h-7 w-36 text-xs" /></Row>
                  <Row label="종류">
                    <select value={region.kind} onChange={(e) => { const k = e.target.value as RegionKind; setRegion(k === "placeholder" && !region.bg ? { kind: k, bg: "#ffffff" } : { kind: k }); }} className="h-7 rounded border bg-background px-1 text-xs">
                      <option value="text">텍스트</option><option value="line">선</option><option value="placeholder">차트/이미지</option><option value="footer">푸터</option>
                    </select>
                  </Row>
                  {(region.kind === "text" || region.kind === "footer") && (
                    <>
                      <label className="text-xs text-muted-foreground">샘플 텍스트</label>
                      <Input value={region.sampleText ?? ""} onChange={(e) => setRegion({ sampleText: e.target.value })} className="h-7 text-xs" />
                      <Row label={`크기 ${region.fontSize ?? 20}px`}><input type="range" min={10} max={140} value={region.fontSize ?? 20} onChange={(e) => setRegion({ fontSize: +e.target.value })} /></Row>
                      <Row label="굵기">
                        <select value={region.weight ?? "normal"} onChange={(e) => setRegion({ weight: e.target.value as Region["weight"] })} className="h-7 rounded border bg-background px-1 text-xs">
                          <option value="normal">보통</option><option value="bold">굵게</option><option value="black">매우굵게</option>
                        </select>
                      </Row>
                      <Row label="정렬">
                        <select value={region.align ?? "left"} onChange={(e) => setRegion({ align: e.target.value as Region["align"] })} className="h-7 rounded border bg-background px-1 text-xs">
                          <option value="left">왼쪽</option><option value="center">가운데</option><option value="right">오른쪽</option>
                        </select>
                      </Row>
                    </>
                  )}
                  {region.kind === "line" && (
                    <>
                      <Row label="방향">
                        <select value={region.orient ?? "h"} onChange={(e) => setRegion({ orient: e.target.value as "h" | "v" })} className="h-7 rounded border bg-background px-1 text-xs">
                          <option value="h">가로</option><option value="v">세로</option>
                        </select>
                      </Row>
                      <Row label={`두께 ${region.thickness ?? 3}px`}><input type="range" min={1} max={12} value={region.thickness ?? 3} onChange={(e) => setRegion({ thickness: +e.target.value })} /></Row>
                    </>
                  )}
                  <Row label="색 지정">
                    <span className="flex items-center gap-2">
                      <input type="checkbox" checked={!!region.color} onChange={(e) => setRegion({ color: e.target.checked ? cur.fg || "#16233d" : "" })} className="size-4" />
                      <input type="color" value={region.color || "#16233d"} disabled={!region.color} onChange={(e) => setRegion({ color: e.target.value })} className="h-7 w-9 cursor-pointer rounded border disabled:opacity-40" />
                    </span>
                  </Row>
                  {region.kind !== "line" && (
                    <Row label="배경색">
                      <span className="flex items-center gap-2">
                        <input type="checkbox" checked={!!region.bg} onChange={(e) => setRegion({ bg: e.target.checked ? "#ffffff" : "" })} className="size-4" />
                        <input type="color" value={region.bg || "#ffffff"} disabled={!region.bg} onChange={(e) => setRegion({ bg: e.target.value })} className="h-7 w-9 cursor-pointer rounded border disabled:opacity-40" />
                      </span>
                    </Row>
                  )}
                  <div className="flex flex-col gap-1 rounded bg-primary/5 p-2">
                    <label className="text-[11px] font-bold text-primary">이 영역 규칙 (생성 시 강제)</label>
                    <Textarea value={region.rule ?? ""} onChange={(e) => setRegion({ rule: e.target.value })} rows={3} className="text-xs"
                      placeholder={region.kind === "placeholder"
                        ? "예) 제목·내용을 참고해 미니멀 일러스트 스타일 이미지를 생성해 넣는다. 캡션은 14px로 하단."
                        : "예) 제목을 2줄로, 조사 최소화·명사형 종결. 한글 keep-all. 날짜는 YYYY.MM.DD."} />
                  </div>
                  <button className="self-start text-xs text-destructive hover:underline" onClick={removeRegion}>영역 삭제</button>
                </div>
              )}
            </div>
          </div>

          {/* 전역 디자인 */}
          <div className="flex flex-col gap-2.5 rounded-md border p-3">
            <div className="text-xs font-medium text-muted-foreground">전역 디자인</div>
            <Row label="페이지 크기">
              <select value={page.size} onChange={(e) => setPage((p) => ({ ...p, size: e.target.value as PageSize }))} className="h-8 rounded-md border bg-background px-2 text-sm">
                <option value="16:9">16:9 (와이드)</option><option value="a4">A4 (문서)</option>
              </select>
            </Row>
            <Row label="방향">
              <select value={page.orientation} onChange={(e) => setPage((p) => ({ ...p, orientation: e.target.value as Orientation }))} className="h-8 rounded-md border bg-background px-2 text-sm">
                <option value="landscape">가로</option><option value="portrait">세로</option>
              </select>
            </Row>
            <Row label="웹폰트">
              <select value={s.fontId} onChange={(e) => set("fontId", e.target.value)} className="h-8 rounded-md border bg-background px-2 text-sm">
                {FONTS.map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}
              </select>
            </Row>
            <Row label="한글 잘림 방지"><input type="checkbox" checked={s.keepAll} onChange={(e) => set("keepAll", e.target.checked)} className="size-4" /></Row>
            <Row label={`모서리 라운드 ${s.radius}px`}><input type="range" min={0} max={28} value={s.radius} onChange={(e) => set("radius", +e.target.value)} /></Row>
            <Row label="여백 밀도">
              <select value={s.density} onChange={(e) => set("density", e.target.value as Density)} className="h-8 rounded-md border bg-background px-2 text-sm">
                <option value="compact">좁게</option><option value="normal">보통</option><option value="roomy">넓게</option>
              </select>
            </Row>
            <ColorField label="액센트 1" value={s.accent1} onChange={(v) => set("accent1", v)} />
            <ColorField label="액센트 2" value={s.accent2} onChange={(v) => set("accent2", v)} />
            <ColorField label="기본 본문 텍스트" value={s.ink} onChange={(v) => set("ink", v)} />
            <ColorField label="기본 슬라이드 배경" value={s.canvasBg} onChange={(v) => set("canvasBg", v)} />
            <ColorField label="발표 모드 바깥 배경" value={s.surround} onChange={(v) => set("surround", v)} />
          </div>

          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className={`inline-block size-2 rounded-full ${saveState === "saving" ? "animate-pulse bg-amber-500" : saveState === "error" ? "bg-destructive" : "bg-emerald-500"}`} />
            {saveState === "saving" ? "자동 저장 중…" : saveState === "error" ? "저장 실패 — 변경 시 재시도" : saveState === "saved" ? "자동 저장됨" : "변경하면 자동 저장됩니다"}
          </div>
          </>
          )}
        </aside>

        <section className="flex h-full min-w-0 flex-col gap-3 p-6" style={{ background: s.surround }}>
          <div className="flex items-center justify-between">
            <div className="text-xs font-medium text-white/70">미리보기 — {cur.name || ROLE_LABEL[cur.role]} {regions.length ? "(영역 드래그·리사이즈)" : ""}</div>
            {canOverlay && (
              <button onClick={() => setOverlayOn((v) => !v)}
                className={`rounded px-2.5 py-1 text-xs font-medium transition ${overlayOn ? "bg-white text-black" : "bg-white/15 text-white/80 hover:bg-white/25"}`}>
                {overlayOn ? "원본 숨기기" : "원본 보기(겹쳐 비교)"}
              </button>
            )}
          </div>
          <div className="min-h-0 flex-1">
            {regions.length ? (
              <RegionLayoutCanvas spec={cur} tokens={tokens} editable selectedId={selReg} overlayUrl={overlayOn ? overlayUrl : undefined} dims={dims} onSelect={setSelReg} onChange={setRegions} />
            ) : (
              <DeckView slides={[sample]} index={0} onIndexChange={() => {}} themeTokens={tokens} layouts={[cur]} dims={dims} />
            )}
          </div>
        </section>
      </main>
    </>
  );
}
