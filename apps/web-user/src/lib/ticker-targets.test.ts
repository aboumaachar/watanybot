import { describe, expect, it } from "vitest";
import { extractTickerQuestion, resolveTickerTarget } from "./ticker-targets";

describe("ticker target routing", () => {
  it("maps route link ids to in-app destinations", () => {
    expect(resolveTickerTarget({
      title: "وفيات رسمية",
      linkType: "route",
      linkId: "/al-wafiyat",
    })).toEqual({
      type: "internal",
      href: "/al-wafiyat",
      actionLabel: "افتح الوجهة",
    });
  });

  it("builds official-service detail routes from official-service link ids", () => {
    expect(resolveTickerTarget({
      title: "شروط التطوع",
      linkType: "official_service",
      linkId: "army-volunteering-conditions",
    })).toEqual({
      type: "internal",
      href: "/services/official/army-volunteering-conditions",
      actionLabel: "افتح الخدمة",
    });
  });
});

describe("extractTickerQuestion", () => {
  it("removes suggest prefixes before drafting chat text", () => {
    expect(extractTickerQuestion("suggest سؤال شائع: كيف أتابع معاملتي؟")).toBe("كيف أتابع معاملتي؟");
  });
});