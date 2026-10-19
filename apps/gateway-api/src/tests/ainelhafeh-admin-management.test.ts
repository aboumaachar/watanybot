import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";

describe("Ain El Hafeh admin application management contract", () => {
  it("defines a protected management route for ADMIN/SUPERADMIN only", async () => {
    const source = await import("node:fs/promises").then(fs =>
      fs.readFile(new URL("../routes/ainelhafeh-admin.ts", import.meta.url), "utf8")
    );

    expect(source).toContain('/api/superadmin/ainelhafeh/applications');
    expect(source).toContain('role !== "ADMIN" && role !== "SUPERADMIN"');
    expect(source).toContain('seasonal_apple_job_applications');
  });

  it("updates existing rows instead of replacing/deleting applications", async () => {
    const source = await import("node:fs/promises").then(fs =>
      fs.readFile(new URL("../routes/ainelhafeh-admin.ts", import.meta.url), "utf8")
    );

    expect(source).toContain('UPDATE seasonal_apple_job_applications');
    expect(source).not.toContain('DELETE FROM seasonal_apple_job_applications');
    expect(source).not.toContain('TRUNCATE');
    expect(source).not.toContain('DROP TABLE');
  });

  it("normalizes historical lowercase status values for admin filtering/display", async () => {
    const source = await readFile(new URL("../routes/ainelhafeh-admin.ts", import.meta.url), "utf8");
    expect(source).toContain("UPPER(COALESCE(status,'pending_review'))");
    expect(source).toContain("UPPER(COALESCE(follow_up_status,'not_contacted'))");
  });
});
