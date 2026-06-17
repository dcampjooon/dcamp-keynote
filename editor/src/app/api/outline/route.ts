// ABOUTME: [기획 단계] 라우트. 사용자 설명 + 소스 자료 → 발표 아웃라인(스토리라인 + 슬라이드별 계획)을 구조화 생성.
// ABOUTME: Claude structured output(zod)으로 Outline 스키마를 강제. 전체 맥락을 한 번에 보되 슬라이드 생성은 다음 단계에서 분리.

import { anthropic, MODEL } from "@/lib/anthropic";
import { OUTLINE_SYSTEM } from "@/lib/prompts";
import { Outline } from "@/lib/slide-schema";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";

export async function POST(request: Request) {
  try {
    const { brief, sources } = (await request.json()) as { brief?: string; sources?: string };
    if (!brief?.trim()) {
      return Response.json({ error: "발표 내용 설명(brief)이 필요합니다." }, { status: 400 });
    }

    const userContent = [
      `[발표 내용 설명]\n${brief.trim()}`,
      sources?.trim() ? `\n[참고 소스 자료]\n${sources.trim()}` : "",
    ].join("");

    const msg = await anthropic().messages.parse({
      model: MODEL,
      max_tokens: 8000,
      thinking: { type: "adaptive" },
      system: OUTLINE_SYSTEM,
      messages: [{ role: "user", content: userContent }],
      output_config: { format: zodOutputFormat(Outline) },
    });

    if (!msg.parsed_output) {
      return Response.json({ error: "아웃라인 생성에 실패했습니다(파싱 불가).", stop: msg.stop_reason }, { status: 502 });
    }
    return Response.json({ outline: msg.parsed_output });
  } catch (err) {
    const message = err instanceof Error ? err.message : "알 수 없는 오류";
    return Response.json({ error: message }, { status: 500 });
  }
}
