// ABOUTME: PPTX 익스포트 라우트(GET ?deckId=). DB 덱 → 편집 가능한 .pptx 파일 다운로드.
// ABOUTME: 텍스트/도형은 네이티브로 매핑되어 PowerPoint에서 그대로 수정 가능하다.

import { buildPptx } from "@/lib/export-pptx";
import type { RenderSlide } from "@/components/slide-renderer/SlideView";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { resolveTheme } from "@/lib/templates-server";

export async function GET(request: Request) {
  try {
    const deckId = new URL(request.url).searchParams.get("deckId");
    if (!deckId) return Response.json({ error: "deckId가 필요합니다." }, { status: 400 });

    const supabase = supabaseAdmin;
    const { data: deck } = await supabase.from("decks").select("title, theme").eq("id", deckId).single();
    const { data: rows, error } = await supabase
      .from("slides")
      .select("id, version, layout, title, blocks, notes")
      .eq("deck_id", deckId)
      .order("idx", { ascending: true });

    if (error || !rows || rows.length === 0) return Response.json({ error: "슬라이드를 찾을 수 없습니다." }, { status: 404 });

    const title = deck?.title || "발표";
    const theme = await resolveTheme((deck?.theme as { id?: string } | null)?.id);
    // 웹폰트 → PowerPoint 설치 폰트 매핑(한글 안전 폴백)
    const fontStack = theme.tokens["--font"] || "";
    const pptxFont = fontStack.includes("Nanum Myeongjo") ? "Nanum Myeongjo" : fontStack.includes("Noto Sans KR") ? "Noto Sans KR" : "Malgun Gothic";
    const buf = await buildPptx(title, rows as unknown as RenderSlide[], theme.tokens["--blue"], pptxFont, theme.layouts);
    const filename = `${title.replace(/[^\p{L}\p{N}\-_]+/gu, "_").slice(0, 40) || "deck"}.pptx`;

    return new Response(new Uint8Array(buf), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "알 수 없는 오류";
    return Response.json({ error: message }, { status: 500 });
  }
}
