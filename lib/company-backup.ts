import { AuthSession, Company, SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "./supabase-auth";

const headers=(session:AuthSession)=>({apikey:SUPABASE_PUBLISHABLE_KEY,Authorization:`Bearer ${session.access_token}`});
async function rows(session:AuthSession,table:string,companyId:string,select="*"){
  const result:unknown[]=[];
  for(let offset=0;;offset+=1000){
    const response=await fetch(`${SUPABASE_URL}/rest/v1/${table}?company_id=eq.${encodeURIComponent(companyId)}&select=${encodeURIComponent(select)}&limit=1000&offset=${offset}`,{headers:headers(session)});
    if(!response.ok){const body:any=await response.json().catch(()=>({}));throw new Error(body?.message||`Não foi possível copiar ${table}.`)}
    const batch:unknown[]=await response.json();result.push(...batch);if(batch.length<1000)return result;
  }
}
export async function downloadCompanyBackup(session:AuthSession,company:Company){
  const [profiles,categories,products,movements,contacts,orders,materials,logs,invites]=await Promise.all([
    rows(session,"profiles",company.id,"id,company_id,full_name,email,phone,job_title,role,active,last_access_at,created_at,updated_at"),
    rows(session,"categories",company.id), rows(session,"products",company.id), rows(session,"stock_movements",company.id),
    rows(session,"business_contacts",company.id), rows(session,"service_orders",company.id), rows(session,"service_order_materials",company.id),
    rows(session,"audit_logs",company.id), rows(session,"employee_invites",company.id,"id,company_id,email,full_name,role,status,expires_at,accepted_at,created_at"),
  ]);
  const backup={format:"orbis-company-backup",version:1,generated_at:new Date().toISOString(),notice:"Não inclui senhas nem arquivos de fotos. As fotos permanecem no armazenamento da instalação.",company,profiles,categories,products,stock_movements:movements,business_contacts:contacts,service_orders:orders,service_order_materials:materials,audit_logs:logs,employee_invites:invites};
  const url=URL.createObjectURL(new Blob([JSON.stringify(backup,null,2)],{type:"application/json"}));
  const link=document.createElement("a");link.href=url;link.download=`backup-orbis-${company.slug||"empresa"}-${new Date().toISOString().slice(0,10)}.json`;link.click();URL.revokeObjectURL(url);
}
