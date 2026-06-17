// ABOUTME: 템플릿(테마) 에디터. 색·폰트·word-break·라운드·여백 밀도·표지/간지/본문 헤드라인 크기를 세세히 설정하고 실시간 미리보기로 확인 후 저장.
// ABOUTME: 모든 설정은 CSS 토큰으로 변환되어 미리보기·HTML·PPTX 익스포트에 동일 적용된다. 빌트인은 읽기전용(복제만).

"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast, Toaster } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DeckView } from "@/components/slide-renderer/DeckView";
import { SEED_SLIDES } from "@/lib/seed-deck";
import { FONTS, DEFAULT_SETTINGS, settingsToTokens, tokensToSettings, type Theme, type TemplateSettings, type Density } from "@/lib/themes";

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
  return (
    <label className="flex items-center justify-between gap-3 text-sm">
      <span className="text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

export function TemplateEditor({ initial, templateId }: { initial?: Theme; templateId?: string }) {
  const router = useRouter();
  const readOnly = !!initial?.builtin;
  const init = initial ? tokensToSettings(initial.tokens, initial.surround) : DEFAULT_SETTINGS;
  const [name, setName] = useState(initial ? (readOnly ? `${initial.name} 복사본` : initial.name) : "새 템플릿");
  const [s, setS] = useState<TemplateSettings>(init);
  const [previewIdx, setPreviewIdx] = useState(0);
  const [saving, setSaving] = useState(false);

  const set = <K extends keyof TemplateSettings>(k: K, v: TemplateSettings[K]) => setS((p) => ({ ...p, [k]: v }));
  const tokens = useMemo(() => settingsToTokens(s), [s]);
  const [analyzing, setAnalyzing] = useState(false);

  async function analyzePdf(file: File) {
    setAnalyzing(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/templates/analyze", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "분석 실패");
      setS((prev) => ({ ...prev, ...data.settings }));
      if (data.name) setName(data.name);
      toast.success(data.rationale ? `분석 완료 — ${data.rationale}` : "디자인을 분석해 적용했습니다.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "오류");
    } finally {
      setAnalyzing(false);
    }
  }

  async function save() {
    if (!name.trim()) return toast.error("이름을 입력하세요.");
    setSaving(true);
    try {
      const isUpdate = !!templateId && !readOnly;
      const res = await fetch(isUpdate ? `/api/templates/${templateId}` : "/api/templates", {
        method: isUpdate ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, desc: "", tokens, surround: s.surround, swatch: [s.accent1, s.accent2] }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "저장 실패");
      toast.success("템플릿을 저장했습니다.");
      router.push("/templates");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "오류");
    } finally {
      setSaving(false);
    }
  }

  const previews = [
    { i: 0, label: "표지" },
    { i: 1, label: "강조" },
    { i: 2, label: "2단" },
    { i: 3, label: "본문" },
  ];

  return (
    <>
      <Toaster richColors position="top-center" />
      <main className="grid h-screen grid-cols-[380px_1fr] overflow-hidden">
        <aside className="flex h-full flex-col gap-4 overflow-y-auto border-r bg-card p-5">
          <div className="flex items-center gap-2">
            <Link href="/templates" className="rounded-md border px-2.5 py-1 text-sm hover:bg-accent">← 템플릿</Link>
            <h1 className="text-lg font-bold">{templateId && !readOnly ? "템플릿 수정" : "새 템플릿"}</h1>
          </div>
          {readOnly && <div className="rounded-md bg-muted p-2.5 text-xs text-muted-foreground">빌트인 템플릿입니다. 값을 바꿔 새 템플릿으로 저장하세요.</div>}

          {/* 샘플 PDF에서 디자인 분석 */}
          <div className="flex flex-col gap-2 rounded-md border border-primary/40 bg-primary/5 p-3">
            <div className="text-xs font-bold text-primary">샘플 PDF로 디자인 가져오기</div>
            <p className="text-xs text-muted-foreground">잘 만든 발표 PDF를 올리면 여백·색·타이포·모서리 등 공통 디자인을 분석해 아래 설정을 채웁니다.</p>
            <label className="inline-flex cursor-pointer items-center justify-center rounded-md border bg-background px-3 py-2 text-sm font-medium hover:bg-accent">
              {analyzing ? "분석 중…" : "📄 PDF 업로드 분석"}
              <input type="file" accept="application/pdf" className="hidden" disabled={analyzing}
                onChange={(e) => { const f = e.target.files?.[0]; if (f) void analyzePdf(f); e.target.value = ""; }} />
            </label>
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium">이름</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="템플릿 이름" />
          </div>

          {/* 타이포그래피 */}
          <div className="flex flex-col gap-2.5 rounded-md border p-3">
            <div className="text-xs font-bold text-muted-foreground">타이포그래피</div>
            <Row label="웹폰트">
              <select value={s.fontId} onChange={(e) => set("fontId", e.target.value)} className="h-8 rounded-md border bg-background px-2 text-sm">
                {FONTS.map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}
              </select>
            </Row>
            <Row label="한글 잘림 방지 (keep-all)">
              <input type="checkbox" checked={s.keepAll} onChange={(e) => set("keepAll", e.target.checked)} className="size-4" />
            </Row>
            <Row label={`표지 헤드라인 ${s.titleSize}px`}>
              <input type="range" min={36} max={84} value={s.titleSize} onChange={(e) => set("titleSize", +e.target.value)} />
            </Row>
            <Row label={`간지 헤드라인 ${s.sectionSize}px`}>
              <input type="range" min={32} max={72} value={s.sectionSize} onChange={(e) => set("sectionSize", +e.target.value)} />
            </Row>
            <Row label={`본문 헤드라인 ${s.bodySize}px`}>
              <input type="range" min={28} max={56} value={s.bodySize} onChange={(e) => set("bodySize", +e.target.value)} />
            </Row>
          </div>

          {/* 레이아웃 */}
          <div className="flex flex-col gap-2.5 rounded-md border p-3">
            <div className="text-xs font-bold text-muted-foreground">레이아웃</div>
            <Row label={`모서리 라운드 ${s.radius}px`}>
              <input type="range" min={0} max={28} value={s.radius} onChange={(e) => set("radius", +e.target.value)} />
            </Row>
            <Row label="여백 밀도">
              <select value={s.density} onChange={(e) => set("density", e.target.value as Density)} className="h-8 rounded-md border bg-background px-2 text-sm">
                <option value="compact">좁게</option>
                <option value="normal">보통</option>
                <option value="roomy">넓게</option>
              </select>
            </Row>
          </div>

          {/* 색 */}
          <div className="flex flex-col gap-2.5 rounded-md border p-3">
            <div className="text-xs font-bold text-muted-foreground">색</div>
            <ColorField label="액센트 1 (메인)" value={s.accent1} onChange={(v) => set("accent1", v)} />
            <ColorField label="액센트 2 (보조)" value={s.accent2} onChange={(v) => set("accent2", v)} />
            <ColorField label="본문 텍스트" value={s.ink} onChange={(v) => set("ink", v)} />
            <ColorField label="슬라이드 배경" value={s.canvasBg} onChange={(v) => set("canvasBg", v)} />
            <ColorField label="발표 모드 바깥 배경" value={s.surround} onChange={(v) => set("surround", v)} />
            <div className="mt-1 h-5 w-full rounded" style={{ background: `linear-gradient(120deg, ${s.accent1}, ${s.accent2})` }} />
          </div>

          <Button onClick={() => void save()} disabled={saving}>{saving ? "저장 중…" : templateId && !readOnly ? "수정 저장" : "새 템플릿으로 저장"}</Button>
        </aside>

        <section className="flex h-full min-w-0 flex-col gap-3 p-6" style={{ background: s.surround }}>
          <div className="flex gap-1.5">
            {previews.map((p) => (
              <button key={p.i} onClick={() => setPreviewIdx(p.i)}
                className={`rounded-md px-3 py-1 text-xs font-medium transition ${previewIdx === p.i ? "bg-white text-black" : "bg-white/15 text-white/80 hover:bg-white/25"}`}>
                {p.label}
              </button>
            ))}
          </div>
          <div className="min-h-0 flex-1">
            <DeckView slides={SEED_SLIDES} index={previewIdx} onIndexChange={setPreviewIdx} themeTokens={tokens} />
          </div>
        </section>
      </main>
    </>
  );
}
