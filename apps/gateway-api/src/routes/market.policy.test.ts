import { describe, expect, it } from "vitest";
import { containsProhibitedContent, validateContact } from "./market";

describe("market policy", () => {
  it("blocks prohibited listing content", () => {
    expect(containsProhibitedContent({ title: "old gun", description: "collector item" })).toBe(true);
    expect(containsProhibitedContent({ title: "used refrigerator", description: "working condition" })).toBe(false);
  });

  it("normalizes contact preference to supported market values", () => {
    expect(validateContact("whatsapp")).toBe("WHATSAPP");
    expect(validateContact("phone")).toBe("PHONE");
    expect(validateContact("in_app")).toBe("IN_APP");
    expect(validateContact("hidden")).toBe("IN_APP");
    expect(validateContact("public-facebook")).toBe("IN_APP");
  });
});
