"use client";

import { useEffect, useState } from "react";
import {
  AlertTriangle, Archive, ArrowDownToLine, ArrowUpFromLine, BarChart3, Bell,
  Boxes, Building2, CheckCircle2, ChevronRight, ClipboardCheck, ClipboardList,
  BookOpen, Camera, CheckSquare, Copy, DollarSign, Download, FileText, Headphones, LayoutDashboard, LogOut, Menu, Package, Trash2,
  Activity, Pencil, Plus, Search, Settings, ShieldCheck, Truck, UserPlus, UserRound, Users, Wrench, X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { AuthSession, Company, EmployeeInvite, PublicCompanyBranding, SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL, UserProfile, createEmployeeInvite, deleteEmployee, getCompany, getCompanyLogoUrl, getPublicCompanyBranding, publicCompanyLogoUrl, getEmployeeInvites, getEmployees, getProfile, refreshSession, restoreSession, sendPasswordRecovery, signIn, signOut, signUpWithInvite, updateCompany, updateEmployee, uploadCompanyLogo } from "@/lib/supabase-auth";
import { InventoryView } from "@/components/inventory-view";
import { DirectoryView } from "@/components/directory-view";
import { ServiceOrdersView } from "@/components/service-orders-view";
import { BillingView } from "@/components/billing-view";
import { ReportsView } from "@/components/reports-view";
import { DashboardView } from "@/components/dashboard-view";
import { NotificationBell } from "@/components/notification-bell";
import { getServiceOrders } from "@/lib/service-orders";
import { cacheIdentity, clearOfflineData, pendingActions, pendingFinishes, readIdentity } from "@/lib/offline-orders";
import { downloadCompanyBackup } from "@/lib/company-backup";
import { AuditView } from "@/components/audit-view";
import {PlatformCompaniesView} from "@/components/subscription-center";
import {PlatformCrmView} from "@/components/platform-crm-view";

type Role = "admin" | "employee";
type View = "dashboard" | "platform_dashboard" | "platform" | "platform_leads" | "platform_tickets" | "platform_tasks" | "platform_finance" | "platform_knowledge" | "platform_settings" | "stock" | "orders" | "customers" | "suppliers" | "employees" | "billing" | "reports" | "audit" | "settings";
type Modal = "movement" | "order" | "finish" | null;
const APP_VERSION = "1.0.0";

const products = [
  { sku:"ELE-001", name:"Cabo flexível 2,5 mm", category:"Elétrica", qty:184, min:50, cost:2.9, price:6.5, location:"A-01" },
  { sku:"ELE-014", name:"Disjuntor bipolar 40A", category:"Elétrica", qty:8, min:12, cost:38.5, price:69.9, location:"A-04" },
  { sku:"HID-008", name:"Registro esfera 3/4", category:"Hidráulica", qty:27, min:10, cost:24.9, price:46, location:"B-02" },
  { sku:"FER-021", name:"Broca concreto 8 mm", category:"Ferramentas", qty:0, min:6, cost:9.8, price:21.9, location:"C-03" },
  { sku:"EPI-005", name:"Luva de proteção nitrílica", category:"EPI", qty:43, min:20, cost:12.4, price:28, location:"D-01" },
  { sku:"ELE-032", name:"Tomada 20A branca", category:"Elétrica", qty:61, min:25, cost:8.9, price:17.5, location:"A-02" },
];

const orders = [
  { id:"OS-1048", client:"Clínica Horizonte", service:"Troca do quadro elétrico", status:"Em andamento", priority:"Alta", tech:"Rafael Costa", value:2380, date:"Hoje, 14:00" },
  { id:"OS-1047", client:"Padaria Santa Rita", service:"Manutenção preventiva", status:"Aguardando funcionário", priority:"Normal", tech:"—", value:780, date:"Hoje, 16:30" },
  { id:"OS-1046", client:"Condomínio Aurora", service:"Reparo de vazamento", status:"Aguardando material", priority:"Alta", tech:"Lucas Melo", value:1250, date:"Amanhã, 08:00" },
  { id:"OS-1045", client:"Mercado Boa Compra", service:"Instalação de tomadas", status:"Finalizada", priority:"Normal", tech:"Rafael Costa", value:940, date:"18 set, 10:20" },
  { id:"OS-1044", client:"Escritório Atlas", service:"Revisão elétrica", status:"Aceita", priority:"Baixa", tech:"Lucas Melo", value:560, date:"21 set, 09:00" },
];

const chartData = [
  { month:"Abr", revenue:18700, cost:9200 }, { month:"Mai", revenue:22400, cost:10800 },
  { month:"Jun", revenue:19800, cost:9100 }, { month:"Jul", revenue:27300, cost:12400 },
  { month:"Ago", revenue:25100, cost:11200 }, { month:"Set", revenue:31840, cost:13600 },
];

const nav: { id:View; label:string; icon:typeof LayoutDashboard; adminOnly?:boolean; platformOnly?:boolean }[] = [
  { id:"dashboard", label:"Visão geral", icon:LayoutDashboard },
  { id:"platform_dashboard", label:"Visão geral", icon:LayoutDashboard, platformOnly:true },
  { id:"platform", label:"Empresas", icon:Building2, adminOnly:true, platformOnly:true },
  { id:"platform_leads", label:"Leads", icon:Users, platformOnly:true },
  { id:"platform_tickets", label:"Chamados", icon:Headphones, platformOnly:true },
  { id:"platform_tasks", label:"Tarefas", icon:CheckSquare, platformOnly:true },
  { id:"platform_finance", label:"Financeiro", icon:DollarSign, platformOnly:true },
  { id:"platform_knowledge", label:"Base de conhecimento", icon:BookOpen, platformOnly:true },
  { id:"platform_settings", label:"Configurações", icon:Settings, platformOnly:true },
  { id:"stock", label:"Estoque", icon:Boxes },
  { id:"orders", label:"Ordens de serviço", icon:ClipboardList },
  { id:"customers", label:"Clientes", icon:Users },
  { id:"suppliers", label:"Fornecedores", icon:Truck, adminOnly:true },
  { id:"employees", label:"Funcionários", icon:UserRound, adminOnly:true },
  { id:"billing", label:"Faturamento", icon:BarChart3, adminOnly:true },
  { id:"reports", label:"Relatórios", icon:FileText, adminOnly:true },
  { id:"audit", label:"Histórico", icon:Activity, adminOnly:true },
  { id:"settings", label:"Configurações", icon:Settings, adminOnly:true },
];

const money = (v:number) => v.toLocaleString("pt-BR", { style:"currency", currency:"BRL" });

function Status({ value }:{value:string}) {
  const tone = value === "Finalizada" ? "success" : value === "Em andamento" ? "info" : value === "Aguardando material" ? "warning" : "neutral";
  return <span className={`status ${tone}`}>{value}</span>;
}

export default function Home() {
  const [logged, setLogged] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [session, setSession] = useState<AuthSession | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [company, setCompany] = useState<Company | null>(null);
  const [role, setRole] = useState<Role>("admin");
  const [view, setView] = useState<View>("dashboard");
  const [menu, setMenu] = useState(false);
  const [modal, setModal] = useState<Modal>(null);
  const [notice, setNotice] = useState("");
  const [query, setQuery] = useState("");
  const [serviceOrderCount, setServiceOrderCount] = useState(0);
  const [companyLogo,setCompanyLogo] = useState<string|null>(null);
  const [online,setOnline] = useState(true);
  const [pendingSync,setPendingSync] = useState(0);

  const flash = (text:string) => { setModal(null); setNotice(text); setTimeout(() => setNotice(""), 3200); };
  useEffect(() => {
    restoreSession().then(async current => {
      if (!current) return;
      try {
        const cached = !navigator.onLine ? await readIdentity(current.user.id) : null;
        const currentProfile = cached?.profile || await getProfile(current);
        setSession(current); setProfile(currentProfile); setRole(currentProfile.role === "employee" ? "employee" : "admin"); setView(currentProfile.role === "platform_admin" ? "platform_dashboard" : "dashboard");
        if (currentProfile.company_id) {
          const memberCompany = cached?.company || await getCompany(current, currentProfile.company_id);
          setCompany(memberCompany);
          if (!cached) void cacheIdentity(current, currentProfile, memberCompany).catch(() => null);
        }
        setLogged(true);
      } catch { if (navigator.onLine) await signOut(current); }
    }).finally(() => setCheckingAuth(false));
  }, []);
  useEffect(() => {
    if ("serviceWorker" in navigator) void navigator.serviceWorker.register("/sw.js").catch(() => null);
  }, []);
  useEffect(()=>{
    const update=()=>setOnline(navigator.onLine);update();
    window.addEventListener("online",update);window.addEventListener("offline",update);
    return()=>{window.removeEventListener("online",update);window.removeEventListener("offline",update)};
  },[]);
  useEffect(()=>{
    if(!session||!company){setPendingSync(0);return}
    const check=()=>Promise.all([pendingFinishes(session.user.id,company.id),pendingActions(session.user.id,company.id)]).then(([photos,actions])=>setPendingSync(photos.length+actions.length)).catch(()=>null);
    void check();const timer=window.setInterval(check,4000);return()=>window.clearInterval(timer);
  },[session?.user.id,company?.id,view]);
  useEffect(() => {
    if (!session) return;
    let cancelled = false;
    let refreshing = false;
    const renew = async () => {
      if (refreshing || session.expires_at > Math.floor(Date.now() / 1000) + 120) return;
      refreshing = true;
      try {
        const renewed = await refreshSession(session);
        if (cancelled) return;
        if (!renewed) {
          setSession(null); setProfile(null); setCompany(null); setLogged(false);
          return;
        }
        if (!cancelled) setSession(renewed);
      } catch {
        // Falha temporária de rede: mantenha a tela e tente novamente no próximo ciclo.
      } finally { refreshing = false; }
    };
    const onReturn = () => { if (document.visibilityState === "visible") void renew(); };
    const timer = window.setInterval(() => void renew(), 60_000);
    document.addEventListener("visibilitychange", onReturn);
    void renew();
    return () => { cancelled = true; window.clearInterval(timer); document.removeEventListener("visibilitychange", onReturn); };
  }, [session?.access_token]);
  useEffect(() => {
    if (!session || !company) {
      setServiceOrderCount(0);
      return;
    }
    getServiceOrders(session, company.id)
      .then((rows) => setServiceOrderCount(rows.filter(order => order.status !== "completed" && order.status !== "cancelled").length))
      .catch(() => setServiceOrderCount(0));
  }, [session, company?.id, view]);
  useEffect(()=>{if(session&&company?.logo_url)getCompanyLogoUrl(session,company.logo_url).then(setCompanyLogo).catch(()=>setCompanyLogo(null));else setCompanyLogo(null)},[session,company?.logo_url]);

  const handleLogin = async (current:AuthSession, currentProfile:UserProfile) => {
    setSession(current); setProfile(currentProfile); setRole(currentProfile.role === "employee" ? "employee" : "admin"); setView(currentProfile.role === "platform_admin" ? "platform_dashboard" : "dashboard");
    if (currentProfile.company_id) {
      const memberCompany = await getCompany(current, currentProfile.company_id);
      setCompany(memberCompany);
      void cacheIdentity(current, currentProfile, memberCompany).catch(() => null);
    }
    setLogged(true);
  };
  const handleLogout = async () => {
    if (session && company) {
      const [photos, actions] = await Promise.all([pendingFinishes(session.user.id, company.id), pendingActions(session.user.id, company.id)]).catch(() => [[], []]);
      if (photos.length + actions.length && !window.confirm(`Há ${photos.length + actions.length} pendência(s) aguardando envio. Sair agora apagará essas pendências deste aparelho. Deseja continuar?`)) return;
    }
    await clearOfflineData().catch(() => null);
    await signOut(session); setSession(null); setProfile(null); setCompany(null); setLogged(false);
  };

  if (checkingAuth) return <div className="auth-loading">
<div className="brand-mark"><Wrench/></div>
<strong>Verificando acesso…</strong>
</div>;
  if (!logged) return <Login onLogin={handleLogin} />;

  return <div className="app-shell">
    {notice && <div className="toast">
<CheckCircle2 size={18}/>{notice}</div>}
    {menu && <button className="scrim" aria-label="Fechar menu" onClick={() => setMenu(false)}/>} 
    <aside className={`sidebar ${menu ? "open" : ""}`}>
      <div className="brand">
<div className={`brand-mark ${companyLogo?"has-logo":""}`}>{companyLogo?<img src={companyLogo} alt={`Logo ${company?.name||"empresa"}`}/>:<Wrench/>}</div>
<div>
<strong>{company?.name || "Gestão de Estoque"}</strong>
<span>{profile?.role === "platform_admin" ? "CRM & Suporte" : "Estoque & Serviços"}</span>
</div>
<button className="mobile-close" onClick={() => setMenu(false)}>
<X/>
</button>
</div>
      <nav>
<p>{profile?.role === "platform_admin" ? "GESTÃO DA PLATAFORMA" : "OPERAÇÃO"}</p>{nav.filter(n => profile?.role === "platform_admin" ? n.platformOnly : (role === "admin" || !n.adminOnly) && !n.platformOnly).map(item => <button key={item.id} className={view === item.id ? "active" : ""} onClick={() => { setView(item.id); setMenu(false); }}>
<item.icon/>
<span>{item.label}</span>{item.id === "orders" && serviceOrderCount > 0 && <em>{serviceOrderCount}</em>}</button>)}</nav>
      <div className="sidebar-user">
<div className="avatar">{(profile?.full_name || "U").split(" ").map(n => n[0]).slice(0,2).join("").toUpperCase()}</div>
<div>
<strong>{profile?.full_name || session?.user.email}</strong>
<span>{profile?.role === "platform_admin" ? "Proprietário ER Creative" : role === "admin" ? "Administrador" : "Funcionário"}</span>
</div>
<button title="Sair" onClick={handleLogout}>
<LogOut/>
</button>
</div>
    </aside>

    <main className="main">
      <header className="topbar">
<button className="menu-trigger" onClick={() => setMenu(true)}>
<Menu/>
</button>
<div>
<span>{profile?.role === "platform_admin" ? "PAINEL ER CREATIVE" : role === "admin" ? "PAINEL ADMINISTRATIVO" : "ÁREA DO FUNCIONÁRIO"}</span>
<h1>{nav.find(n => n.id === view)?.label}</h1>
</div>
<div className="top-actions">
{(!online||pendingSync>0)&&<span className={`connection-badge ${online?"pending":"offline"}`}>{online?`${pendingSync} pendência${pendingSync===1?"":"s"}`:"Sem internet"}</span>}
{session&&company&&<NotificationBell session={session} company={company} setView={setView}/>} 
<span className="access-badge">
<ShieldCheck/>{profile?.role === "platform_admin" ? "Proprietário" : role === "admin" ? "Administrador" : "Funcionário"}</span>
</div>
</header>
      <div className="content">
        {view === "dashboard" && session && company && <DashboardView role={role} userName={profile?.full_name || ""} session={session} company={company} setView={setView}/>} 
        {view === "platform" && session && profile?.role==="platform_admin" && <PlatformCompaniesView session={session}/>} 
        {view === "platform_dashboard" && session && profile?.role==="platform_admin" && <PlatformCrmView session={session} mode="overview"/>}
        {view === "platform_leads" && session && profile?.role==="platform_admin" && <PlatformCrmView session={session} mode="leads"/>}
        {view === "platform_tickets" && session && profile?.role==="platform_admin" && <PlatformCrmView session={session} mode="tickets"/>}
        {view === "platform_tasks" && session && profile?.role==="platform_admin" && <PlatformCrmView session={session} mode="tasks"/>}
        {view === "platform_finance" && session && profile?.role==="platform_admin" && <PlatformCrmView session={session} mode="finance"/>}
        {view === "platform_knowledge" && session && profile?.role==="platform_admin" && <PlatformCrmView session={session} mode="knowledge"/>}
        {view === "platform_settings" && session && profile?.role==="platform_admin" && <PlatformCrmView session={session} mode="settings"/>}
        {view === "stock" && session && company && <InventoryView role={role} session={session} company={company} flash={flash}/>}
        {view === "orders" && session && company && profile && <ServiceOrdersView role={role} session={session} company={company} profile={profile} flash={flash} onCountChange={setServiceOrderCount}/>}
        {view === "customers" && session && company && <DirectoryView type="customer" role={role} session={session} company={company} flash={flash}/>}
        {view === "suppliers" && session && company && <DirectoryView type="supplier" role={role} session={session} company={company} flash={flash}/>}
        {view === "employees" && session && profile && company && <Employees session={session} currentProfile={profile} company={company} flash={flash}/>} 
        {view === "billing" && session && company && <BillingView session={session} company={company}/>}
        {view === "reports" && session && company && <ReportsView session={session} company={company}/>} 
        {view === "audit" && session && company && <AuditView session={session} company={company}/>} 
        {view === "settings" && session && company && <SettingsView session={session} company={company} onCompanyChange={setCompany} flash={flash}/>} 
      </div>
    </main>
    <MovementModal open={modal === "movement"} role={role} close={() => setModal(null)} save={() => flash("Movimentação registrada com sucesso.")}/>
    <OrderModal open={modal === "order"} close={() => setModal(null)} save={() => flash("Ordem de serviço criada com sucesso.")}/>
    <FinishModal open={modal === "finish"} close={() => setModal(null)} save={() => flash("OS finalizada e materiais baixados do estoque.")}/>
  </div>;
}

function Login({ onLogin }:{onLogin:(s:AuthSession,p:UserProfile)=>void}) {
  const [inviteToken, setInviteToken] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [companySlug,setCompanySlug] = useState("");
  const [branding,setBranding] = useState<PublicCompanyBranding|null>(null);
  const [brandingError,setBrandingError] = useState("");
  useEffect(() => {
    const params=new URLSearchParams(window.location.search);
    setInviteToken(params.get("invite")||"");
    const slug=params.get("empresa")||"";
    setCompanySlug(slug);
    if(slug)getPublicCompanyBranding(slug).then(result=>{if(result)setBranding(result);else setBrandingError("Empresa não encontrada neste link.")}).catch(()=>setBrandingError("Não foi possível carregar a identidade da empresa."));
  },[]);
  const submit = async (event:React.FormEvent) => {
    event.preventDefault(); setLoading(true); setError(""); setMessage("");
    try { const current = await signIn(email,password); try { const currentProfile = await getProfile(current); if(companySlug&&currentProfile.company_id){const memberCompany=await getCompany(current,currentProfile.company_id);if(memberCompany.slug!==companySlug)throw new Error("Esta conta pertence a outra empresa. Use o link de acesso correto.")} onLogin(current,currentProfile); } catch(err) { await signOut(current); throw err; } }
    catch (err) { setError(err instanceof Error ? err.message : "Não foi possível entrar."); }
    finally { setLoading(false); }
  };
  const recover = async () => {
    if (!email) return setError("Informe seu e-mail antes de recuperar a senha.");
    setLoading(true); setError("");
    try { await sendPasswordRecovery(email); setMessage("Enviamos as instruções de recuperação para o seu e-mail."); }
    catch (err) { setError(err instanceof Error ? err.message : "Não foi possível enviar o e-mail."); }
    finally { setLoading(false); }
  };
  const brandLogo=publicCompanyLogoUrl(branding?.logo_path||null);
  if (inviteToken) return <InviteRegistration token={inviteToken} branding={branding} onDone={() => { const link=companySlug?`${window.location.pathname}?empresa=${encodeURIComponent(companySlug)}`:window.location.pathname;window.history.replaceState({},"",link); setInviteToken(""); setMessage("Conta criada. Agora entre com seu e-mail e senha."); }}/>
  return <main className="login-page">
<section className="login-aside">
<div>
<div className={`large-mark ${brandLogo?"login-logo":""}`}>{brandLogo?<img src={brandLogo} alt={`Logo ${branding?.company_name}`}/>:<Wrench/>}</div>
<span>GESTÃO EM UM SÓ LUGAR</span>
<h1>{branding?.company_name||<>Controle a operação.<br/>Do estoque ao serviço.</>}</h1>
<p>Informação confiável para sua equipe trabalhar melhor e sua empresa crescer com controle.</p>
<div className="trust">
<ShieldCheck/>
<span>
<strong>Acesso protegido</strong>
<small>Permissões reais por usuário e função</small>
</span>
</div>
</div>
</section>
<section className="login-form-wrap">
<form className="login-form" onSubmit={submit}>
<div className="mobile-brand">{brandLogo?<img src={brandLogo} alt=""/>:<Wrench/>}{branding?.company_name||"Orbis Gestão"}</div>
<span>BEM-VINDO</span>
<h2>Acesse sua conta</h2>
<p>Use o e-mail e a senha cadastrados pela empresa.</p>{brandingError&&<div className="auth-message error-message">{brandingError}</div>}{error && <div className="auth-message error-message">{error}</div>}{message && <div className="auth-message success-message">{message}</div>}<label>E-mail</label>
<Input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="seuemail@empresa.com.br" required autoComplete="email"/>
<div className="label-row">
<label>Senha</label>
<button type="button" className="recover-link" onClick={recover}>Esqueci minha senha</button>
</div>
<Input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Digite sua senha" required autoComplete="current-password"/>
<Button className="login-button" type="submit" disabled={loading}>{loading ? "Verificando…" : "Entrar no sistema"}<ChevronRight/>
</Button>
<small className="demo-note">Acesso protegido e conectado ao banco de dados</small>
</form>
</section>
</main>;
}

function InviteRegistration({token,branding,onDone}:{token:string;branding:PublicCompanyBranding|null;onDone:()=>void}) {
  const [fullName,setFullName] = useState("");
  const [email,setEmail] = useState("");
  const [password,setPassword] = useState("");
  const [confirm,setConfirm] = useState("");
  const [loading,setLoading] = useState(false);
  const [error,setError] = useState("");
  const submit = async (event:React.FormEvent) => {
    event.preventDefault();
    if (password.length < 8) return setError("A senha precisa ter pelo menos 8 caracteres.");
    if (password !== confirm) return setError("As senhas não são iguais.");
    setLoading(true); setError("");
    try { await signUpWithInvite(email,password,fullName,token); onDone(); }
    catch (err) { setError(err instanceof Error ? err.message : "Não foi possível criar sua conta."); }
    finally { setLoading(false); }
  };
  return <main className="login-page">
<section className="login-aside">
<div>
<div className={`large-mark ${branding?.logo_path?"login-logo":""}`}>{publicCompanyLogoUrl(branding?.logo_path||null)?<img src={publicCompanyLogoUrl(branding?.logo_path||null)!} alt={`Logo ${branding?.company_name}`}/>:<UserPlus/>}</div>
<span>CONVITE DA EMPRESA</span>
<h1>{branding?.company_name||<>Crie seu acesso<br/>com segurança.</>}</h1>
<p>Sua senha é pessoal e não será exibida ao administrador.</p>
</div>
</section>
<section className="login-form-wrap">
<form className="login-form" onSubmit={submit}>
<div className="mobile-brand">
<Wrench/>Gestão de Estoque</div>
<span>NOVO ACESSO</span>
<h2>Aceitar convite</h2>
<p>Preencha seus dados para ativar a conta.</p>{error && <div className="auth-message error-message">{error}</div>}<label>Nome completo</label>
<Input value={fullName} onChange={e=>setFullName(e.target.value)} required/>
<label>E-mail do convite</label>
<Input type="email" value={email} onChange={e=>setEmail(e.target.value)} required/>
<label>Crie uma senha</label>
<Input type="password" value={password} onChange={e=>setPassword(e.target.value)} required/>
<label>Confirme a senha</label>
<Input type="password" value={confirm} onChange={e=>setConfirm(e.target.value)} required/>
<Button className="login-button" type="submit" disabled={loading}>{loading ? "Criando acesso…" : "Criar minha conta"}<ChevronRight/>
</Button>
</form>
</section>
</main>;
}

function Dashboard({ role, userName, setView, setModal }:{role:Role;userName:string;setView:(v:View)=>void;setModal:(m:Modal)=>void}) {
  const [greeting,setGreeting] = useState("Olá");
  useEffect(() => {
    const hour = new Date().getHours();
    setGreeting(hour < 12 ? "Bom dia" : hour < 18 ? "Boa tarde" : "Boa noite");
  },[]);
  const firstName = userName.trim().split(" ")[0] || (role === "admin" ? "Administrador" : "Funcionário");
  const stockCost = products.reduce((s,p) => s + p.qty*p.cost, 0);
  const cards = role === "admin" ? [
    ["Valor em estoque",money(stockCost),"+4,8% no mês",DollarSign,"blue"],
    ["Faturamento mensal",money(31840),"+12,6% vs. agosto",BarChart3,"green"],
    ["Ordens em andamento","12","5 aguardando aceite",ClipboardCheck,"purple"],
    ["Estoque crítico","2","Ação necessária",AlertTriangle,"orange"],
  ] : [
    ["Minhas ordens","4","2 para hoje",ClipboardCheck,"blue"],
    ["Ordens disponíveis","5","1 com prioridade alta",ClipboardList,"purple"],
    ["Concluídas no mês","18","+3 vs. agosto",CheckCircle2,"green"],
  ];
  return <>
<div className="page-head">
<div>
<h2>{greeting}, {firstName}.</h2>
<p>{role === "admin" ? "Aqui está o resumo da operação de hoje." : "Confira suas atividades e atendimentos de hoje."}</p>
</div>
<div className="actions">{role === "admin" && <Button variant="outline" onClick={() => setView("stock")}>
<ArrowDownToLine/>Movimentar estoque</Button>}<Button onClick={() => role === "admin" ? setModal("order") : setView("orders")}>
<Plus/>{role === "admin" ? "Nova ordem" : "Ver ordens"}</Button>
</div>
</div>
    <div className="metric-grid">{cards.map(([label,value,note,Icon,tone]:any) => <article className="metric-card" key={label}>
<div className={`metric-icon ${tone}`}>
<Icon/>
</div>
<span>{label}</span>
<strong>{value}</strong>
<small>{note}</small>
</article>)}</div>
    <div className="dashboard-grid">
<section className="panel chart-panel">
<PanelHead title={role === "admin" ? "Desempenho financeiro" : "Ordens concluídas"} text="Últimos 6 meses"/>
<div className="chart">
<ResponsiveContainer width="100%" height="100%">
<AreaChart data={chartData}>
<defs>
<linearGradient id="area" x1="0" y1="0" x2="0" y2="1">
<stop offset="5%" stopColor="#2457d6" stopOpacity={.25}/>
<stop offset="95%" stopColor="#2457d6" stopOpacity={0}/>
</linearGradient>
</defs>
<CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e7eaf0"/>
<XAxis dataKey="month" axisLine={false} tickLine={false}/>
<YAxis hide/>
<Tooltip formatter={v => role === "admin" ? money(Number(v)) : v}/>
<Area type="monotone" dataKey={role === "admin" ? "revenue" : "cost"} stroke="#2457d6" strokeWidth={3} fill="url(#area)"/>
</AreaChart>
</ResponsiveContainer>
</div>
</section>
<section className="panel">
<PanelHead title="Atenção necessária" text="Itens que precisam de ação" action={() => setView("stock")}/>
<div className="attention">{products.filter(p => p.qty <= p.min).map(p => <div key={p.sku}>
<div className="square">
<Package/>
</div>
<span>
<strong>{p.name}</strong>
<small>{p.sku} • {p.location}</small>
</span>
<span className={p.qty === 0 ? "danger" : "warn"}>
<strong>{p.qty} un.</strong>
<small>Mín. {p.min}</small>
</span>
</div>)}</div>
</section>
</div>
    <section className="panel">
<PanelHead title="Ordens recentes" text="Acompanhe os últimos atendimentos" action={() => setView("orders")}/>
<OrdersTable rows={orders.slice(0,4)} role={role}/>
</section>
</>;
}

function PanelHead({title,text,action}:{title:string;text:string;action?:()=>void}) { return <div className="panel-head">
<div>
<h3>{title}</h3>
<p>{text}</p>
</div>{action && <button onClick={action}>Ver todas<ChevronRight/>
</button>}</div> }

function Stock({role,query,setQuery,setModal}:{role:Role;query:string;setQuery:(v:string)=>void;setModal:(m:Modal)=>void}) {
  const filtered = products.filter(p => `${p.name} ${p.sku} ${p.category}`.toLowerCase().includes(query.toLowerCase()));
  return <>
<div className="page-head">
<div>
<h2>Controle de estoque</h2>
<p>Acompanhe níveis, custos e movimentações.</p>
</div>
<Button onClick={() => setModal("movement")}>
<Plus/>Registrar {role === "admin" ? "movimentação" : "saída"}</Button>
</div>
<div className="mini-metrics">
<Mini icon={Package} label="Itens cadastrados" value="268"/>
<Mini icon={AlertTriangle} label="Estoque baixo" value="12"/>
<Mini icon={Archive} label="Produtos zerados" value="3"/>{role === "admin" && <Mini icon={DollarSign} label="Valor em estoque" value={money(48296.2)}/>}</div>
<section className="panel table-panel">
<div className="table-tools">
<div className="search">
<Search/>
<Input placeholder="Buscar produto, SKU ou categoria" value={query} onChange={e => setQuery(e.target.value)}/>
</div>
<select>
<option>Todas as categorias</option>
<option>Elétrica</option>
<option>Hidráulica</option>
</select>
<select>
<option>Todos os níveis</option>
<option>Estoque baixo</option>
</select>
<Button variant="outline">
<Download/>Exportar</Button>
</div>
<div className="table-scroll">
<table>
<thead>
<tr>
<th>Produto</th>
<th>Categoria</th>
<th>Local</th>
<th>Nível</th>{role === "admin" && <>
<th>Custo</th>
<th>Valor</th>
</>}<th>Situação</th>
</tr>
</thead>
<tbody>{filtered.map(p => <tr key={p.sku}>
<td>
<div className="product">
<div className="square">
<Package/>
</div>
<span>
<strong>{p.name}</strong>
<small>{p.sku}</small>
</span>
</div>
</td>
<td>{p.category}</td>
<td>{p.location}</td>
<td>
<div className="level">
<span>
<strong>{p.qty}</strong> / mín. {p.min}</span>
<Progress value={Math.min(p.qty/(p.min*2)*100,100)}/>
</div>
</td>{role === "admin" && <>
<td>{money(p.cost)}</td>
<td>
<strong>{money(p.cost*p.qty)}</strong>
</td>
</>}<td>{p.qty === 0 ? <span className="status danger-bg">Zerado</span> : p.qty <= p.min ? <span className="status warning">Estoque baixo</span> : <span className="status success">Normal</span>}</td>
</tr>)}</tbody>
</table>
</div>
</section>
</>;
}

function Mini({icon:Icon,label,value}:any) { return <div>
<Icon/>
<span>
<small>{label}</small>
<strong>{value}</strong>
</span>
</div> }

function Orders({role,setModal,flash}:{role:Role;setModal:(m:Modal)=>void;flash:(s:string)=>void}) { return <>
<div className="page-head">
<div>
<h2>Ordens de serviço</h2>
<p>Do chamado à assinatura do cliente.</p>
</div>{role === "admin" && <Button onClick={() => setModal("order")}>
<Plus/>Nova ordem</Button>}</div>
<div className="tabs">
<button className="active">Todas <span>24</span>
</button>
<button>Aguardando <span>5</span>
</button>
<button>Em andamento <span>12</span>
</button>
<button>Finalizadas <span>7</span>
</button>
</div>
<section className="panel">
<OrdersTable rows={orders} role={role} action={row => role === "employee" && row.status === "Aguardando funcionário" ? flash(`${row.id} aceita e vinculada a você.`) : setModal("finish")}/>
</section>
</> }

function OrdersTable({rows,role,action}:{rows:typeof orders;role:Role;action?:(r:typeof orders[number])=>void}) { return <div className="table-scroll">
<table>
<thead>
<tr>
<th>Ordem</th>
<th>Cliente / serviço</th>
<th>Status</th>
<th>Responsável</th>
<th>Agenda</th>{role === "admin" && <th>Valor</th>}<th/>
</tr>
</thead>
<tbody>{rows.map(r => <tr key={r.id}>
<td>
<strong className="order-id">{r.id}</strong>
<small className={`priority ${r.priority.toLowerCase()}`}>{r.priority}</small>
</td>
<td>
<div className="two-lines">
<strong>{r.client}</strong>
<span>{r.service}</span>
</div>
</td>
<td>
<Status value={r.status}/>
</td>
<td>{r.tech}</td>
<td>{r.date}</td>{role === "admin" && <td>
<strong>{money(r.value)}</strong>
</td>}<td>
<Button variant="ghost" size="sm" onClick={() => action?.(r)}>{role === "employee" && r.status === "Aguardando funcionário" ? "Aceitar" : "Abrir"}<ChevronRight/>
</Button>
</td>
</tr>)}</tbody>
</table>
</div> }

function Directory({title,description,role,customers=false}:{title:string;description:string;role:Role;customers?:boolean}) {
  const rows = customers ? [["Clínica Horizonte","12.345.678/0001-90","(11) 98765-4321","8 serviços"],["Condomínio Aurora","45.987.321/0001-12","(11) 3456-7890","14 serviços"],["Padaria Santa Rita","123.456.789-10","(11) 99821-4400","3 serviços"],["Escritório Atlas","98.765.432/0001-09","(11) 3090-1122","6 serviços"]] : [["Elétrica Central Ltda.","11.222.333/0001-44","(11) 3333-1212","42 produtos"],["Hidro Forte Distribuidora","55.666.777/0001-88","(11) 4002-8922","18 produtos"],["Protege EPI Brasil","22.444.555/0001-66","(11) 3888-9000","27 produtos"]];
  return <>
<div className="page-head">
<div>
<h2>{title}</h2>
<p>{description}</p>
</div>{role === "admin" && <Button>
<Plus/>Novo cadastro</Button>}</div>
<section className="panel table-panel">
<div className="table-tools">
<div className="search">
<Search/>
<Input placeholder={`Buscar ${title.toLowerCase()}`}/>
</div>
</div>
<div className="directory">{rows.map(r => <article key={r[0]}>
<div className="square">
<Building2/>
</div>
<div>
<strong>{r[0]}</strong>
<span>{r[1]}</span>
</div>
<div>
<small>Contato</small>
<strong>{r[2]}</strong>
</div>
<div>
<small>Histórico</small>
<strong>{r[3]}</strong>
</div>
<Button variant="ghost">Visualizar<ChevronRight/>
</Button>
</article>)}</div>
</section>
</>;
}

function Employees({session,currentProfile,company,flash}:{session:AuthSession;currentProfile:UserProfile;company:Company;flash:(s:string)=>void}) {
  const [employees,setEmployees] = useState<UserProfile[]>([]);
  const [invites,setInvites] = useState<EmployeeInvite[]>([]);
  const [loading,setLoading] = useState(true);
  const [open,setOpen] = useState(false);
  const [name,setName] = useState("");
  const [email,setEmail] = useState("");
  const [inviteRole,setInviteRole] = useState<"admin"|"employee">("employee");
  const [error,setError] = useState("");
  const [inviteLink,setInviteLink] = useState("");
  const [employeeDetails,setEmployeeDetails] = useState<UserProfile|null>(null);
  const [editingEmployee,setEditingEmployee] = useState<UserProfile|null>(null);
  const [employeeForm,setEmployeeForm] = useState({full_name:"",phone:"",job_title:"",role:"employee" as "admin"|"employee"});
  const load = async () => {
    setLoading(true);
    try { const [people,pending] = await Promise.all([getEmployees(session,company.id),getEmployeeInvites(session,company.id)]); setEmployees(people); setInvites(pending); }
    catch (err) { setError(err instanceof Error ? err.message : "Não foi possível carregar funcionários."); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); },[company.id]);
  const invite = async () => {
    if (!name.trim() || !email.includes("@")) return setError("Informe o nome e um e-mail válido.");
    setLoading(true); setError("");
    try { const created = await createEmployeeInvite(session,company.id,{full_name:name,email,role:inviteRole}); const link = `${window.location.origin}?invite=${encodeURIComponent(created.token)}${company.slug?`&empresa=${encodeURIComponent(company.slug)}`:""}`; setInviteLink(link); await navigator.clipboard.writeText(link).catch(()=>null); await load(); }
    catch (err) { setError(err instanceof Error ? err.message : "Não foi possível criar o convite."); setLoading(false); }
  };
  const toggle = async (employee:UserProfile) => {
    try { const updated = await updateEmployee(session,employee,{active:!employee.active}); setEmployees(list=>list.map(item=>item.id===updated.id?updated:item)); flash(updated.active?"Funcionário reativado.":"Acesso do funcionário bloqueado."); }
    catch (err) { setError(err instanceof Error ? err.message : "Não foi possível alterar o acesso."); }
  };
  const changeRole = async (employee:UserProfile,role:"admin"|"employee") => {
    try { const updated = await updateEmployee(session,employee,{role}); setEmployees(list=>list.map(item=>item.id===updated.id?updated:item)); flash("Permissão atualizada."); }
    catch (err) { setError(err instanceof Error ? err.message : "Não foi possível alterar a permissão."); }
  };
  const openEmployeeEdit=(employee:UserProfile)=>{setEditingEmployee(employee);setEmployeeForm({full_name:employee.full_name,phone:employee.phone||"",job_title:employee.job_title||"",role:employee.role==="employee"?"employee":"admin"});setError("")};
  const saveEmployee=async()=>{if(!editingEmployee||!employeeForm.full_name.trim())return setError("Informe o nome do funcionário.");setLoading(true);setError("");try{const changes:{full_name:string;phone:string|null;job_title:string|null;role?:"admin"|"employee"}={full_name:employeeForm.full_name.trim(),phone:employeeForm.phone.trim()||null,job_title:employeeForm.job_title.trim()||null};if(editingEmployee.role!=="platform_admin"&&editingEmployee.id!==currentProfile.id)changes.role=employeeForm.role;const updated=await updateEmployee(session,editingEmployee,changes);setEmployees(list=>list.map(item=>item.id===updated.id?updated:item));setEditingEmployee(null);flash("Funcionário atualizado com sucesso.")}catch(err){setError(err instanceof Error?err.message:"Não foi possível editar o funcionário.")}finally{setLoading(false)}};
  const removeEmployee=async(employee:UserProfile)=>{if(!window.confirm(`Excluir “${employee.full_name}” do sistema? O acesso será encerrado, mas o histórico será preservado.`))return;setLoading(true);setError("");try{await deleteEmployee(session,employee.id);setEmployees(list=>list.filter(item=>item.id!==employee.id));setEmployeeDetails(null);flash("Funcionário excluído e histórico preservado.")}catch(err){setError(err instanceof Error?err.message:"Não foi possível excluir o funcionário.")}finally{setLoading(false)}};
  return <>
<div className="page-head">
<div>
<h2>Funcionários</h2>
<p>Contas e permissões reais de {company.name}.</p>
</div>
<Button onClick={()=>{setOpen(true);setInviteLink("");setError("");}}>
<UserPlus/>Convidar funcionário</Button>
</div>{error && <div className="auth-message error-message">{error}</div>}<section className="panel table-panel">
<div className="employee-summary">
<span>
<strong>{employees.length}</strong> usuários cadastrados</span>
<span>
<strong>{employees.filter(e=>e.active).length}</strong> ativos</span>
<span>
<strong>{invites.filter(i=>i.status==="pending").length}</strong> convites pendentes</span>
</div>
<div className="table-scroll">
<table>
<thead>
<tr>
<th>Funcionário</th>
<th>Permissão</th>
<th>Último acesso</th>
<th>Situação</th>
<th>Ações</th>
</tr>
</thead>
<tbody>{loading && employees.length===0 ? <tr>
<td colSpan={5}>Carregando funcionários…</td>
</tr> : employees.map(employee=>
<tr key={employee.id} className="clickable-row" onClick={()=>setEmployeeDetails(employee)}>
<td>
<div className="product">
<div className="employee-avatar small">{employee.full_name.split(" ").map(n=>n[0]).slice(0,2).join("")}</div>
<span>
<strong>{employee.full_name}</strong>
<small>{employee.email || (employee.id===currentProfile.id?session.user.email:"E-mail não informado")}</small>
</span>
</div>
</td>
<td onClick={e=>e.stopPropagation()}>{employee.role==="platform_admin"?<span className="status info">Proprietário</span>:employee.id===currentProfile.id?<span className="status neutral">Sua conta</span>:<select value={employee.role} onChange={e=>changeRole(employee,e.target.value as "admin"|"employee")}>
<option value="employee">Funcionário</option>
<option value="admin">Administrador</option>
</select>}</td>
<td>{employee.last_access_at?new Date(employee.last_access_at).toLocaleString("pt-BR"):"Ainda não registrado"}</td>
<td>
<span className={`status ${employee.active?"success":"danger-bg"}`}>{employee.active?"Ativo":"Bloqueado"}</span>
</td>
<td onClick={e=>e.stopPropagation()}><div className="row-actions"><Button size="icon" variant="outline" aria-label={`Editar ${employee.full_name}`} onClick={()=>openEmployeeEdit(employee)}><Pencil/></Button>{employee.id===currentProfile.id?<small>Protegida</small>:<><Button size="sm" variant="outline" onClick={()=>toggle(employee)}>{employee.active?"Bloquear":"Reativar"}</Button><Button size="icon" variant="outline" aria-label={`Excluir ${employee.full_name}`} onClick={()=>removeEmployee(employee)} disabled={loading}><Trash2/></Button></>}</div></td>
</tr>)}</tbody>
</table>
</div>
</section>{invites.some(i=>i.status==="pending")&&<section className="panel invites-panel">
<PanelHead title="Convites pendentes" text="Links ainda não utilizados"/>
<div>{invites.filter(i=>i.status==="pending").map(item=>
<article key={item.id}>
<div>
<strong>{item.full_name}</strong>
<span>{item.email} • expira em {new Date(item.expires_at).toLocaleDateString("pt-BR")}</span>
</div>
<Button variant="outline" size="sm" onClick={()=>{navigator.clipboard.writeText(`${window.location.origin}?invite=${encodeURIComponent(item.token)}${company.slug?`&empresa=${encodeURIComponent(company.slug)}`:""}`);flash("Link copiado.");}}>
<Copy/>Copiar link</Button>
</article>)}</div>
</section>}<Dialog open={open} onOpenChange={setOpen}>
<DialogContent className="modal">
<DialogHeader>
<DialogTitle>Convidar funcionário</DialogTitle>
<DialogDescription>O funcionário receberá um link para criar a própria senha.</DialogDescription>
</DialogHeader>{error&&<div className="auth-message error-message">{error}</div>}{inviteLink?<div className="invite-ready">
<CheckCircle2/>
<h3>Convite criado</h3>
<p>O link foi copiado. Envie para o funcionário por WhatsApp ou e-mail.</p>
<Input readOnly value={inviteLink}/>
<Button onClick={()=>navigator.clipboard.writeText(inviteLink)}>
<Copy/>Copiar novamente</Button>
</div>:<div className="modal-form">
<label>Nome completo<Input value={name} onChange={e=>setName(e.target.value)}/>
</label>
<label>E-mail<Input type="email" value={email} onChange={e=>setEmail(e.target.value)}/>
</label>
<label>Permissão<select value={inviteRole} onChange={e=>setInviteRole(e.target.value as "admin"|"employee")}>
<option value="employee">Funcionário</option>
<option value="admin">Administrador</option>
</select>
</label>
<Button onClick={invite} disabled={loading}>{loading?"Gerando…":"Gerar convite seguro"}</Button>
</div>}</DialogContent>
</Dialog>
<Dialog open={!!employeeDetails} onOpenChange={v=>!v&&setEmployeeDetails(null)}>
<DialogContent className="modal">
<DialogHeader>
<DialogTitle>{employeeDetails?.full_name}</DialogTitle>
<DialogDescription>Informações e acesso do usuário.</DialogDescription>
</DialogHeader>{employeeDetails&&<div className="detail-grid">
<DetailItem label="E-mail" value={employeeDetails.email||(employeeDetails.id===currentProfile.id?session.user.email:null)}/>
<DetailItem label="Telefone" value={employeeDetails.phone}/>
<DetailItem label="Cargo" value={employeeDetails.job_title}/>
<DetailItem label="Permissão" value={employeeDetails.role==="platform_admin"?"Proprietário":employeeDetails.role==="admin"?"Administrador":"Funcionário"}/>
<DetailItem label="Situação" value={employeeDetails.active?"Ativo":"Bloqueado"}/>
<DetailItem label="Último acesso" value={employeeDetails.last_access_at?new Date(employeeDetails.last_access_at).toLocaleString("pt-BR"):"Ainda não registrado"}/>
</div>}</DialogContent>
</Dialog>
<Dialog open={!!editingEmployee} onOpenChange={v=>!v&&setEditingEmployee(null)}>
<DialogContent className="modal">
<DialogHeader>
<DialogTitle>Editar funcionário</DialogTitle>
<DialogDescription>Atualize os dados profissionais. O e-mail de login não é alterado aqui.</DialogDescription>
</DialogHeader>{error&&<div className="auth-message error-message">{error}</div>}<div className="modal-form">
<label>Nome completo<Input value={employeeForm.full_name} onChange={e=>setEmployeeForm(f=>({...f,full_name:e.target.value}))}/></label>
<label>E-mail de login<Input value={editingEmployee?.email||(editingEmployee?.id===currentProfile.id?session.user.email:"")} readOnly disabled/></label>
<label>Telefone<Input value={employeeForm.phone} onChange={e=>setEmployeeForm(f=>({...f,phone:e.target.value}))}/></label>
<label>Cargo / função<Input value={employeeForm.job_title} onChange={e=>setEmployeeForm(f=>({...f,job_title:e.target.value}))}/></label>
<label>Permissão<select value={employeeForm.role} disabled={editingEmployee?.role==="platform_admin"||editingEmployee?.id===currentProfile.id} onChange={e=>setEmployeeForm(f=>({...f,role:e.target.value as "admin"|"employee"}))}><option value="employee">Funcionário</option><option value="admin">Administrador</option></select></label>
<Button onClick={saveEmployee} disabled={loading}>{loading?"Salvando…":"Salvar alterações"}</Button>
</div></DialogContent>
</Dialog>
</>;
}

function DetailItem({label,value}:{label:string;value?:string|null}){return <div>
<small>{label}</small>
<strong>{value||"Não informado"}</strong>
</div>}

function Billing() { return <>
<div className="page-head">
<div>
<h2>Faturamento</h2>
<p>Receitas das ordens e controle de recebimentos.</p>
</div>
<Button variant="outline">
<Download/>Exportar relatório</Button>
</div>
<div className="metric-grid three">
<article className="metric-card">
<span>Faturamento no mês</span>
<strong>{money(31840)}</strong>
<small className="positive">+12,6% vs. agosto</small>
</article>
<article className="metric-card">
<span>Valores recebidos</span>
<strong>{money(27680)}</strong>
<small>86,9% do faturado</small>
</article>
<article className="metric-card">
<span>Valores pendentes</span>
<strong>{money(4160)}</strong>
<small>6 ordens pendentes</small>
</article>
</div>
<section className="panel chart-panel tall">
<PanelHead title="Evolução do faturamento" text="Receita e custo operacional"/>
<div className="chart">
<ResponsiveContainer width="100%" height="100%">
<AreaChart data={chartData}>
<CartesianGrid strokeDasharray="3 3" vertical={false}/>
<XAxis dataKey="month"/>
<YAxis tickFormatter={v => `${v/1000}k`}/>
<Tooltip formatter={v => money(Number(v))}/>
<Area type="monotone" dataKey="revenue" name="Faturamento" stroke="#2457d6" fill="#2457d622" strokeWidth={3}/>
<Area type="monotone" dataKey="cost" name="Custos" stroke="#f59e0b" fill="#f59e0b12" strokeWidth={2}/>
</AreaChart>
</ResponsiveContainer>
</div>
</section>
</> }

function Reports({flash}:{flash:(s:string)=>void}) { return <>
<div className="page-head">
<div>
<h2>Relatórios e fechamento</h2>
<p>Documentos gerenciais e informações para a contabilidade.</p>
</div>
</div>
<div className="report-grid">
<Report icon={FileText} tone="blue" title="Balanço mensal" text="Entradas, saídas, perdas, ajustes e posição final do estoque." button="Gerar PDF" onClick={() => flash("Balanço mensal preparado para download.")}/>
<Report icon={Building2} tone="green" title="Fechamento contábil" text="Posição do estoque, custos e resumo pronto para o contador." button="Gerar pacote" onClick={() => flash("Pacote contábil gerado com sucesso.")}/>
<Report icon={BarChart3} tone="orange" title="Faturamento" text="Receitas, pagamentos, pendências e desempenho por período." button="Exportar Excel" onClick={() => flash("Planilha de faturamento exportada.")}/>
</div>
</> }
function Report({icon:Icon,tone,title,text,button,onClick}:any) { return <article className="panel report">
<div className={`report-icon ${tone}`}>
<Icon/>
</div>
<h3>{title}</h3>
<p>{text}</p>
<select>
<option>Setembro de 2026</option>
<option>Agosto de 2026</option>
<option>Exercício 2026</option>
</select>
<Button onClick={onClick}>
<Download/>{button}</Button>
</article> }

function SettingsView({session,company,onCompanyChange,flash}:{session:AuthSession;company:Company;onCompanyChange:(c:Company)=>void;flash:(s:string)=>void}) {
  const [form,setForm] = useState(company);
  const [saving,setSaving] = useState(false);
  const [error,setError] = useState("");
  const [logoPreview,setLogoPreview] = useState<string|null>(null);
  const [diagnostics,setDiagnostics] = useState({online:true,offlineReady:false,storage:"Verificando…",installed:false});
  const [checking,setChecking]=useState(false);
  const [health,setHealth]=useState<Array<{name:string;status:"ok"|"warning"|"error";detail:string}>>([]);
  useEffect(() => setForm(company),[company]);
  useEffect(()=>{getCompanyLogoUrl(session,company.logo_url).then(setLogoPreview)},[session,company.logo_url]);
  useEffect(()=>{
    const check=async()=>{
      const estimate=await navigator.storage?.estimate?.().catch(()=>null);
      const used=estimate?.usage?`${(estimate.usage/1024/1024).toFixed(1)} MB usados`:"Não disponível";
      const ready="serviceWorker" in navigator?!!(await navigator.serviceWorker.getRegistration().catch(()=>null)):false;
      const installed=window.matchMedia("(display-mode: standalone)").matches;
      setDiagnostics({online:navigator.onLine,offlineReady:ready,storage:used,installed});
    };void check();window.addEventListener("online",check);window.addEventListener("offline",check);return()=>{window.removeEventListener("online",check);window.removeEventListener("offline",check)};
  },[]);
  const field = (key:keyof Company,value:string) => setForm(current => ({...current,[key]:value}));
  const save = async () => {
    if (!form.name.trim()) return setError("Informe o nome da empresa.");
    setSaving(true); setError("");
    try { const updated = await updateCompany(session,form); onCompanyChange(updated); flash("Configurações salvas no banco de dados."); }
    catch (err) { setError(err instanceof Error ? err.message : "Não foi possível salvar."); }
    finally { setSaving(false); }
  };
  const changeLogo=async(file?:File)=>{if(!file)return;setSaving(true);setError("");try{const updated=await uploadCompanyLogo(session,company,file);onCompanyChange(updated);setForm(updated);flash("Logomarca atualizada com sucesso.")}catch(err){setError(err instanceof Error?err.message:"Não foi possível enviar a logomarca.")}finally{setSaving(false)}};
  const copyLoginLink=async()=>{if(!company.slug)return;try{await navigator.clipboard.writeText(`${window.location.origin}/?empresa=${encodeURIComponent(company.slug)}`);flash("Link de login copiado.")}catch{setError("Não foi possível copiar. Selecione o link abaixo e copie manualmente.")}};
  const backup=async()=>{setSaving(true);setError("");try{await downloadCompanyBackup(session,company);flash("Backup dos dados baixado com sucesso.")}catch(err){setError(err instanceof Error?err.message:"Não foi possível gerar o backup.")}finally{setSaving(false)}};
  const supportReport=async()=>{
    const [finishes,actions]=await Promise.all([pendingFinishes(),pendingActions()]);
    const report={format:"orbis-support-report",version:1,generated_at:new Date().toISOString(),company:{id:company.id,name:company.name,slug:company.slug||null},application:{version:APP_VERSION,url:window.location.origin,language:navigator.language,online:navigator.onLine,installed:diagnostics.installed,offline_ready:diagnostics.offlineReady,local_storage:diagnostics.storage},synchronization:{pending_finishes:finishes.length,pending_actions:actions.length,errors:[...finishes,...actions].filter(item=>item.error).map(item=>item.error)},checks:health,device:{platform:navigator.platform||"Não informado",user_agent:navigator.userAgent},notice:"Relatório técnico sem senha, chave de acesso ou conteúdo dos cadastros."};
    const url=URL.createObjectURL(new Blob([JSON.stringify(report,null,2)],{type:"application/json"}));
    const link=document.createElement("a");link.href=url;link.download=`diagnostico-orbis-${company.slug||"empresa"}-${new Date().toISOString().slice(0,10)}.json`;link.click();URL.revokeObjectURL(url);flash("Relatório para suporte baixado.");
  };
  const checkInstallation=async()=>{
    setChecking(true);setHealth([]);
    const result:Array<{name:string;status:"ok"|"warning"|"error";detail:string}>=[];
    result.push({name:"Conexão",status:navigator.onLine?"ok":"error",detail:navigator.onLine?"Aparelho conectado à internet.":"Sem acesso à internet neste momento."});
    try{
      const response=await fetch(`${SUPABASE_URL}/rest/v1/profiles?company_id=eq.${encodeURIComponent(company.id)}&select=id&limit=1`,{headers:{apikey:SUPABASE_PUBLISHABLE_KEY,Authorization:`Bearer ${session.access_token}`}});
      result.push({name:"Banco de dados",status:response.ok?"ok":"error",detail:response.ok?"Leitura autenticada e permissões funcionando.":`Falha na leitura (${response.status}).`});
    }catch{result.push({name:"Banco de dados",status:"error",detail:"Não foi possível alcançar o banco de dados."})}
    try{
      const response=await fetch(`${SUPABASE_URL}/rest/v1/rpc/get_orbis_system_status`,{method:"POST",headers:{apikey:SUPABASE_PUBLISHABLE_KEY,Authorization:`Bearer ${session.access_token}`,"Content-Type":"application/json"},body:"{}"});
      if(response.ok){const status=await response.json();const complete=status.tables_ok&&status.functions_ok&&status.storage_ok;result.push({name:"Versão do banco",status:complete?"ok":"error",detail:complete?`Banco atualizado na versão ${status.database_version}.`:`Versão ${status.database_version}, mas existem componentes ausentes.`})}
      else result.push({name:"Versão do banco",status:"warning",detail:"Execute a SQL 018 para atualizar e verificar o banco."});
    }catch{result.push({name:"Versão do banco",status:"warning",detail:"Não foi possível conferir a versão agora."})}
    const registration="serviceWorker" in navigator?await navigator.serviceWorker.getRegistration().catch(()=>null):null;
    result.push({name:"Modo offline",status:registration?"ok":"warning",detail:registration?"Aplicativo preparado para guardar as telas essenciais.":"Abra novamente o sistema conectado para preparar o modo offline."});
    const [finishes,actions]=await Promise.all([pendingFinishes(),pendingActions()]);
    const syncErrors=[...finishes,...actions].filter(item=>item.error).length;
    result.push({name:"Sincronização",status:syncErrors?"error":finishes.length+actions.length?"warning":"ok",detail:syncErrors?`${syncErrors} item(ns) precisam de atenção.`:finishes.length+actions.length?`${finishes.length+actions.length} item(ns) aguardando envio.`:"Nenhuma alteração aguardando envio."});
    if(company.logo_url){
      try{const logo=await getCompanyLogoUrl(session,company.logo_url);result.push({name:"Armazenamento",status:logo?"ok":"error",detail:logo?"Arquivo da logomarca acessível.":"Não foi possível acessar a logomarca."})}
      catch{result.push({name:"Armazenamento",status:"error",detail:"Falha ao acessar os arquivos da empresa."})}
    }else result.push({name:"Armazenamento",status:"warning",detail:"Envie uma logomarca para concluir este teste."});
    setHealth(result);setChecking(false);
  };
  return <>
<div className="page-head">
<div>
<h2>Configurações da empresa</h2>
<p>Identidade salva no banco e exibida em toda a instalação.</p>
</div>
</div>
<section className="panel settings-card">
<div className="settings-logo">
{logoPreview?<img src={logoPreview} alt={`Logo ${form.name}`}/>:<Wrench/>}
<div>
<strong>{form.name}</strong>
<small>JPG, PNG, WEBP ou SVG, com até 2 MB.</small>
</div>
<label className="logo-upload">Alterar logomarca<input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" onChange={e=>changeLogo(e.target.files?.[0])} disabled={saving}/></label>
</div>{error && <div className="auth-message error-message">{error}</div>}<div className="form-grid">
<label>Nome da empresa<Input value={form.name} onChange={e=>field("name",e.target.value)}/>
</label>
<label>CNPJ ou CPF<Input value={form.document || ""} onChange={e=>field("document",e.target.value)} placeholder="00.000.000/0001-00"/>
</label>
<label>Telefone<Input value={form.phone || ""} onChange={e=>field("phone",e.target.value)} placeholder="(00) 00000-0000"/>
</label>
<label>E-mail<Input type="email" value={form.email || ""} onChange={e=>field("email",e.target.value)}/>
</label>
<label className="span-2">Endereço<Input value={form.address || ""} onChange={e=>field("address",e.target.value)} placeholder="Rua, número, bairro, cidade e estado"/>
</label>
</div>
{company.slug&&<div className="company-link"><div><strong>Link de entrada da empresa</strong><p>Compartilhe este endereço com os funcionários para exibir a logomarca no login.</p><Input readOnly value={typeof window!=="undefined"?`${window.location.origin}/?empresa=${encodeURIComponent(company.slug)}`:""}/></div><Button variant="outline" onClick={copyLoginLink}><Copy/>Copiar link</Button></div>}
<div className="company-link"><div><strong>Backup dos dados</strong><p>Baixa cadastros, estoque, histórico, OS e registros de auditoria. Senhas e fotos não são incluídas.</p></div><Button variant="outline" onClick={backup} disabled={saving}><Archive/>Baixar backup</Button></div>
<div className="company-link"><div><strong>Relatório para suporte</strong><p>Gera um diagnóstico do aparelho e da sincronização sem incluir senhas nem dados dos clientes.</p></div><Button variant="outline" onClick={supportReport}><FileText/>Baixar diagnóstico</Button></div>
<div className="system-diagnostics"><div><strong>Diagnóstico deste aparelho</strong><p>Verifique a preparação para trabalhar fora da empresa.</p></div><div className="diagnostic-grid"><span><small>Conexão</small><strong>{diagnostics.online?"Online":"Sem internet"}</strong></span><span><small>Modo offline</small><strong>{diagnostics.offlineReady?"Preparado":"Ainda não preparado"}</strong></span><span><small>Armazenamento local</small><strong>{diagnostics.storage}</strong></span><span><small>Aplicativo instalado</small><strong>{diagnostics.installed?"Sim":"Não"}</strong></span></div><p className="install-note">Para instalar: abra o menu do navegador e escolha <strong>Instalar aplicativo</strong> ou <strong>Adicionar à tela inicial</strong>. Antes de sair sem internet, entre no sistema e abra Ordens de serviço.</p></div>
<div className="installation-check"><div className="check-head"><div><strong>Verificação da instalação</strong><p>Teste os serviços principais antes de entregar ou após uma atualização.</p></div><Button variant="outline" onClick={checkInstallation} disabled={checking}><ShieldCheck/>{checking?"Verificando…":"Executar verificação"}</Button></div>{health.length>0&&<div className="health-list">{health.map(item=><div key={item.name} className={`health-item ${item.status}`}><span>{item.status==="ok"?<CheckCircle2/>:<AlertTriangle/>}</span><div><strong>{item.name}</strong><p>{item.detail}</p></div></div>)}</div>}</div>
<p className="version-line">Orbis Gestão {APP_VERSION} · Banco de dados versão 15</p>
<div className="save-row">
<Button onClick={save} disabled={saving}>{saving ? "Salvando…" : "Salvar alterações"}</Button>
</div>
</section>
</>;
}

function MovementModal({open,role,close,save}:any) { return <Dialog open={open} onOpenChange={v => !v && close()}>
<DialogContent className="modal">
<DialogHeader>
<DialogTitle>Registrar {role === "admin" ? "movimentação" : "saída"}</DialogTitle>
<DialogDescription>O histórico será vinculado ao usuário e não poderá ser apagado.</DialogDescription>
</DialogHeader>
<div className="modal-form">
<label>Tipo<select disabled={role === "employee"}>
<option>{role === "employee" ? "Saída" : "Entrada"}</option>
<option>Saída</option>
<option>Devolução</option>
<option>Ajuste</option>
</select>
</label>
<label>Produto<select>
<option>Disjuntor bipolar 40A — 8 un.</option>
<option>Cabo flexível 2,5 mm — 184 un.</option>
</select>
</label>
<div className="form-grid">
<label>Quantidade<Input type="number" defaultValue="1"/>
</label>
<label>Ordem de serviço<select>
<option>Sem vínculo</option>
<option>OS-1048</option>
</select>
</label>
</div>
<label>Motivo<textarea placeholder="Descreva o motivo"/>
</label>
<Button onClick={save}>Confirmar movimentação</Button>
</div>
</DialogContent>
</Dialog> }
function OrderModal({open,close,save}:any) { return <Dialog open={open} onOpenChange={v => !v && close()}>
<DialogContent className="modal wide">
<DialogHeader>
<DialogTitle>Nova ordem de serviço</DialogTitle>
<DialogDescription>Cadastre o atendimento e disponibilize para a equipe.</DialogDescription>
</DialogHeader>
<div className="modal-form">
<div className="form-grid">
<label>Cliente<select>
<option>Clínica Horizonte</option>
<option>Padaria Santa Rita</option>
</select>
</label>
<label>Prioridade<select>
<option>Normal</option>
<option>Alta</option>
<option>Baixa</option>
</select>
</label>
<label>Data<Input type="date"/>
</label>
<label>Horário<Input type="time"/>
</label>
</div>
<label>Serviço solicitado<Input placeholder="Ex.: Manutenção do quadro elétrico"/>
</label>
<label>Descrição<textarea placeholder="Problema e orientações"/>
</label>
<div className="form-grid">
<label>Valor estimado<Input placeholder="R$ 0,00"/>
</label>
<label>Funcionário<select>
<option>Disponível para aceite</option>
<option>Rafael Costa</option>
</select>
</label>
</div>
<Button onClick={save}>Criar ordem de serviço</Button>
</div>
</DialogContent>
</Dialog> }
function FinishModal({open,close,save}:any) { return <Dialog open={open} onOpenChange={v => !v && close()}>
<DialogContent className="modal">
<DialogHeader>
<DialogTitle>Finalizar OS-1048</DialogTitle>
<DialogDescription>Os materiais informados serão baixados automaticamente.</DialogDescription>
</DialogHeader>
<div className="modal-form">
<label>Serviço executado<textarea placeholder="Descreva o que foi realizado"/>
</label>
<label>Materiais utilizados<Input placeholder="Buscar e adicionar produto"/>
</label>
<div className="upload">
<strong>OS assinada pelo cliente</strong>
<span>Tire a foto agora ou escolha um arquivo salvo.</span>
<div className="upload-actions">
<label htmlFor="camera-os" className="camera-button">
<Camera/>Abrir câmera</label>
<label htmlFor="arquivo-os" className="file-button">
<ArrowUpFromLine/>Escolher arquivo</label>
</div>
<input id="camera-os" className="file-input" type="file" accept="image/*" capture="environment"/>
<input id="arquivo-os" className="file-input" type="file" accept="image/jpeg,image/png,image/webp,application/pdf"/>
</div>
<label className="check">
<input type="checkbox"/>Confirmo que o serviço foi concluído e os materiais informados foram utilizados.</label>
<Button onClick={save}>Finalizar ordem de serviço</Button>
</div>
</DialogContent>
</Dialog> }
