-- Bucket privado para logomarcas das empresas.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('company-logos', 'company-logos', false, 2097152, array['image/jpeg','image/png','image/webp','image/svg+xml'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "company_logos_read" on storage.objects;
create policy "company_logos_read" on storage.objects for select to authenticated
using (
  bucket_id = 'company-logos'
  and exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.active = true
      and split_part(storage.objects.name, '/', 1) = p.company_id::text
  )
);

drop policy if exists "company_logos_admin_insert" on storage.objects;
create policy "company_logos_admin_insert" on storage.objects for insert to authenticated
with check (
  bucket_id = 'company-logos'
  and exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.active = true
      and p.role in ('admin','platform_admin')
      and split_part(storage.objects.name, '/', 1) = p.company_id::text
  )
);

drop policy if exists "company_logos_admin_update" on storage.objects;
create policy "company_logos_admin_update" on storage.objects for update to authenticated
using (
  bucket_id = 'company-logos'
  and exists (select 1 from public.profiles p where p.id = auth.uid() and p.active = true and p.role in ('admin','platform_admin') and split_part(storage.objects.name, '/', 1) = p.company_id::text)
)
with check (
  bucket_id = 'company-logos'
  and exists (select 1 from public.profiles p where p.id = auth.uid() and p.active = true and p.role in ('admin','platform_admin') and split_part(storage.objects.name, '/', 1) = p.company_id::text)
);

drop policy if exists "company_logos_admin_delete" on storage.objects;
create policy "company_logos_admin_delete" on storage.objects for delete to authenticated
using (
  bucket_id = 'company-logos'
  and exists (select 1 from public.profiles p where p.id = auth.uid() and p.active = true and p.role in ('admin','platform_admin') and split_part(storage.objects.name, '/', 1) = p.company_id::text)
);
