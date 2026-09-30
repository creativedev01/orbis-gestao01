-- ORBIS GESTÃO — clientes e fornecedores
-- Execute após 004_product_management.sql.

create table if not exists public.business_contacts (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  entity_type text not null check (entity_type in ('customer','supplier')),
  person_type text not null default 'company' check (person_type in ('person','company')),
  name text not null,
  trade_name text,
  document text,
  contact_name text,
  phone text,
  email text,
  postal_code text,
  address text,
  address_number text,
  complement text,
  neighborhood text,
  city text,
  state text,
  notes text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists business_contacts_company_type_idx on public.business_contacts(company_id,entity_type,active);
create index if not exists business_contacts_name_idx on public.business_contacts(company_id,name);

alter table public.business_contacts enable row level security;

drop policy if exists "members_contacts_read" on public.business_contacts;
create policy "members_contacts_read" on public.business_contacts for select
using (company_id = public.current_company_id());

drop policy if exists "admins_contacts_insert" on public.business_contacts;
create policy "admins_contacts_insert" on public.business_contacts for insert
with check (public.is_admin() and company_id = public.current_company_id());

drop policy if exists "admins_contacts_update" on public.business_contacts;
create policy "admins_contacts_update" on public.business_contacts for update
using (public.is_admin() and company_id = public.current_company_id())
with check (public.is_admin() and company_id = public.current_company_id());

