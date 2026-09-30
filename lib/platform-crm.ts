import {AuthSession,SUPABASE_PUBLISHABLE_KEY,SUPABASE_URL} from "./supabase-auth";
const headers=(s:AuthSession)=>({apikey:SUPABASE_PUBLISHABLE_KEY,Authorization:`Bearer ${s.access_token}`,"Content-Type":"application/json"});
async function fail(r:Response){const b:any=await r.json().catch(()=>({}));throw new Error(b?.message||b?.error||"Não foi possível concluir a operação.")}
export type CrmKind="leads"|"tickets"|"tasks"|"knowledge";
export type CrmRow={id:string;[key:string]:any};
const tables:Record<CrmKind,string>={leads:"crm_leads",tickets:"support_tickets",tasks:"crm_tasks",knowledge:"knowledge_articles"};
export async function listCrm(s:AuthSession,kind:CrmKind){const r=await fetch(`${SUPABASE_URL}/rest/v1/${tables[kind]}?deleted_at=is.null&select=*&order=created_at.desc`,{headers:headers(s)});if(!r.ok)await fail(r);return r.json() as Promise<CrmRow[]>}
export async function createCrm(s:AuthSession,kind:CrmKind,data:Record<string,any>){const r=await fetch(`${SUPABASE_URL}/rest/v1/${tables[kind]}`,{method:"POST",headers:{...headers(s),Prefer:"return=representation"},body:JSON.stringify(data)});if(!r.ok)await fail(r);return (await r.json())[0] as CrmRow}
export async function updateCrm(s:AuthSession,kind:CrmKind,id:string,data:Record<string,any>){const r=await fetch(`${SUPABASE_URL}/rest/v1/${tables[kind]}?id=eq.${id}`,{method:"PATCH",headers:{...headers(s),Prefer:"return=representation"},body:JSON.stringify({...data,updated_at:new Date().toISOString()})});if(!r.ok)await fail(r);return (await r.json())[0] as CrmRow}
export async function removeCrm(s:AuthSession,kind:CrmKind,id:string){const r=await fetch(`${SUPABASE_URL}/rest/v1/${tables[kind]}?id=eq.${id}`,{method:"PATCH",headers:headers(s),body:JSON.stringify({deleted_at:new Date().toISOString(),updated_at:new Date().toISOString()})});if(!r.ok)await fail(r)}
export async function crmCounts(s:AuthSession){const kinds=Object.keys(tables) as CrmKind[];const values=await Promise.all(kinds.map(k=>listCrm(s,k)));return Object.fromEntries(kinds.map((k,i)=>[k,values[i].length])) as Record<CrmKind,number>}
