import { createHmac } from "node:crypto";
import bcrypt from "bcryptjs";
import { describe, expect, it } from "vitest";
import { isLegacyWordpressPasswordHash, verifyPassword } from "../auth/password.js";

describe("legacy WordPress password verification", () => {
  const phpass = "$P$B55D6LjfHDkINU5wF.v2BuuzO0/XPk/";

  it("accepts the PHPass reference vector", async () => {
    expect(isLegacyWordpressPasswordHash(phpass)).toBe(true);
    await expect(verifyPassword("test", phpass)).resolves.toBe(true);
    await expect(verifyPassword("wrong-password", phpass)).resolves.toBe(false);
  });

  it("accepts WordPress $wp$ bcrypt prehashes", async () => {
    const plain = "WatanyWpBcrypt!2026";
    const prehashed = createHmac("sha384", "wp-sha384").update(plain, "utf8").digest("base64");
    const stored = `$wp${await bcrypt.hash(prehashed, 4)}`;
    expect(isLegacyWordpressPasswordHash(stored)).toBe(true);
    await expect(verifyPassword(plain, stored)).resolves.toBe(true);
    await expect(verifyPassword("wrong-password", stored)).resolves.toBe(false);
  });
});
