// ABOUTME: 브라우저용 Supabase 클라이언트. 로그인/로그아웃 등 클라이언트 인증에 사용.

import { createBrowserClient } from "@supabase/ssr";

export function createSupabaseBrowser() {
  return createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!);
}
