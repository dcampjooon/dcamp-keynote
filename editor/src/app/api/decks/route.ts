// ABOUTME: 내 덱 목록(GET). 단일 사용자 모드 — service 키로 dev 유저 소유 덱만 조회.

import { supabaseAdmin, DEV_USER_ID } from "@/lib/supabase/admin";

export async function GET() {
  try {
    const { data, error } = await supabaseAdmin
      .from("decks")
      .select("id, title, theme, status, updated_at")
      .eq("owner", DEV_USER_ID)
      .order("updated_at", { ascending: false });
    if (error) return Response.json({ error: error.message }, { status: 500 });
    return Response.json({ decks: data ?? [] });
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : "오류" }, { status: 500 });
  }
}
