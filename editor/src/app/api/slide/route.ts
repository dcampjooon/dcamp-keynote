// ABOUTME: 슬라이드 저장 라우트(PATCH). 화면 인라인 편집·AI 패치 결과를 DB에 반영하며 version으로 낙관적 잠금.
// ABOUTME: 같은 슬라이드를 다른 곳에서 먼저 바꿨으면(version 불일치) 409로 거부 — 편집 충돌 방지.

import { Slide } from "@/lib/slide-schema";
import { supabaseAdmin } from "@/lib/supabase";
import { z } from "zod";

const PatchBody = z.object({
  slideId: z.string(),
  version: z.number().int(),
  layout: Slide.shape.layout.optional(),
  title: z.string().optional(),
  notes: z.string().optional(),
  blocks: Slide.shape.blocks.optional(),
});

export async function PATCH(request: Request) {
  try {
    const parsed = PatchBody.safeParse(await request.json());
    if (!parsed.success) {
      return Response.json({ error: "잘못된 요청", detail: parsed.error.issues }, { status: 400 });
    }
    const { slideId, version, ...fields } = parsed.data;
    const update = Object.fromEntries(Object.entries(fields).filter(([, v]) => v !== undefined));

    const { data, error } = await supabaseAdmin
      .from("slides")
      .update({ ...update, version: version + 1 })
      .eq("id", slideId)
      .eq("version", version) // 낙관적 잠금: version이 그대로일 때만 적용
      .select()
      .single();

    if (error || !data) {
      // 행이 없으면 version 충돌(누군가 먼저 수정) 또는 없는 슬라이드
      return Response.json({ error: "version 충돌 — 최신 상태를 다시 불러오세요.", code: "version_conflict" }, { status: 409 });
    }
    return Response.json({ slide: data, version: data.version });
  } catch (err) {
    const message = err instanceof Error ? err.message : "알 수 없는 오류";
    return Response.json({ error: message }, { status: 500 });
  }
}
