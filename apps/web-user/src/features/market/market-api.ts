import type { MarketContactPreference, MarketStatus } from "./market-ux";

const API_BASE = import.meta.env.VITE_GATEWAY_BASE_URL || "http://localhost:4000";

export type MarketListingType = "SELL" | "BUY" | "DONATE" | "SERVICE";

export interface MarketCategory {
  id: string;
  labelAr: string;
  labelEn: string;
  icon: string;
}

export interface MarketListing {
  id: string;
  ownerId: string;
  title: string;
  description: string;
  categoryId: string;
  listingType: MarketListingType;
  price: string;
  currency: string;
  condition: string;
  location: string;
  contactPreference: MarketContactPreference;
  status: MarketStatus;
  createdAt: string;
  updatedAt: string;
  rejectionReason?: string;
  adminNote?: string;
  reportCount: number;
  trust: {
    verifiedByWatany: boolean;
    featuredVeteranSeller: boolean;
    sellerTrustLevel: "NEW" | "TRUSTED" | "FEATURED";
    note?: string;
  };
}

export interface CreateMarketListingInput {
  title: string;
  description: string;
  categoryId: string;
  listingType: MarketListingType;
  price?: string;
  currency?: string;
  condition?: string;
  location?: string;
  contactPreference: MarketContactPreference;
}

function userHeaders(): HeadersInit {
  return {
    "content-type": "application/json",
    "x-user-id": localStorage.getItem("watany-user-id") || "web-user-market-ui",
    "x-user-role": "accredited",
  };
}

async function readJson<T>(response: Response): Promise<T> {
  const text = await response.text();
  const data = text ? JSON.parse(text) : {};
  if (!response.ok) throw new Error(data?.error || `HTTP ${response.status}`);
  return data as T;
}

export async function fetchMarketCategories(): Promise<MarketCategory[]> {
  const response = await fetch(`${API_BASE}/api/market/categories`);
  const data = await readJson<{ categories: MarketCategory[] }>(response);
  return data.categories || [];
}

export async function fetchMarketListings(): Promise<MarketListing[]> {
  const response = await fetch(`${API_BASE}/api/market/listings`);
  const data = await readJson<{ listings: MarketListing[] }>(response);
  return data.listings || [];
}

export async function fetchMyMarketListings(): Promise<MarketListing[]> {
  const response = await fetch(`${API_BASE}/api/market/my/listings`, { headers: userHeaders() });
  const data = await readJson<{ listings: MarketListing[] }>(response);
  return data.listings || [];
}

export async function createMarketListing(input: CreateMarketListingInput): Promise<MarketListing> {
  const response = await fetch(`${API_BASE}/api/market/listings`, {
    method: "POST",
    headers: userHeaders(),
    body: JSON.stringify({ ...input, categoryId: input.categoryId || "other", contactPreference: input.contactPreference || "WHATSAPP" }),
  });
  const data = await readJson<{ listing: MarketListing }>(response);
  return data.listing;
}

export async function reportMarketListing(id: string, reason: string, note = ""): Promise<void> {
  const response = await fetch(`${API_BASE}/api/market/listings/${id}/report`, {
    method: "POST",
    headers: userHeaders(),
    body: JSON.stringify({ reason, note }),
  });
  await readJson<Record<string, never>>(response);
}