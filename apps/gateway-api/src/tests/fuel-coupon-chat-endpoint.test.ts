import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, describe, expect, it } from "vitest";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ragPath = path.resolve(__dirname, "../../../../watany_kb_tables_v4/watany_rag_chunks_v4.jsonl");

process.env.JWT_SECRET ||= "test-jwt-secret-for-fuel-coupon-regression-0123456789";
process.env.DISABLE_PLUGIN_DB = "true";
process.env.DISABLE_KB_NODES = "true";
process.env.DISABLE_CHAT_PERSIST = "true";
process.env.USE_AI = "false";
process.env.AI_RAG_CHUNKS_PATH = ragPath;

let appPromise: Promise<typeof import("../server").default> | null = null;
async function getApp() {
  appPromise ||= import("../server").then((mod) => mod.default);
  return appPromise;
}

afterAll(async () => {
  if (appPromise) await (await appPromise).close();
}, 30000);

describe("fuel coupon chat endpoint", () => {
  it("returns the complete required-document answer for a warrant officer fuel-coupon query", async () => {
    expect(fs.existsSync(ragPath)).toBe(true);
    const app = await getApp();
    const response = await app.inject({
      method: "POST",
      url: "/api/chat",
      payload: {
        message: "المستندات المطلوبة للمؤهل على قسائم محروقات",
        channel: "web",
        userId: "00000000-0000-4000-8000-000000000086",
      },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.reply).toContain("دفتر الآلية");
    expect(body.reply).toContain("التأمين الإلزامي");
    expect(body.reply).toContain("إثبات ملكية الآلية");
    expect(body.reply).toContain("إثبات هوية صاحب العلاقة");
    expect(body.reply).toContain("كتاب من صاحب العلاقة");
    expect(body.reply).not.toContain("اضافة الابنة المطلقة على العاتق");
  }, 30000);
});
