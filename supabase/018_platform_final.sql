-- ORBIS GESTÃO — fechamento comercial do painel ER Creative.
-- Execute após 017_hide_inactive_companies.sql.

create table if not exists public.platform_payments (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  reference_month date not null,
  amount numeric(12,2) not null default 0,
  due_date date not null,
  paid_at timestamptz,
  status text not null default 'pending' check(status in ('pending','paid','overdue','cancelled')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
alter table public.platform_payments enable row level security;
drop policy if exists platform_full_access on public.platform_payments;
create policy platform_full_access on public.platform_payments for all to authenticated
using (public.is_platform_admin()) with check (public.is_platform_admin());
grant select,insert,update,delete on public.platform_payments to authenticated;

create or replace function public.platform_list_inactive_companies()
returns table(company_id uuid,company_name text,slug text,plan_name text,subscription_status text,current_period_end date,retention_days integer,employee_count bigint,order_count bigint)
language sql stable security definer set search_path=public as $$
  select c.id,c.name,c.slug,p.name,s.status,s.current_period_end,coalesce(s.retention_days,p.retention_days),
    (select count(*) from public.profiles pr where pr.company_id=c.id and pr.removed_at is null),
    (select count(*) from public.service_orders so where so.company_id=c.id)
  from public.companies c
  join public.company_subscriptions s on s.company_id=c.id
  join public.subscription_plans p on p.code=s.plan_code
  where public.is_platform_admin() and c.active=false order by c.name
$$;
grant execute on function public.platform_list_inactive_companies() to authenticated;

create or replace function public.get_orbis_system_status()
returns jsonb language sql stable security definer set search_path=public as $$
select jsonb_build_object('database_version',18,'checked_at',now(),'tables_ok',to_regclass('public.platform_payments') is not null and to_regclass('public.crm_leads') is not null and to_regclass('public.support_tickets') is not null and to_regclass('public.crm_tasks') is not null,'functions_ok',to_regprocedure('public.platform_list_inactive_companies()') is not null and to_regprocedure('public.platform_create_company(text,text,text,text,text,text,text)') is not null,'storage_ok',exists(select 1 from storage.buckets where id='company-logos') and exists(select 1 from storage.buckets where id='service-order-proofs'))
$$;
