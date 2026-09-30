-- ORBIS GESTÃO — materiais usados na OS e baixa automática do estoque.
-- Execute após 010_public_company_branding.sql.

create table if not exists public.service_order_materials (
  id bigint generated always as identity primary key,
  service_order_id uuid not null references public.service_orders(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  product_id uuid not null references public.products(id),
  quantity numeric(14,3) not null check (quantity > 0),
  unit_cost numeric(14,2) not null default 0 check (unit_cost >= 0),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  unique(service_order_id, product_id)
);

create index if not exists service_order_materials_order_idx
  on public.service_order_materials(service_order_id);

alter table public.service_order_materials enable row level security;

drop policy if exists "members_order_materials_read" on public.service_order_materials;
create policy "members_order_materials_read" on public.service_order_materials
for select using (company_id = public.current_company_id());

create or replace function public.service_order_finish(
  p_order_id uuid,
  p_photo_path text,
  p_materials jsonb
)
returns public.service_orders
language plpgsql
security definer
set search_path = public
as $$
declare
  p public.profiles%rowtype;
  o public.service_orders%rowtype;
  item jsonb;
  product public.products%rowtype;
  product_id_value uuid;
  requested numeric;
  resulting numeric;
  seen_products uuid[] := array[]::uuid[];
begin
  select * into p from public.profiles where id = auth.uid() and active = true;
  if p.id is null then raise exception 'Usuário sem acesso ativo.'; end if;

  select * into o from public.service_orders
  where id = p_order_id and company_id = p.company_id for update;
  if o.id is null then raise exception 'Ordem de serviço não encontrada.'; end if;
  if o.assigned_to <> auth.uid() or o.status <> 'in_progress' then
    raise exception 'Somente o responsável pode finalizar uma OS em andamento.';
  end if;
  if coalesce(p_photo_path, '') = '' then raise exception 'A foto da OS assinada é obrigatória.'; end if;
  if p_photo_path not like p.company_id::text || '/' || o.id::text || '/%' then
    raise exception 'Caminho do comprovante inválido.';
  end if;
  if p_materials is null or jsonb_typeof(p_materials) <> 'array' then
    raise exception 'A lista de materiais é inválida.';
  end if;
  if jsonb_array_length(p_materials) > 100 then raise exception 'Limite de 100 materiais por OS.'; end if;

  for item in select value from jsonb_array_elements(p_materials)
  loop
    begin
      product_id_value := (item->>'product_id')::uuid;
      requested := (item->>'quantity')::numeric;
    exception when others then
      raise exception 'Produto ou quantidade inválida na lista de materiais.';
    end;
    if product_id_value is null or requested is null or requested <= 0 then
      raise exception 'A quantidade dos materiais deve ser maior que zero.';
    end if;
    if product_id_value = any(seen_products) then raise exception 'O mesmo produto foi informado mais de uma vez.'; end if;
    seen_products := array_append(seen_products, product_id_value);

    select * into product from public.products
    where id = product_id_value and company_id = p.company_id and active = true for update;
    if product.id is null then raise exception 'Produto não encontrado ou inativo.'; end if;
    resulting := product.quantity - requested;
    if resulting < 0 then
      raise exception 'Estoque insuficiente para %. Disponível: % %', product.name, product.quantity, product.unit;
    end if;

    update public.products set quantity = resulting, updated_at = now() where id = product.id;
    insert into public.service_order_materials(service_order_id,company_id,product_id,quantity,unit_cost,created_by)
    values(o.id,p.company_id,product.id,requested,product.cost_price,auth.uid());
    insert into public.stock_movements(company_id,product_id,type,quantity,previous_quantity,new_quantity,reason,note_number,service_order_id,user_id)
    values(p.company_id,product.id,'exit',requested,product.quantity,resulting,'Material utilizado na ordem de serviço',
      'OS-' || lpad(o.order_number::text,5,'0'),o.id,auth.uid());
  end loop;

  update public.service_orders set status='completed',completion_photo_path=p_photo_path,
    completed_at=now(),updated_at=now() where id=o.id returning * into o;
  insert into public.audit_logs(company_id,user_id,action,entity,entity_id,new_data)
  values(p.company_id,auth.uid(),'service_order.finish','service_orders',o.id::text,
    jsonb_build_object('status',o.status,'completion_photo_path',p_photo_path,'materials_count',jsonb_array_length(p_materials)));
  return o;
end;
$$;

revoke all on function public.service_order_finish(uuid,text,jsonb) from public;
grant execute on function public.service_order_finish(uuid,text,jsonb) to authenticated;
