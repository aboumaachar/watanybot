/**
 * Plugins routes — jobs, marketplace, emergency alerts, admin plugins overview.
 * Extracted from server.ts.
 */
import type { FastifyPluginAsync } from "fastify";
import { request } from "undici";
import type { PluginDb, JobApplication, MarketplaceListing, EmergencyAlert } from "../types/domain";
import { makeId, normalizeText } from "../lib/helpers";
import { MOCK_JOBS, MOCK_ALERTS, SEED_MARKETPLACE } from "../data/seed-data";

interface PluginsRoutesOptions {
  pluginDb: PluginDb;
}

type MarketplaceInterest = {
  id: string;
  listingId: string;
  buyerName: string;
  buyerPhone: string;
  buyerEmail?: string;
  message?: string;
  createdAt: number;
};

const v2MarketplaceListings: MarketplaceListing[] = SEED_MARKETPLACE.map((item) => ({ ...item }));
const v2MarketplaceInterests: MarketplaceInterest[] = [];

function mapMarketplaceRow(row: Record<string, unknown>): MarketplaceListing {
  return {
    id: String(row.id),
    title: String(row.title),
    price: Number(row.price),
    currency: String(row.currency),
    location: String(row.location),
    seller: String(row.seller),
    contact: String(row.contact),
    description: row.description ? String(row.description) : "",
    category: row.category ? String(row.category) : "general",
    status: row.status === "sold" ? "sold" : "active",
    createdAt: Number(row.created_at),
  };
}

async function fetchEmergencyAlerts(query: string, limit: number): Promise<EmergencyAlert[]> {
  const url = new URL("https://api.reliefweb.int/v1/disasters");
  url.searchParams.set("appname", "watany");
  url.searchParams.set("limit", String(limit));
  url.searchParams.set("profile", "lite");
  url.searchParams.append("fields[include][]", "name");
  url.searchParams.append("fields[include][]", "country");
  url.searchParams.append("fields[include][]", "date");
  url.searchParams.append("fields[include][]", "url");
  url.searchParams.append("fields[include][]", "description");
  if (query) {
    url.searchParams.set("query[value]", query);
  }

  const res = await request(url.toString(), { method: "GET" });
  const text = await res.body.text();
  const raw = JSON.parse(text) as {
    data?: Array<{
      id?: string | number;
      fields?: {
        name?: string;
        url?: string;
        country?: Array<{ name?: string }>;
        date?: { changed?: string; created?: string };
        description?: string;
      };
    }>;
  };

  return (raw.data || []).map((entry) => {
    const fields = entry.fields || {};
    const country = fields.country?.[0]?.name || "Multiple";
    return {
      id: String(entry.id || fields.name || "alert"),
      title: fields.name || "Emergency update",
      country,
      date: fields.date?.changed || fields.date?.created || new Date().toISOString(),
      url: fields.url,
      summary: fields.description ? fields.description.slice(0, 160) : undefined,
      source: "ReliefWeb",
    } satisfies EmergencyAlert;
  });
}

export const pluginsRoutes: FastifyPluginAsync<PluginsRoutesOptions> = async (app, { pluginDb }) => {
  const marketplacePrefix = "/api/v2/marketplace";

  app.get(marketplacePrefix, async (req) => {
    const qs = req.query as Record<string, string>;
    const q = normalizeText(qs.q).toLowerCase();
    const category = normalizeText(qs.category).toLowerCase();
    const location = normalizeText(qs.location).toLowerCase();
    const status = normalizeText(qs.status).toLowerCase();
    const minPrice = Number(qs.min_price || "0");
    const maxPrice = Number(qs.max_price || Number.MAX_SAFE_INTEGER);
    const limit = Math.min(100, Math.max(1, Number(qs.limit || "20")));
    const offset = Math.max(0, Number(qs.offset || "0"));

    let items = v2MarketplaceListings.slice();
    if (q) {
      items = items.filter((item) => {
        const blob = `${item.title} ${item.description || ""} ${item.category} ${item.location} ${item.seller}`.toLowerCase();
        return blob.includes(q);
      });
    }
    if (category) {
      items = items.filter((item) => item.category.toLowerCase().includes(category));
    }
    if (location) {
      items = items.filter((item) => item.location.toLowerCase().includes(location));
    }
    if (status) {
      items = items.filter((item) => item.status.toLowerCase() === status);
    }
    items = items.filter((item) => item.price >= minPrice && item.price <= maxPrice);
    items.sort((left, right) => right.createdAt - left.createdAt);

    return {
      total: items.length,
      offset,
      limit,
      items: items.slice(offset, offset + limit),
    };
  });

  app.get(`${marketplacePrefix}/:id`, async (req, reply) => {
    const { id } = req.params as { id: string };
    const item = v2MarketplaceListings.find((entry) => entry.id === id);
    if (!item) {
      reply.code(404);
      return { error: "الإعلان غير موجود" };
    }
    return { item };
  });

  app.post<{ Body: { title?: string; price?: number; currency?: string; location?: string; seller?: string; contact?: string; description?: string; category?: string } }>(marketplacePrefix, async (req, reply) => {
    const title = normalizeText(req.body?.title);
    const location = normalizeText(req.body?.location);
    const seller = normalizeText(req.body?.seller);
    const contact = normalizeText(req.body?.contact);
    const description = normalizeText(req.body?.description);
    const category = normalizeText(req.body?.category) || "general";
    const price = Number(req.body?.price || 0);
    const currency = normalizeText(req.body?.currency) || "USD";

    if (!title || !location || !seller || !contact || !Number.isFinite(price) || price <= 0) {
      reply.code(400);
      return { error: "title, price, location, seller, contact required" };
    }

    const item: MarketplaceListing = {
      id: makeId("mkt"),
      title,
      price,
      currency,
      location,
      seller,
      contact,
      description,
      category,
      status: "active",
      createdAt: Date.now(),
    };
    v2MarketplaceListings.unshift(item);
    return { ok: true, item };
  });

  app.patch<{ Params: { id: string }; Body: { actor_contact?: string; title?: string; price?: number; currency?: string; location?: string; description?: string; category?: string } }>(`${marketplacePrefix}/:id`, async (req, reply) => {
    const { id } = req.params;
    const actorContact = normalizeText(req.body?.actor_contact);
    const item = v2MarketplaceListings.find((entry) => entry.id === id);
    if (!item) {
      reply.code(404);
      return { error: "الإعلان غير موجود" };
    }
    if (!actorContact || actorContact !== item.contact) {
      reply.code(403);
      return { error: "غير مسموح بتعديل هذا الإعلان" };
    }

    if (req.body?.title !== undefined) item.title = normalizeText(req.body.title) || item.title;
    if (req.body?.price !== undefined) {
      const nextPrice = Number(req.body.price);
      if (!Number.isFinite(nextPrice) || nextPrice <= 0) {
        reply.code(400);
        return { error: "price غير صالح" };
      }
      item.price = nextPrice;
    }
    if (req.body?.currency !== undefined) item.currency = normalizeText(req.body.currency) || item.currency;
    if (req.body?.location !== undefined) item.location = normalizeText(req.body.location) || item.location;
    if (req.body?.description !== undefined) item.description = normalizeText(req.body.description);
    if (req.body?.category !== undefined) item.category = normalizeText(req.body.category) || item.category;

    return { ok: true, item };
  });

  app.post<{ Params: { id: string }; Body: { actor_contact?: string } }>(`${marketplacePrefix}/:id/close`, async (req, reply) => {
    const { id } = req.params;
    const actorContact = normalizeText(req.body?.actor_contact);
    const item = v2MarketplaceListings.find((entry) => entry.id === id);
    if (!item) {
      reply.code(404);
      return { error: "الإعلان غير موجود" };
    }
    if (!actorContact || actorContact !== item.contact) {
      reply.code(403);
      return { error: "غير مسموح بإغلاق هذا الإعلان" };
    }
    item.status = "sold";
    return { ok: true, item };
  });

  app.post<{ Params: { id: string }; Body: { buyer_name?: string; buyer_phone?: string; buyer_email?: string; message?: string } }>(`${marketplacePrefix}/:id/interest`, async (req, reply) => {
    const { id } = req.params;
    const item = v2MarketplaceListings.find((entry) => entry.id === id);
    if (!item) {
      reply.code(404);
      return { error: "الإعلان غير موجود" };
    }

    const buyerName = normalizeText(req.body?.buyer_name);
    const buyerPhone = normalizeText(req.body?.buyer_phone);
    const buyerEmail = normalizeText(req.body?.buyer_email);
    const message = normalizeText(req.body?.message);

    if (!buyerName || !buyerPhone) {
      reply.code(400);
      return { error: "buyer_name و buyer_phone مطلوبان" };
    }

    const duplicate = v2MarketplaceInterests.find((entry) => entry.listingId === id && entry.buyerPhone === buyerPhone);
    if (duplicate) {
      return { ok: true, interest: duplicate, duplicate: true };
    }

    const interest: MarketplaceInterest = {
      id: makeId("mk_interest"),
      listingId: id,
      buyerName,
      buyerPhone,
      buyerEmail: buyerEmail || undefined,
      message: message || undefined,
      createdAt: Date.now(),
    };
    v2MarketplaceInterests.unshift(interest);
    return { ok: true, interest };
  });

  app.get(`${marketplacePrefix}/my/listings`, async (req, reply) => {
    const qs = req.query as Record<string, string>;
    const contact = normalizeText(qs.contact);
    if (!contact) {
      reply.code(400);
      return { error: "contact مطلوب" };
    }

    const items = v2MarketplaceListings
      .filter((entry) => entry.contact === contact)
      .sort((left, right) => right.createdAt - left.createdAt);
    return { items };
  });

  app.get(`${marketplacePrefix}/my/interests`, async (req, reply) => {
    const qs = req.query as Record<string, string>;
    const contact = normalizeText(qs.contact);
    if (!contact) {
      reply.code(400);
      return { error: "contact مطلوب" };
    }

    const interests = v2MarketplaceInterests
      .filter((entry) => entry.buyerPhone === contact || (entry.buyerEmail && entry.buyerEmail === contact))
      .sort((left, right) => right.createdAt - left.createdAt);
    return { interests };
  });

  app.get(`${marketplacePrefix}/stats`, async () => {
    const active = v2MarketplaceListings.filter((entry) => entry.status === "active").length;
    const sold = v2MarketplaceListings.filter((entry) => entry.status === "sold").length;
    const categories = new Set(v2MarketplaceListings.map((entry) => entry.category));
    return {
      total_listings: v2MarketplaceListings.length,
      active_listings: active,
      sold_listings: sold,
      total_interests: v2MarketplaceInterests.length,
      categories: categories.size,
    };
  });

  app.get("/api/plugins/jobs", async (req) => {
    const query = normalizeText((req.query as { q?: string }).q);
    const results = query
      ? MOCK_JOBS.filter((job) =>
          `${job.title} ${job.company} ${job.summary} ${job.tags.join(" ")}`
            .toLowerCase()
            .includes(query.toLowerCase()),
        )
      : MOCK_JOBS;
    return { results } as const;
  });

  app.post<{ Body: { jobId?: string; name?: string; phone?: string; email?: string; note?: string } }>(
    "/api/plugins/jobs/apply",
    async (req, reply) => {
      const jobId = normalizeText(req.body?.jobId);
      const name = normalizeText(req.body?.name);
      const phone = normalizeText(req.body?.phone);
      const email = normalizeText(req.body?.email);
      const note = normalizeText(req.body?.note);
      if (!jobId || !name || !phone) {
        reply.code(400);
        return { error: "jobId, name, phone required" } as const;
      }
      const job = MOCK_JOBS.find((item) => item.id === jobId);
      if (!job) {
        reply.code(404);
        return { error: "job not found" } as const;
      }
      const application: JobApplication = {
        id: makeId("job_app"),
        jobId,
        name,
        phone,
        email: email || undefined,
        note: note || undefined,
        createdAt: Date.now(),
      };
      pluginDb
        .prepare("INSERT INTO job_applications (id, job_id, name, phone, email, note, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)")
        .run(application.id, application.jobId, application.name, application.phone, application.email, application.note, application.createdAt);
      return { ok: true, application } as const;
    },
  );

  app.get("/api/plugins/marketplace", async () => {
    const rows = pluginDb
      .prepare("SELECT * FROM marketplace_listings ORDER BY created_at DESC")
      .all() as Array<Record<string, unknown>>;
    const items = rows.map(mapMarketplaceRow);
    return { items } as const;
  });

  app.post<{
    Body: {
      title?: string;
      price?: number;
      currency?: string;
      location?: string;
      seller?: string;
      contact?: string;
      description?: string;
      category?: string;
    };
  }>("/api/plugins/marketplace", async (req, reply) => {
    const title = normalizeText(req.body?.title);
    const location = normalizeText(req.body?.location);
    const seller = normalizeText(req.body?.seller);
    const contact = normalizeText(req.body?.contact);
    const description = normalizeText(req.body?.description);
    const category = normalizeText(req.body?.category) || "general";
    const price = Number(req.body?.price || 0);
    const currency = normalizeText(req.body?.currency) || "USD";

    if (!title || !location || !seller || !contact || !Number.isFinite(price) || price <= 0) {
      reply.code(400);
      return { error: "title, price, location, seller, contact required" } as const;
    }

    const item: MarketplaceListing = {
      id: makeId("list"),
      title,
      price,
      currency,
      location,
      seller,
      contact,
      description,
      category,
      status: "active",
      createdAt: Date.now(),
    };
    pluginDb
      .prepare("INSERT INTO marketplace_listings (id, title, price, currency, location, seller, contact, description, category, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
      .run(item.id, item.title, item.price, item.currency, item.location, item.seller, item.contact, item.description, item.category, item.status, item.createdAt);
    return item;
  });

  app.post<{ Params: { id: string } }>("/api/plugins/marketplace/:id/interest", async (req, reply) => {
    const id = req.params.id;
    const exists = pluginDb
      .prepare("SELECT id FROM marketplace_listings WHERE id = ?")
      .get(id) as { id?: string } | undefined;
    if (!exists) {
      reply.code(404);
      return { error: "listing not found" } as const;
    }
    return { ok: true, message: "Interest recorded (demo)." } as const;
  });

  app.get("/api/plugins/emergency", async (req) => {
    const query = normalizeText((req.query as { q?: string }).q);
    const limit = Math.max(1, Math.min(10, Number((req.query as { limit?: string }).limit || "5")));
    try {
      const alerts = await fetchEmergencyAlerts(query, limit);
      return { source: "ReliefWeb", alerts } as const;
    } catch {
      const alerts = query
        ? MOCK_ALERTS.filter((item) =>
            `${item.title} ${item.country} ${item.summary || ""}`.toLowerCase().includes(query.toLowerCase()),
          )
        : MOCK_ALERTS;
      return { source: "Watany Demo", alerts } as const;
    }
  });

  app.get("/api/admin/plugins", async () => ({
    jobApplications: (pluginDb
      .prepare("SELECT id, job_id, name, phone, created_at FROM job_applications ORDER BY created_at DESC LIMIT 5")
      .all() as Array<Record<string, unknown>>).map((row) => ({
      id: String(row.id),
      jobId: String(row.job_id),
      name: String(row.name),
      phone: String(row.phone),
      createdAt: Number(row.created_at),
    })),
    jobApplicationCount: (
      pluginDb.prepare("SELECT COUNT(*) as count FROM job_applications").get() as { count: number }
    ).count,
    marketplaceListings: (pluginDb
      .prepare("SELECT id, title, location, price, currency FROM marketplace_listings ORDER BY created_at DESC LIMIT 5")
      .all() as Array<Record<string, unknown>>).map((row) => ({
      id: String(row.id),
      title: String(row.title),
      location: String(row.location),
      price: Number(row.price),
      currency: String(row.currency),
    })),
    marketplaceCount: (
      pluginDb.prepare("SELECT COUNT(*) as count FROM marketplace_listings").get() as { count: number }
    ).count,
  }));
};
