# 배포 가이드 (Vercel + Supabase)

AI 키노트 에디터(`editor/`)를 웹 서비스로 배포하는 절차. 로컬은 `supabase start` + `npm run dev`로 동작하며, 아래는 **원격 배포**용이다.

## 1. Supabase 원격 프로젝트

1. [supabase.com](https://supabase.com)에서 프로젝트 생성.
2. 로컬 마이그레이션을 원격에 적용:
   ```bash
   cd editor
   supabase link --project-ref <YOUR_PROJECT_REF>
   supabase db push          # supabase/migrations/* 를 원격에 적용
   ```
3. **인증 설정** (Authentication → Providers → Email): 이메일/비밀번호 활성화.
   - 초대제로 운영하려면 "Allow new users to sign up"을 끄고 사용자를 직접 추가.
4. **API 키** (Project Settings → API): `Project URL`과 `publishable` 키를 환경변수로 사용.

> RLS는 마이그레이션에 포함되어 있어 별도 작업 불필요(`deck_members` 기반). 서버는 `secret` 키를 쓰지 않고 사용자 세션(쿠키)으로 접근하므로 RLS가 그대로 적용된다.

## 2. Vercel 배포

1. [vercel.com](https://vercel.com)에서 이 GitHub 저장소를 Import.
2. **Root Directory**: `editor` 로 지정(앱이 하위 디렉토리에 있음).
3. Framework: Next.js (자동 감지). 빌드 명령/출력은 기본값.
4. **환경변수** (Settings → Environment Variables) — `editor/.env.example` 참고:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
   - `ANTHROPIC_API_KEY`
5. Deploy.

## 3. 배포 후 점검

- `/login`에서 가입/로그인 → 발표 생성 → 미리보기/편집/익스포트.
- 다른 계정으로 로그인 시 서로의 발표가 보이지 않는지(RLS 격리) 확인.

## 참고 / 한계

- 익스포트(HTML/PPTX)는 서버에서 생성된다. PPTX의 다이어그램은 네이티브 도형, 자유 캔버스(SVG)는 HTML 익스포트에서만 보인다(PPTX는 안내 플레이스홀더).
- 공동작업: `deck_members` 테이블이 멤버십 근간이다. 현재 UI는 본인 발표 목록까지 — 초대/공유 UI는 다음 단계.
- 자유 캔버스 SVG는 `src/lib/sanitize-svg.ts`로 정화하지만, 멀티테넌트 운영 시 DOMPurify 등으로 한 번 더 강화하는 것을 권장.
