"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, Bell, ClipboardList, FileText, Package, X } from "lucide-react";
import { AuthSession, Company } from "@/lib/supabase-auth";
import { getProducts } from "@/lib/inventory";
import { getServiceOrders } from "@/lib/service-orders";
import {getClosures} from "@/lib/subscriptions";

type View="dashboard"|"stock"|"orders"|"customers"|"suppliers"|"employees"|"billing"|"reports"|"settings";
export function NotificationBell({session,company,setView}:{session:AuthSession;company:Company;setView:(v:View)=>void}){
 const [open,setOpen]=useState(false),[low,setLow]=useState(0),[zero,setZero]=useState(0),[waiting,setWaiting]=useState(0),[closures,setClosures]=useState(0),[loading,setLoading]=useState(true),[error,setError]=useState("");
 const refresh=useCallback(async()=>{
  setLoading(true);setError("");
  try{
   const [p,o,c]=await Promise.all([getProducts(session,company.id),getServiceOrders(session,company.id),getClosures(session,company.id).catch(()=>[])]);
   setLow(p.filter(x=>Number(x.quantity)>0&&Number(x.quantity)<=Number(x.min_stock)).length);
   setZero(p.filter(x=>Number(x.quantity)===0).length);
   setWaiting(o.filter(x=>x.status==="waiting").length);
   setClosures(c.filter(x=>x.status==="pending").length);
  }catch{setError("Não foi possível atualizar os alertas.")}finally{setLoading(false)}
 },[session,company.id]);
 useEffect(()=>{refresh();const onFocus=()=>refresh();window.addEventListener("focus",onFocus);const timer=window.setInterval(()=>{if(!document.hidden)refresh()},60000);return()=>{window.removeEventListener("focus",onFocus);window.clearInterval(timer)}},[refresh]);
 const total=low+zero+waiting+closures;
 const items=useMemo(()=>[
  ...(zero?[{icon:Package,title:`${zero} produto${zero>1?"s":""} sem estoque`,text:"Reposição necessária",view:"stock" as View,tone:"danger"}]:[]),
  ...(low?[{icon:AlertTriangle,title:`${low} produto${low>1?"s":""} com estoque baixo`,text:"Quantidade mínima atingida",view:"stock" as View,tone:"warning"}]:[]),
  ...(waiting?[{icon:ClipboardList,title:`${waiting} ordem${waiting>1?"s":""} aguardando funcionário`,text:"Ainda sem aceite",view:"orders" as View,tone:"info"}]:[]),
  ...(closures?[{icon:FileText,title:`${closures} fechamento${closures>1?"s":""} aguardando download`,text:"Baixe as OS antes do prazo de retenção",view:"reports" as View,tone:"warning"}]:[]),
 ],[low,zero,waiting,closures]);
 const go=(view:View)=>{setOpen(false);setView(view)};
 return <div className="notification-wrap"><button className="bell" aria-label={`Notificações${total?`: ${total} pendentes`:""}`} onClick={()=>{if(!open)refresh();setOpen(v=>!v)}}><Bell/>{total>0&&<b>{total>9?"9+":total}</b>}</button>{open&&<><button className="notification-scrim" aria-label="Fechar notificações" onClick={()=>setOpen(false)}/><section className="notification-popover"><header><div><strong>Notificações</strong><span>{loading?"Atualizando…":error?"Atualização indisponível":total?`${total} alerta${total>1?"s":""} pendente${total>1?"s":""}`:"Tudo em dia"}</span></div><button aria-label="Fechar" onClick={()=>setOpen(false)}><X/></button></header><div className="notification-list">{error?<p>{error} <button className="notification-retry" onClick={refresh}>Tentar novamente</button></p>:loading?<p>Carregando alertas…</p>:items.length===0?<div className="notification-empty"><Bell/><strong>Nenhuma pendência</strong><span>Os novos alertas aparecerão aqui.</span></div>:items.map(({icon:Icon,title,text,view,tone})=><button key={title} onClick={()=>go(view)}><i className={tone}><Icon/></i><span><strong>{title}</strong><small>{text}</small></span></button>)}</div>{!error&&items.length>0&&<footer><button onClick={()=>go("dashboard")}>Ver visão geral</button></footer>}</section></>}</div>;
}
