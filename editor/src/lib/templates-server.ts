// ABOUTME: 서버 전용 템플릿 헬퍼. DB 템플릿 행 ↔ Theme 변환, id로 테마 resolve(빌트인 우선, 없으면 DB).
// ABOUTME: 익스포트 라우트가 deck.theme.id로 실제 토큰을 얻을 때 사용.

import { supabaseAdmin } from "@/lib/supabase/admin";
import { THEMES, DEFAULT_THEME, DEFAULT_LAYOUTS, type LayoutSpec, type Theme } from "@/lib/themes";

type Row = { id: string; name: string; description: string | null; theme: { tokens?: Record<string, string>; surround?: string; swatch?: [string, string]; layouts?: LayoutSpec[] } | null };

export function rowToTheme(row: Row): Theme {
  const t = row.theme ?? {};
  return {
    id: row.id,
    name: row.name,
    desc: row.description ?? "",
    tokens: t.tokens ?? {},
    surround: t.surround ?? "#0a0e24",
    swatch: t.swatch ?? ["#2f6df6", "#14b8c4"],
    layouts: t.layouts && t.layouts.length ? t.layouts : DEFAULT_LAYOUTS,
    builtin: false,
  };
}

/** id → Theme. 빌트인이면 코드에서, 아니면 DB에서 조회. 없으면 기본 테마. */
export async function resolveTheme(id?: string | null): Promise<Theme> {
  if (!id) return DEFAULT_THEME;
  const builtin = THEMES.find((t) => t.id === id);
  if (builtin) return builtin;
  const { data } = await supabaseAdmin.from("templates").select("id, name, description, theme").eq("id", id).single();
  return data ? rowToTheme(data as Row) : DEFAULT_THEME;
}
