import type { NextConfig } from "next";

// 브라우저의 Supabase 호출(/sb-proxy/*)을 같은 출처(3000)에서 받아 원격 Supabase로 중계.
// SSH로 3000만 포워딩해도 로그인이 되도록(54321 포워딩 불필요). 서버측 호출은 직접 연결한다.
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321";

const nextConfig: NextConfig = {
  async rewrites() {
    return [{ source: "/sb-proxy/:path*", destination: `${SUPABASE_URL}/:path*` }];
  },
};

export default nextConfig;
