-- Permite que somente administradores da empresa excluam ordens de serviço.
-- Execute após 006_service_orders.sql.

drop policy if exists "admins_orders_delete" on public.service_orders;
create policy "admins_orders_delete" on public.service_orders
for delete using (
  public.is_admin()
  and company_id = public.current_company_id()
);
