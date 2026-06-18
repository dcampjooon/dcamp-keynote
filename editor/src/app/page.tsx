// ABOUTME: 홈 대시보드(/). 내 발표 목록을 카드로 보여주고, 클릭하면 에디터로 진입. 새 발표·템플릿 메뉴 제공.
// ABOUTME: 에디터(/editor)와 분리 — 진입 시 바로 에디터가 아니라 목록을 먼저 본다.

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { DEFAULT_THEME, type Theme } from "@/lib/themes";

type DeckSummary = { id: string; title: string; theme: { id?: string } | null; status: string; updated_at: string };

export default function HomePage() {
  const router = useRouter();
  const [decks, setDecks] = useState<DeckSummary[]>([]);
  const [templates, setTemplates] = useState<Theme[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void Promise.all([
      fetch("/api/decks").then((r) => r.json()).then((d) => setDecks(d.decks ?? [])).catch(() => {}),
      fetch("/api/templates").then((r) => r.json()).then((d) => { if (Array.isArray(d.templates)) setTemplates(d.templates); }).catch(() => {}),
    ]).finally(() => setLoading(false));
  }, []);

  const swatchOf = (id?: string) => (templates.find((t) => t.id === id) ?? DEFAULT_THEME).swatch;

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <header className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-medium">키노트 에디터</h1>
          <p className="mt-1 text-sm text-muted-foreground">자연어로 설명하면 애니메이션 발표를 만들어 드립니다.</p>
        </div>
        <div className="flex gap-2">
          <Link href="/templates"><Button variant="outline">템플릿</Button></Link>
          <Link href="/editor"><Button>+ 새 발표 만들기</Button></Link>
        </div>
      </header>

      <h2 className="mb-3 text-sm font-medium text-muted-foreground">내 발표</h2>

      {loading ? (
        <div className="py-16 text-center text-sm text-muted-foreground">불러오는 중…</div>
      ) : decks.length === 0 ? (
        <div className="rounded-xl border border-dashed p-12 text-center">
          <p className="text-sm text-muted-foreground">아직 발표가 없습니다.</p>
          <Link href="/editor"><Button className="mt-4">첫 발표 만들기</Button></Link>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          {/* 새 발표 카드 */}
          <button
            onClick={() => router.push("/editor")}
            className="flex min-h-36 flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed text-muted-foreground transition hover:border-primary hover:text-primary"
          >
            <span className="text-3xl leading-none">+</span>
            <span className="text-sm font-medium">새 발표 만들기</span>
          </button>

          {decks.map((d) => {
            const [c1, c2] = swatchOf(d.theme?.id);
            return (
              <Link
                key={d.id}
                href={`/editor?deck=${d.id}`}
                className="group flex min-h-36 flex-col overflow-hidden rounded-xl border bg-card transition hover:shadow-md"
              >
                <div className="h-16 w-full" style={{ background: `linear-gradient(120deg, ${c1}, ${c2})` }} />
                <div className="flex flex-1 flex-col p-3">
                  <div className="line-clamp-2 text-sm font-medium">{d.title}</div>
                  <div className="mt-auto flex items-center justify-between pt-2 text-[11px] text-muted-foreground">
                    <span>{new Date(d.updated_at).toLocaleDateString()}</span>
                    <span className="opacity-0 transition group-hover:opacity-100">열기 →</span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </main>
  );
}
