// ABOUTME: [생성 단계] 라우트. 확정된 아웃라인 → 슬라이드를 하나씩 생성·검증(zod)·DB 저장 → 덱 반환.
// ABOUTME: 전체 한방 생성 금지(codex 권고). 슬라이드 단위 호출 + 실패 시 1회 리페어. 진행은 ai_jobs로 추적.

import { z } from "zod";
import { anthropic, MODEL } from "@/lib/anthropic";
import { SLIDE_SYSTEM, deckContext } from "@/lib/prompts";
import { Outline, Slide, type SlidePlan } from "@/lib/slide-schema";
import { supabaseAdmin, DEV_USER_ID } from "@/lib/supabase/admin";
import { resolveTheme } from "@/lib/templates-server";
import { layoutForSlide, type LayoutSpec } from "@/lib/themes";

const SlideContent = Slide.omit({ id: true });
// 블록 union이 커서 strict structured output은 "grammar too large"로 거부된다.
// → non-strict 도구 호출로 스키마를 '힌트'로 주고, zod로 직접 검증한다(문법 컴파일 회피).
const SLIDE_TOOL_SCHEMA = z.toJSONSchema(SlideContent) as Record<string, unknown>;

/** 선택된 템플릿 레이아웃의 영역(region) 구성을 생성 프롬프트용 가이드 텍스트로 변환. */
function regionGuide(spec: LayoutSpec): string {
  const parts: string[] = [];
  const regions = spec.regions ?? [];
  const items = regions
    .map((r) => {
      if (r.kind === "placeholder") return `· "${r.label}" 차트/이미지 자리 — diagram(데이터 도식) 또는 image 블록으로 채움`;
      if (r.kind === "line" || r.kind === "footer") return null; // 구분선·푸터는 렌더가 처리
      const lines = ((r.sampleText ?? "").match(/\n/g)?.length ?? 0) + 1;
      const ex = (r.sampleText ?? "").replace(/\s+/g, " ").trim().slice(0, 36);
      return `· "${r.label}" 텍스트 — 약 ${lines}줄 분량${ex ? ` (예: "${ex}")` : ""}`;
    })
    .filter(Boolean);
  if (items.length) {
    parts.push(`[이 슬라이드는 선택된 템플릿의 영역 구성을 따른다 — 각 영역에 맞는 블록을 채워라]\n${items.join("\n")}`);
  }
  if (spec.columns >= 2) {
    parts.push(`본문 하단은 ${spec.columns}단 — 차트/카드 블록을 컬럼으로 나눠 배치(좌=left, ${spec.columns >= 3 ? "가운데=mid, " : ""}우=right).`);
  }
  return parts.join("\n");
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = Outline.safeParse(body.outline);
    if (!parsed.success) {
      return Response.json({ error: "유효한 아웃라인이 아닙니다.", detail: parsed.error.issues }, { status: 400 });
    }
    const outline = parsed.data;
    const themeId = typeof body.themeId === "string" ? body.themeId : "dcamp-white";

    const supabase = supabaseAdmin;

    // 1) 덱 생성 (owner=고정 dev 유저)
    const { data: deck, error: deckErr } = await supabase
      .from("decks")
      .insert({ owner: DEV_USER_ID, title: outline.title || "제목 없는 발표", status: "generating", theme: { id: themeId } })
      .select()
      .single();
    if (deckErr || !deck) {
      return Response.json({ error: `덱 생성 실패: ${deckErr?.message}` }, { status: 500 });
    }

    // ai_job 시작 기록
    const { data: job } = await supabase
      .from("ai_jobs")
      .insert({ deck_id: deck.id, kind: "generate_slide", status: "running", input: { outline } })
      .select()
      .single();

    const ctx = deckContext(
      outline.title,
      outline.storyline,
      outline.slides.map((s) => `[${s.layout}] ${s.headline}`),
    );

    // 선택된 템플릿의 레이아웃들 — 슬라이드 role에 맞는 영역 구성을 생성에 반영
    const theme = await resolveTheme(themeId);

    // 2) 슬라이드 단위 생성 + 검증 + 저장
    const slides = [];
    for (let i = 0; i < outline.slides.length; i++) {
      const plan = outline.slides[i];
      const guide = regionGuide(layoutForSlide(plan.layout, theme.layouts));
      const content = await generateSlide(ctx, plan, i + 1, outline.slides.length, guide);

      const { data: row, error: slideErr } = await supabase
        .from("slides")
        .insert({ deck_id: deck.id, idx: i, layout: content.layout, title: content.title, blocks: content.blocks, notes: content.notes })
        .select()
        .single();
      if (slideErr || !row) {
        await supabase.from("ai_jobs").update({ status: "failed", error: slideErr?.message }).eq("id", job?.id);
        return Response.json({ error: `슬라이드 ${i + 1} 저장 실패: ${slideErr?.message}` }, { status: 500 });
      }
      slides.push({ id: row.id, version: row.version, ...content });
    }

    await supabase.from("decks").update({ status: "ready" }).eq("id", deck.id);
    await supabase.from("ai_jobs").update({ status: "succeeded", output: { count: slides.length } }).eq("id", job?.id);

    return Response.json({ deckId: deck.id, title: outline.title, subtitle: outline.subtitle, themeId, slides });
  } catch (err) {
    const message = err instanceof Error ? err.message : "알 수 없는 오류";
    return Response.json({ error: message }, { status: 500 });
  }
}

/** 슬라이드 한 장 생성. parse 실패 시 1회 리페어 후, 그래도 실패하면 최소 슬라이드로 폴백. */
async function generateSlide(ctx: string, plan: SlidePlan, n: number, total: number, layoutGuide = "") {
  const planText = `[이 슬라이드(${n}/${total}) 계획]
목적: ${plan.purpose}
헤드라인: ${plan.headline}
레이아웃: ${plan.layout}
들어갈 요소: ${plan.blockHints.join(" / ")}${plan.material?.trim() ? `\n참고 자료(이 내용을 우선 반영):\n${plan.material.trim()}` : ""}${layoutGuide ? `\n\n${layoutGuide}` : ""}`;

  for (let attempt = 0; attempt < 2; attempt++) {
    const msg = await anthropic().messages.create({
      model: MODEL,
      max_tokens: 4000,
      system: SLIDE_SYSTEM,
      tools: [{ name: "emit_slide", description: "이 슬라이드를 블록 스키마로 출력한다.", input_schema: SLIDE_TOOL_SCHEMA as never }],
      tool_choice: { type: "tool", name: "emit_slide" },
      messages: [{ role: "user", content: `${ctx}\n\n${planText}${attempt > 0 ? "\n\n(이전 출력이 스키마에 맞지 않았다. 스키마를 엄격히 지켜 다시 생성하라.)" : ""}` }],
    });
    const tu = msg.content.find((b) => b.type === "tool_use");
    if (tu && tu.type === "tool_use") {
      const parsed = SlideContent.safeParse(tu.input);
      if (parsed.success) return parsed.data;
    }
  }

  // 폴백: 헤드라인만 담은 최소 슬라이드
  return {
    layout: plan.layout,
    title: plan.headline,
    blocks: [{ id: "h", type: "heading" as const, text: plan.headline, accent: "", column: "full" as const, anim: "rise" as const }],
    notes: plan.purpose,
  };
}
