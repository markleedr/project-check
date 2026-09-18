-- Project Check: washed datasets only. Raw contact lists never land here.

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);

create table public.checks (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  status text not null default 'ready',
  project_name text not null default '',
  datasets jsonb not null default '{}'::jsonb,
  figures jsonb,
  commentary jsonb,
  dropped_columns jsonb
);

alter table public.projects enable row level security;
alter table public.checks enable row level security;

create policy "users manage own projects"
  on public.projects
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "users manage own checks"
  on public.checks
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
