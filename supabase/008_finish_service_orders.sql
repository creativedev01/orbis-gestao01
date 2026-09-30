-- Finalização da OS com foto do documento assinado.
-- Execute após 007_delete_service_orders.sql.

alter table public.service_orders
  add column if not exists completion_photo_path text;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'service-order-proofs',
  'service-order-proofs',
  false,
  10485760,
  array['image/jpeg','image/png','image/webp','image/heic','image/heif']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "company_members_upload_os_proofs" on storage.objects;
create policy "company_members_upload_os_proofs" on storage.objects
for insert to authenticated
with check (
  bucket_id = 'service-order-proofs'
  and (storage.foldername(name))[1] = public.current_company_id()::text
);

drop policy if exists "company_members_read_os_proofs" on storage.objects;
create policy "company_members_read_os_proofs" on storage.objects
for select to authenticated
using (
  bucket_id = 'service-order-proofs'
  and (storage.foldername(name))[1] = public.current_company_id()::text
);

create or replace function public.service_order_finish(
  p_order_id uuid,
  p_photo_path text
)
returns public.service_orders
language plpgsql
security definer
set search_path = public
as $$
declare
  p public.profiles%rowtype;
  o public.service_orders%rowtype;
begin
  select * into p from public.profiles where id = auth.uid() and active = true;
  if p.id is null then raise exception 'Usuário sem acesso ativo.'; end if;

  select * into o from public.service_orders
  where id = p_order_id and company_id = p.company_id for update;
  if o.id is null then raise exception 'Ordem de serviço não encontrada.'; end if;
  if o.assigned_to <> auth.uid() or o.status <> 'in_progress' then
    raise exception 'Somente o responsável pode finalizar uma OS em andamento.';
  end if;
  if p_photo_path is null or p_photo_path = '' then
    raise exception 'A foto da OS assinada é obrigatória.';
  end if;
  if p_photo_path not like p.company_id::text || '/' || o.id::text || '/%' then
    raise exception 'Caminho do comprovante inválido.';
  end if;

  update public.service_orders
  set status = 'completed',
      completion_photo_path = p_photo_path,
      completed_at = now(),
      updated_at = now()
  where id = o.id
  returning * into o;

  insert into public.audit_logs(company_id,user_id,action,entity,entity_id,new_data)
  values (p.company_id,auth.uid(),'service_order.finish','service_orders',o.id::text,
    jsonb_build_object('status',o.status,'completion_photo_path',p_photo_path));
  return o;
end;
$$;

grant execute on function public.service_order_finish(uuid,text) to authenticated;
