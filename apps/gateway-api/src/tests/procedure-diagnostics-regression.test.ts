import { afterAll, describe, expect, it } from "vitest";
import { normalizeArabic } from "@watany/shared/arabic";
import { signAccessToken } from "../auth/auth-middleware";

let appPromise: Promise<typeof import("../server").default> | null = null;

async function getApp() {
  process.env.JWT_SECRET ||= "test-jwt-secret-for-procedure-diagnostics-0123456789";
  process.env.DISABLE_PLUGIN_DB ||= "true";
  process.env.DISABLE_KB_NODES ||= "true";
  process.env.DISABLE_CHAT_PERSIST ||= "true";
  appPromise ||= import("../server").then((mod) => mod.default);
  return appPromise;
}

afterAll(async () => {
  if (appPromise !== null) {
    const fastifyApp = await appPromise;
    await fastifyApp.close();
  }
}, 30000);

describe("procedure diagnostics regressions", () => {
  it("keeps hard-excluded legal fragments and guide section shells out of representative diagnostics", async () => {
    const app = await getApp();
    const response = await app.inject({
      method: "GET",
      url: "/api/admin/procedures/diagnostics",
      headers: {
        authorization: `Bearer ${signAccessToken({
          sub: "procedure-diagnostics-superadmin",
          role: "superadmin",
          email: "procedure-diagnostics-user@example.invalid",
        })}`,
      },
    });

    expect(response.statusCode).toBe(200);

    const body = response.json();
    const summary = body.summary as {
      raw_procedures: number;
      representative_titles: number;
      listable_representatives: number;
      excluded_representatives: number;
      weaker_duplicates: number;
    };
    const excludedTitles = new Set(
      (body.excluded_representatives as Array<{ title_clean?: string; title_ar?: string }>).map((entry) =>
        normalizeArabic(entry.title_clean || entry.title_ar || ""),
      ),
    );

    expect(summary.raw_procedures).toBeLessThanOrEqual(340);
    expect(summary.representative_titles).toBeLessThanOrEqual(290);
    expect(summary.listable_representatives).toBeGreaterThanOrEqual(180);
    // Some representatives may lack structured content; guard is that bad legal
    // fragments / guide shells are NOT in this list (checked by title below).
    expect(summary.excluded_representatives).toBeLessThanOrEqual(100);
    expect(summary.weaker_duplicates).toBeLessThanOrEqual(40);

    for (const title of [
      "Ø®Ø¯Ù…Ø§Øª Ø®Ø§ØµØ© ÙÙŠ Ø§Ù„Ø¬ÙŠØ´",
      "رابطة قدماء القوى المسلحة",
      "معاملات شؤون المناطق",
      "معاملات الشؤون والمالية",
      "معاملات المالية",
      "Ù…Ø¹Ø§Ù…Ù„Ø§Øª ÙÙŠ Ø§Ù„Ø¬ÙŠØ´",
      "Ù…Ø¹Ø§Ù…Ù„Ø§Øª Ù…Ø®ØªÙ„ÙØ© Ø¹Ø§Ù…Ø©",
      "1 ( Ø£Ø¶ÙŠÙØª Ø¨Ù…ÙˆØ¬Ø¨ : 3 / 2025",
      "2 ( Ø£Ø¶ÙŠÙØª Ø¨Ù…ÙˆØ¬Ø¨ : 3 / 2025",
      "استخدام الاجراء",
      "الاحكام القانونية",
      'ابدال كلمة "مباراة"',
    ]) {
      expect(excludedTitles.has(normalizeArabic(title)), title).toBe(false);
    }
  }, 60000);
});
