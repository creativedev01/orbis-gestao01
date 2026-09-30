// Cada instalação usa as credenciais públicas do projeto Supabase do cliente.
// Os valores padrão preservam a instalação de desenvolvimento já publicada.
export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://bnlhhnipeqhcdxmzkgwl.supabase.co";
export const SUPABASE_PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || "sb_publishable_ysJbAV0p5I40noKsNnzW5w_bb2AcfAl";

export type AppRole = "platform_admin" | "admin" | "employee";
export type AuthSession = {
  access_token: string;
  refresh_token: string;
  expires_at: number;
  user: { id: string; email?: string };
};
export type UserProfile = {
  id: string;
  company_id: string | null;
  full_name: string;
  role: AppRole;
  active: boolean;
  email?: string | null;
  phone?: string | null;
  job_title?: string | null;
  last_access_at?: string | null;
  removed_at?: string | null;
};
export type EmployeeInvite = {
  id: string;
  company_id: string;
  email: string;
  full_name: string;
  role: "admin" | "employee";
  token: string;
  status: "pending" | "accepted" | "cancelled" | "expired";
  expires_at: string;
  created_at: string;
};
export type Company = {
  id: string;
  name: string;
  slug: string | null;
  document: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  logo_url: string | null;
  active: boolean;
};
export type PublicCompanyBranding = { company_name:string; logo_path:string|null };

export async function getPublicCompanyBranding(slug:string):Promise<PublicCompanyBranding|null>{
  const response=await fetch(`${SUPABASE_URL}/rest/v1/rpc/get_company_branding`,{
    method:"POST",headers,body:JSON.stringify({p_slug:slug}),
  });
  if(!response.ok) throw new Error(await parseError(response));
  const rows:PublicCompanyBranding[]=await response.json();
  return rows[0]||null;
}

export function publicCompanyLogoUrl(path:string|null){
  if(!path||!/^[-a-f0-9]{36}\/logo-[0-9]+\.(png|jpg|jpeg|webp|svg)$/i.test(path)) return null;
  return `${SUPABASE_URL}/storage/v1/object/public/company-logos/${path}`;
}

const headers = { apikey: SUPABASE_PUBLISHABLE_KEY, "Content-Type": "application/json" };
const storageKey = "orbis-auth-session";

async function parseError(response: Response) {
  const body = await response.json().catch(() => ({}));
  return body?.msg || body?.message || body?.error_description || body?.error || "Não foi possível concluir a operação.";
}

export async function signIn(email: string, password: string): Promise<AuthSession> {
  const response = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: "POST", headers, body: JSON.stringify({ email, password }),
  });
  if (!response.ok) throw new Error(await parseError(response));
  const data = await response.json();
  const session: AuthSession = {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_at: Math.floor(Date.now() / 1000) + data.expires_in,
    user: data.user,
  };
  localStorage.setItem(storageKey, JSON.stringify(session));
  return session;
}

export async function signUpWithInvite(email: string, password: string, fullName: string, inviteToken: string) {
  const response = await fetch(`${SUPABASE_URL}/auth/v1/signup`, {
    method: "POST", headers, body: JSON.stringify({ email, password, data: { full_name: fullName, invite_token: inviteToken } }),
  });
  if (!response.ok) throw new Error(await parseError(response));
  return response.json();
}

export async function refreshSession(session: AuthSession): Promise<AuthSession | null> {
  if (session.expires_at > Math.floor(Date.now() / 1000) + 60) return session;
  const response = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
    method: "POST", headers, body: JSON.stringify({ refresh_token: session.refresh_token }),
  });
  if (!response.ok) { localStorage.removeItem(storageKey); return null; }
  const data = await response.json();
  const renewed: AuthSession = {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_at: Math.floor(Date.now() / 1000) + data.expires_in,
    user: data.user,
  };
  localStorage.setItem(storageKey, JSON.stringify(renewed));
  return renewed;
}

export async function restoreSession() {
  const raw = localStorage.getItem(storageKey);
  if (!raw) return null;
  try {
    const stored: AuthSession = JSON.parse(raw);
    if (!navigator.onLine) return stored;
    return await refreshSession(stored);
  } catch { return null; }
}

export async function getProfile(session: AuthSession): Promise<UserProfile> {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${encodeURIComponent(session.user.id)}&select=id,company_id,full_name,role,active&limit=1`, {
    headers: { ...headers, Authorization: `Bearer ${session.access_token}` },
  });
  if (!response.ok) throw new Error(await parseError(response));
  const [profile] = await response.json();
  if (!profile) throw new Error("Seu usuário ainda não possui um perfil no sistema.");
  if (!profile.active) throw new Error("Seu acesso está bloqueado. Procure o administrador.");
  return profile;
}

export async function getCompany(session: AuthSession, companyId: string): Promise<Company> {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/companies?id=eq.${encodeURIComponent(companyId)}&select=id,name,slug,document,phone,email,address,logo_url,active&limit=1`, {
    headers: { ...headers, Authorization: `Bearer ${session.access_token}` },
  });
  if (!response.ok) throw new Error(await parseError(response));
  const [company] = await response.json();
  if (!company) throw new Error("Empresa não encontrada.");
  return company;
}

export async function updateCompany(session: AuthSession, company: Company): Promise<Company> {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/companies?id=eq.${encodeURIComponent(company.id)}`, {
    method: "PATCH",
    headers: { ...headers, Authorization: `Bearer ${session.access_token}`, Prefer: "return=representation" },
    body: JSON.stringify({ name: company.name, document: company.document, phone: company.phone, email: company.email, address: company.address, updated_at: new Date().toISOString() }),
  });
  if (!response.ok) throw new Error(await parseError(response));
  const [updated] = await response.json();
  await fetch(`${SUPABASE_URL}/rest/v1/audit_logs`, {
    method: "POST",
    headers: { ...headers, Authorization: `Bearer ${session.access_token}` },
    body: JSON.stringify({ company_id: company.id, user_id: session.user.id, action: "company.updated", entity: "companies", entity_id: company.id, new_data: { name: company.name, document: company.document, phone: company.phone, email: company.email, address: company.address } }),
  }).catch(() => null);
  return updated;
}

export async function uploadCompanyLogo(session:AuthSession, company:Company, file:File):Promise<Company>{
  if(file.size>2*1024*1024) throw new Error("A logomarca deve ter no máximo 2 MB.");
  if(!["image/jpeg","image/png","image/webp","image/svg+xml"].includes(file.type)) throw new Error("Use uma imagem JPG, PNG, WEBP ou SVG.");
  const extension=(file.name.split(".").pop()||"png").toLowerCase();
  const path=`${company.id}/logo-${Date.now()}.${extension}`;
  const upload=await fetch(`${SUPABASE_URL}/storage/v1/object/company-logos/${path}`,{method:"POST",headers:{apikey:SUPABASE_PUBLISHABLE_KEY,Authorization:`Bearer ${session.access_token}`,"Content-Type":file.type,"x-upsert":"false"},body:file});
  if(!upload.ok) throw new Error(await parseError(upload));
  const response=await fetch(`${SUPABASE_URL}/rest/v1/companies?id=eq.${encodeURIComponent(company.id)}`,{method:"PATCH",headers:{...headers,Authorization:`Bearer ${session.access_token}`,Prefer:"return=representation"},body:JSON.stringify({logo_url:path,updated_at:new Date().toISOString()})});
  if(!response.ok) throw new Error(await parseError(response));
  const [updated]=await response.json(); return updated;
}

export async function getCompanyLogoUrl(session:AuthSession,path:string|null){
  if(!path) return null;
  const response=await fetch(`${SUPABASE_URL}/storage/v1/object/sign/company-logos/${path}`,{method:"POST",headers:{...headers,Authorization:`Bearer ${session.access_token}`},body:JSON.stringify({expiresIn:3600})});
  if(!response.ok) return null;
  const data=await response.json(); return `${SUPABASE_URL}/storage/v1${data.signedURL}`;
}

export async function getEmployees(session: AuthSession, companyId: string): Promise<UserProfile[]> {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/profiles?company_id=eq.${encodeURIComponent(companyId)}&removed_at=is.null&select=id,company_id,full_name,email,phone,job_title,role,active,last_access_at,removed_at&order=full_name.asc`, {
    headers: { ...headers, Authorization: `Bearer ${session.access_token}` },
  });
  if (!response.ok) throw new Error(await parseError(response));
  return response.json();
}

export async function deleteEmployee(session:AuthSession,employeeId:string){
  const response=await fetch(`${SUPABASE_URL}/rest/v1/rpc/remove_employee`,{method:"POST",headers:{...headers,Authorization:`Bearer ${session.access_token}`},body:JSON.stringify({p_employee_id:employeeId})});
  if(!response.ok) throw new Error(await parseError(response));
}

export async function updateEmployee(session: AuthSession, employee: UserProfile, changes: { role?: "admin" | "employee"; active?: boolean; full_name?: string; phone?: string | null; job_title?: string | null }) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${encodeURIComponent(employee.id)}`, {
    method: "PATCH",
    headers: { ...headers, Authorization: `Bearer ${session.access_token}`, Prefer: "return=representation" },
    body: JSON.stringify({ ...changes, updated_at: new Date().toISOString() }),
  });
  if (!response.ok) throw new Error(await parseError(response));
  const [updated] = await response.json();
  return updated as UserProfile;
}

export async function getEmployeeInvites(session: AuthSession, companyId: string): Promise<EmployeeInvite[]> {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/employee_invites?company_id=eq.${encodeURIComponent(companyId)}&select=*&order=created_at.desc`, {
    headers: { ...headers, Authorization: `Bearer ${session.access_token}` },
  });
  if (!response.ok) throw new Error(await parseError(response));
  return response.json();
}

export async function createEmployeeInvite(session: AuthSession, companyId: string, data: { full_name: string; email: string; role: "admin" | "employee" }) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/employee_invites`, {
    method: "POST",
    headers: { ...headers, Authorization: `Bearer ${session.access_token}`, Prefer: "return=representation" },
    body: JSON.stringify({ company_id: companyId, created_by: session.user.id, full_name: data.full_name, email: data.email.toLowerCase(), role: data.role }),
  });
  if (!response.ok) throw new Error(await parseError(response));
  const [invite] = await response.json();
  return invite as EmployeeInvite;
}

export async function sendPasswordRecovery(email: string) {
  const response = await fetch(`${SUPABASE_URL}/auth/v1/recover`, {
    method: "POST", headers, body: JSON.stringify({ email, redirect_to: window.location.origin }),
  });
  if (!response.ok) throw new Error(await parseError(response));
}

export async function signOut(session: AuthSession | null) {
  if (session) await fetch(`${SUPABASE_URL}/auth/v1/logout`, { method: "POST", headers: { ...headers, Authorization: `Bearer ${session.access_token}` } }).catch(() => null);
  localStorage.removeItem(storageKey);
}
