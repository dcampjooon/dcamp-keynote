-- ABOUTME: AI 키노트 에디터 초기 스키마. 덱/슬라이드(blocks jsonb)/스냅샷/소스/ai_jobs/에셋/템플릿/멤버십.
-- ABOUTME: RLS는 deck_members 기반(처음부터 협업 대비). slides.blocks는 jsonb, 모든 변경 테이블에 version(optimistic lock).

-- ---------- 공통: updated_at 자동 갱신 ----------
create or replace function set_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

-- ---------- profiles (auth.users 미러) ----------
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  display_name text,
  created_at timestamptz not null default now()
);

create or replace function handle_new_user() returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, email) values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end; $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function handle_new_user();

-- ---------- templates (사전 지정 테마/레이아웃/허용 블록) ----------
create table templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  theme jsonb not null default '{}',           -- 색/폰트/여백 토큰
  layouts jsonb not null default '[]',         -- 사용 가능한 레이아웃 프리셋
  allowed_blocks jsonb not null default '[]',  -- 허용 블록 타입
  is_builtin boolean not null default false,
  owner uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

-- ---------- decks ----------
create table decks (
  id uuid primary key default gen_random_uuid(),
  owner uuid not null references auth.users(id) on delete cascade,
  title text not null default '제목 없는 발표',
  template_id uuid references templates(id) on delete set null,
  theme jsonb not null default '{}',
  status text not null default 'draft' check (status in ('draft','planning','generating','ready')),
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger decks_updated_at before update on decks
  for each row execute function set_updated_at();

-- ---------- deck_members (협업/RLS 근간) ----------
create table deck_members (
  deck_id uuid not null references decks(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'editor' check (role in ('owner','editor','viewer')),
  created_at timestamptz not null default now(),
  primary key (deck_id, user_id)
);
create index deck_members_user_idx on deck_members(user_id);

-- 덱 생성 시 owner를 멤버로 자동 등록
create or replace function add_deck_owner_member() returns trigger language plpgsql security definer as $$
begin
  insert into public.deck_members (deck_id, user_id, role) values (new.id, new.owner, 'owner')
  on conflict do nothing;
  return new;
end; $$;
create trigger decks_add_owner after insert on decks
  for each row execute function add_deck_owner_member();

-- ---------- slides (blocks는 jsonb) ----------
create table slides (
  id uuid primary key default gen_random_uuid(),
  deck_id uuid not null references decks(id) on delete cascade,
  idx integer not null,                        -- 0-based 순서
  layout text not null default 'blank',
  blocks jsonb not null default '[]',          -- Block[] (block.id/version 포함)
  notes text not null default '',              -- 발표자 노트/원고
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index slides_deck_idx on slides(deck_id, idx);
create trigger slides_updated_at before update on slides
  for each row execute function set_updated_at();

-- ---------- sources (기획 입력 자료 + traceability) ----------
create table sources (
  id uuid primary key default gen_random_uuid(),
  deck_id uuid not null references decks(id) on delete cascade,
  kind text not null default 'paste' check (kind in ('paste','file','url')),
  title text,
  content text,                                -- 추출/붙여넣기 텍스트
  meta jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index sources_deck_idx on sources(deck_id);

-- ---------- ai_jobs (비동기 상태머신 + 추적) ----------
create table ai_jobs (
  id uuid primary key default gen_random_uuid(),
  deck_id uuid not null references decks(id) on delete cascade,
  kind text not null check (kind in ('outline','generate_slide','patch','export')),
  status text not null default 'queued' check (status in ('queued','running','succeeded','failed')),
  input jsonb not null default '{}',
  output jsonb,
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index ai_jobs_deck_idx on ai_jobs(deck_id, created_at desc);
create trigger ai_jobs_updated_at before update on ai_jobs
  for each row execute function set_updated_at();

-- ---------- deck_snapshots (버전/undo) ----------
create table deck_snapshots (
  id uuid primary key default gen_random_uuid(),
  deck_id uuid not null references decks(id) on delete cascade,
  label text,
  data jsonb not null,                         -- 덱+슬라이드 전체 직렬화
  created_at timestamptz not null default now()
);
create index deck_snapshots_deck_idx on deck_snapshots(deck_id, created_at desc);

-- ---------- assets (Storage 경로) ----------
create table assets (
  id uuid primary key default gen_random_uuid(),
  deck_id uuid not null references decks(id) on delete cascade,
  storage_path text not null,
  kind text not null default 'image',
  meta jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index assets_deck_idx on assets(deck_id);

-- ================= RLS =================
alter table profiles       enable row level security;
alter table templates      enable row level security;
alter table decks          enable row level security;
alter table deck_members   enable row level security;
alter table slides         enable row level security;
alter table sources        enable row level security;
alter table ai_jobs        enable row level security;
alter table deck_snapshots enable row level security;
alter table assets         enable row level security;

-- 멤버십/소유권 헬퍼 (security definer로 정책 재귀 회피)
create or replace function is_deck_member(d uuid) returns boolean
  language sql security definer stable set search_path = public as $$
  select exists (select 1 from deck_members where deck_id = d and user_id = auth.uid());
$$;
create or replace function is_deck_owner(d uuid) returns boolean
  language sql security definer stable set search_path = public as $$
  select exists (select 1 from deck_members where deck_id = d and user_id = auth.uid() and role = 'owner');
$$;

-- profiles: 본인만
create policy profiles_self on profiles for all using (id = auth.uid()) with check (id = auth.uid());

-- templates: builtin은 모두 읽기, 본인 것은 전체
create policy templates_read on templates for select using (is_builtin or owner = auth.uid());
create policy templates_write on templates for all using (owner = auth.uid()) with check (owner = auth.uid());

-- decks: 멤버는 읽기, owner=auth.uid()로만 생성, owner 역할만 수정/삭제
create policy decks_select on decks for select using (is_deck_member(id));
create policy decks_insert on decks for insert with check (owner = auth.uid());
create policy decks_update on decks for update using (is_deck_owner(id)) with check (is_deck_owner(id));
create policy decks_delete on decks for delete using (is_deck_owner(id));

-- deck_members: 멤버는 읽기, owner만 관리
create policy members_select on deck_members for select using (is_deck_member(deck_id));
create policy members_manage on deck_members for all using (is_deck_owner(deck_id)) with check (is_deck_owner(deck_id));

-- 자식 테이블: 덱 멤버면 전체 접근
create policy slides_rw         on slides         for all using (is_deck_member(deck_id)) with check (is_deck_member(deck_id));
create policy sources_rw        on sources        for all using (is_deck_member(deck_id)) with check (is_deck_member(deck_id));
create policy ai_jobs_rw        on ai_jobs        for all using (is_deck_member(deck_id)) with check (is_deck_member(deck_id));
create policy deck_snapshots_rw on deck_snapshots for all using (is_deck_member(deck_id)) with check (is_deck_member(deck_id));
create policy assets_rw         on assets         for all using (is_deck_member(deck_id)) with check (is_deck_member(deck_id));
