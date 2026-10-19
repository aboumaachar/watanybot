import Fastify from "fastify";
import { afterEach, describe, expect, it } from "vitest";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { veterans2019Routes } from "../routes/veterans-2019";

let tempRoot = "";
afterEach(async () => {
  delete process.env.VETERANS_2019_DATA_FILE;
  delete process.env.VETERANS_2019_SURVEY_OPEN;
  if (tempRoot) await fs.rm(tempRoot, { recursive: true, force: true });
  tempRoot = "";
});

describe("veterans 2019 survey disabled state", () => {
  it("rejects cached public submissions with HTTP 410 by default", async () => {
    tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "watany-v19-disabled-"));
    const file = path.join(tempRoot, "applications.jsonl");
    process.env.VETERANS_2019_DATA_FILE = file;
    const app = Fastify();
    await app.register(veterans2019Routes);
    await app.ready();
    const response = await app.inject({ method: "POST", url: "/api/veterans-2019/applications", payload: {} });
    expect(response.statusCode).toBe(410);
    expect(response.json()).toMatchObject({ ok: false, error: "SURVEY_CLOSED" });
    await expect(fs.stat(file)).rejects.toMatchObject({ code: "ENOENT" });
    await app.close();
  });
});
