/* ── Disaster Management Feature – Type definitions ─── */

export type DisasterType = "war" | "earthquake" | "flood" | "fire" | "explosion" | "other";
export type Severity = "low" | "medium" | "high" | "critical";

export type Disaster = {
  id: string;
  disaster_type: DisasterType;
  name_ar: string;
  name_en?: string;
  description_ar: string;
  severity: Severity;
  affected_areas: string[];
  status: "active" | "monitoring" | "resolved";
  started_at: string;
  ended_at?: string;
  displaced_count: number;
  casualties_count: number;
  shelters_opened: number;
  created_at: string;
};

export type EmergencyShelter = {
  id: string;
  disaster_id?: string;
  name_ar: string;
  shelter_type: "government" | "military" | "school" | "mosque" | "church" | "community_center";
  address_ar: string;
  city: string;
  region?: string;
  latitude?: number;
  longitude?: number;
  total_capacity: number;
  current_occupancy: number;
  families_count: number;
  individuals_count: number;
  has_water: boolean;
  has_electricity: boolean;
  has_medical: boolean;
  has_food: boolean;
  has_bathrooms: boolean;
  has_heating: boolean;
  has_cooling: boolean;
  manager_name?: string;
  manager_phone?: string;
  emergency_contact?: string;
  status: "open" | "full" | "closed";
  accepting_new: boolean;
  accepts_families: boolean;
  accepts_elderly: boolean;
  accepts_disabled: boolean;
};

export type DisplacedPerson = {
  id: string;
  disaster_id: string;
  full_name: string;
  military_id?: string;
  national_id?: string;
  gender?: string;
  is_family_head: boolean;
  family_size: number;
  has_children: boolean;
  children_count: number;
  has_elderly: boolean;
  has_disabled: boolean;
  original_city: string;
  original_address: string;
  current_shelter_id?: string;
  current_city?: string;
  current_status: "displaced" | "sheltered" | "hosted" | "returned";
  phone: string;
  emergency_contact_name?: string;
  emergency_contact_phone?: string;
  needs_shelter: boolean;
  needs_food: boolean;
  needs_water: boolean;
  needs_medical: boolean;
  needs_medication: boolean;
  needs_clothing: boolean;
  medical_conditions?: string;
  urgent_needs?: string;
  is_pregnant: boolean;
  is_injured: boolean;
  requires_wheelchair: boolean;
  registered_at: string;
  registered_by: string;
  verified: boolean;
};

export type EmergencyContact = {
  id: string;
  organization_name_ar: string;
  organization_name_en?: string;
  contact_type: "government" | "military" | "ngo" | "medical" | "police" | "civil_defense" | "international";
  service_provided_ar: string;
  service_area: string;
  primary_phone: string;
  secondary_phone?: string;
  emergency_hotline?: string;
  whatsapp?: string;
  available_24_7: boolean;
  priority_level: number;
  is_emergency: boolean;
  active: boolean;
};

export type DisasterVolunteer = {
  id: string;
  disaster_id: string;
  full_name: string;
  phone: string;
  whatsapp?: string;
  email?: string;
  available_in_city: string;
  can_travel: boolean;
  has_vehicle: boolean;
  skills: string[];
  medical_training: boolean;
  available_hours: string;
  status: "available" | "assigned" | "inactive";
  assigned_shelter_id?: string;
  is_veteran: boolean;
  registered_at: string;
};

export type EmergencyAlertRecord = {
  id: string;
  disaster_id: string;
  title_ar: string;
  message_ar: string;
  severity: Severity;
  alert_type: "evacuation" | "shelter" | "aid" | "safety" | "weather" | "general";
  affected_areas: string[];
  sent_at: string;
  expires_at?: string;
  active: boolean;
};

export type MissingPerson = {
  id: string;
  disaster_id: string;
  full_name: string;
  age?: number;
  gender?: string;
  last_seen_location: string;
  last_seen_date: string;
  description_ar: string;
  distinguishing_features?: string;
  photo_url?: string;
  reporter_name: string;
  reporter_phone: string;
  status: "missing" | "found" | "deceased";
  reported_at: string;
};
