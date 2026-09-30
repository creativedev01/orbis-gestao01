-- ORBIS GESTÃO — ordens de serviço reais
-- Execute após 005_customers_suppliers.sql.

create table if not exists public.service_orders (
  id uuid primary key default gen_random_uuid(),
  order_number bigint generated always as identity,
  company_id uuid not null references public.companies(id) on delete cascade,
  customer_id uuid not null references public.business_contacts(id),
  assigned_to uuid references public.profiles(id),
  title text not null,
  description text,
  service_address text,
  scheduled_at timestamptz,
  priority text not null default 'normal' check (priority in ('low','normal','high','urgent')),
  status text not null default 'waiting' check (status in ('waiting','accepted','in_progress','completed','cancelled')),
  value numeric(14,2) not null default 0 check (value >= 0),
  notes text,
  created_by uuid not null references auth.users(id),
  accepted_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists service_orders_company_status_idx on public.service_orders(company_id,status);
create index if not exists service_orders_assigned_idx on public.service_orders(assigned_to,status);
alter table public.service_orders enable row level security;

drop policy if exists "members_orders_read" on public.service_orders;
create policy "members_orders_read" on public.service_orders for select using (company_id=public.current_company_id());
drop policy if exists "admins_orders_insert" on public.service_orders;
create policy "admins_orders_insert" on public.service_orders for insert with check (public.is_admin() and company_id=public.current_company_id() and created_by=auth.uid());
drop policy if exists "admins_orders_update" on public.service_orders;
create policy "admins_orders_update" on public.service_orders for update using (public.is_admin() and company_id=public.current_company_id()) with check (public.is_admin() and company_id=public.current_company_id());

create or replace function public.service_order_action(p_order_id uuid,p_action text)
returns public.service_orders language plpgsql security definer set search_path=public as $$
declare p public.profiles%rowtype; o public.service_orders%rowtype;
begin
 select * into p from public.profiles where id=auth.uid() and active=true;
 if p.id is null then raise exception 'Usuário sem acesso ativo.'; end if;
 select * into o from public.service_orders where id=p_order_id and company_id=p.company_id for update;
 if o.id is null then raise exception 'Ordem de serviço não encontrada.'; end if;
 if p_action='accept' then
   if o.status<>'waiting' then raise exception 'Esta OS não está aguardando aceite.'; end if;
   if o.assigned_to is not null and o.assigned_to<>auth.uid() then raise exception 'Esta OS foi destinada a outro funcionário.'; end if;
   update public.service_orders set assigned_to=auth.uid(),status='accepted',accepted_at=now(),updated_at=now() where id=o.id returning * into o;
 elsif p_action='start' then
   if o.assigned_to<>auth.uid() or o.status<>'accepted' then raise exception 'Somente o responsável pode iniciar uma OS aceita.'; end if;
   update public.service_orders set status='in_progress',started_at=now(),updated_at=now() where id=o.id returning * into o;
 else raise exception 'Ação inválida.';
 end if;
 insert into public.audit_logs(company_id,user_id,action,entity,entity_id,new_data) values(p.company_id,auth.uid(),'service_order.'||p_action,'service_orders',o.id::text,jsonb_build_object('status',o.status,'assigned_to',o.assigned_to));
 return o;
end; $$;

grant execute on function public.service_order_action(uuid,text) to authenticated;

