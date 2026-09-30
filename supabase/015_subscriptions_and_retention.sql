-- ORBIS GESTÃO — assinatura por empresa e retenção segura das OS.
-- Execute após 014_remove_employees.sql.

create table if not exists public.subscription_plans (
  code text primary key,
  name text not null,
  monthly_price numeric(12,2) not null default 0,
  retention_days integer not null default 90 check (retention_days between 30 and 730),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

insert into public.subscription_plans(code,name,monthly_price,retention_days) values
  ('essencial','Essencial',149,90),
  ('profissional','Profissional',249,180)
on conflict (code) do update set name=excluded.name, monthly_price=excluded.monthly_price;

create table if not exists public.company_subscriptions (
  company_id uuid primary key references public.companies(id) on delete cascade,
  plan_code text not null references public.subscription_plans(code) default 'essencial',
  status text not null default 'trial' check (status in ('trial','active','past_due','suspended','cancelled')),
  started_at timestamptz not null default now(),
  current_period_end date not null default (current_date + 30),
  grace_until date,
  retention_days integer check (retention_days between 30 and 730),
  updated_at timestamptz not null default now()
);

insert into public.company_subscriptions(company_id,status,current_period_end)
select id,'active',current_date+30 from public.companies
on conflict (company_id) do nothing;

create table if not exists public.monthly_os_closures (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  reference_month date not null,
  status text not null default 'pending' check (status in ('pending','exported','archived')),
  order_count integer not null default 0,
  proof_count integer not null default 0,
  total_value numeric(14,2) not null default 0,
  retention_until date not null,
  exported_at timestamptz,
  exported_by uuid references auth.users(id),
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  unique(company_id,reference_month)
);

alter table public.service_orders add column if not exists archived_at timestamptz;
alter table public.subscription_plans enable row level security;
alter table public.company_subscriptions enable row level security;
alter table public.monthly_os_closures enable row level security;

drop policy if exists "plans_authenticated_read" on public.subscription_plans;
create policy "plans_authenticated_read" on public.subscription_plans for select to authenticated using (true);
drop policy if exists "members_subscription_read" on public.company_subscriptions;
create policy "members_subscription_read" on public.company_subscriptions for select to authenticated using (company_id=public.current_company_id() or public.is_platform_admin());
drop policy if exists "admins_closures_read" on public.monthly_os_closures;
create policy "admins_closures_read" on public.monthly_os_closures for select to authenticated using ((public.is_admin() and company_id=public.current_company_id()) or public.is_platform_admin());

create or replace function public.prepare_monthly_os_closures()
returns integer language plpgsql security definer set search_path=public as $$
declare c uuid; retention integer; inserted integer;
begin
  if not public.is_admin() then raise exception 'Somente administradores podem preparar fechamentos.'; end if;
  c:=public.current_company_id();
  select coalesce(s.retention_days,p.retention_days,90) into retention
  from public.company_subscriptions s join public.subscription_plans p on p.code=s.plan_code where s.company_id=c;
  retention:=coalesce(retention,90);
  insert into public.monthly_os_closures(company_id,reference_month,order_count,proof_count,total_value,retention_until)
  select c,date_trunc('month',coalesce(o.completed_at,o.updated_at))::date,count(*),count(o.completion_photo_path),coalesce(sum(o.value),0),
    (date_trunc('month',coalesce(o.completed_at,o.updated_at))+interval '1 month'+make_interval(days=>retention))::date
  from public.service_orders o where o.company_id=c and o.status in ('completed','cancelled')
    and coalesce(o.completed_at,o.updated_at)<date_trunc('month',now())
  group by date_trunc('month',coalesce(o.completed_at,o.updated_at))
  on conflict(company_id,reference_month) do update set order_count=excluded.order_count,proof_count=excluded.proof_count,total_value=excluded.total_value;
  get diagnostics inserted=row_count; return inserted;
end $$;

create or replace function public.confirm_monthly_os_export(p_reference_month date)
returns void language plpgsql security definer set search_path=public as $$
begin
  if not public.is_admin() then raise exception 'Somente administradores podem confirmar o fechamento.'; end if;
  update public.monthly_os_closures set status='exported',exported_at=now(),exported_by=auth.uid()
  where company_id=public.current_company_id() and reference_month=date_trunc('month',p_reference_month)::date;
  if not found then raise exception 'Fechamento mensal não encontrado.'; end if;
end $$;

create or replace function public.archive_eligible_os()
returns integer language plpgsql security definer set search_path=public as $$
declare affected integer;
begin
  if not public.is_admin() then raise exception 'Somente administradores podem arquivar OS.'; end if;
  update public.service_orders o set archived_at=now(),updated_at=now()
  from public.monthly_os_closures c where c.company_id=public.current_company_id() and c.company_id=o.company_id
    and c.status='exported' and c.retention_until<=current_date and o.archived_at is null
    and date_trunc('month',coalesce(o.completed_at,o.updated_at))::date=c.reference_month;
  get diagnostics affected=row_count;
  update public.monthly_os_closures set status='archived',archived_at=now()
  where company_id=public.current_company_id() and status='exported' and retention_until<=current_date;
  return affected;
end $$;

create or replace function public.platform_list_companies()
returns table(company_id uuid,company_name text,slug text,plan_name text,subscription_status text,current_period_end date,retention_days integer,employee_count bigint,order_count bigint)
language sql stable security definer set search_path=public as $$
  select c.id,c.name,c.slug,p.name,s.status,s.current_period_end,coalesce(s.retention_days,p.retention_days),
    (select count(*) from public.profiles pr where pr.company_id=c.id and pr.removed_at is null),
    (select count(*) from public.service_orders so where so.company_id=c.id)
  from public.companies c join public.company_subscriptions s on s.company_id=c.id join public.subscription_plans p on p.code=s.plan_code
  where public.is_platform_admin() order by c.name
$$;

create or replace function public.platform_update_subscription(p_company_id uuid,p_plan_code text,p_status text,p_period_end date)
returns void language plpgsql security definer set search_path=public as $$
begin
  if not public.is_platform_admin() then raise exception 'Acesso exclusivo da ER Creative.'; end if;
  if p_status not in ('trial','active','past_due','suspended','cancelled') then raise exception 'Situação inválida.'; end if;
  insert into public.company_subscriptions(company_id,plan_code,status,current_period_end,grace_until,updated_at)
  values(p_company_id,p_plan_code,p_status,p_period_end,case when p_status='past_due' then p_period_end+15 else null end,now())
  on conflict(company_id) do update set plan_code=excluded.plan_code,status=excluded.status,current_period_end=excluded.current_period_end,grace_until=excluded.grace_until,updated_at=now();
end $$;

grant execute on function public.prepare_monthly_os_closures() to authenticated;
grant execute on function public.confirm_monthly_os_export(date) to authenticated;
grant execute on function public.archive_eligible_os() to authenticated;
grant execute on function public.platform_list_companies() to authenticated;
grant execute on function public.platform_update_subscription(uuid,text,text,date) to authenticated;

create or replace function public.get_orbis_system_status()
returns jsonb language sql stable security definer set search_path=public as $$
select jsonb_build_object('database_version',15,'checked_at',now(),'tables_ok',to_regclass('public.company_subscriptions') is not null and to_regclass('public.monthly_os_closures') is not null,'functions_ok',to_regprocedure('public.prepare_monthly_os_closures()') is not null and to_regprocedure('public.remove_employee(uuid)') is not null,'storage_ok',exists(select 1 from storage.buckets where id='company-logos') and exists(select 1 from storage.buckets where id='service-order-proofs'))
$$;

