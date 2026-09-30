-- ORBIS GESTÃO — versão do banco e verificação de integridade.
-- Execute após 012_complete_audit.sql.

create or replace function public.get_orbis_system_status()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'database_version', 13,
    'checked_at', now(),
    'tables_ok',
      to_regclass('public.companies') is not null and
      to_regclass('public.profiles') is not null and
      to_regclass('public.products') is not null and
      to_regclass('public.stock_movements') is not null and
      to_regclass('public.business_contacts') is not null and
      to_regclass('public.service_orders') is not null and
      to_regclass('public.service_order_materials') is not null and
      to_regclass('public.audit_logs') is not null,
    'functions_ok',
      to_regprocedure('public.service_order_action(uuid,text)') is not null and
      to_regprocedure('public.service_order_finish(uuid,text,jsonb)') is not null and
      to_regprocedure('public.delete_product(uuid)') is not null,
    'storage_ok',
      exists(select 1 from storage.buckets where id = 'company-logos') and
      exists(select 1 from storage.buckets where id = 'service-order-proofs')
  );
$$;

revoke all on function public.get_orbis_system_status() from public;
grant execute on function public.get_orbis_system_status() to authenticated;

