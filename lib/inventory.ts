import { AuthSession, SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "./supabase-auth";

export type Category = { id:string; company_id:string; name:string; active:boolean };
export type Product = {
  id:string; company_id:string; category_id:string|null; sku:string; barcode:string|null; name:string;
  description:string|null; unit:string; quantity:number; min_stock:number; cost_price:number; sale_price:number;
  location:string|null; ncm:string|null; image_url:string|null; active:boolean; categories?:{name:string}|null;
};
export type ProductInput = Omit<Product,"id"|"quantity"|"active"|"categories"> & { initial_quantity:number };
export type StockMovement = { id:number; product_id:string; type:string; quantity:number; previous_quantity:number; new_quantity:number; reason:string; created_at:string };

const authHeaders = (session:AuthSession) => ({ apikey:SUPABASE_PUBLISHABLE_KEY, Authorization:`Bearer ${session.access_token}`, "Content-Type":"application/json" });
async function errorOf(response:Response){ const body=await response.json().catch(()=>({})); return body?.message||body?.error||body?.hint||"Não foi possível concluir a operação."; }

export async function getCategories(session:AuthSession,companyId:string):Promise<Category[]> {
  const response=await fetch(`${SUPABASE_URL}/rest/v1/categories?company_id=eq.${companyId}&active=eq.true&select=*&order=name.asc`,{headers:authHeaders(session)});
  if(!response.ok) throw new Error(await errorOf(response)); return response.json();
}
export async function createCategory(session:AuthSession,companyId:string,name:string):Promise<Category>{
  const response=await fetch(`${SUPABASE_URL}/rest/v1/categories`,{method:"POST",headers:{...authHeaders(session),Prefer:"return=representation"},body:JSON.stringify({company_id:companyId,name:name.trim()})});
  if(!response.ok) throw new Error(await errorOf(response)); const [row]=await response.json(); return row;
}
export async function getProducts(session:AuthSession,companyId:string):Promise<Product[]> {
  const response=await fetch(`${SUPABASE_URL}/rest/v1/products?company_id=eq.${companyId}&active=eq.true&select=*,categories(name)&order=name.asc`,{headers:authHeaders(session)});
  if(!response.ok) throw new Error(await errorOf(response)); return response.json();
}
export async function createProduct(session:AuthSession,input:ProductInput):Promise<Product>{
  const {initial_quantity,...product}=input;
  const response=await fetch(`${SUPABASE_URL}/rest/v1/products`,{method:"POST",headers:{...authHeaders(session),Prefer:"return=representation"},body:JSON.stringify(product)});
  if(!response.ok) throw new Error(await errorOf(response)); const [created]=await response.json();
  if(initial_quantity>0) await registerMovement(session,{product_id:created.id,type:"entry",quantity:initial_quantity,reason:"Estoque inicial"});
  return created;
}
export async function updateProduct(session:AuthSession,productId:string,input:Omit<ProductInput,"company_id"|"initial_quantity">):Promise<Product>{
  const response=await fetch(`${SUPABASE_URL}/rest/v1/products?id=eq.${productId}`,{method:"PATCH",headers:{...authHeaders(session),Prefer:"return=representation"},body:JSON.stringify(input)});
  if(!response.ok) throw new Error(await errorOf(response)); const [updated]=await response.json();
  if(!updated) throw new Error("Produto não encontrado ou sem permissão para editar."); return updated;
}
export async function deleteProduct(session:AuthSession,productId:string):Promise<{mode:"deleted"|"deactivated"}>{
  const response=await fetch(`${SUPABASE_URL}/rest/v1/rpc/delete_product`,{method:"POST",headers:authHeaders(session),body:JSON.stringify({p_product_id:productId})});
  if(!response.ok) throw new Error(await errorOf(response)); return response.json();
}
export async function registerMovement(session:AuthSession,data:{product_id:string;type:string;quantity:number;reason:string;note_number?:string}){
  const response=await fetch(`${SUPABASE_URL}/rest/v1/rpc/register_stock_movement`,{method:"POST",headers:authHeaders(session),body:JSON.stringify({p_product_id:data.product_id,p_type:data.type,p_quantity:data.quantity,p_reason:data.reason,p_note_number:data.note_number||null})});
  if(!response.ok) throw new Error(await errorOf(response)); return response.json();
}
export async function getMovements(session:AuthSession,companyId:string,all=false):Promise<StockMovement[]>{
  const rows:StockMovement[]=[];
  const batchSize=all?500:50;
  for(let offset=0;;offset+=batchSize){
    const response=await fetch(`${SUPABASE_URL}/rest/v1/stock_movements?company_id=eq.${encodeURIComponent(companyId)}&select=*&order=created_at.desc,id.desc&limit=${batchSize}&offset=${offset}`,{headers:authHeaders(session)});
    if(!response.ok) throw new Error(await errorOf(response));
    const batch:StockMovement[]=await response.json(); rows.push(...batch);
    if(!all||batch.length<batchSize) return rows;
  }
}
