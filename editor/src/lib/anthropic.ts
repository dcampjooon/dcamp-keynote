// ABOUTME: 서버 전용 Claude 클라이언트와 모델 상수. 키는 ANTHROPIC_API_KEY(.env.local)에서 읽는다.
// ABOUTME: 기획/생성에 claude-opus-4-8 사용, 적응형 사고(adaptive thinking) 기본. 클라이언트에 노출 금지.

import Anthropic from "@anthropic-ai/sdk";

export const MODEL = "claude-opus-4-8";

let _client: Anthropic | null = null;

/** 지연 초기화 — 키가 없으면 명확한 에러를 던진다. */
export function anthropic(): Anthropic {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY가 설정되지 않았습니다 (.env.local에 키를 넣어주세요).");
  }
  if (!_client) _client = new Anthropic();
  return _client;
}
