-- ORBIS GESTÃO — remove empresas desativadas da lista operacional do proprietário.
-- Execute após 016_platform_crm.sql.

create or replace function public.platform_list_companies()
returns table(company_id uuid,company_name text,slug text,plan_name text,subscription_status text,current_period_end date,retention_days integer,employee_count bigint,order_count bigint)
language sql stable security definer set search_path=public as $$
  select c.id,c.name,c.slug,p.name,s.status,s.current_period_end,coalesce(s.retention_days,p.retention_days),
    (select count(*) from public.profiles pr where pr.company_id=c.id and pr.removed_at is null),
    (select count(*) from public.service_orders so where so.company_id=c.id)
  from public.companies c
  join public.company_subscriptions s on s.company_id=c.id
  join public.subscription_plans p on p.code=s.plan_code
  where public.is_platform_admin() and c.active=true
  order by c.name
$$;

grant execute on function public.platform_list_companies() to authenticated;

create or replace function public.get_orbis_system_status()
returns jsonb language sql stable security definer set search_path=public as $$
select jsonb_build_object('database_version',17,'checked_at',now(),'tables_ok',to_regclass('public.crm_leads') is not null and to_regclass('public.support_tickets') is not null and to_regclass('public.crm_tasks') is not null and to_regclass('public.knowledge_articles') is not null,'functions_ok',to_regprocedure('public.platform_create_company(text,text,text,text,text,text,text)') is not null and to_regprocedure('public.remove_employee(uuid)') is not null,'storage_ok',exists(select 1 from storage.buckets where id='company-logos') and exists(select 1 from storage.buckets where id='service-order-proofs'))
$$;
