// ABOUTME: 서버용 Supabase 클라이언트(쿠키 세션 기반). RLS가 로그인 사용자 권한으로 작동하게 한다.
// ABOUTME: 라우트 핸들러/서버 컴포넌트에서 await createSupabaseServer()로 사용.

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;

export async function createSupabaseServer() {
  const cookieStore = await cookies();
  return createServerClient(url, key, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (toSet) => {
        try {
          toSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // 서버 컴포넌트에서 set 호출 시 무시(proxy가 세션을 갱신함)
        }
      },
    },
  });
}

/** 현재 로그인 사용자(없으면 null). */
export async function currentUser() {
  const supabase = await createSupabaseServer();
  const { data } = await supabase.auth.getUser();
  return data.user;
}
