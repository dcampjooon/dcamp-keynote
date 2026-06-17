// ABOUTME: 내 덱 목록(GET). RLS로 멤버인 덱만 조회된다. 홈의 "내 발표" 목록에 사용.

import { createSupabaseServer } from "@/lib/supabase/server";

export async function GET() {
  try {
    const supabase = await createSupabaseServer();
    const { data, error } = await supabase
      .from("decks")
      .select("id, title, theme, status, updated_at")
      .order("updated_at", { ascending: false });
    if (error) return Response.json({ error: error.message }, { status: 500 });
    return Response.json({ decks: data ?? [] });
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : "오류" }, { status: 500 });
  }
}
