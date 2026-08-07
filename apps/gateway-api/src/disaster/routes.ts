/* ── Disaster Management Feature – Fastify routes ────── */
import type { FastifyInstance } from "fastify";
import {
  SEED_CONTACTS,
  SEED_DISASTERS,
  SEED_SHELTERS,
  SEED_ALERTS,
  displacedPersons,
  volunteers,
  missingPersons,
} from "./seed.js";
import type {
  DisplacedPerson,
  DisasterVolunteer,
  MissingPerson,
} from "./types.js";

let idCounter = 1;
function makeId(prefix: string) {
  return `${prefix}_${Date.now()}_${idCounter++}`;
}

function normalize(s: unknown): string {
  return typeof s === "string" ? s.trim() : "";
}

export async function disasterRoutes(app: FastifyInstance) {
  const prefix = "/api/v2/disaster";

  /* ─── PUBLIC ROUTES (no auth needed for emergencies) ── */

  /* GET /api/v2/disaster/active — active disasters */
  app.get(`${prefix}/active`, async () => {
    const active = SEED_DISASTERS.filter((d) => d.status !== "resolved");
    return { disasters: active };
  });

  /* GET /api/v2/disaster/shelters — emergency shelters */
  app.get(`${prefix}/shelters`, async (req) => {
    const qs = req.query as Record<string, string>;
    const city = normalize(qs.city).toLowerCase();
    const disasterId = normalize(qs.disaster_id);
    const openOnly = qs.open_only !== "false";

    let filtered = [...SEED_SHELTERS];
    if (city) filtered = filtered.filter((s) => s.city.toLowerCase().includes(city));
    if (disasterId) filtered = filtered.filter((s) => s.disaster_id === disasterId);
    if (openOnly) filtered = filtered.filter((s) => s.status === "open");

    return {
      shelters: filtered.map((s) => ({
        ...s,
        availability: s.total_capacity - s.current_occupancy,
        occupancy_pct: Math.round((s.current_occupancy / s.total_capacity) * 100),
      })),
    };
  });

  /* GET /api/v2/disaster/emergency-contacts — essential hotlines */
  app.get(`${prefix}/emergency-contacts`, async (req) => {
    const qs = req.query as Record<string, string>;
    const type = normalize(qs.type);

    let contacts = SEED_CONTACTS.filter((c) => c.active);
    if (type) contacts = contacts.filter((c) => c.contact_type === type);

    contacts.sort((a, b) => a.priority_level - b.priority_level);
    return { contacts };
  });

  /* GET /api/v2/disaster/alerts — emergency alerts */
  app.get(`${prefix}/alerts`, async (req) => {
    const qs = req.query as Record<string, string>;
    const disasterId = normalize(qs.disaster_id);
    const limit = Math.min(50, Math.max(1, Number(qs.limit || "20")));

    let alerts = SEED_ALERTS.filter((a) => a.active);
    if (disasterId) alerts = alerts.filter((a) => a.disaster_id === disasterId);

    alerts.sort((a, b) => new Date(b.sent_at).getTime() - new Date(a.sent_at).getTime());
    return { alerts: alerts.slice(0, limit) };
  });

  /* GET /api/v2/disaster/:id — single disaster detail */
  app.get(`${prefix}/:id`, async (req, reply) => {
    const { id } = req.params as { id: string };
    const disaster = SEED_DISASTERS.find((d) => d.id === id);
    if (!disaster) {
      reply.code(404);
      return { error: "الكارثة غير موجودة" };
    }
    const shelters = SEED_SHELTERS.filter((s) => s.disaster_id === id);
    const alerts = SEED_ALERTS.filter((a) => a.disaster_id === id && a.active);
    const displaced = displacedPersons.filter((d) => d.disaster_id === id);
    const vols = volunteers.filter((v) => v.disaster_id === id);
    return {
      disaster,
      shelters_count: shelters.length,
      alerts_count: alerts.length,
      registered_displaced: displaced.length,
      volunteers_count: vols.length,
    };
  });

  /* ─── USER ROUTES ─────────────────────────────────── */

  /* POST /api/v2/disaster/register-displaced — self-register */
  app.post(`${prefix}/register-displaced`, async (req, reply) => {
    const body = (req.body || {}) as Record<string, unknown>;
    const full_name = normalize(body.full_name);
    const phone = normalize(body.phone);
    const disasterId = normalize(body.disaster_id);
    const original_city = normalize(body.original_city);
    const original_address = normalize(body.original_address);

    if (!full_name || !phone || !disasterId || !original_city) {
      reply.code(400);
      return { error: "الاسم ورقم الهاتف والكارثة والمدينة الأصلية مطلوبة" };
    }

    const disaster = SEED_DISASTERS.find((d) => d.id === disasterId);
    if (!disaster) {
      reply.code(404);
      return { error: "الكارثة غير موجودة" };
    }

    const dup = displacedPersons.find((d) => d.phone === phone && d.disaster_id === disasterId);
    if (dup) {
      reply.code(409);
      return { error: "تم التسجيل سابقاً بهذا الرقم", existing_id: dup.id };
    }

    const record: DisplacedPerson = {
      id: makeId("dp"),
      disaster_id: disasterId,
      full_name,
      military_id: normalize(body.military_id) || undefined,
      national_id: normalize(body.national_id) || undefined,
      gender: normalize(body.gender) || undefined,
      is_family_head: body.is_family_head !== false,
      family_size: Number(body.family_size || 1),
      has_children: Boolean(body.has_children),
      children_count: Number(body.children_count || 0),
      has_elderly: Boolean(body.has_elderly),
      has_disabled: Boolean(body.has_disabled),
      original_city,
      original_address: original_address || original_city,
      current_shelter_id: normalize(body.shelter_id) || undefined,
      current_city: normalize(body.current_city) || undefined,
      current_status: normalize(body.shelter_id) ? "sheltered" : "displaced",
      phone,
      emergency_contact_name: normalize(body.emergency_contact_name) || undefined,
      emergency_contact_phone: normalize(body.emergency_contact_phone) || undefined,
      needs_shelter: Boolean(body.needs_shelter),
      needs_food: Boolean(body.needs_food),
      needs_water: Boolean(body.needs_water),
      needs_medical: Boolean(body.needs_medical),
      needs_medication: Boolean(body.needs_medication),
      needs_clothing: Boolean(body.needs_clothing),
      medical_conditions: normalize(body.medical_conditions) || undefined,
      urgent_needs: normalize(body.urgent_needs) || undefined,
      is_pregnant: Boolean(body.is_pregnant),
      is_injured: Boolean(body.is_injured),
      requires_wheelchair: Boolean(body.requires_wheelchair),
      registered_at: new Date().toISOString(),
      registered_by: "self",
      verified: false,
    };

    displacedPersons.push(record);
    disaster.displaced_count += record.family_size;

    return { ok: true, registration: { id: record.id, status: record.current_status } };
  });

  /* POST /api/v2/disaster/report-missing — report a missing person */
  app.post(`${prefix}/report-missing`, async (req, reply) => {
    const body = (req.body || {}) as Record<string, unknown>;
    const full_name = normalize(body.full_name);
    const reporter_name = normalize(body.reporter_name);
    const reporter_phone = normalize(body.reporter_phone);
    const disasterId = normalize(body.disaster_id);
    const last_seen = normalize(body.last_seen_location);
    const description = normalize(body.description_ar);

    if (!full_name || !reporter_name || !reporter_phone || !disasterId) {
      reply.code(400);
      return { error: "اسم المفقود واسم المبلّغ ورقمه والكارثة مطلوبة" };
    }

    const record: MissingPerson = {
      id: makeId("mp"),
      disaster_id: disasterId,
      full_name,
      age: body.age ? Number(body.age) : undefined,
      gender: normalize(body.gender) || undefined,
      last_seen_location: last_seen || "غير محدد",
      last_seen_date: normalize(body.last_seen_date) || new Date().toISOString(),
      description_ar: description || "لا يوجد وصف",
      distinguishing_features: normalize(body.distinguishing_features) || undefined,
      reporter_name,
      reporter_phone,
      status: "missing",
      reported_at: new Date().toISOString(),
    };

    missingPersons.push(record);
    return { ok: true, report: { id: record.id, status: "under_review" } };
  });

  /* GET /api/v2/disaster/missing — list missing persons */
  app.get(`${prefix}/missing`, async (req) => {
    const qs = req.query as Record<string, string>;
    const disasterId = normalize(qs.disaster_id);
    const q = normalize(qs.q).toLowerCase();

    let results = [...missingPersons].filter((p) => p.status === "missing");
    if (disasterId) results = results.filter((p) => p.disaster_id === disasterId);
    if (q) results = results.filter((p) => p.full_name.toLowerCase().includes(q));

    return { missing_persons: results };
  });

  /* POST /api/v2/disaster/volunteer — volunteer signup */
  app.post(`${prefix}/volunteer`, async (req, reply) => {
    const body = (req.body || {}) as Record<string, unknown>;
    const full_name = normalize(body.full_name);
    const phone = normalize(body.phone);
    const disasterId = normalize(body.disaster_id);
    const city = normalize(body.available_in_city);

    if (!full_name || !phone || !disasterId || !city) {
      reply.code(400);
      return { error: "الاسم والهاتف والكارثة والمدينة مطلوبة" };
    }

    const dup = volunteers.find((v) => v.phone === phone && v.disaster_id === disasterId);
    if (dup) {
      reply.code(409);
      return { error: "تم التسجيل سابقاً كمتطوع" };
    }

    const skills = Array.isArray(body.skills) ? (body.skills as string[]) : [];

    const record: DisasterVolunteer = {
      id: makeId("vol"),
      disaster_id: disasterId,
      full_name,
      phone,
      whatsapp: normalize(body.whatsapp) || undefined,
      email: normalize(body.email) || undefined,
      available_in_city: city,
      can_travel: Boolean(body.can_travel),
      has_vehicle: Boolean(body.has_vehicle),
      skills,
      medical_training: Boolean(body.medical_training),
      available_hours: normalize(body.available_hours) || "full_time",
      status: "available",
      is_veteran: Boolean(body.is_veteran),
      registered_at: new Date().toISOString(),
    };

    volunteers.push(record);
    return { ok: true, volunteer: { id: record.id, status: "registered" } };
  });

  /* ─── STATS ───────────────────────────────────────── */

  app.get(`${prefix}/stats`, async () => {
    return {
      active_disasters: SEED_DISASTERS.filter((d) => d.status !== "resolved").length,
      total_shelters: SEED_SHELTERS.length,
      open_shelters: SEED_SHELTERS.filter((s) => s.status === "open").length,
      total_capacity: SEED_SHELTERS.reduce((sum, s) => sum + s.total_capacity, 0),
      current_occupancy: SEED_SHELTERS.reduce((sum, s) => sum + s.current_occupancy, 0),
      registered_displaced: displacedPersons.length,
      active_volunteers: volunteers.filter((v) => v.status === "available").length,
      missing_persons: missingPersons.filter((p) => p.status === "missing").length,
      emergency_contacts: SEED_CONTACTS.filter((c) => c.active).length,
    };
  });
}
