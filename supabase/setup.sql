-- ORBIS GESTÃO — base inicial de autenticação e permissões
-- Execute este arquivo uma única vez no Supabase SQL Editor.

create extension if not exists pgcrypto;

create table if not exists public.companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique,
  document text,
  phone text,
  email text,
  address text,
  logo_url text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.companies add column if not exists slug text;
create unique index if not exists companies_slug_key on public.companies(slug) where slug is not null;
insert into public.companies (name, slug, email)
values ('ER Creative', 'er-creative', 'rodriguesboletos@gmail.com')
on conflict (slug) do update set name = excluded.name, email = excluded.email;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  company_id uuid references public.companies(id),
  full_name text not null default '',
  role text not null default 'employee' check (role in ('platform_admin','admin','employee')),
  active boolean not null default true,
  last_access_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.audit_logs (
  id bigint generated always as identity primary key,
  company_id uuid references public.companies(id),
  user_id uuid references auth.users(id),
  action text not null,
  entity text not null,
  entity_id text,
  old_data jsonb,
  new_data jsonb,
  created_at timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, company_id, full_name, role, active)
  values (
    new.id,
    case when lower(new.email) = 'rodriguesboletos@gmail.com' then (select id from public.companies where slug = 'er-creative' limit 1) else null end,
    coalesce(new.raw_user_meta_data->>'full_name', case when lower(new.email) = 'rodriguesboletos@gmail.com' then 'Eduardo Rodrigues' else '' end),
    case when lower(new.email) = 'rodriguesboletos@gmail.com' then 'platform_admin' else 'employee' end,
    true
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
for each row execute procedure public.handle_new_user();

alter table public.companies enable row level security;
alter table public.profiles enable row level security;
alter table public.audit_logs enable row level security;

create or replace function public.current_company_id() returns uuid
language sql stable security definer set search_path = public as $$
  select company_id from public.profiles where id = auth.uid() and active = true
$$;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.profiles where id = auth.uid() and active = true and role in ('platform_admin','admin'))
$$;

create or replace function public.is_platform_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.profiles where id = auth.uid() and active = true and role = 'platform_admin')
$$;

drop policy if exists "profile_self_read" on public.profiles;
create policy "profile_self_read" on public.profiles for select using (id = auth.uid());
drop policy if exists "admin_company_profiles_read" on public.profiles;
create policy "admin_company_profiles_read" on public.profiles for select using (public.is_admin() and company_id = public.current_company_id());
drop policy if exists "admin_company_profiles_update" on public.profiles;
create policy "admin_company_profiles_update" on public.profiles for update using (public.is_admin() and company_id = public.current_company_id());

drop policy if exists "company_members_read" on public.companies;
create policy "company_members_read" on public.companies for select using (id = public.current_company_id());
drop policy if exists "company_admin_update" on public.companies;
create policy "company_admin_update" on public.companies for update using (public.is_admin() and id = public.current_company_id());

drop policy if exists "admin_audit_read" on public.audit_logs;
create policy "admin_audit_read" on public.audit_logs for select using (public.is_admin() and company_id = public.current_company_id());
drop policy if exists "authenticated_audit_insert" on public.audit_logs;
create policy "authenticated_audit_insert" on public.audit_logs for insert with check (user_id = auth.uid() and company_id = public.current_company_id());

-- O usuário rodriguesboletos@gmail.com será criado automaticamente como proprietário da plataforma.
