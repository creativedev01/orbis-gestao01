import type { AuthSession, Company, UserProfile } from "./supabase-auth";
import type { ServiceOrder } from "./service-orders";
import type { Product } from "./inventory";
import type { ServiceOrderMaterialInput } from "./service-orders";

export type PendingFinish = { key: string; userId: string; companyId: string; orderId: string; photo: File; materials: ServiceOrderMaterialInput[]; createdAt: string; error?: string };
export type PendingAction = { key: string; userId: string; companyId: string; orderId: string; action: "accept" | "start"; createdAt: string; error?: string };
type CachedOrders = { key: string; orders: ServiceOrder[]; savedAt: string };
type CachedIdentity = { key: string; profile: UserProfile; company: Company };
type CachedProducts = { key: string; products: Product[]; savedAt: string };

const DB = "orbis-offline-v1";
function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB, 3);
    request.onupgradeneeded = () => {
      const db = request.result;
      for (const name of ["orders", "pending", "identity", "actions", "products"]) if (!db.objectStoreNames.contains(name)) db.createObjectStore(name, { keyPath: "key" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
async function transact<T>(store: "orders" | "pending" | "identity" | "actions" | "products", mode: IDBTransactionMode, action: (object: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDb();
  try {
    return await new Promise<T>((resolve, reject) => {
      const transaction = db.transaction(store, mode);
      const request = action(transaction.objectStore(store));
      transaction.oncomplete = () => resolve(request.result);
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
    });
  } finally { db.close(); }
}
const key = (userId: string, companyId: string) => `${userId}:${companyId}`;

export async function cacheIdentity(session: AuthSession, profile: UserProfile, company: Company) {
  await transact("identity", "readwrite", store => store.put({ key: session.user.id, profile, company } satisfies CachedIdentity));
}
export async function readIdentity(userId: string): Promise<CachedIdentity | undefined> {
  return transact("identity", "readonly", store => store.get(userId));
}
export async function cacheEmployeeOrders(userId: string, companyId: string, orders: ServiceOrder[]) {
  const assigned = orders.filter(order => order.assigned_to === userId && ["waiting", "accepted", "in_progress"].includes(order.status))
    .map(order => ({ ...order, value: 0 }));
  await transact("orders", "readwrite", store => store.put({ key: key(userId, companyId), orders: assigned, savedAt: new Date().toISOString() } satisfies CachedOrders));
}
export async function readEmployeeOrders(userId: string, companyId: string): Promise<CachedOrders | undefined> {
  return transact("orders", "readonly", store => store.get(key(userId, companyId)));
}
export async function cacheProducts(userId: string, companyId: string, products: Product[]) {
  await transact("products", "readwrite", store => store.put({ key: key(userId, companyId), products, savedAt: new Date().toISOString() } satisfies CachedProducts));
}
export async function readProducts(userId: string, companyId: string): Promise<CachedProducts | undefined> {
  return transact("products", "readonly", store => store.get(key(userId, companyId)));
}
export async function queueAction(userId: string, companyId: string, order: ServiceOrder, action: "accept" | "start") {
  if (order.company_id !== companyId || order.assigned_to !== userId ||
    action === "accept" && order.status !== "waiting" || action === "start" && order.status !== "accepted") throw new Error("Esta ação não está disponível para esta OS.");
  await transact("actions", "readwrite", store => store.put({ key: `${key(userId, order.id)}:${action}`, userId, companyId, orderId: order.id, action, createdAt: new Date().toISOString() } satisfies PendingAction));
}
export async function pendingActions(userId: string, companyId: string): Promise<PendingAction[]> {
  const all = await transact<PendingAction[]>("actions", "readonly", store => store.getAll());
  return all.filter(item => item.userId === userId && item.companyId === companyId).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}
export async function removePendingAction(item: PendingAction) {
  await transact("actions", "readwrite", store => store.delete(item.key));
}
export async function flagPendingAction(item: PendingAction, message: string) {
  await transact("actions", "readwrite", store => store.put({ ...item, error: message }));
}
export async function queueFinish(userId: string, companyId: string, order: ServiceOrder, photo: File, materials: ServiceOrderMaterialInput[]) {
  if (order.company_id !== companyId || order.assigned_to !== userId || order.status !== "in_progress") throw new Error("Esta OS não está em andamento na sua conta.");
  await transact("pending", "readwrite", store => store.put({ key: key(userId, order.id), userId, companyId, orderId: order.id, photo, materials, createdAt: new Date().toISOString() } satisfies PendingFinish));
}
export async function pendingFinishes(userId: string, companyId: string): Promise<PendingFinish[]> {
  const all = await transact<PendingFinish[]>("pending", "readonly", store => store.getAll());
  return all.filter(item => item.userId === userId && item.companyId === companyId);
}
export async function removePendingFinish(item: PendingFinish) {
  await transact("pending", "readwrite", store => store.delete(item.key));
}
export async function flagPendingFinish(item: PendingFinish, message: string) {
  await transact("pending", "readwrite", store => store.put({ ...item, error: message }));
}
export async function clearOfflineData() {
  const db = await openDb();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(["orders", "pending", "identity", "actions", "products"], "readwrite");
      for (const name of ["orders", "pending", "identity", "actions", "products"]) tx.objectStore(name).clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } finally { db.close(); }
}
