// ABOUTME: 브라우저용 Supabase 클라이언트. 로그인/로그아웃 등 클라이언트 인증에 사용.
// ABOUTME: URL은 서버와 동일하게 둬 쿠키 키를 일치시키고(세션 공유), 실제 네트워크만 같은 출처의 /sb-proxy로 돌려 SSH 3000 포워딩만으로 동작하게 한다.

import { createBrowserClient } from "@supabase/ssr";

export function createSupabaseBrowser() {
  const direct = process.env.NEXT_PUBLIC_SUPABASE_URL!; // 쿠키 키 유도용(서버와 동일해야 세션 공유)
  const proxyBase = typeof window !== "undefined" ? `${window.location.origin}/sb-proxy` : direct;

  // 요청 URL이 direct(원격 Supabase)면 같은 출처 프록시로 바꿔 보낸다.
  const proxiedFetch: typeof fetch = (input, init) => {
    const swap = (u: string) => (u.startsWith(direct) ? proxyBase + u.slice(direct.length) : u);
    if (typeof input === "string") return fetch(swap(input), init);
    if (input instanceof URL) return fetch(swap(input.href), init);
    if (input instanceof Request) return fetch(new Request(swap(input.url), input), init);
    return fetch(input, init);
  };

  return createBrowserClient(direct, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
    global: { fetch: proxiedFetch },
  });
}
