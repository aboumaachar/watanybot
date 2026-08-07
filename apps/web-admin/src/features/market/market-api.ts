const API_BASE = import.meta.env.VITE_GATEWAY_BASE_URL || "http://localhost:4000";

export interface AdminMarketListing {
  id: string;
  ownerId: string;
  title: string;
  description: string;
  categoryId: string;
  status: "PENDING_REVIEW" | "APPROVED" | "REJECTED" | "REMOVED";
  lifecycleStatus?: "active" | "sold" | "reserved" | "hidden" | "archived";
  rejectionReason?: string;
  adminNote?: string;
  reportCount: number;
  trust: { verifiedByWatany: boolean; featuredVeteranSeller: boolean; sellerTrustLevel: "NEW" | "TRUSTED" | "FEATURED"; note?: string };
}

export interface AdminMarketReport {
  id: string;
  listingId: string;
  reason: string;
  note: string;
  reporterId: string;
  status: "OPEN" | "REVIEWED" | "DISMISSED";
  listing?: AdminMarketListing | null;
}

export interface AdminMarketCategory {
  id: string;
  labelAr: string;
  labelEn: string;
  icon: string;
  enabled: boolean;
  sortOrder: number;
}

export interface AdminMarketOutboxEvent {
  id: string;
  aggregateType: "market_listing" | "market_category" | "market_report" | "market_favorite";
  aggregateId: string;
  eventType: string;
  createdAt: string;
  mercurStatus: "pending" | "exported";
}

function adminHeaders(): HeadersInit {
  return { "content-type": "application/json", "x-user-id": "web-admin-market-ui", "x-user-role": "admin" };
}

function superadminHeaders(): HeadersInit {
  return { "content-type": "application/json", "x-user-id": "web-admin-market-ui", "x-user-role": "superadmin" };
}

async function readJson<T>(response: Response): Promise<T> {
  const text = await response.text();
  const data = text ? JSON.parse(text) : {};
  if (!response.ok) throw new Error(data?.error || `HTTP ${response.status}`);
  return data as T;
}

export async function fetchAdminMarketListings(status?: string): Promise<AdminMarketListing[]> {
  const qs = status ? `?status=${encodeURIComponent(status)}` : "";
  const response = await fetch(`${API_BASE}/api/market/admin/listings${qs}`, { headers: adminHeaders() });
  const data = await readJson<{ listings: AdminMarketListing[] }>(response);
  return data.listings || [];
}

export async function fetchAdminMarketReports(): Promise<AdminMarketReport[]> {
  const response = await fetch(`${API_BASE}/api/market/admin/reports`, { headers: adminHeaders() });
  const data = await readJson<{ reports: AdminMarketReport[] }>(response);
  return data.reports || [];
}

export async function fetchAdminMarketCategories(): Promise<AdminMarketCategory[]> {
  const response = await fetch(`${API_BASE}/api/market/admin/categories`, { headers: adminHeaders() });
  const data = await readJson<{ categories: AdminMarketCategory[] }>(response);
  return data.categories || [];
}

export async function fetchAdminMarketOutbox(): Promise<AdminMarketOutboxEvent[]> {
  const response = await fetch(`${API_BASE}/api/market/admin/outbox`, { headers: adminHeaders() });
  const data = await readJson<{ events: AdminMarketOutboxEvent[] }>(response);
  return data.events || [];
}

export async function saveAdminMarketCategory(input: Partial<AdminMarketCategory> & { labelAr: string }): Promise<AdminMarketCategory> {
  const response = await fetch(`${API_BASE}/api/market/admin/categories`, {
    method: "POST",
    headers: superadminHeaders(),
    body: JSON.stringify(input),
  });
  const data = await readJson<{ category: AdminMarketCategory }>(response);
  return data.category;
}

export async function approveMarketListing(id: string): Promise<void> {
  await fetch(`${API_BASE}/api/market/admin/listings/${id}/approve`, { method: "POST", headers: adminHeaders(), body: JSON.stringify({}) });
}

export async function rejectMarketListing(id: string, reason: string, note = ""): Promise<void> {
  await fetch(`${API_BASE}/api/market/admin/listings/${id}/reject`, { method: "POST", headers: adminHeaders(), body: JSON.stringify({ reason, note }) });
}

export async function removeMarketListing(id: string, note = ""): Promise<void> {
  await fetch(`${API_BASE}/api/market/admin/listings/${id}/remove`, { method: "POST", headers: adminHeaders(), body: JSON.stringify({ note }) });
}

export async function updateMarketTrust(id: string, input: { verifiedByWatany?: boolean; featuredVeteranSeller?: boolean; sellerTrustLevel?: "NEW" | "TRUSTED" | "FEATURED"; note?: string }): Promise<void> {
  await fetch(`${API_BASE}/api/market/admin/listings/${id}/trust`, { method: "POST", headers: adminHeaders(), body: JSON.stringify(input) });
}

export async function compactMarketStore(): Promise<void> {
  await fetch(`${API_BASE}/api/market/admin/maintenance/compact`, { method: "POST", headers: adminHeaders(), body: JSON.stringify({}) });
}