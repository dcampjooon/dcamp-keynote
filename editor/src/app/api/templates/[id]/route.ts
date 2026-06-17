// ABOUTME: 템플릿 단건 조회/수정/삭제. 빌트인은 코드에서 읽기 전용, 사용자 템플릿만 수정·삭제 가능.

import { supabaseAdmin, DEV_USER_ID } from "@/lib/supabase/admin";
import { THEMES } from "@/lib/themes";
import { rowToTheme } from "@/lib/templates-server";

export async function GET(_req: Request, ctx: RouteContext<"/api/templates/[id]">) {
  const { id } = await ctx.params;
  const builtin = THEMES.find((t) => t.id === id);
  if (builtin) return Response.json({ template: { ...builtin, builtin: true } });
  const { data, error } = await supabaseAdmin.from("templates").select("id, name, description, theme").eq("id", id).single();
  if (error || !data) return Response.json({ error: "템플릿을 찾을 수 없습니다." }, { status: 404 });
  return Response.json({ template: rowToTheme(data as never) });
}

export async function PUT(request: Request, ctx: RouteContext<"/api/templates/[id]">) {
  const { id } = await ctx.params;
  if (THEMES.some((t) => t.id === id)) return Response.json({ error: "빌트인 템플릿은 수정할 수 없습니다." }, { status: 403 });
  const b = await request.json();
  const { data, error } = await supabaseAdmin
    .from("templates")
    .update({ name: b.name?.trim(), description: b.desc ?? "", theme: { tokens: b.tokens ?? {}, surround: b.surround ?? "#0a0e24", swatch: b.swatch ?? ["#2f6df6", "#14b8c4"] } })
    .eq("id", id)
    .eq("owner", DEV_USER_ID)
    .select("id, name, description, theme")
    .single();
  if (error || !data) return Response.json({ error: error?.message || "수정 실패" }, { status: 500 });
  return Response.json({ template: rowToTheme(data as never) });
}

export async function DELETE(_req: Request, ctx: RouteContext<"/api/templates/[id]">) {
  const { id } = await ctx.params;
  if (THEMES.some((t) => t.id === id)) return Response.json({ error: "빌트인 템플릿은 삭제할 수 없습니다." }, { status: 403 });
  const { error } = await supabaseAdmin.from("templates").delete().eq("id", id).eq("owner", DEV_USER_ID);
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ ok: true });
}
