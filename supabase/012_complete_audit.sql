-- ORBIS GESTÃO — auditoria de cadastros alterados diretamente.
-- Execute após 011_service_order_materials.sql.

create or replace function public.audit_company_row()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  company_value uuid;
  record_id text;
  old_value jsonb;
  new_value jsonb;
begin
  company_value := case when tg_op = 'DELETE' then old.company_id else new.company_id end;
  record_id := case when tg_op = 'DELETE' then old.id::text else new.id::text end;
  old_value := case when tg_op in ('UPDATE','DELETE') then to_jsonb(old) else null end;
  new_value := case when tg_op in ('INSERT','UPDATE') then to_jsonb(new) else null end;
  if tg_table_name = 'employee_invites' then
    old_value := old_value - 'token';
    new_value := new_value - 'token';
  end if;
  insert into public.audit_logs(company_id,user_id,action,entity,entity_id,old_data,new_data)
  values(company_value,auth.uid(),lower(tg_table_name)||'.'||lower(tg_op),tg_table_name,record_id,
    old_value,new_value);
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

drop trigger if exists audit_business_contacts on public.business_contacts;
create trigger audit_business_contacts after insert or update or delete on public.business_contacts
for each row execute function public.audit_company_row();

drop trigger if exists audit_categories on public.categories;
create trigger audit_categories after insert or update or delete on public.categories
for each row execute function public.audit_company_row();

drop trigger if exists audit_employee_invites on public.employee_invites;
create trigger audit_employee_invites after insert or update or delete on public.employee_invites
for each row execute function public.audit_company_row();

-- Perfis usam company_id e id, mas o JSON do histórico não deve expor dados de autenticação.
drop trigger if exists audit_profiles on public.profiles;
create trigger audit_profiles after update on public.profiles
for each row when (
  old.full_name is distinct from new.full_name or old.email is distinct from new.email or
  old.phone is distinct from new.phone or old.job_title is distinct from new.job_title or
  old.role is distinct from new.role or old.active is distinct from new.active
) execute function public.audit_company_row();
