// ABOUTME: [편집 단계] 채팅 패치 라우트. 자연어 지시 → AI가 패치 커맨드(set_title/update/insert/delete) 생성 → 적용·검증·저장.
// ABOUTME: 적용 결과를 SlideContent로 재검증하고 version 낙관적 잠금으로 저장(편집 충돌 방지). non-strict 도구 호출 사용.

import { z } from "zod";
import { anthropic, MODEL } from "@/lib/anthropic";
import { PATCH_SYSTEM } from "@/lib/prompts";
import { Block, Slide } from "@/lib/slide-schema";
import { supabaseAdmin } from "@/lib/supabase";

const SlideContent = Slide.omit({ id: true });

const PatchOp = z.discriminatedUnion("op", [
  z.object({ op: z.literal("set_title"), text: z.string() }),
  z.object({ op: z.literal("update"), blockId: z.string(), block: Block }),
  z.object({ op: z.literal("insert"), afterBlockId: z.string().default(""), block: Block }),
  z.object({ op: z.literal("delete"), blockId: z.string() }),
]);
const PatchPlan = z.object({
  reply: z.string().describe("무엇을 바꿨는지 한 문장"),
  ops: z.array(PatchOp).max(12),
});
const PATCH_TOOL_SCHEMA = z.toJSONSchema(PatchPlan) as Record<string, unknown>;

const ReqBody = z.object({
  slideId: z.string(),
  version: z.number().int(),
  instruction: z.string().min(1),
  slide: SlideContent, // 현재 슬라이드 내용
});

export async function POST(request: Request) {
  try {
    const parsed = ReqBody.safeParse(await request.json());
    if (!parsed.success) return Response.json({ error: "잘못된 요청", detail: parsed.error.issues }, { status: 400 });
    const { slideId, version, instruction, slide } = parsed.data;

    const current = `[현재 슬라이드]\n레이아웃: ${slide.layout}\n헤드라인: ${slide.title}\n블록(JSON):\n${JSON.stringify(slide.blocks, null, 1)}`;

    const msg = await anthropic().messages.create({
      model: MODEL,
      max_tokens: 4000,
      system: PATCH_SYSTEM,
      tools: [{ name: "emit_patch", description: "이 슬라이드에 적용할 패치 커맨드를 출력한다.", input_schema: PATCH_TOOL_SCHEMA as never }],
      tool_choice: { type: "tool", name: "emit_patch" },
      messages: [{ role: "user", content: `${current}\n\n[수정 요청]\n${instruction}` }],
    });

    const tu = msg.content.find((b) => b.type === "tool_use");
    if (!tu || tu.type !== "tool_use") return Response.json({ error: "패치 생성 실패" }, { status: 502 });
    const plan = PatchPlan.safeParse(tu.input);
    if (!plan.success) return Response.json({ error: "패치 형식 오류", detail: plan.error.issues }, { status: 502 });

    // 패치 적용
    let title = slide.title;
    let blocks = [...slide.blocks];
    const ids = new Set(blocks.map((b) => b.id));
    for (const op of plan.data.ops) {
      if (op.op === "set_title") title = op.text;
      else if (op.op === "update") blocks = blocks.map((b) => (b.id === op.blockId ? { ...op.block, id: op.blockId } : b));
      else if (op.op === "delete") blocks = blocks.filter((b) => b.id !== op.blockId);
      else if (op.op === "insert") {
        let nb = op.block;
        if (ids.has(nb.id)) nb = { ...nb, id: `${nb.id}-${Math.floor((blocks.length + 1) * 7).toString(36)}` };
        ids.add(nb.id);
        const at = op.afterBlockId ? blocks.findIndex((b) => b.id === op.afterBlockId) : -1;
        if (at >= 0) blocks.splice(at + 1, 0, nb);
        else blocks.push(nb);
      }
    }

    // 결과 재검증
    const validated = SlideContent.safeParse({ layout: slide.layout, title, blocks, notes: slide.notes });
    if (!validated.success) return Response.json({ error: "패치 적용 결과가 유효하지 않음", detail: validated.error.issues }, { status: 502 });

    // 낙관적 잠금 저장
    const { data, error } = await supabaseAdmin
      .from("slides")
      .update({ title: validated.data.title, blocks: validated.data.blocks, version: version + 1 })
      .eq("id", slideId)
      .eq("version", version)
      .select()
      .single();
    if (error || !data) return Response.json({ error: "version 충돌 — 최신 상태를 다시 불러오세요.", code: "version_conflict" }, { status: 409 });

    return Response.json({ reply: plan.data.reply, slide: { id: data.id, version: data.version, layout: data.layout, title: data.title, blocks: data.blocks, notes: data.notes } });
  } catch (err) {
    const message = err instanceof Error ? err.message : "알 수 없는 오류";
    return Response.json({ error: message }, { status: 500 });
  }
}
