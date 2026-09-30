"use client";
import { useEffect, useMemo, useState } from "react";
import {
  Download,
  FileText,
  Package,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { AuthSession, Company, getCompanyLogoUrl } from "@/lib/supabase-auth";
import { getServiceOrders, ServiceOrder } from "@/lib/service-orders";
import { downloadCsv } from "@/lib/csv";
import {RetentionCenter} from "@/components/subscription-center";
import {
  Product,
  StockMovement,
  getMovements,
  getProducts,
} from "@/lib/inventory";
const money = (v: number) =>
  Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const incoming = ["entry", "return", "adjustment_in"],
  outgoing = ["exit", "loss", "damaged", "adjustment_out"];
const movementNames: Record<string, string> = {
  entry: "Entrada",
  exit: "Saída",
  return: "Devolução",
  loss: "Perda",
  damaged: "Danificado",
  adjustment_in: "Ajuste positivo",
  adjustment_out: "Ajuste negativo",
};
const safe = (v: unknown) =>
  String(v ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ] || c,
  );
export function ReportsView({
  session,
  company,
}: {
  session: AuthSession;
  company: Company;
}) {
  const now = new Date(),
    [month, setMonth] = useState(now.toISOString().slice(0, 7)),
    [products, setProducts] = useState<Product[]>([]),
    [moves, setMoves] = useState<StockMovement[]>([]),
    [orders,setOrders] = useState<ServiceOrder[]>([]),
    [fiscalYear,setFiscalYear] = useState(String(now.getFullYear())),
    [logoUrl,setLogoUrl] = useState<string|null>(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState("");
  useEffect(() => {
    setLoading(true);
    Promise.all([
      getProducts(session, company.id),
      getMovements(session, company.id, true),
      getServiceOrders(session,company.id,true),
    ])
      .then(([p, m, o]) => {
        setProducts(p);
        setMoves(m);
        setOrders(o);
      })
      .catch((e) =>
        setError(
          e instanceof Error ? e.message : "Erro ao preparar relatório.",
        ),
      )
      .finally(() => setLoading(false));
  }, [session, company.id]);
  useEffect(()=>{getCompanyLogoUrl(session,company.logo_url).then(setLogoUrl)},[session,company.logo_url]);
  const list = useMemo(
      () => moves.filter((m) => m.created_at.slice(0, 7) === month),
      [moves, month],
    ),
    entries = list
      .filter((m) => incoming.includes(m.type))
      .reduce((s, m) => s + Number(m.quantity), 0),
    exits = list
      .filter((m) => outgoing.includes(m.type))
      .reduce((s, m) => s + Number(m.quantity), 0),
    value = products.reduce(
      (s, p) => s + Number(p.quantity) * Number(p.cost_price),
      0,
    );
  const fiscalOrders=orders.filter(o=>o.status==="completed"&&o.completed_at&&new Date(o.completed_at).getFullYear()===Number(fiscalYear));
  const fiscalRevenue=fiscalOrders.reduce((sum,o)=>sum+Number(o.value),0);
  const monthlyRevenue=Array.from({length:12},(_,index)=>{
    const monthOrders=fiscalOrders.filter(o=>new Date(o.completed_at!).getMonth()===index);
    return {month:new Intl.DateTimeFormat("pt-BR",{month:"long"}).format(new Date(2024,index,1)),count:monthOrders.length,value:monthOrders.reduce((sum,o)=>sum+Number(o.value),0)};
  });
  const fiscalMoves=moves.filter(m=>new Date(m.created_at).getFullYear()===Number(fiscalYear));
  const missingNcm=products.filter(p=>!p.ncm?.trim()).length;
  const exportFiscalStock=()=>downloadCsv(`posicao-atual-estoque-${new Date().toISOString().slice(0,10)}.csv`,[["CNPJ/CPF",company.document||""],["Posição em",new Date().toLocaleString("pt-BR")],[],["SKU","Produto","NCM","Unidade","Quantidade","Custo unitário","Valor total"],...products.map(p=>[p.sku,p.name,p.ncm||"",p.unit,Number(p.quantity),Number(p.cost_price).toFixed(2),(Number(p.quantity)*Number(p.cost_price)).toFixed(2)])]);
  const exportFiscalMoves=()=>downloadCsv(`movimentacoes-estoque-${fiscalYear}.csv`,[["CNPJ/CPF",company.document||""],["Ano",fiscalYear],[],["Data","Produto","SKU","Tipo","Quantidade","Motivo","Documento"],...fiscalMoves.map(m=>{const p=products.find(x=>x.id===m.product_id);return[new Date(m.created_at).toLocaleString("pt-BR"),p?.name||"Produto",p?.sku||"",movementNames[m.type]||m.type,Number(m.quantity),m.reason,(m as StockMovement&{note_number?:string}).note_number||""]})]);
  const exportFiscalRevenue=()=>downloadCsv(`faturamento-${fiscalYear}.csv`,[["CNPJ/CPF",company.document||""],["Ano",fiscalYear],[],["OS","Cliente","Serviço","Data da conclusão","Valor"],...fiscalOrders.map(o=>[`OS-${String(o.order_number).padStart(5,"0")}`,o.customer?.name||"",o.title,o.completed_at?new Date(o.completed_at).toLocaleString("pt-BR"):"",Number(o.value).toFixed(2)])]);
  const exportMonthlyRevenue=()=>downloadCsv(`resumo-mensal-${fiscalYear}.csv`,[["CNPJ/CPF",company.document||""],["Ano",fiscalYear],["Origem","Ordens de serviço finalizadas"],[],["Mês","Serviços finalizados","Valor dos serviços"],...monthlyRevenue.map(item=>[item.month,item.count,item.value.toFixed(2)]),["TOTAL",fiscalOrders.length,fiscalRevenue.toFixed(2)]]);
  const generateFiscalPdf=()=>{
    const w=window.open("","_blank");
    if(!w)return setError("Permita pop-ups para gerar o relatório fiscal.");
    const months=monthlyRevenue.map(item=>`<tr><td>${safe(item.month)}</td><td>${item.count}</td><td>${safe(money(item.value))}</td></tr>`).join("");
    const missing=products.filter(p=>!p.ncm?.trim()).map(p=>`<li>${safe(p.sku)} · ${safe(p.name)}</li>`).join("");
    const stock=products.map(p=>`<tr><td>${safe(p.sku)}</td><td>${safe(p.name)}</td><td>${safe(p.ncm||"Não informado")}</td><td>${safe(Number(p.quantity))} ${safe(p.unit)}</td><td>${safe(money(Number(p.quantity)*Number(p.cost_price)))}</td></tr>`).join("");
    w.document.write(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Relatório anual ${safe(fiscalYear)}</title><style>body{font:13px Arial;color:#172033;max-width:950px;margin:30px auto;padding:0 24px}header{display:flex;gap:18px;align-items:center;border-bottom:2px solid #2457d6;padding-bottom:16px}header img{max-width:120px;max-height:65px}h1{margin:0;color:#2457d6}h2{font-size:16px;margin-top:26px}.muted{color:#667085}.cards{display:grid;grid-template-columns:repeat(4,1fr);gap:9px;margin-top:20px}.card{border:1px solid #ddd;padding:12px;border-radius:8px}.card span,.card strong{display:block}.card span{font-size:10px;color:#667085}.card strong{font-size:17px;margin-top:5px}table{width:100%;border-collapse:collapse}th,td{padding:8px;border-bottom:1px solid #ddd;text-align:left}th{background:#f3f6fb;font-size:10px;text-transform:uppercase}.warning{border:1px solid #f0d79a;background:#fff8e6;padding:12px;border-radius:8px}.actions{margin-bottom:16px}.actions button{border:0;background:#2457d6;color:#fff;padding:10px 16px;border-radius:7px}.foot{margin-top:25px;font-size:10px;color:#667085}@media print{.actions{display:none}body{max-width:none;margin:0}.stock{break-before:page}}@media(max-width:700px){.cards{grid-template-columns:1fr 1fr}}</style></head><body><div class="actions"><button onclick="window.print()">Imprimir ou salvar em PDF</button></div><header>${logoUrl?`<img src="${safe(logoUrl)}" alt="Logomarca">`:""}<div><h1>${safe(company.name)}</h1><div>${safe(company.document||"CNPJ/CPF não informado")}</div><div class="muted">Relatório anual auxiliar · ${safe(fiscalYear)}</div></div></header><p class="warning"><strong>Atenção:</strong> documento auxiliar para conferência do contador. Não substitui notas fiscais, livros fiscais, declarações ou obrigações oficiais.</p><div class="cards"><div class="card"><span>OS FINALIZADAS</span><strong>${fiscalOrders.length}</strong></div><div class="card"><span>VALOR DAS OS</span><strong>${safe(money(fiscalRevenue))}</strong></div><div class="card"><span>VALOR ATUAL DO ESTOQUE</span><strong>${safe(money(value))}</strong></div><div class="card"><span>PRODUTOS SEM NCM</span><strong>${missingNcm}</strong></div></div><h2>Valores por mês</h2><table><thead><tr><th>Mês</th><th>Serviços finalizados</th><th>Valor das OS</th></tr></thead><tbody>${months}<tr><th>Total</th><th>${fiscalOrders.length}</th><th>${safe(money(fiscalRevenue))}</th></tr></tbody></table>${missing?`<h2>Pendências de cadastro</h2><p>Produtos sem NCM:</p><ul>${missing}</ul>`:""}<section class="stock"><h2>Posição atual do estoque</h2><p class="muted">Posição gerada em ${safe(new Date().toLocaleString("pt-BR"))}; não representa necessariamente o saldo existente no encerramento de ${safe(fiscalYear)}.</p><table><thead><tr><th>SKU</th><th>Produto</th><th>NCM</th><th>Quantidade</th><th>Valor atual</th></tr></thead><tbody>${stock||'<tr><td colspan="5">Nenhum produto cadastrado.</td></tr>'}</tbody></table></section><p class="foot">Gerado pelo Orbis Gestão em ${safe(new Date().toLocaleString("pt-BR"))}.</p></body></html>`);
    w.document.close();
  };
  const generate = () => {
    const label = new Date(month + "-02T12:00:00").toLocaleDateString("pt-BR", {
        month: "long",
        year: "numeric",
      }),
      rows = list
        .map((m) => {
          const p = products.find((x) => x.id === m.product_id);
          return (
            "<tr><td>" +
            safe(new Date(m.created_at).toLocaleString("pt-BR")) +
            "</td><td>" +
            safe(p?.name || "Produto") +
            "</td><td>" +
            safe(m.reason) +
            "</td><td>" +
            safe(movementNames[m.type] || m.type) +
            "</td><td>" +
            safe(m.quantity) +
            "</td><td>" +
            safe(m.previous_quantity) +
            " → " +
            safe(m.new_quantity) +
            "</td></tr>"
          );
        })
        .join(""),
      w = window.open("", "_blank");
    if (!w) return setError("Permita pop-ups para gerar o PDF.");
    w.document.write(
      '<!doctype html><html><head><meta charset="utf-8"><title>Balanço mensal</title><style>body{font:13px Arial;color:#172033;margin:35px}h1{margin:0;color:#2457d6}.sub{color:#667085;margin:6px 0 25px}.cards{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}.card{border:1px solid #ddd;padding:14px;border-radius:8px}.card span{display:block;color:#667085;font-size:11px}.card strong{font-size:18px}table{width:100%;border-collapse:collapse;margin-top:12px}th,td{padding:8px;border-bottom:1px solid #ddd;text-align:left}th{background:#f3f6fb;font-size:10px;text-transform:uppercase}.foot{margin-top:28px;color:#667085;font-size:10px}.logo{max-width:130px;max-height:65px;object-fit:contain;margin-bottom:12px}@media print{button{display:none}}</style></head><body><button onclick="window.print()">Salvar como PDF</button>' +
        (logoUrl?'<div><img class="logo" src="'+safe(logoUrl)+'" alt="Logomarca"></div>':'') + '<h1>' +
        safe(company.name) +
        '</h1><div class="sub">Balanço mensal de estoque · ' +
        safe(label) +
        '</div><div class="cards"><div class="card"><span>Entradas</span><strong>' +
        entries +
        '</strong></div><div class="card"><span>Saídas</span><strong>' +
        exits +
        '</strong></div><div class="card"><span>Valor atual do estoque</span><strong>' +
        safe(money(value)) +
        "</strong></div></div><h2>Movimentações do período</h2><table><thead><tr><th>Data</th><th>Produto</th><th>Motivo</th><th>Tipo</th><th>Qtd.</th><th>Saldo</th></tr></thead><tbody>" +
        (rows ||
          '<tr><td colspan="6">Nenhuma movimentação no período.</td></tr>') +
        '</tbody></table><div class="foot">Gerado pelo Orbis Gestão em ' +
        safe(new Date().toLocaleString("pt-BR")) +
        ".</div><script>window.onload=()=>window.print()<\/script></body></html>",
    );
    w.document.close();
  };
  return (
    <>
      <RetentionCenter session={session} company={company}/>
      <div className="page-head">
        <div>
          <h2>Relatórios e fechamento</h2>
          <p>Balanço real do estoque pronto para salvar em PDF.</p>
        </div>
        <div className="actions report-actions">
          <input
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
          />
          <Button onClick={generate} disabled={loading}>
            <Download />
            Gerar PDF
          </Button>
        </div>
      </div>
      {error && <div className="auth-message error-message">{error}</div>}
      <div className="mini-metrics">
        <Mini
          icon={TrendingUp}
          label="Entradas no mês"
          value={loading ? "…" : String(entries)}
        />
        <Mini
          icon={TrendingDown}
          label="Saídas no mês"
          value={loading ? "…" : String(exits)}
        />
        <Mini
          icon={FileText}
          label="Movimentações"
          value={loading ? "…" : String(list.length)}
        />
        <Mini
          icon={Package}
          label="Valor em estoque"
          value={loading ? "…" : money(value)}
        />
      </div>
      <section className="panel table-panel">
        <div className="panel-head report-preview-head">
          <div>
            <h3>Prévia do balanço mensal</h3>
            <p>Confira os dados antes de gerar o documento.</p>
          </div>
        </div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Data</th>
                <th>Produto</th>
                <th>Motivo</th>
                <th>Tipo</th>
                <th>Quantidade</th>
                <th>Saldo</th>
              </tr>
            </thead>
            <tbody>
              {!list.length ? (
                <tr>
                  <td colSpan={6}>Nenhuma movimentação neste mês.</td>
                </tr>
              ) : (
                list.map((m) => {
                  const p = products.find((x) => x.id === m.product_id);
                  return (
                    <tr key={m.id}>
                      <td>{new Date(m.created_at).toLocaleString("pt-BR")}</td>
                      <td>{p?.name || "Produto"}</td>
                      <td>{m.reason}</td>
                      <td>{movementNames[m.type] || m.type}</td>
                      <td>{Number(m.quantity)}</td>
                      <td>
                        {Number(m.previous_quantity)} → {Number(m.new_quantity)}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>
      <section className="panel fiscal-panel">
        <div className="panel-head"><div><h3>Pacote fiscal para o contador</h3><p>Arquivos auxiliares para conferência contábil. Não substituem documentos fiscais oficiais.</p></div><input type="number" min="2000" max="2100" value={fiscalYear} onChange={e=>setFiscalYear(e.target.value)}/></div>
        {!company.document&&<div className="auth-message error-message">Cadastre o CNPJ ou CPF da empresa em Configurações antes de exportar.</div>}
        <div className="fiscal-summary"><div><span>Valor das OS finalizadas</span><strong>{money(fiscalRevenue)}</strong></div><div><span>Movimentações no ano</span><strong>{fiscalMoves.length}</strong></div><div><span>Posição atual do estoque</span><strong>{money(value)}</strong></div><div><span>Produtos sem NCM</span><strong className={missingNcm?"fiscal-warning":""}>{missingNcm}</strong></div></div>
        <div className="table-scroll"><table><thead><tr><th>Mês</th><th>Serviços finalizados</th><th>Valor das OS finalizadas</th></tr></thead><tbody>{monthlyRevenue.map(item=><tr key={item.month}><td className="fiscal-month">{item.month}</td><td>{item.count}</td><td>{money(item.value)}</td></tr>)}<tr className="fiscal-total"><td>Total do ano</td><td>{fiscalOrders.length}</td><td>{money(fiscalRevenue)}</td></tr></tbody></table></div>
        <div className="fiscal-actions"><Button onClick={generateFiscalPdf} disabled={loading}><FileText/>Relatório anual PDF</Button><Button variant="outline" onClick={exportMonthlyRevenue} disabled={loading||!fiscalOrders.length}><Download/>Resumo mensal</Button><Button variant="outline" onClick={exportFiscalStock} disabled={loading||!products.length}><Download/>Posição do estoque</Button><Button variant="outline" onClick={exportFiscalMoves} disabled={loading||!fiscalMoves.length}><Download/>Movimentações</Button><Button variant="outline" onClick={exportFiscalRevenue} disabled={loading||!fiscalOrders.length}><Download/>OS finalizadas</Button></div>
      </section>
    </>
  );
}
function Mini({ icon: Icon, label, value }: any) {
  return (
    <div>
      <Icon />
      <span>
        <small>{label}</small>
        <strong>{value}</strong>
      </span>
    </div>
  );
}
