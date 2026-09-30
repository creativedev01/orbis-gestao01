import { AuthSession, SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "./supabase-auth";
export type AuditLog={id:number;company_id:string;user_id:string|null;action:string;entity:string;entity_id:string|null;old_data:Record<string,unknown>|null;new_data:Record<string,unknown>|null;created_at:string};
export async function getAuditLogs(session:AuthSession,companyId:string):Promise<AuditLog[]>{
  const response=await fetch(`${SUPABASE_URL}/rest/v1/audit_logs?company_id=eq.${encodeURIComponent(companyId)}&select=*&order=created_at.desc,id.desc&limit=500`,{headers:{apikey:SUPABASE_PUBLISHABLE_KEY,Authorization:`Bearer ${session.access_token}`}});
  if(!response.ok){const body:any=await response.json().catch(()=>({}));throw new Error(body?.message||"Não foi possível carregar o histórico.")}
  return response.json();
}
