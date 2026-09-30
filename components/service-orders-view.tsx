"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { Camera, ChevronRight, Download, ExternalLink, ImageUp, Package, Pencil, Plus, Search, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  AuthSession,
  Company,
  UserProfile,
  getCompanyLogoUrl,
  getEmployees,
} from "@/lib/supabase-auth";
import { BusinessContact, getBusinessContacts } from "@/lib/business-contacts";
import {
  ServiceOrder,
  createServiceOrder,
  completeServiceOrder,
  deleteServiceOrder,
  getServiceOrderPhotoUrl,
  getServiceOrderMaterials,
  getServiceOrders,
  serviceOrderAction,
  updateServiceOrder,
  type ServiceOrderMaterial,
} from "@/lib/service-orders";
import { downloadCsv } from "@/lib/csv";
import { getProducts, type Product } from "@/lib/inventory";
import { cacheEmployeeOrders, cacheProducts, flagPendingAction, flagPendingFinish, pendingActions, pendingFinishes, queueAction, queueFinish, readEmployeeOrders, readProducts, removePendingAction, removePendingFinish, type PendingAction, type PendingFinish } from "@/lib/offline-orders";
import type { ServiceOrderMaterialInput } from "@/lib/service-orders";
const blank = {
  customer_id: "",
  assigned_to: "",
  title: "",
  description: "",
  service_address: "",
  scheduled_at: "",
  priority: "normal" as ServiceOrder["priority"],
  value: "0",
  notes: "",
};
const statusName: Record<ServiceOrder["status"], string> = {
  waiting: "Aguardando funcionário",
  accepted: "Aceita",
  in_progress: "Em andamento",
  completed: "Finalizada",
  cancelled: "Cancelada",
};
const priorityName = {
  low: "Baixa",
  normal: "Normal",
  high: "Alta",
  urgent: "Urgente",
};
const money = (v: number) =>
  Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const escapeHtml=(value:unknown)=>String(value??"").replace(/[&<>"']/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[char]||char);
export function ServiceOrdersView({
  role,
  session,
  company,
  profile,
  flash,
  onCountChange,
}: {
  role: "admin" | "employee";
  session: AuthSession;
  company: Company;
  profile: UserProfile;
  flash: (s: string) => void;
  onCountChange?: (count: number) => void;
}) {
  const [orders, setOrders] = useState<ServiceOrder[]>([]),
    [customers, setCustomers] = useState<BusinessContact[]>([]),
    [employees, setEmployees] = useState<UserProfile[]>([]),
    [products, setProducts] = useState<Product[]>([]),
    [query, setQuery] = useState(""),
    [filter, setFilter] = useState("all"),
    [loading, setLoading] = useState(true),
    [saving, setSaving] = useState(false),
    [error, setError] = useState(""),
    [open, setOpen] = useState(false),
    [editing, setEditing] = useState<ServiceOrder | null>(null),
    [details, setDetails] = useState<ServiceOrder | null>(null),
    [detailMaterials, setDetailMaterials] = useState<ServiceOrderMaterial[]>([]),
    [loadingMaterials, setLoadingMaterials] = useState(false),
    [deleting, setDeleting] = useState<ServiceOrder | null>(null),
    [finishing, setFinishing] = useState<ServiceOrder | null>(null),
    [finishPhoto, setFinishPhoto] = useState<File | null>(null),
    [finishMaterials, setFinishMaterials] = useState<ServiceOrderMaterialInput[]>([]),
    [materialProduct, setMaterialProduct] = useState(""),
    [materialQuantity, setMaterialQuantity] = useState("1"),
    [offline, setOffline] = useState(false),
    [cachedAt, setCachedAt] = useState(""),
    [pending, setPending] = useState<PendingFinish[]>([]),
    [actions, setActions] = useState<PendingAction[]>([]),
    [syncing, setSyncing] = useState(false),
    [form, setForm] = useState(blank);
  const syncLock = useRef(false);
  const refreshPending = async () => {
    if (role === "employee") {
      const [photos, queued] = await Promise.all([pendingFinishes(profile.id, company.id), pendingActions(profile.id, company.id)]);
      setPending(photos); setActions(queued);
    }
  };
  const load = async () => {
    setLoading(true);
    setError("");
    try {
      if (role === "employee" && !navigator.onLine) throw new Error("sem rede");
      const [o, c, e, p] = await Promise.all([
        getServiceOrders(session, company.id),
        getBusinessContacts(session, company.id, "customer"),
        getEmployees(session, company.id),
        getProducts(session, company.id),
      ]);
      setOrders(role === "employee" ? o.filter(order => order.assigned_to === profile.id || order.status === "waiting" && !order.assigned_to) : o);
      setOffline(false);
      if (role === "employee") {
        try { await cacheEmployeeOrders(profile.id, company.id, o); setCachedAt(new Date().toISOString()); }
        catch { setError("O aparelho não permitiu guardar OS para uso offline. Verifique o espaço disponível."); }
      }
      onCountChange?.(o.filter(order=>order.status!=="completed"&&order.status!=="cancelled").length);
      setCustomers(c);
      setEmployees(e.filter((x) => x.active));
      setProducts(p);
      if (role === "employee") void cacheProducts(profile.id, company.id, p).catch(() => null);
    } catch (err) {
      if (role === "employee") {
        try {
          const cached = await readEmployeeOrders(profile.id, company.id);
          setOrders(cached?.orders || []);
          setProducts((await readProducts(profile.id, company.id))?.products || []);
          setCachedAt(cached?.savedAt || "");
          setOffline(true);
          if (!cached) setError("Nenhuma OS foi preparada neste aparelho. Conecte-se e abra esta tela antes de sair.");
        } catch { setError("Não foi possível acessar as OS guardadas neste aparelho."); }
      } else setError(err instanceof Error ? err.message : "Erro ao carregar ordens de serviço.");
    } finally {
      void refreshPending().catch(() => null);
      setLoading(false);
    }
  };
  useEffect(() => {
    load();
  }, [company.id]);
  useEffect(()=>{
    if(!details||details.status!=="completed"||offline){setDetailMaterials([]);return}
    setLoadingMaterials(true);
    getServiceOrderMaterials(session,details.id).then(setDetailMaterials).catch(err=>setError(err instanceof Error?err.message:"Não foi possível carregar os materiais da OS.")).finally(()=>setLoadingMaterials(false));
  },[details?.id,details?.status,offline]);
  useEffect(() => {
    const reconnect = () => { void syncPending(); };
    window.addEventListener("online", reconnect);
    if (navigator.onLine) void syncPending();
    return () => window.removeEventListener("online", reconnect);
  }, [company.id, profile.id, session.access_token]);
  const syncPending = async () => {
    if (role !== "employee" || !navigator.onLine || syncLock.current) return;
    syncLock.current = true;
    setSyncing(true);
    try {
      const [pending, actions] = await Promise.all([pendingFinishes(profile.id, company.id), pendingActions(profile.id, company.id)]);
      if (pending.length || actions.length) {
        let current = await getServiceOrders(session, company.id);
        for (const item of actions) {
          const order = current.find(row => row.id === item.orderId);
          if (!order || order.assigned_to !== profile.id) {
            await flagPendingAction(item, "OS alterada no servidor. Confira com o administrador.");
            continue;
          }
          if (item.action === "accept" && order.status === "accepted" || item.action === "start" && order.status === "in_progress") {
            await removePendingAction(item);
            continue;
          }
          try {
            if (order.status !== (item.action === "accept" ? "waiting" : "accepted")) throw new Error("O status da OS mudou. Confira com o administrador.");
            await serviceOrderAction(session, item.orderId, item.action);
            await removePendingAction(item);
            current = await getServiceOrders(session, company.id);
          } catch (err) { await flagPendingAction(item, err instanceof Error ? err.message : "Não foi possível enviar a ação."); }
        }
        current = await getServiceOrders(session, company.id);
        for (const item of pending) {
          const order = current.find(row => row.id === item.orderId);
          if (!order || order.assigned_to !== profile.id || order.status !== "in_progress") {
            await flagPendingFinish(item, "OS alterada no servidor. Peça ao administrador para conferir antes de reenviar.");
            continue;
          }
          try { await completeServiceOrder(session, order, company.id, item.photo, item.materials || []); await removePendingFinish(item); }
          catch (err) { await flagPendingFinish(item, err instanceof Error ? err.message : "Falha ao enviar. Tente novamente."); }
        }
        await refreshPending();
        await load();
      } else if (offline) await load();
    } catch (err) { setError(err instanceof Error ? err.message : "Não foi possível sincronizar agora."); }
    finally { syncLock.current = false; setSyncing(false); }
  };
  const filtered = useMemo(
    () =>
      orders.filter(
        (o) =>
          (filter === "all" || o.status === filter) &&
          `${o.order_number} ${o.title} ${o.customer?.name || ""}`
            .toLowerCase()
            .includes(query.toLowerCase()),
      ),
    [orders, query, filter],
  );
  const openNew = () => {
    setEditing(null);
    setForm(blank);
    setOpen(true);
    setError("");
  };
  const openEdit = (o: ServiceOrder) => {
    setEditing(o);
    setForm({
      customer_id: o.customer_id,
      assigned_to: o.assigned_to || "",
      title: o.title,
      description: o.description || "",
      service_address: o.service_address || "",
      scheduled_at: o.scheduled_at
        ? new Date(o.scheduled_at).toISOString().slice(0, 16)
        : "",
      priority: o.priority,
      value: String(o.value),
      notes: o.notes || "",
    });
    setOpen(true);
    setError("");
  };
  const save = async () => {
    if (!form.customer_id || !form.title.trim())
      return setError("Selecione o cliente e informe o serviço.");
    setSaving(true);
    setError("");
    try {
      const data = {
        company_id: company.id,
        customer_id: form.customer_id,
        assigned_to: form.assigned_to || null,
        title: form.title.trim(),
        description: form.description || null,
        service_address: form.service_address || null,
        scheduled_at: form.scheduled_at
          ? new Date(form.scheduled_at).toISOString()
          : null,
        priority: form.priority,
        status: editing?.status || ("waiting" as ServiceOrder["status"]),
        value: Number(form.value) || 0,
        notes: form.notes || null,
        created_by: editing?.created_by || session.user.id,
      };
      editing
        ? await updateServiceOrder(session, editing.id, data)
        : await createServiceOrder(session, data);
      setOpen(false);
      await load();
      flash(`Ordem de serviço ${editing ? "atualizada" : "criada"}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao salvar OS.");
    } finally {
      setSaving(false);
    }
  };
  const act = async (o: ServiceOrder, action: "accept" | "start") => {
    setSaving(true);
    setError("");
    try {
      if (role === "employee" && (offline || !navigator.onLine)) {
        await queueAction(profile.id, company.id, o, action);
        const updated:ServiceOrder[] = orders.map(row => row.id === o.id ? {...row,status:action === "accept" ? "accepted" : "in_progress"} : row);
        setOrders(updated);
        await cacheEmployeeOrders(profile.id, company.id, updated);
        await refreshPending();
        flash(action === "accept" ? "Aceite guardado no aparelho para sincronizar." : "Início guardado no aparelho para sincronizar.");
        return;
      }
      await serviceOrderAction(session, o.id, action);
      await load();
      flash(
        action === "accept"
          ? "Ordem aceita e vinculada a você."
          : "Atendimento iniciado.",
      );
    } catch (err) {
      if (role === "employee" && (err instanceof TypeError || !navigator.onLine)) {
        try {
          await queueAction(profile.id, company.id, o, action);
          const updated:ServiceOrder[] = orders.map(row => row.id === o.id ? {...row,status:action === "accept" ? "accepted" : "in_progress"} : row);
          setOrders(updated); await cacheEmployeeOrders(profile.id, company.id, updated); await refreshPending();
          flash("Conexão perdida. A ação foi guardada para sincronizar.");
        } catch (storageError) { setError(storageError instanceof Error ? storageError.message : "Não foi possível guardar a ação."); }
      } else setError(err instanceof Error ? err.message : "Não foi possível atualizar a OS.");
    } finally {
      setSaving(false);
    }
  };
  const remove = async () => {
    if (!deleting) return;
    setSaving(true);
    setError("");
    try {
      await deleteServiceOrder(session, deleting.id);
      setDeleting(null);
      setDetails(null);
      await load();
      flash("Ordem de serviço excluída.");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Não foi possível excluir a OS.",
      );
    } finally {
      setSaving(false);
    }
  };
  const finish = async () => {
    if (!finishing || !finishPhoto) {
      setError("Tire ou selecione a foto da OS assinada pelo cliente.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      if (role === "employee" && (offline || !navigator.onLine)) {
        await queueFinish(profile.id, company.id, finishing, finishPhoto, finishMaterials);
        await refreshPending();
        setFinishing(null);
        setFinishPhoto(null);
        setFinishMaterials([]);
        flash("Foto guardada neste aparelho. A OS será finalizada quando sincronizar.");
        return;
      }
      await completeServiceOrder(session, finishing, company.id, finishPhoto, finishMaterials);
      setFinishing(null);
      setFinishPhoto(null);
      setFinishMaterials([]);
      await load();
      flash("Ordem de serviço finalizada com comprovante.");
    } catch (err) {
      if (role === "employee" && finishing && finishPhoto && (err instanceof TypeError || !navigator.onLine)) {
        try {
          await queueFinish(profile.id, company.id, finishing, finishPhoto, finishMaterials);
          await refreshPending();
          setFinishing(null); setFinishPhoto(null); setFinishMaterials([]);
          flash("Conexão perdida. Foto guardada neste aparelho para sincronizar.");
        } catch (storageError) { setError(storageError instanceof Error ? storageError.message : "Não foi possível guardar a foto no aparelho."); }
      } else setError(err instanceof Error ? err.message : "Não foi possível finalizar a OS.");
    } finally {
      setSaving(false);
    }
  };
  const addMaterial = () => {
    const quantity = Number(materialQuantity.replace(",", "."));
    const product = products.find(item => item.id === materialProduct);
    if (!product) return setError("Selecione um produto.");
    if (!Number.isFinite(quantity) || quantity <= 0) return setError("Informe uma quantidade válida.");
    if (quantity > Number(product.quantity)) return setError(`Estoque disponível: ${Number(product.quantity)} ${product.unit}.`);
    setFinishMaterials(current => {
      const existing = current.find(item => item.product_id === product.id);
      return existing ? current.map(item => item.product_id === product.id ? {...item,quantity} : item) : [...current,{product_id:product.id,quantity}];
    });
    setMaterialProduct(""); setMaterialQuantity("1"); setError("");
  };
  const chooseProof = (file: File | undefined) => {
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"].includes(file.type)) {
      setError("Escolha uma foto JPG, PNG, WEBP ou HEIC da OS assinada.");
      setFinishPhoto(null);
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setError("A foto deve ter no máximo 10 MB.");
      setFinishPhoto(null);
      return;
    }
    setError("");
    setFinishPhoto(file);
  };
  const openProof = async (order: ServiceOrder) => {
    if (!order.completion_photo_path) return;
    try {
      const url = await getServiceOrderPhotoUrl(session, order.completion_photo_path);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível abrir o comprovante.");
    }
  };
  const printOrder = async (order:ServiceOrder) => {
    const page=window.open("","_blank");
    if(!page){setError("Permita a abertura de janelas para imprimir a OS.");return}
    page.document.write("<!doctype html><html lang='pt-BR'><meta charset='utf-8'><title>Preparando OS…</title><body style='font:16px Arial;padding:30px'>Preparando ordem de serviço…</body></html>");
    page.document.close();
    try{
      const [logo,proof,materials]=await Promise.all([getCompanyLogoUrl(session,company.logo_url),order.completion_photo_path?getServiceOrderPhotoUrl(session,order.completion_photo_path):Promise.resolve(null),order.status==="completed"?getServiceOrderMaterials(session,order.id):Promise.resolve([])]);
      const row=(label:string,value:unknown)=>`<div class="field"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value||"—")}</strong></div>`;
      const date=(value:string|null)=>value?new Date(value).toLocaleString("pt-BR"):"—";
      const materialRows=materials.map(item=>`<tr><td>${escapeHtml(item.product?.sku||"")}</td><td>${escapeHtml(item.product?.name||"Produto")}</td><td>${escapeHtml(item.quantity)} ${escapeHtml(item.product?.unit||"UN")}</td>${role==="admin"?`<td>${escapeHtml(money(Number(item.unit_cost)))}</td>`:""}</tr>`).join("");
      const html=`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>OS-${escapeHtml(String(order.order_number).padStart(5,"0"))}</title><style>body{font:14px Arial,sans-serif;color:#18263c;max-width:850px;margin:30px auto;padding:0 22px}header{display:flex;align-items:center;gap:20px;border-bottom:2px solid #2457d6;padding-bottom:20px}header img{max-width:110px;max-height:70px;object-fit:contain}h1{font-size:22px;margin:0 0 5px}h2{font-size:16px;margin:26px 0 10px;color:#2457d6}.muted{color:#64748b}.grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}.field{padding:10px;border:1px solid #e3e8ef;border-radius:7px;min-width:0}.field span,.field strong{display:block}.field span{font-size:11px;color:#64748b;margin-bottom:5px}.field strong{white-space:pre-wrap;overflow-wrap:anywhere}.full{grid-column:1/-1}table{width:100%;border-collapse:collapse}th,td{padding:8px;border-bottom:1px solid #ddd;text-align:left}.proof{max-width:100%;max-height:750px;object-fit:contain;border:1px solid #ddd}.actions{margin-bottom:18px}.actions button{border:0;background:#2457d6;color:white;padding:10px 18px;border-radius:7px;cursor:pointer}.foot{margin-top:30px;font-size:11px;color:#64748b}@media print{body{margin:0;max-width:none}.actions{display:none}.proof-section{break-before:page}}@media(max-width:600px){.grid{grid-template-columns:1fr}.full{grid-column:auto}}</style></head><body><div class="actions"><button onclick="window.print()">Imprimir ou salvar em PDF</button></div><header>${logo?`<img src="${escapeHtml(logo)}" alt="Logomarca">`:""}<div><h1>${escapeHtml(company.name)}</h1><div class="muted">${escapeHtml(company.document||"")} ${escapeHtml(company.phone||"")}</div><div class="muted">${escapeHtml(company.email||"")}</div></div></header><h2>Ordem de serviço OS-${escapeHtml(String(order.order_number).padStart(5,"0"))}</h2><div class="grid">${row("Cliente",order.customer?.name)}${row("Telefone do cliente",order.customer?.phone)}${row("Serviço",order.title)}${row("Situação",statusName[order.status])}${row("Responsável",order.employee?.full_name)}${row("Agendamento",date(order.scheduled_at))}${row("Abertura",date(order.created_at))}${row("Conclusão",date(order.completed_at))}${role==="admin"?row("Valor do serviço",money(order.value)):""}<div class="full">${row("Endereço do serviço",order.service_address)}</div><div class="full">${row("Descrição",order.description)}</div><div class="full">${row("Observações",order.notes)}</div></div><h2>Materiais utilizados</h2>${materialRows?`<table><thead><tr><th>SKU</th><th>Produto</th><th>Quantidade</th>${role==="admin"?"<th>Custo unitário</th>":""}</tr></thead><tbody>${materialRows}</tbody></table>`:"<p class='muted'>Nenhum material registrado.</p>"}${proof?`<section class="proof-section"><h2>Comprovante assinado</h2><img class="proof" src="${escapeHtml(proof)}" alt="Foto da OS assinada"></section>`:""}<p class="foot">Documento gerado em ${escapeHtml(new Date().toLocaleString("pt-BR"))} a partir dos dados registrados no sistema.</p></body></html>`;
      page.document.open();page.document.write(html);page.document.close();
    }catch(err){page.close();setError(err instanceof Error?err.message:"Não foi possível preparar a impressão.")}
  };
  const selectCustomer = (id: string) => {
    const c = customers.find((x) => x.id === id);
    setForm((f) => ({
      ...f,
      customer_id: id,
      service_address:
        f.service_address ||
        [c?.address, c?.address_number, c?.neighborhood, c?.city, c?.state]
          .filter(Boolean)
          .join(", "),
    }));
  };
  const exportOrders=()=>downloadCsv(`ordens-de-servico-${new Date().toISOString().slice(0,10)}.csv`,[["Ordem","Cliente","Serviço","Status","Prioridade","Responsável","Agendamento",...(role==="admin"?["Valor"]:[])],...filtered.map(o=>[`OS-${String(o.order_number).padStart(5,"0")}`,o.customer?.name||"",o.title,statusName[o.status],priorityName[o.priority],o.employee?.full_name||"",o.scheduled_at?new Date(o.scheduled_at).toLocaleString("pt-BR"):"",...(role==="admin"?[Number(o.value).toFixed(2)]:[])])]);
  return (
    <>
      <div className="page-head">
        <div>
          <h2>Ordens de serviço</h2>
          <p>Chamados reais ligados a clientes e responsáveis.</p>
        </div>
        {role === "admin" && (
          <Button onClick={openNew}>
            <Plus />
            Nova ordem
          </Button>
        )}
      </div>
      {error && <div className="auth-message error-message">{error}</div>}
      {role === "employee" && !offline && !pending.length && !actions.length && cachedAt && <p className="offline-hint">Suas OS atribuídas foram guardadas neste aparelho para consulta sem internet.</p>}
      {role === "employee" && (offline || pending.length > 0 || actions.length > 0) && <div className="auth-message offline-message">
        <strong>{offline ? "Modo offline" : "Sincronização pendente"}</strong>
        {offline && <span> OS atribuídas guardadas neste aparelho{cachedAt ? ` em ${new Date(cachedAt).toLocaleString("pt-BR")}` : ""}. As alterações serão confirmadas quando voltar a conexão.</span>}
        {actions.length > 0 && <span> {actions.length} alteração(ões) de status aguardando envio.</span>}
        {pending.length > 0 && <span> {pending.length} foto{pending.length > 1 ? "s" : ""} aguardando envio.</span>}
        {(pending.length > 0 || actions.length > 0) && <span>Não saia da conta nem limpe os dados do navegador antes de sincronizar.</span>}
        {actions.filter(item => item.error).map(item => <span key={item.key} className="offline-error">OS pendente: {item.error}</span>)}
        {pending.filter(item => item.error).map(item => <span key={item.key} className="offline-error">OS pendente: {item.error}</span>)}
        {(pending.length > 0 || actions.length > 0) && navigator.onLine && <Button variant="outline" size="sm" onClick={() => void syncPending()} disabled={syncing}>{syncing ? "Sincronizando…" : "Sincronizar agora"}</Button>}
      </div>}
      <div className="tabs">
        <button
          className={filter === "all" ? "active" : ""}
          onClick={() => setFilter("all")}
        >
          Todas <span>{orders.length}</span>
        </button>
        {(["waiting", "accepted", "in_progress", "completed"] as const).map(
          (s) => (
            <button
              key={s}
              className={filter === s ? "active" : ""}
              onClick={() => setFilter(s)}
            >
              {statusName[s]}{" "}
              <span>{orders.filter((o) => o.status === s).length}</span>
            </button>
          ),
        )}
      </div>
      <section className="panel table-panel">
        <div className="table-tools">
          <div className="search">
            <Search />
            <Input
              placeholder="Buscar número, cliente ou serviço"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <Button variant="outline" onClick={exportOrders} disabled={!filtered.length}>
            <Download />
            Exportar
          </Button>
        </div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Ordem</th>
                <th>Cliente / serviço</th>
                <th>Status</th>
                <th>Responsável</th>
                <th>Agenda</th>
                {role === "admin" && <th>Valor</th>}
                <th>Ação</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7}>Carregando ordens…</td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={7}>Nenhuma ordem encontrada.</td>
                </tr>
              ) : (
                filtered.map((o) => (
                  <tr
                    key={o.id}
                    className="clickable-row"
                    onClick={() => setDetails(o)}
                  >
                    <td>
                      <strong className="order-id">
                        OS-{String(o.order_number).padStart(5, "0")}
                      </strong>
                      <small
                        className={`priority ${priorityName[o.priority].toLowerCase()}`}
                      >
                        {priorityName[o.priority]}
                      </small>
                    </td>
                    <td>
                      <div className="two-lines">
                        <strong>{o.customer?.name || "Cliente"}</strong>
                        <span>{o.title}</span>
                      </div>
                    </td>
                    <td>
                      <span
                        className={`status ${o.status === "completed" ? "success" : o.status === "in_progress" ? "info" : o.status === "cancelled" ? "danger-bg" : "warning"}`}
                      >
                        {statusName[o.status]}
                      </span>
                    </td>
                    <td>{o.employee?.full_name || "Não atribuído"}</td>
                    <td>
                      {o.scheduled_at
                        ? new Date(o.scheduled_at).toLocaleString("pt-BR")
                        : "Sem agendamento"}
                    </td>
                    {role === "admin" && (
                      <td>
                        <strong>{money(o.value)}</strong>
                      </td>
                    )}
                    <td onClick={(e) => e.stopPropagation()}>
                      <div className="row-actions">
                        {role === "admin" ? (
                          <>
                            <Button
                              variant="outline"
                              size="icon"
                              aria-label="Editar ordem"
                              onClick={() => openEdit(o)}
                            >
                              <Pencil />
                            </Button>
                            <Button
                              variant="outline"
                              size="icon"
                              aria-label="Excluir ordem"
                              onClick={() => setDeleting(o)}
                            >
                              <Trash2 />
                            </Button>
                          </>
                        ) : pending.some(item => item.orderId === o.id) ? (
                          <span className="status warning">Pendente de envio</span>
                        ) : o.status === "waiting" &&
                          (!o.assigned_to || o.assigned_to === profile.id) ? (
                          <Button
                            size="sm"
                            onClick={() => act(o, "accept")}
                            disabled={saving}
                          >
                            Aceitar
                          </Button>
                        ) : o.status === "accepted" &&
                          o.assigned_to === profile.id ? (
                          <Button
                            size="sm"
                            onClick={() => act(o, "start")}
                            disabled={saving}
                          >
                            Iniciar
                          </Button>
                        ) : o.status === "in_progress" &&
                          o.assigned_to === profile.id ? (
                          <Button
                            size="sm"
                            onClick={() => {
                              setFinishing(o);
                              setFinishPhoto(null);
                              setFinishMaterials([]);
                              setMaterialProduct("");
                              setMaterialQuantity("1");
                              setError("");
                            }}
                            disabled={saving}
                          >
                            Finalizar
                          </Button>
                        ) : (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setDetails(o)}
                          >
                            Abrir
                            <ChevronRight />
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="modal wide">
          <DialogHeader>
            <DialogTitle>
              {editing ? "Editar ordem de serviço" : "Nova ordem de serviço"}
            </DialogTitle>
            <DialogDescription>
              Vincule o atendimento a um cliente e, se desejar, a um
              funcionário.
            </DialogDescription>
          </DialogHeader>
          {error && <div className="auth-message error-message">{error}</div>}
          <div className="modal-form">
            <div className="form-grid">
              <label>
                Cliente
                <select
                  value={form.customer_id}
                  onChange={(e) => selectCustomer(e.target.value)}
                >
                  <option value="">Selecione</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Responsável
                <select
                  value={form.assigned_to}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, assigned_to: e.target.value }))
                  }
                >
                  <option value="">Qualquer funcionário</option>
                  {employees
                    .filter((e) => e.role !== "platform_admin")
                    .map((e) => (
                      <option key={e.id} value={e.id}>
                        {e.full_name}
                      </option>
                    ))}
                </select>
              </label>
              <Field
                label="Serviço"
                value={form.title}
                set={(v) => setForm((f) => ({ ...f, title: v }))}
              />
              <label>
                Prioridade
                <select
                  value={form.priority}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      priority: e.target.value as ServiceOrder["priority"],
                    }))
                  }
                >
                  <option value="low">Baixa</option>
                  <option value="normal">Normal</option>
                  <option value="high">Alta</option>
                  <option value="urgent">Urgente</option>
                </select>
              </label>
              <Field
                label="Data e horário"
                type="datetime-local"
                value={form.scheduled_at}
                set={(v) => setForm((f) => ({ ...f, scheduled_at: v }))}
              />
              <Field
                label="Valor"
                type="number"
                value={form.value}
                set={(v) => setForm((f) => ({ ...f, value: v }))}
              />
              <label className="span-2">
                Endereço do serviço
                <Input
                  value={form.service_address}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, service_address: e.target.value }))
                  }
                />
              </label>
            </div>
            <label>
              Descrição
              <textarea
                value={form.description}
                onChange={(e) =>
                  setForm((f) => ({ ...f, description: e.target.value }))
                }
              />
            </label>
            <label>
              Observações internas
              <textarea
                value={form.notes}
                onChange={(e) =>
                  setForm((f) => ({ ...f, notes: e.target.value }))
                }
              />
            </label>
            <Button onClick={save} disabled={saving}>
              {saving
                ? "Salvando…"
                : editing
                  ? "Salvar alterações"
                  : "Criar ordem"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      <Dialog open={!!details} onOpenChange={(v) => !v && setDetails(null)}>
        <DialogContent className="modal">
          <DialogHeader>
            <DialogTitle>
              OS-{details && String(details.order_number).padStart(5, "0")} ·{" "}
              {details?.title}
            </DialogTitle>
            <DialogDescription>
              Informações completas do atendimento.
            </DialogDescription>
          </DialogHeader>
          {details && (
            <div className="detail-grid">
              <Detail label="Cliente" value={details.customer?.name} />
              <Detail label="Telefone" value={details.customer?.phone} />
              <Detail label="Status" value={statusName[details.status]} />
              <Detail
                label="Prioridade"
                value={priorityName[details.priority]}
              />
              <Detail label="Responsável" value={details.employee?.full_name} />
              <Detail
                label="Agendamento"
                value={
                  details.scheduled_at
                    ? new Date(details.scheduled_at).toLocaleString("pt-BR")
                    : null
                }
              />
              {role === "admin" && (
                <Detail label="Valor" value={money(details.value)} />
              )}
              <Detail label="Endereço" value={details.service_address} wide />
              <Detail label="Descrição" value={details.description} wide />
              <Detail label="Observações" value={details.notes} wide />
              {details.status==="completed"&&<div className="wide os-used-materials"><strong>Materiais utilizados</strong>{loadingMaterials?<span>Carregando…</span>:detailMaterials.length===0?<span>Nenhum material registrado.</span>:detailMaterials.map(item=><div key={item.id}><span>{item.product?.name||"Produto"}<small>{item.product?.sku||""}</small></span><strong>{Number(item.quantity)} {item.product?.unit||"UN"}</strong></div>)}</div>}
              {details.completion_photo_path && (
                <Button
                  variant="outline"
                  onClick={() => openProof(details)}
                  className="wide"
                >
                  <ExternalLink /> Ver comprovante assinado
                </Button>
              )}
              <Button variant="outline" onClick={()=>printOrder(details)} className="wide"><Download/>Imprimir ou salvar PDF</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
      <Dialog
        open={!!finishing}
        onOpenChange={(value) => {
          if (!value) {
            setFinishing(null);
            setFinishPhoto(null);
            setFinishMaterials([]);
          }
        }}
      >
        <DialogContent className="modal wide">
          <DialogHeader>
            <DialogTitle>Finalizar ordem de serviço</DialogTitle>
            <DialogDescription>
              Envie uma foto legível da OS assinada pelo cliente.
            </DialogDescription>
          </DialogHeader>
          {error && <div className="auth-message error-message">{error}</div>}
          <section className="os-materials">
            <div><Package/><span><strong>Materiais utilizados</strong><small>Adicione somente o que foi realmente usado. A baixa será feita ao finalizar.</small></span></div>
            <div className="material-add">
              <select value={materialProduct} onChange={event=>setMaterialProduct(event.target.value)}>
                <option value="">Selecione um produto</option>
                {products.filter(product=>product.active&&Number(product.quantity)>0).map(product=><option key={product.id} value={product.id}>{product.name} · disponível {Number(product.quantity)} {product.unit}</option>)}
              </select>
              <Input type="number" min="0.001" step="0.001" value={materialQuantity} onChange={event=>setMaterialQuantity(event.target.value)} aria-label="Quantidade utilizada" />
              <Button type="button" variant="outline" onClick={addMaterial}>Adicionar</Button>
            </div>
            {finishMaterials.length===0?<p>Nenhum material informado.</p>:<div className="material-list">{finishMaterials.map(item=>{const product=products.find(p=>p.id===item.product_id);return <div key={item.product_id}><span><strong>{product?.name||"Produto"}</strong><small>{item.quantity} {product?.unit||"UN"}</small></span><button type="button" aria-label={`Remover ${product?.name||"produto"}`} onClick={()=>setFinishMaterials(list=>list.filter(row=>row.product_id!==item.product_id))}><X/></button></div>})}</div>}
          </section>
          <div className="upload camera-upload">
            <strong>OS assinada pelo cliente</strong>
            <span>{finishPhoto ? `Selecionada: ${finishPhoto.name}` : "Fotografe o documento ou escolha uma imagem salva."}</span>
            <div className="upload-actions">
              <label htmlFor="proof-camera" className="camera-button"><Camera />Abrir câmera</label>
              <label htmlFor="proof-file" className="file-button"><ImageUp />Escolher foto</label>
            </div>
            <input id="proof-camera" className="file-input" type="file" accept="image/*" capture="environment" onChange={event=>{chooseProof(event.target.files?.[0]);event.target.value=""}} />
            <input id="proof-file" className="file-input" type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif" onChange={event=>{chooseProof(event.target.files?.[0]);event.target.value=""}} />
          </div>
          <Button onClick={finish} disabled={saving || !finishPhoto}>
            {saving ? "Enviando…" : "Enviar e finalizar OS"}
          </Button>
        </DialogContent>
      </Dialog>
      <AlertDialog
        open={!!deleting}
        onOpenChange={(value) => !value && setDeleting(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir esta ordem de serviço?</AlertDialogTitle>
            <AlertDialogDescription>
              A OS-
              {deleting && String(deleting.order_number).padStart(5, "0")} será
              apagada definitivamente. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={saving}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={remove}
              disabled={saving}
            >
              {saving ? "Excluindo…" : "Excluir OS"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
function Field({
  label,
  value,
  set,
  type = "text",
}: {
  label: string;
  value: string;
  set: (v: string) => void;
  type?: string;
}) {
  return (
    <label>
      {label}
      <Input type={type} value={value} onChange={(e) => set(e.target.value)} />
    </label>
  );
}
function Detail({
  label,
  value,
  wide = false,
}: {
  label: string;
  value?: string | null;
  wide?: boolean;
}) {
  return (
    <div className={wide ? "wide" : ""}>
      <small>{label}</small>
      <strong>{value || "Não informado"}</strong>
    </div>
  );
}
