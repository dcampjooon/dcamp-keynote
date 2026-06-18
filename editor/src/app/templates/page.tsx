// ABOUTME: 템플릿 목록(/templates). 빌트인 + 내가 만든 템플릿을 카드로 보여주고, 새로 만들기·수정·삭제·복제 진입.

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { toast, Toaster } from "sonner";
import { Button } from "@/components/ui/button";
import { type Theme } from "@/lib/themes";

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<Theme[]>([]);

  async function load() {
    const d = await fetch("/api/templates").then((r) => r.json()).catch(() => null);
    if (d?.templates) setTemplates(d.templates);
  }
  useEffect(() => { void load(); }, []);

  async function remove(id: string) {
    if (!confirm("이 템플릿을 삭제할까요?")) return;
    const res = await fetch(`/api/templates/${id}`, { method: "DELETE" });
    if (res.ok) { toast.success("삭제했습니다."); void load(); }
    else toast.error("삭제 실패");
  }

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <Toaster richColors position="top-center" />
      <header className="mb-8 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Link href="/" className="rounded-md border px-2.5 py-1 text-sm hover:bg-accent">← 홈</Link>
          <h1 className="text-2xl font-medium">템플릿</h1>
        </div>
        <Link href="/templates/new"><Button>+ 새 템플릿</Button></Link>
      </header>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        {templates.map((t) => (
          <div key={t.id} className="flex flex-col overflow-hidden rounded-xl border bg-card">
            <div className="h-20 w-full" style={{ background: `linear-gradient(120deg, ${t.swatch[0]}, ${t.swatch[1]})` }} />
            <div className="flex flex-1 flex-col p-3">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">{t.name}</span>
                {t.builtin && <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">기본</span>}
              </div>
              <div className="mt-auto flex gap-2 pt-3">
                {t.builtin ? (
                  <Link href={`/templates/${t.id}`} className="flex-1"><Button variant="outline" size="sm" className="w-full">복제</Button></Link>
                ) : (
                  <>
                    <Link href={`/templates/${t.id}`} className="flex-1"><Button variant="outline" size="sm" className="w-full">수정</Button></Link>
                    <Button variant="ghost" size="sm" className="text-destructive" onClick={() => void remove(t.id)}>삭제</Button>
                  </>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
