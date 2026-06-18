// ABOUTME: 로그인/회원가입 화면. Supabase Auth(이메일+비밀번호). 성공 시 홈으로 이동.

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowser } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function submit() {
    setBusy(true);
    setErr("");
    const supabase = createSupabaseBrowser();
    try {
      if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
      }
      router.replace("/");
      router.refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "인증 실패");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/40 p-6">
      <div className="w-full max-w-sm rounded-xl border bg-card p-6 shadow-sm">
        <h1 className="text-xl font-medium">키노트 에디터</h1>
        <p className="mt-1 text-sm text-muted-foreground">{mode === "login" ? "로그인" : "계정 만들기"}</p>

        <div className="mt-5 flex flex-col gap-3">
          <Input type="email" placeholder="이메일" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
          <Input
            type="password"
            placeholder="비밀번호"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && void submit()}
            autoComplete={mode === "login" ? "current-password" : "new-password"}
          />
          {err && <div className="text-sm text-destructive">{err}</div>}
          <Button onClick={() => void submit()} disabled={busy || !email || !password}>
            {busy ? "처리 중…" : mode === "login" ? "로그인" : "가입하고 시작"}
          </Button>
          <button className="text-xs text-muted-foreground hover:underline" onClick={() => setMode((m) => (m === "login" ? "signup" : "login"))}>
            {mode === "login" ? "계정이 없으신가요? 회원가입" : "이미 계정이 있으신가요? 로그인"}
          </button>
        </div>
      </div>
    </main>
  );
}
