// ABOUTME: [기획 단계] 라우트. 사용자 설명 + 소스 자료 → 발표 아웃라인(스토리라인 + 슬라이드별 계획)을 구조화 생성.
// ABOUTME: Claude structured output(zod)으로 Outline 스키마를 강제. 전체 맥락을 한 번에 보되 슬라이드 생성은 다음 단계에서 분리.

import { anthropic, MODEL } from "@/lib/anthropic";
import { OUTLINE_SYSTEM } from "@/lib/prompts";
import { Outline } from "@/lib/slide-schema";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";

export const runtime = "nodejs";

/** HTML → 대략적 평문(스크립트/스타일/태그 제거). */
function htmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&#39;/g, "'").replace(/&quot;/g, '"')
    .replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
}

/** URL 1개 → 본문 텍스트. 구글 독스는 평문 export(공개 문서만), 그 외는 HTML 추출. */
async function fetchUrlText(url: string): Promise<string> {
  const gd = url.match(/docs\.google\.com\/document\/d\/([A-Za-z0-9_-]+)/);
  const target = gd ? `https://docs.google.com/document/d/${gd[1]}/export?format=txt` : url;
  const res = await fetch(target, { redirect: "follow", headers: { "User-Agent": "Mozilla/5.0 (compatible; dcamp-keynote/1.0)" }, signal: AbortSignal.timeout(20_000) });
  if (!res.ok) return "";
  const ct = res.headers.get("content-type") ?? "";
  if (gd && !ct.includes("text/plain")) return ""; // 비공개 구글 독스 → 로그인 HTML이 오므로 버림
  const body = await res.text();
  const text = ct.includes("text/html") ? htmlToText(body) : body;
  return text.slice(0, 100_000); // 과도한 길이 방지
}

/** sources 안의 URL들을 가져와 본문으로 확장. 실패한 URL은 조용히 건너뜀. */
async function expandUrls(sources: string): Promise<string> {
  const urls = [...new Set(sources.match(/https?:\/\/[^\s)>\]]+/g) ?? [])].slice(0, 5);
  if (!urls.length) return sources;
  let out = sources;
  for (const url of urls) {
    try {
      const text = await fetchUrlText(url);
      if (text.trim()) out += `\n\n[가져온 자료 — ${url}]\n${text}`;
    } catch { /* 무시 */ }
  }
  return out;
}

export async function POST(request: Request) {
  try {
    const { brief, sources } = (await request.json()) as { brief?: string; sources?: string };
    if (!brief?.trim()) {
      return Response.json({ error: "발표 내용 설명(brief)이 필요합니다." }, { status: 400 });
    }

    const expandedSources = sources?.trim() ? await expandUrls(sources.trim()) : "";
    const userContent = [
      `[발표 내용 설명]\n${brief.trim()}`,
      expandedSources ? `\n[참고 소스 자료]\n${expandedSources}` : "",
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
