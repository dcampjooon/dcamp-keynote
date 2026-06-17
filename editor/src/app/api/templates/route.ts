// ABOUTME: 템플릿 목록(GET: 빌트인 + 사용자) / 생성(POST). 사용자 템플릿은 templates 테이블(theme jsonb)에 저장.

import { supabaseAdmin, DEV_USER_ID } from "@/lib/supabase/admin";
import { THEMES } from "@/lib/themes";
import { rowToTheme } from "@/lib/templates-server";

export async function GET() {
  try {
    const { data } = await supabaseAdmin
      .from("templates")
      .select("id, name, description, theme")
      .eq("owner", DEV_USER_ID)
      .order("created_at", { ascending: false });
    const user = (data ?? []).map((r) => rowToTheme(r as never));
    return Response.json({ templates: [...THEMES.map((t) => ({ ...t, builtin: true })), ...user] });
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : "오류" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const b = await request.json();
    if (!b.name?.trim()) return Response.json({ error: "이름이 필요합니다." }, { status: 400 });
    const { data, error } = await supabaseAdmin
      .from("templates")
      .insert({
        owner: DEV_USER_ID,
        name: b.name.trim(),
        description: b.desc ?? "",
        is_builtin: false,
        theme: { tokens: b.tokens ?? {}, surround: b.surround ?? "#0a0e24", swatch: b.swatch ?? ["#2f6df6", "#14b8c4"], layouts: b.layouts ?? [], pdfPath: b.pdfPath ?? "", page: b.page ?? { size: "16:9", orientation: "landscape" } },
      })
      .select("id, name, description, theme")
      .single();
    if (error || !data) return Response.json({ error: error?.message || "생성 실패" }, { status: 500 });
    return Response.json({ template: rowToTheme(data as never) });
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : "오류" }, { status: 500 });
  }
}
