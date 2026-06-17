// ABOUTME: HTML 익스포트 라우트(GET ?deckId=). DB에서 덱+슬라이드를 읽어 자립형 단일 HTML로 내려준다(첨부 다운로드).
// ABOUTME: 실제 렌더와 동일한 SlideView/CSS를 재사용하므로 미리보기와 결과가 일치한다.

import { buildExportHtml } from "@/lib/export-html";
import type { RenderSlide } from "@/components/slide-renderer/SlideView";
import { supabaseAdmin } from "@/lib/supabase";
import { themeById } from "@/lib/themes";

export async function GET(request: Request) {
  try {
    const deckId = new URL(request.url).searchParams.get("deckId");
    if (!deckId) return Response.json({ error: "deckId가 필요합니다." }, { status: 400 });

    const { data: deck } = await supabaseAdmin.from("decks").select("title, theme").eq("id", deckId).single();
    const { data: rows, error } = await supabaseAdmin
      .from("slides")
      .select("id, version, layout, title, blocks, notes")
      .eq("deck_id", deckId)
      .order("idx", { ascending: true });

    if (error || !rows || rows.length === 0) {
      return Response.json({ error: "슬라이드를 찾을 수 없습니다." }, { status: 404 });
    }

    const title = deck?.title || "발표";
    const theme = themeById((deck?.theme as { id?: string } | null)?.id);
    const html = await buildExportHtml(title, rows as unknown as RenderSlide[], theme);

    const filename = `${title.replace(/[^\p{L}\p{N}\-_]+/gu, "_").slice(0, 40) || "deck"}.html`;
    return new Response(html, {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "알 수 없는 오류";
    return Response.json({ error: message }, { status: 500 });
  }
}
