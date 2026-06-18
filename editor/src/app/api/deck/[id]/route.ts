// ABOUTME: 덱 단건 로드(GET)·삭제(DELETE). 테마 + 슬라이드(편집 가능 형태)를 반환. RLS로 멤버만 접근 가능.

import { supabaseAdmin, DEV_USER_ID } from "@/lib/supabase/admin";

export async function GET(_req: Request, ctx: RouteContext<"/api/deck/[id]">) {
  try {
    const { id } = await ctx.params;
    const supabase = supabaseAdmin;
    const { data: deck, error: deckErr } = await supabase.from("decks").select("id, title, theme").eq("id", id).single();
    if (deckErr || !deck) return Response.json({ error: "덱을 찾을 수 없습니다." }, { status: 404 });

    const { data: slides, error } = await supabase
      .from("slides")
      .select("id, version, layout, title, blocks, notes")
      .eq("deck_id", id)
      .order("idx", { ascending: true });
    if (error) return Response.json({ error: error.message }, { status: 500 });

    return Response.json({ deckId: deck.id, title: deck.title, themeId: (deck.theme as { id?: string } | null)?.id ?? "default", slides: slides ?? [] });
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : "오류" }, { status: 500 });
  }
}

export async function DELETE(_req: Request, ctx: RouteContext<"/api/deck/[id]">) {
  try {
    const { id } = await ctx.params;
    const supabase = supabaseAdmin;
    // 슬라이드 먼저 정리(외래키 cascade 미설정 대비) 후 덱 삭제. 소유자 본인 것만.
    await supabase.from("slides").delete().eq("deck_id", id);
    const { error } = await supabase.from("decks").delete().eq("id", id).eq("owner", DEV_USER_ID);
    if (error) return Response.json({ error: error.message }, { status: 500 });
    return Response.json({ ok: true });
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : "오류" }, { status: 500 });
  }
}
