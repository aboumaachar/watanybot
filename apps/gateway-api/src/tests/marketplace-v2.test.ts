import { beforeAll, describe, expect, it } from "vitest";
import { app } from "../server";

describe("marketplace v2 routes", () => {
  beforeAll(async () => {
    await app.ready();
  });

  it("creates, updates, closes, and tracks interest for a listing", async () => {
    const created = await app.inject({
      method: "POST",
      url: "/api/v2/marketplace",
      payload: {
        title: "كرسي متحرك شبه جديد",
        price: 250,
        currency: "USD",
        location: "بيروت",
        seller: "أحمد",
        contact: "70123456",
        description: "حالة ممتازة",
        category: "مستلزمات طبية",
      },
    });

    expect(created.statusCode).toBe(200);
    const createdBody = created.json() as { ok: boolean; item: { id: string; status: string; contact: string } };
    expect(createdBody.ok).toBe(true);
    expect(createdBody.item.status).toBe("active");

    const listingId = createdBody.item.id;

    const patch = await app.inject({
      method: "PATCH",
      url: `/api/v2/marketplace/${encodeURIComponent(listingId)}`,
      payload: {
        actor_contact: "70123456",
        price: 230,
        description: "تم تخفيض السعر",
      },
    });

    expect(patch.statusCode).toBe(200);
    const patchBody = patch.json() as { ok: boolean; item: { price: number; description: string } };
    expect(patchBody.ok).toBe(true);
    expect(patchBody.item.price).toBe(230);
    expect(patchBody.item.description).toContain("تخفيض");

    const interest = await app.inject({
      method: "POST",
      url: `/api/v2/marketplace/${encodeURIComponent(listingId)}/interest`,
      payload: {
        buyer_name: "مشتري تجريبي",
        buyer_phone: "71999888",
        message: "مهتم بالشراء",
      },
    });

    expect(interest.statusCode).toBe(200);
    const interestBody = interest.json() as { ok: boolean; interest: { listingId: string } };
    expect(interestBody.ok).toBe(true);
    expect(interestBody.interest.listingId).toBe(listingId);

    const close = await app.inject({
      method: "POST",
      url: `/api/v2/marketplace/${encodeURIComponent(listingId)}/close`,
      payload: {
        actor_contact: "70123456",
      },
    });

    expect(close.statusCode).toBe(200);
    const closeBody = close.json() as { ok: boolean; item: { status: string } };
    expect(closeBody.ok).toBe(true);
    expect(closeBody.item.status).toBe("sold");

    const mine = await app.inject({
      method: "GET",
      url: "/api/v2/marketplace/my/listings?contact=70123456",
    });

    expect(mine.statusCode).toBe(200);
    const mineBody = mine.json() as { items: Array<{ id: string; status: string }> };
    expect(mineBody.items.some((item) => item.id === listingId && item.status === "sold")).toBe(true);
  });
});
