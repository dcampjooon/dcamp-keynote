// ABOUTME: 서버 전용 Supabase 클라이언트. M1은 secret 키로 접근(RLS 우회)하고 고정 dev 유저를 owner로 쓴다.
// ABOUTME: M5에서 @supabase/ssr + 쿠키 세션 기반 사용자 클라이언트로 교체하고 RLS를 실제로 작동시킨다.

import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const secret = process.env.SUPABASE_SECRET_KEY;

if (!url || !secret) {
  throw new Error("SUPABASE 환경변수가 없습니다 (.env.local 확인).");
}

/** 서버 전용. RLS를 우회하므로 절대 클라이언트 번들에 노출하지 말 것. */
export const supabaseAdmin = createClient(url, secret, {
  auth: { autoRefreshToken: false, persistSession: false },
});

/** M1 단일 사용자 모드의 덱 owner. M5에서 세션 사용자로 대체. */
export const DEV_USER_ID = process.env.DEV_USER_ID ?? "";
