// ABOUTME: 서버 전용 Supabase 클라이언트(secret 키, RLS 우회) + 고정 dev 유저. 로그인 없는 단일 사용자 모드용.
// ABOUTME: 멀티유저로 다시 전환하려면 라우트를 createSupabaseServer(세션) + auth.getUser로 되돌리면 된다(스키마/RLS는 유지됨).

import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const secret = process.env.SUPABASE_SECRET_KEY;
if (!url || !secret) throw new Error("SUPABASE 환경변수가 없습니다 (.env.local 확인).");

/** 서버 전용. RLS를 우회하므로 클라이언트 번들에 노출 금지. */
export const supabaseAdmin = createClient(url, secret, {
  auth: { autoRefreshToken: false, persistSession: false },
});

/** 단일 사용자 모드의 덱 owner. */
export const DEV_USER_ID = process.env.DEV_USER_ID ?? "";
