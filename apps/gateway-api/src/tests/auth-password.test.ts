import { describe, it, expect } from "vitest";
import { hashPassword, verifyPassword } from "../auth/password";

describe("password hashing", () => {
  it("hashes and verifies a password", async () => {
    const hash = await hashPassword("test-password-123");
    expect(hash).toBeTruthy();
    expect(hash).not.toBe("test-password-123");
    expect(hash.startsWith("$2")).toBe(true); // bcrypt prefix

    const valid = await verifyPassword("test-password-123", hash);
    expect(valid).toBe(true);

    const invalid = await verifyPassword("wrong-password", hash);
    expect(invalid).toBe(false);
  });

  it("produces different hashes for same input (salted)", async () => {
    const h1 = await hashPassword("same-pass");
    const h2 = await hashPassword("same-pass");
    expect(h1).not.toBe(h2);
  });
});
