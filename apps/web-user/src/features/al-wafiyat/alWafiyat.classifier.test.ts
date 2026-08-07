import { describe, expect, it } from "vitest";
import { SERVICE_CATEGORIES } from "../../lib/service-catalog";
import { getAlWafiyatSourceById, getAlWafiyatStatusLabel } from "./alWafiyat.classifier";

describe("al-wafiyat feature wiring", () => {
  it("publishes the official source registry and the public service tile", () => {
    expect(getAlWafiyatSourceById("army")).toMatchObject({
      providerAr: "الجيش اللبناني",
      sourceUrl: "https://www.lebarmy.gov.lb/ar/deceased",
    });

    expect(getAlWafiyatSourceById("isf")).toMatchObject({
      providerAr: "قوى الأمن الداخلي",
      sourceUrl: "https://isf.gov.lb/ar/deaths/",
    });

    const assistantCategory = SERVICE_CATEGORIES.find((category) => category.id === "assistant");
    const publicTile = assistantCategory?.tiles.find((tile) => tile.id === "al-wafiyat");
    const accountCategory = SERVICE_CATEGORIES.find((category) => category.id === "account");
    const adminTile = accountCategory?.tiles.find((tile) => tile.id === "al-wafiyat-admin");

    expect(publicTile).toMatchObject({
      label: "الوفيات الرسمية",
      action: { kind: "route", path: "/al-wafiyat" },
    });

    expect(adminTile).toMatchObject({
      label: "إدارة الوفيات الرسمية",
      adminOnly: true,
      action: { kind: "route", path: "/admin/al-wafiyat" },
    });
  });

  it("maps approval statuses to Arabic labels", () => {
    expect(getAlWafiyatStatusLabel("IMPORTED")).toBe("معاينة مستوردة");
    expect(getAlWafiyatStatusLabel("PENDING_APPROVAL")).toBe("بانتظار الاعتماد");
    expect(getAlWafiyatStatusLabel("APPROVED")).toBe("معتمد");
    expect(getAlWafiyatStatusLabel("REJECTED")).toBe("مرفوض");
  });
});