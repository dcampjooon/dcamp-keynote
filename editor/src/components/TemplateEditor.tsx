// ABOUTME: 템플릿(테마) 에디터. 액센트·캔버스·발표배경 색을 고르면 실시간 미리보기에 반영되고, 저장 시 templates에 기록.
// ABOUTME: 새 템플릿(POST)·기존 수정(PUT) 공용. 빌트인은 읽기 전용으로 복제만 가능.

"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast, Toaster } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DeckView } from "@/components/slide-renderer/DeckView";
import { SEED_SLIDES } from "@/lib/seed-deck";
import { tokensFrom, type Theme } from "@/lib/themes";

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="flex items-center justify-between gap-3 text-sm">
      <span>{label}</span>
      <span className="flex items-center gap-2">
        <Input value={value} onChange={(e) => onChange(e.target.value)} className="h-8 w-24 font-mono text-xs" />
        <input type="color" value={value} onChange={(e) => onChange(e.target.value)} className="h-8 w-10 cursor-pointer rounded border" />
      </span>
    </label>
  );
}

export function TemplateEditor({ initial, templateId }: { initial?: Theme; templateId?: string }) {
  const router = useRouter();
  const readOnly = !!initial?.builtin;
  const [name, setName] = useState(initial ? (readOnly ? `${initial.name} 복사본` : initial.name) : "새 템플릿");
  const [accent1, setAccent1] = useState(initial?.tokens["--blue"] ?? "#2f6df6");
  const [accent2, setAccent2] = useState(initial?.tokens["--cyan"] ?? "#14b8c4");
  const [canvasBg, setCanvasBg] = useState(initial?.tokens["--canvas-bg"] ?? "#ffffff");
  const [surround, setSurround] = useState(initial?.surround ?? "#0a0e24");
  const [index, setIndex] = useState(3); // 다이어그램 슬라이드로 미리보기
  const [saving, setSaving] = useState(false);

  const tokens = useMemo(() => tokensFrom(accent1, accent2, canvasBg), [accent1, accent2, canvasBg]);
  const swatch: [string, string] = [accent1, accent2];

  async function save() {
    if (!name.trim()) return toast.error("이름을 입력하세요.");
    setSaving(true);
    try {
      // 빌트인 수정은 새 템플릿으로 복제 저장
      const isUpdate = !!templateId && !readOnly;
      const res = await fetch(isUpdate ? `/api/templates/${templateId}` : "/api/templates", {
        method: isUpdate ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, desc: "", tokens, surround, swatch }),
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

  return (
    <>
      <Toaster richColors position="top-center" />
      <main className="grid h-screen grid-cols-[360px_1fr] overflow-hidden">
        <aside className="flex h-full flex-col gap-4 overflow-y-auto border-r bg-card p-5">
          <div className="flex items-center gap-2">
            <Link href="/templates" className="rounded-md border px-2.5 py-1 text-sm hover:bg-accent">← 템플릿</Link>
            <h1 className="text-lg font-bold">{templateId && !readOnly ? "템플릿 수정" : "새 템플릿"}</h1>
          </div>

          {readOnly && <div className="rounded-md bg-muted p-2.5 text-xs text-muted-foreground">빌트인 템플릿은 수정할 수 없습니다. 색을 바꿔 새 템플릿으로 저장하세요.</div>}

          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium">이름</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="템플릿 이름" />
          </div>

          <div className="flex flex-col gap-3 rounded-md border p-3">
            <div className="text-xs font-bold text-muted-foreground">색</div>
            <ColorField label="액센트 1 (메인)" value={accent1} onChange={setAccent1} />
            <ColorField label="액센트 2 (보조)" value={accent2} onChange={setAccent2} />
            <ColorField label="슬라이드 배경" value={canvasBg} onChange={setCanvasBg} />
            <ColorField label="발표 모드 바깥 배경" value={surround} onChange={setSurround} />
            <div className="mt-1 h-6 w-full rounded" style={{ background: `linear-gradient(120deg, ${accent1}, ${accent2})` }} />
          </div>

          <Button onClick={() => void save()} disabled={saving}>{saving ? "저장 중…" : templateId && !readOnly ? "수정 저장" : "새 템플릿으로 저장"}</Button>
        </aside>

        <section className="flex h-full min-w-0 flex-col p-6" style={{ background: surround }}>
          <DeckView slides={SEED_SLIDES} index={index} onIndexChange={setIndex} themeTokens={tokens} />
        </section>
      </main>
    </>
  );
}
