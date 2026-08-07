/* ── Disaster Management — API hooks ──────────────────── */
import { useState, useEffect, useCallback } from "react";
import { getDefaultApiBaseUrl } from "./api-base";

const API = getDefaultApiBaseUrl();

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API}${path}`, { credentials: "include", ...init });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

/* ── Types ────────────────────────────────────────────── */

export type Disaster = {
  id: string;
  disaster_type: string;
  name_ar: string;
  description_ar: string;
  severity: string;
  affected_areas: string[];
  status: string;
  started_at: string;
  displaced_count: number;
  shelters_opened: number;
};

export type EmergencyShelter = {
  id: string;
  disaster_id?: string;
  name_ar: string;
  shelter_type: string;
  address_ar: string;
  city: string;
  region?: string;
  total_capacity: number;
  current_occupancy: number;
  families_count: number;
  has_water: boolean;
  has_electricity: boolean;
  has_medical: boolean;
  has_food: boolean;
  has_heating: boolean;
  manager_phone?: string;
  emergency_contact?: string;
  status: string;
  accepting_new: boolean;
  availability: number;
  occupancy_pct: number;
};

export type EmergencyContact = {
  id: string;
  organization_name_ar: string;
  organization_name_en?: string;
  contact_type: string;
  service_provided_ar: string;
  primary_phone: string;
  secondary_phone?: string;
  emergency_hotline?: string;
  available_24_7: boolean;
  is_emergency: boolean;
  priority_level: number;
};

export type EmergencyAlertItem = {
  id: string;
  disaster_id: string;
  title_ar: string;
  message_ar: string;
  severity: string;
  alert_type: string;
  affected_areas: string[];
  sent_at: string;
  active: boolean;
};

export type DisasterStats = {
  active_disasters: number;
  total_shelters: number;
  open_shelters: number;
  total_capacity: number;
  current_occupancy: number;
  registered_displaced: number;
  active_volunteers: number;
  missing_persons: number;
  emergency_contacts: number;
};

/* ── Hooks ────────────────────────────────────────────── */

export function useDisasters() {
  const [disasters, setDisasters] = useState<Disaster[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch<{ disasters: Disaster[] }>("/api/v2/disaster/active")
      .then((r) => setDisasters(r.disasters || []))
      .catch(() => setDisasters([]))
      .finally(() => setLoading(false));
  }, []);

  return { disasters, loading };
}

export function useShelters(disasterId?: string) {
  const [shelters, setShelters] = useState<EmergencyShelter[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const params = new URLSearchParams();
    if (disasterId) params.set("disaster_id", disasterId);
    apiFetch<{ shelters: EmergencyShelter[] }>(`/api/v2/disaster/shelters?${params}`)
      .then((r) => setShelters(r.shelters || []))
      .catch(() => setShelters([]))
      .finally(() => setLoading(false));
  }, [disasterId]);

  return { shelters, loading };
}

export function useEmergencyContacts() {
  const [contacts, setContacts] = useState<EmergencyContact[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch<{ contacts: EmergencyContact[] }>("/api/v2/disaster/emergency-contacts")
      .then((r) => setContacts(r.contacts || []))
      .catch(() => setContacts([]))
      .finally(() => setLoading(false));
  }, []);

  return { contacts, loading };
}

export function useEmergencyAlerts(disasterId?: string) {
  const [alerts, setAlerts] = useState<EmergencyAlertItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const params = new URLSearchParams();
    if (disasterId) params.set("disaster_id", disasterId);
    apiFetch<{ alerts: EmergencyAlertItem[] }>(`/api/v2/disaster/alerts?${params}`)
      .then((r) => setAlerts(r.alerts || []))
      .catch(() => setAlerts([]))
      .finally(() => setLoading(false));
  }, [disasterId]);

  return { alerts, loading };
}

export function useDisasterStats() {
  const [stats, setStats] = useState<DisasterStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch<DisasterStats>("/api/v2/disaster/stats")
      .then(setStats)
      .catch(() => setStats(null))
      .finally(() => setLoading(false));
  }, []);

  return { stats, loading };
}

/* ── Actions ─────────────────────────────────────────── */

export async function registerDisplaced(data: {
  full_name: string;
  phone: string;
  disaster_id: string;
  original_city: string;
  original_address?: string;
  family_size?: number;
  has_children?: boolean;
  children_count?: number;
  has_elderly?: boolean;
  has_disabled?: boolean;
  needs_shelter?: boolean;
  needs_food?: boolean;
  needs_medical?: boolean;
  medical_conditions?: string;
  urgent_needs?: string;
}) {
  return apiFetch<{ ok: boolean; registration: { id: string; status: string } }>(
    "/api/v2/disaster/register-displaced",
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(data),
    },
  );
}

export async function reportMissing(data: {
  full_name: string;
  disaster_id: string;
  reporter_name: string;
  reporter_phone: string;
  age?: number;
  gender?: string;
  last_seen_location?: string;
  last_seen_date?: string;
  description_ar?: string;
  distinguishing_features?: string;
}) {
  return apiFetch<{ ok: boolean; report: { id: string; status: string } }>(
    "/api/v2/disaster/report-missing",
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(data),
    },
  );
}

export async function volunteerSignup(data: {
  full_name: string;
  phone: string;
  disaster_id: string;
  available_in_city: string;
  can_travel?: boolean;
  has_vehicle?: boolean;
  skills?: string[];
  medical_training?: boolean;
  is_veteran?: boolean;
}) {
  return apiFetch<{ ok: boolean; volunteer: { id: string; status: string } }>(
    "/api/v2/disaster/volunteer",
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(data),
    },
  );
}
