import Fastify from "fastify";
import { afterEach, describe, expect, it } from "vitest";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { veterans2019Routes } from "../routes/veterans-2019";

let tempRoot = "";
afterEach(async () => {
  delete process.env.VETERANS_2019_DATA_FILE;
  if (tempRoot) await fs.rm(tempRoot, { recursive: true, force: true });
  tempRoot = "";
});

describe("veterans 2019 customs institution", () => {
  it("rejects a cached الجمارك submission while the survey is closed", async () => {
    tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "watany-v19-customs-"));
    process.env.VETERANS_2019_DATA_FILE = path.join(tempRoot, "applications.jsonl");
    const app = Fastify();
    await app.register(veterans2019Routes);
    await app.ready();
    const response = await app.inject({
      method: "POST",
      url: "/api/veterans-2019/applications",
      payload: {
        fullName: "اختبار الجمارك",
        phone: "03123456",
        email: "customs@example.test",
        service: "الجمارك",
        rank: "رقيب",
        retirementDate: "2019-10-16",
        depositMonth: "2020-01",
        amount: 1000000,
        address: { governorateId: "beirut", cazaId: "beirut" },
      },
    });
    expect(response.statusCode).toBe(410);
    const body = response.json() as { ok?: boolean; error?: string };
    expect(body.ok).toBe(false);
    expect(body.error).toBe("SURVEY_CLOSED");
    await expect(fs.readFile(process.env.VETERANS_2019_DATA_FILE!, "utf8")).rejects.toMatchObject({ code: "ENOENT" });
    await app.close();
  });
});
