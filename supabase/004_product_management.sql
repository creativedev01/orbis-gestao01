-- ORBIS GESTÃO — edição e exclusão segura de produtos
-- Execute após 003_inventory.sql.

create or replace function public.delete_product(p_product_id uuid)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  current_profile public.profiles%rowtype;
  current_product public.products%rowtype;
  has_movements boolean;
  result_mode text;
begin
  select * into current_profile from public.profiles where id = auth.uid() and active = true;
  if current_profile.id is null then raise exception 'Usuário sem acesso ativo.'; end if;
  if current_profile.role not in ('admin','platform_admin') then raise exception 'Somente administradores podem excluir produtos.'; end if;

  select * into current_product from public.products
  where id = p_product_id and company_id = current_profile.company_id and active = true
  for update;
  if current_product.id is null then raise exception 'Produto não encontrado.'; end if;

  select exists(select 1 from public.stock_movements where product_id = current_product.id) into has_movements;
  if has_movements then
    update public.products set active = false, updated_at = now() where id = current_product.id;
    result_mode := 'deactivated';
  else
    delete from public.products where id = current_product.id;
    result_mode := 'deleted';
  end if;

  insert into public.audit_logs(company_id,user_id,action,entity,entity_id,old_data,new_data)
  values(current_product.company_id,auth.uid(),'product.' || result_mode,'products',current_product.id::text,
    to_jsonb(current_product),jsonb_build_object('active',false,'mode',result_mode));

  return jsonb_build_object('mode',result_mode);
end;
$$;

grant execute on function public.delete_product(uuid) to authenticated;
