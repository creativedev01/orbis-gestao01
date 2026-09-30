import {
  AuthSession,
  SUPABASE_PUBLISHABLE_KEY,
  SUPABASE_URL,
} from "./supabase-auth";
export type ServiceOrder = {
  id: string;
  order_number: number;
  company_id: string;
  customer_id: string;
  assigned_to: string | null;
  title: string;
  description: string | null;
  service_address: string | null;
  scheduled_at: string | null;
  priority: "low" | "normal" | "high" | "urgent";
  status: "waiting" | "accepted" | "in_progress" | "completed" | "cancelled";
  value: number;
  notes: string | null;
  created_by: string;
  accepted_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  completion_photo_path: string | null;
  created_at: string;
  updated_at: string;
  customer?: { name: string; phone: string | null } | null;
  employee?: { full_name: string } | null;
};
export type ServiceOrderInput = {
  company_id: string;
  customer_id: string;
  assigned_to: string | null;
  title: string;
  description: string | null;
  service_address: string | null;
  scheduled_at: string | null;
  priority: ServiceOrder["priority"];
  status: ServiceOrder["status"];
  value: number;
  notes: string | null;
  created_by: string;
};
export type ServiceOrderMaterialInput = { product_id: string; quantity: number };
export type ServiceOrderMaterial = ServiceOrderMaterialInput & { id:number; service_order_id:string; unit_cost:number; product?:{name:string;sku:string;unit:string}|null };
const headers = (s: AuthSession) => ({
  apikey: SUPABASE_PUBLISHABLE_KEY,
  Authorization: `Bearer ${s.access_token}`,
  "Content-Type": "application/json",
});
async function errorOf(r: Response) {
  const b: any = await r.json().catch(() => ({}));
  return (
    b?.message || b?.error || b?.hint || "Não foi possível concluir a operação."
  );
}
const select =
  "*,customer:business_contacts!service_orders_customer_id_fkey(name,phone),employee:profiles!service_orders_assigned_to_fkey(full_name)";
export async function getServiceOrders(
  s: AuthSession,
  companyId: string,
  all = false,
): Promise<ServiceOrder[]> {
  const rows: ServiceOrder[] = [];
  const pageSize = all ? 500 : 1000;
  for (let offset = 0; ; offset += pageSize) {
    const r = await fetch(
      `${SUPABASE_URL}/rest/v1/service_orders?company_id=eq.${encodeURIComponent(companyId)}&select=${encodeURIComponent(select)}&order=created_at.desc,id.desc&limit=${pageSize}&offset=${offset}`,
      { headers: headers(s) },
    );
    if (!r.ok) throw new Error(await errorOf(r));
    const page: ServiceOrder[] = await r.json();
    rows.push(...page);
    if (!all || page.length < pageSize) return rows;
  }
}
export async function createServiceOrder(
  s: AuthSession,
  input: ServiceOrderInput,
) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/service_orders`, {
    method: "POST",
    headers: { ...headers(s), Prefer: "return=representation" },
    body: JSON.stringify(input),
  });
  if (!r.ok) throw new Error(await errorOf(r));
  return r.json();
}
export async function updateServiceOrder(
  s: AuthSession,
  id: string,
  input: Partial<ServiceOrderInput>,
) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/service_orders?id=eq.${id}`, {
    method: "PATCH",
    headers: { ...headers(s), Prefer: "return=representation" },
    body: JSON.stringify({ ...input, updated_at: new Date().toISOString() }),
  });
  if (!r.ok) throw new Error(await errorOf(r));
  return r.json();
}
export async function deleteServiceOrder(s: AuthSession, id: string) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/service_orders?id=eq.${id}`, {
    method: "DELETE",
    headers: { ...headers(s), Prefer: "return=minimal" },
  });
  if (!r.ok) throw new Error(await errorOf(r));
}
export async function serviceOrderAction(
  s: AuthSession,
  id: string,
  action: "accept" | "start",
) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/service_order_action`, {
    method: "POST",
    headers: headers(s),
    body: JSON.stringify({ p_order_id: id, p_action: action }),
  });
  if (!r.ok) throw new Error(await errorOf(r));
  return r.json();
}

export async function completeServiceOrder(
  s: AuthSession,
  order: ServiceOrder,
  companyId: string,
  photo: File,
  materials: ServiceOrderMaterialInput[] = [],
) {
  const extension = photo.name.split(".").pop()?.toLowerCase() || "jpg";
  const path = `${companyId}/${order.id}/${Date.now()}.${extension}`;
  const upload = await fetch(
    `${SUPABASE_URL}/storage/v1/object/service-order-proofs/${path}`,
    {
      method: "POST",
      headers: {
        apikey: SUPABASE_PUBLISHABLE_KEY,
        Authorization: `Bearer ${s.access_token}`,
        "Content-Type": photo.type || "image/jpeg",
        "x-upsert": "false",
      },
      body: photo,
    },
  );
  if (!upload.ok) throw new Error(await errorOf(upload));

  const finish = await fetch(`${SUPABASE_URL}/rest/v1/rpc/service_order_finish`, {
    method: "POST",
    headers: headers(s),
    body: JSON.stringify({ p_order_id: order.id, p_photo_path: path, p_materials: materials }),
  });
  if (!finish.ok) throw new Error(await errorOf(finish));
  return finish.json();
}

export async function getServiceOrderMaterials(s:AuthSession,orderId:string):Promise<ServiceOrderMaterial[]> {
  const select="id,service_order_id,product_id,quantity,unit_cost,product:products(name,sku,unit)";
  const response=await fetch(`${SUPABASE_URL}/rest/v1/service_order_materials?service_order_id=eq.${encodeURIComponent(orderId)}&select=${encodeURIComponent(select)}&order=id.asc`,{headers:headers(s)});
  if(!response.ok) throw new Error(await errorOf(response));
  return response.json();
}

export async function getServiceOrderPhotoUrl(
  s: AuthSession,
  path: string,
) {
  const response = await fetch(
    `${SUPABASE_URL}/storage/v1/object/sign/service-order-proofs/${path}`,
    {
      method: "POST",
      headers: headers(s),
      body: JSON.stringify({ expiresIn: 3600 }),
    },
  );
  if (!response.ok) throw new Error(await errorOf(response));
  const data = await response.json();
  return `${SUPABASE_URL}/storage/v1${data.signedURL}`;
}
