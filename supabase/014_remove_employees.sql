-- ORBIS GESTÃO — remoção segura de funcionários sem apagar o histórico.
-- Execute após 013_system_version.sql.

alter table public.profiles add column if not exists removed_at timestamptz;

create or replace function public.remove_employee(p_employee_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  actor public.profiles%rowtype;
  target public.profiles%rowtype;
begin
  select * into actor from public.profiles where id = auth.uid() and active = true;
  if actor.id is null or actor.role not in ('platform_admin','admin') then
    raise exception 'Somente administradores podem excluir funcionários.';
  end if;
  if p_employee_id = auth.uid() then raise exception 'Sua própria conta não pode ser excluída.'; end if;
  select * into target from public.profiles where id = p_employee_id and company_id = actor.company_id and removed_at is null for update;
  if target.id is null then raise exception 'Funcionário não encontrado.'; end if;
  if target.role = 'platform_admin' then raise exception 'A conta do proprietário não pode ser excluída.'; end if;
  update public.profiles set active = false, removed_at = now(), updated_at = now() where id = target.id;
end;
$$;

revoke all on function public.remove_employee(uuid) from public;
grant execute on function public.remove_employee(uuid) to authenticated;

create or replace function public.get_orbis_system_status()
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'database_version', 14,
    'checked_at', now(),
    'tables_ok', to_regclass('public.companies') is not null and to_regclass('public.profiles') is not null and to_regclass('public.products') is not null and to_regclass('public.stock_movements') is not null and to_regclass('public.business_contacts') is not null and to_regclass('public.service_orders') is not null and to_regclass('public.service_order_materials') is not null and to_regclass('public.audit_logs') is not null,
    'functions_ok', to_regprocedure('public.service_order_action(uuid,text)') is not null and to_regprocedure('public.service_order_finish(uuid,text,jsonb)') is not null and to_regprocedure('public.delete_product(uuid)') is not null and to_regprocedure('public.remove_employee(uuid)') is not null,
    'storage_ok', exists(select 1 from storage.buckets where id = 'company-logos') and exists(select 1 from storage.buckets where id = 'service-order-proofs')
  );
$$;

