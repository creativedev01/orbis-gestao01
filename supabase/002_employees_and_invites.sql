-- ORBIS GESTÃO — funcionários, convites e acesso por empresa
-- Execute este arquivo após setup.sql.

alter table public.profiles add column if not exists email text;
alter table public.profiles add column if not exists phone text;
alter table public.profiles add column if not exists job_title text;
alter table public.profiles add column if not exists last_access_at timestamptz;

update public.profiles p
set email = u.email
from auth.users u
where p.id = u.id and p.email is null;

create table if not exists public.employee_invites (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  email text not null,
  full_name text not null,
  role text not null default 'employee' check (role in ('admin','employee')),
  token uuid not null default gen_random_uuid() unique,
  status text not null default 'pending' check (status in ('pending','accepted','cancelled','expired')),
  expires_at timestamptz not null default (now() + interval '7 days'),
  created_by uuid not null references auth.users(id),
  accepted_at timestamptz,
  created_at timestamptz not null default now()
);

create unique index if not exists employee_invites_pending_email
on public.employee_invites(company_id, lower(email)) where status = 'pending';

alter table public.employee_invites enable row level security;

drop policy if exists "company_admin_invites_read" on public.employee_invites;
create policy "company_admin_invites_read" on public.employee_invites for select
using (public.is_admin() and company_id = public.current_company_id());

drop policy if exists "company_admin_invites_insert" on public.employee_invites;
create policy "company_admin_invites_insert" on public.employee_invites for insert
with check (public.is_admin() and company_id = public.current_company_id() and created_by = auth.uid());

drop policy if exists "company_admin_invites_update" on public.employee_invites;
create policy "company_admin_invites_update" on public.employee_invites for update
using (public.is_admin() and company_id = public.current_company_id());

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  matched_invite public.employee_invites%rowtype;
  target_company uuid;
  target_name text;
  target_role text;
begin
  if lower(new.email) = 'rodriguesboletos@gmail.com' then
    target_company := (select id from public.companies where slug = 'er-creative' limit 1);
    target_name := coalesce(nullif(new.raw_user_meta_data->>'full_name',''), 'Eduardo Rodrigues');
    target_role := 'platform_admin';
  else
    select * into matched_invite
    from public.employee_invites
    where token::text = new.raw_user_meta_data->>'invite_token'
      and lower(email) = lower(new.email)
      and status = 'pending'
      and expires_at > now()
    limit 1;

    if matched_invite.id is null then
      raise exception 'Convite inválido, expirado ou pertencente a outro e-mail.';
    end if;

    target_company := matched_invite.company_id;
    target_name := matched_invite.full_name;
    target_role := matched_invite.role;

    update public.employee_invites
    set status = 'accepted', accepted_at = now()
    where id = matched_invite.id;
  end if;

  insert into public.profiles (id, company_id, full_name, email, role, active)
  values (new.id, target_company, target_name, new.email, target_role, true)
  on conflict (id) do update set
    company_id = excluded.company_id,
    full_name = excluded.full_name,
    email = excluded.email,
    role = excluded.role,
    active = true;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
for each row execute procedure public.handle_new_user();

drop policy if exists "admin_company_profiles_update" on public.profiles;
create policy "admin_company_profiles_update" on public.profiles for update
using (public.is_admin() and company_id = public.current_company_id() and id <> auth.uid())
with check (company_id = public.current_company_id() and role in ('admin','employee'));
