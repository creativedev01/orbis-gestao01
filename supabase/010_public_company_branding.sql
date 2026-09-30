-- Permite identificar a empresa na tela de login por um link com o slug.
-- Apenas nome e caminho da logomarca são expostos pela função.
create or replace function public.get_company_branding(p_slug text)
returns table(company_name text, logo_path text)
language sql stable security definer
set search_path = ''
as $$
  select c.name, c.logo_url
  from public.companies as c
  where c.slug = p_slug and c.active = true
  limit 1;
$$;

revoke all on function public.get_company_branding(text) from public;
grant execute on function public.get_company_branding(text) to anon, authenticated;

-- Logomarcas são imagens de identidade visual e podem ser exibidas antes do login.
-- Os demais buckets, inclusive comprovantes das OS, permanecem privados.
update storage.buckets set public = true where id = 'company-logos';
