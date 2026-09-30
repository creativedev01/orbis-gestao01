-- ORBIS GESTÃO — produtos, categorias e movimentações de estoque
-- Execute após 002_employees_and_invites.sql.

create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  name text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique(company_id, name)
);

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  category_id uuid references public.categories(id),
  sku text not null,
  barcode text,
  name text not null,
  description text,
  unit text not null default 'UN',
  quantity numeric(14,3) not null default 0 check (quantity >= 0),
  min_stock numeric(14,3) not null default 0 check (min_stock >= 0),
  cost_price numeric(14,2) not null default 0 check (cost_price >= 0),
  sale_price numeric(14,2) not null default 0 check (sale_price >= 0),
  location text,
  ncm text,
  image_url text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(company_id, sku)
);

create table if not exists public.stock_movements (
  id bigint generated always as identity primary key,
  company_id uuid not null references public.companies(id) on delete cascade,
  product_id uuid not null references public.products(id),
  type text not null check (type in ('entry','exit','return','loss','damaged','adjustment_in','adjustment_out')),
  quantity numeric(14,3) not null check (quantity > 0),
  previous_quantity numeric(14,3) not null,
  new_quantity numeric(14,3) not null,
  reason text not null,
  note_number text,
  service_order_id uuid,
  user_id uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);

create index if not exists products_company_idx on public.products(company_id);
create index if not exists products_name_idx on public.products(company_id, name);
create index if not exists movements_product_idx on public.stock_movements(product_id, created_at desc);

alter table public.categories enable row level security;
alter table public.products enable row level security;
alter table public.stock_movements enable row level security;

drop policy if exists "members_categories_read" on public.categories;
create policy "members_categories_read" on public.categories for select using (company_id = public.current_company_id());
drop policy if exists "admins_categories_write" on public.categories;
create policy "admins_categories_write" on public.categories for all using (public.is_admin() and company_id = public.current_company_id()) with check (public.is_admin() and company_id = public.current_company_id());

drop policy if exists "members_products_read" on public.products;
create policy "members_products_read" on public.products for select using (company_id = public.current_company_id());
drop policy if exists "admins_products_insert" on public.products;
create policy "admins_products_insert" on public.products for insert with check (public.is_admin() and company_id = public.current_company_id());
drop policy if exists "admins_products_update" on public.products;
create policy "admins_products_update" on public.products for update using (public.is_admin() and company_id = public.current_company_id()) with check (public.is_admin() and company_id = public.current_company_id());

drop policy if exists "members_movements_read" on public.stock_movements;
create policy "members_movements_read" on public.stock_movements for select using (company_id = public.current_company_id());

create or replace function public.register_stock_movement(
  p_product_id uuid,
  p_type text,
  p_quantity numeric,
  p_reason text,
  p_note_number text default null
) returns public.stock_movements
language plpgsql security definer set search_path = public as $$
declare
  current_profile public.profiles%rowtype;
  current_product public.products%rowtype;
  resulting_quantity numeric;
  movement public.stock_movements%rowtype;
  decrease boolean;
begin
  select * into current_profile from public.profiles where id = auth.uid() and active = true;
  if current_profile.id is null then raise exception 'Usuário sem acesso ativo.'; end if;
  if p_quantity is null or p_quantity <= 0 then raise exception 'A quantidade deve ser maior que zero.'; end if;
  if coalesce(trim(p_reason),'') = '' then raise exception 'Informe o motivo da movimentação.'; end if;
  if p_type not in ('entry','exit','return','loss','damaged','adjustment_in','adjustment_out') then raise exception 'Tipo de movimentação inválido.'; end if;
  if current_profile.role = 'employee' and p_type <> 'exit' then raise exception 'Funcionários podem registrar somente saídas.'; end if;

  select * into current_product from public.products where id = p_product_id and company_id = current_profile.company_id and active = true for update;
  if current_product.id is null then raise exception 'Produto não encontrado.'; end if;

  decrease := p_type in ('exit','loss','damaged','adjustment_out');
  resulting_quantity := current_product.quantity + case when decrease then -p_quantity else p_quantity end;
  if resulting_quantity < 0 then raise exception 'Estoque insuficiente. Disponível: %', current_product.quantity; end if;

  update public.products set quantity = resulting_quantity, updated_at = now() where id = current_product.id;
  insert into public.stock_movements(company_id,product_id,type,quantity,previous_quantity,new_quantity,reason,note_number,user_id)
  values(current_product.company_id,current_product.id,p_type,p_quantity,current_product.quantity,resulting_quantity,p_reason,p_note_number,auth.uid())
  returning * into movement;

  insert into public.audit_logs(company_id,user_id,action,entity,entity_id,new_data)
  values(current_product.company_id,auth.uid(),'stock.movement','products',current_product.id::text,jsonb_build_object('type',p_type,'quantity',p_quantity,'previous',current_product.quantity,'new',resulting_quantity,'reason',p_reason));
  return movement;
end;
$$;

grant execute on function public.register_stock_movement(uuid,text,numeric,text,text) to authenticated;
