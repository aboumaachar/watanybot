import { mkdtempSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import Fastify from "fastify";
import { marketRoutes } from "./market";

let marketStorePath = "";

function buildApp() {
  const app = Fastify({ logger: false });
  app.register(marketRoutes, { prefix: "/api" });
  return app;
}

function actorHeaders(userId: string, role: string) {
  return {
    "x-user-id": userId,
    "x-user-role": role,
    "content-type": "application/json",
  };
}

function actorNoBodyHeaders(userId: string, role: string) {
  return {
    "x-user-id": userId,
    "x-user-role": role,
  };
}

beforeEach(() => {
  const tmpRoot = mkdtempSync(path.join(os.tmpdir(), "watany-market-"));
  marketStorePath = path.join(tmpRoot, "market-store.json");
  process.env.MARKET_STORE_PATH = marketStorePath;
});

afterEach(() => {
  delete process.env.MARKET_STORE_PATH;
});

describe("market persisted routes", () => {
  it("creates, approves, favorites, reports, and manages listing lifecycle through the persisted market store", async () => {
    const app = buildApp();
    await app.ready();

    const created = await app.inject({
      method: "POST",
      url: "/api/market/listings",
      headers: actorHeaders("seller-1", "public"),
      payload: {
        title: "كرسي متحرك شبه جديد",
        description: "وصف كافٍ للإعلان مع تفاصيل واضحة جداً",
        categoryId: "items",
        listingType: "SELL",
        price: "250",
        currency: "USD",
        locationLabel: "بيروت · الأشرفية",
        mohafaza: "بيروت",
        caza: "بيروت",
        village: "الأشرفية",
        contactPreference: "PHONE",
        seller: "أحمد",
        contact: "70123456",
      },
    });

    expect(created.statusCode).toBe(201);
    const createdBody = created.json() as { listing: { id: string; moderationStatus?: string; ownerId: string } };
    expect(createdBody.listing.ownerId).toBe("seller-1");
    const listingId = createdBody.listing.id;

    const mine = await app.inject({
      method: "GET",
      url: "/api/market/my/listings",
      headers: actorHeaders("seller-1", "public"),
    });
    expect(mine.statusCode).toBe(200);
    expect((mine.json() as { listings: Array<{ id: string }> }).listings.some((listing) => listing.id === listingId)).toBe(true);

    const approved = await app.inject({
      method: "POST",
      url: `/api/market/admin/listings/${encodeURIComponent(listingId)}/approve`,
      headers: actorHeaders("admin-1", "admin"),
      payload: {},
    });
    expect(approved.statusCode).toBe(200);

    const publicList = await app.inject({
      method: "GET",
      url: "/api/market/listings",
    });
    expect(publicList.statusCode).toBe(200);
    expect((publicList.json() as { listings: Array<{ id: string }> }).listings.some((listing) => listing.id === listingId)).toBe(true);

    const favorited = await app.inject({
      method: "POST",
      url: `/api/market/listings/${encodeURIComponent(listingId)}/favorite`,
      headers: actorHeaders("buyer-1", "public"),
      payload: {},
    });
    expect(favorited.statusCode).toBe(200);

    const favorites = await app.inject({
      method: "GET",
      url: "/api/market/my/favorites",
      headers: actorHeaders("buyer-1", "public"),
    });
    expect(favorites.statusCode).toBe(200);
    expect((favorites.json() as { listings: Array<{ id: string; isFavorited?: boolean }> }).listings.some((listing) => listing.id === listingId && listing.isFavorited)).toBe(true);

    const report = await app.inject({
      method: "POST",
      url: `/api/market/listings/${encodeURIComponent(listingId)}/report`,
      headers: actorHeaders("buyer-2", "public"),
      payload: { reason: "مخالف", note: "نحتاج مراجعة هذا الإعلان" },
    });
    expect(report.statusCode).toBe(200);

    const reserved = await app.inject({
      method: "POST",
      url: `/api/market/listings/${encodeURIComponent(listingId)}/reserve`,
      headers: actorHeaders("seller-1", "public"),
      payload: {},
    });
    expect(reserved.statusCode).toBe(200);
    expect((reserved.json() as { listing: { status: string } }).listing.status).toBe("reserved");

    const sold = await app.inject({
      method: "POST",
      url: `/api/market/listings/${encodeURIComponent(listingId)}/sold`,
      headers: actorHeaders("seller-1", "public"),
      payload: {},
    });
    expect(sold.statusCode).toBe(200);
    expect((sold.json() as { listing: { status: string } }).listing.status).toBe("sold");

    const hidden = await app.inject({
      method: "POST",
      url: `/api/market/listings/${encodeURIComponent(listingId)}/hide`,
      headers: actorHeaders("seller-1", "public"),
      payload: {},
    });
    expect(hidden.statusCode).toBe(200);
    expect((hidden.json() as { listing: { status: string } }).listing.status).toBe("hidden");

    const hiddenPublicList = await app.inject({ method: "GET", url: "/api/market/listings" });
    expect((hiddenPublicList.json() as { listings: Array<{ id: string }> }).listings.some((listing) => listing.id === listingId)).toBe(false);

    const renewed = await app.inject({
      method: "POST",
      url: `/api/market/listings/${encodeURIComponent(listingId)}/renew`,
      headers: actorHeaders("seller-1", "public"),
      payload: {},
    });
    expect(renewed.statusCode).toBe(200);
    expect((renewed.json() as { listing: { status: string } }).listing.status).toBe("active");

    const archived = await app.inject({
      method: "POST",
      url: `/api/market/listings/${encodeURIComponent(listingId)}/archive`,
      headers: actorHeaders("seller-1", "public"),
      payload: {},
    });
    expect(archived.statusCode).toBe(200);
    expect((archived.json() as { listing: { status: string } }).listing.status).toBe("archived");

    const outbox = await app.inject({
      method: "GET",
      url: "/api/market/admin/outbox",
      headers: actorHeaders("admin-1", "admin"),
    });
    expect(outbox.statusCode).toBe(200);
    const outboxBody = outbox.json() as { events: Array<{ eventType: string }> };
    expect(outboxBody.events.some((event) => event.eventType === "listing.created")).toBe(true);
    expect(outboxBody.events.some((event) => event.eventType === "favorite.created")).toBe(true);
  });

  it("enforces owner/admin access on image management and allows superadmin category creation", async () => {
    const app = buildApp();
    await app.ready();

    const created = await app.inject({
      method: "POST",
      url: "/api/market/listings",
      headers: actorHeaders("seller-2", "public"),
      payload: {
        title: "معدات تصوير",
        description: "وصف واضح وطويل بما يكفي للإعلان داخل السوق المحلي",
        categoryId: "items",
        listingType: "SELL",
        price: "80",
        currency: "USD",
        location: "بيروت",
        seller: "سليم",
        contact: "71111111",
        contactPreference: "WHATSAPP",
      },
    });
    const listingId = (created.json() as { listing: { id: string } }).listing.id;

    const deniedAttach = await app.inject({
      method: "POST",
      url: `/api/market/listings/${encodeURIComponent(listingId)}/images`,
      headers: actorHeaders("other-user", "public"),
      payload: {
        images: [{ url: "/runtime/uploads/1712345678901-abcdefabcdefabcdefabcdef.jpg", mimeType: "image/jpeg", filename: "listing.jpg", size: 1024 }],
      },
    });
    expect(deniedAttach.statusCode).toBe(403);

    const attached = await app.inject({
      method: "POST",
      url: `/api/market/listings/${encodeURIComponent(listingId)}/images`,
      headers: actorHeaders("seller-2", "public"),
      payload: {
        images: [{ url: "/runtime/uploads/1712345678901-abcdefabcdefabcdefabcdef.jpg", mimeType: "image/jpeg", filename: "listing.jpg", size: 1024 }],
      },
    });
    expect(attached.statusCode).toBe(200);
    const imageId = (attached.json() as { listing: { images: Array<{ id: string }> } }).listing.images[0]?.id;
    expect(imageId).toBeTruthy();

    const removed = await app.inject({
      method: "DELETE",
      url: `/api/market/listings/${encodeURIComponent(listingId)}/images/${encodeURIComponent(String(imageId))}`,
      headers: actorNoBodyHeaders("seller-2", "public"),
    });
    expect(removed.statusCode).toBe(200);
    expect((removed.json() as { listing: { images: unknown[] } }).listing.images).toHaveLength(0);

    const categorySaved = await app.inject({
      method: "POST",
      url: "/api/market/admin/categories",
      headers: actorHeaders("super-1", "superadmin"),
      payload: { labelAr: "معدات تصوير", labelEn: "Photo Gear", icon: "📷", sortOrder: 70 },
    });
    expect(categorySaved.statusCode).toBe(200);

    const categories = await app.inject({
      method: "GET",
      url: "/api/market/admin/categories",
      headers: actorHeaders("admin-2", "admin"),
    });
    expect(categories.statusCode).toBe(200);
    expect((categories.json() as { categories: Array<{ labelAr: string }> }).categories.some((category) => category.labelAr === "معدات تصوير")).toBe(true);
  });
});
