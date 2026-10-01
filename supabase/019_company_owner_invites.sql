-- ORBIS GESTAO — cria empresa e convite do primeiro administrador

create or replace function public.platform_create_company_with_owner(
  p_name text,
  p_slug text,
  p_document text,
  p_email text,
  p_phone text,
  p_address text,
  p_plan_code text,
  p_owner_name text,
  p_owner_email text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  cid uuid;
  invite_token uuid;
begin
  if not public.is_platform_admin() then
    raise exception 'Acesso exclusivo da ER Creative.';
  end if;
  if nullif(trim(p_name), '') is null then
    raise exception 'Informe o nome da empresa.';
  end if;
  if nullif(trim(p_owner_name), '') is null then
    raise exception 'Informe o nome do proprietário.';
  end if;
  if nullif(trim(p_owner_email), '') is null then
    raise exception 'Informe o e-mail do proprietário.';
  end if;

  insert into public.companies(name, slug, document, email, phone, address, active)
  values (
    trim(p_name), nullif(lower(trim(p_slug)), ''), nullif(trim(p_document), ''),
    nullif(lower(trim(p_email)), ''), nullif(trim(p_phone), ''),
    nullif(trim(p_address), ''), true
  ) returning id into cid;

  insert into public.company_subscriptions(company_id, plan_code, status, current_period_end)
  values (cid, coalesce(nullif(p_plan_code, ''), 'essencial'), 'trial', current_date + 30);

  insert into public.employee_invites(company_id, email, full_name, role, created_by)
  values (cid, lower(trim(p_owner_email)), trim(p_owner_name), 'admin', auth.uid())
  returning token into invite_token;

  return jsonb_build_object('company_id', cid, 'token', invite_token);
end;
$$;

grant execute on function public.platform_create_company_with_owner(
  text,text,text,text,text,text,text,text,text
) to authenticated;

select jsonb_build_object(
  'database_version', 19,
  'function_ok', to_regprocedure(
    'public.platform_create_company_with_owner(text,text,text,text,text,text,text,text,text)'
  ) is not null
) as orbis_status;
