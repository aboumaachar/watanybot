import { describe, it, expect } from "vitest";
import { filterContent, sanitizeInput } from "../filters/content-filter";

describe("content-filter", () => {
  describe("sanitizeInput", () => {
    it("strips script tags", () => {
      expect(sanitizeInput('<script>alert("xss")</script>hello')).not.toContain("<script>");
      expect(sanitizeInput('<script>alert("xss")</script>hello')).toContain("hello");
    });

    it("strips event handlers", () => {
      const out = sanitizeInput('<div onload="alert(1)">test</div>');
      expect(out).not.toContain("onload");
    });

    it("preserves normal text", () => {
      expect(sanitizeInput("Just a normal message")).toBe("Just a normal message");
    });
  });

  describe("filterContent", () => {
    it("detects SQL injection patterns", async () => {
      // SQL injection pattern: "';DROP | UNION SELECT | -- | /* */"
      const result = await filterContent("'; DROP TABLE users--");
      // Rule action is "block" → passed = false
      expect(result.passed).toBe(false);
      const sqlMatch = result.violations.find((v) => v.rule === "SQL Injection Patterns");
      expect(sqlMatch).toBeDefined();
    });

    it("detects API key leaks", async () => {
      const result = await filterContent("My key is sk-abc123def456ghijklmnop789012345678901234567890");
      // Rule action is "block" → passed = false
      expect(result.passed).toBe(false);
      const keyMatch = result.violations.find((v) => v.rule === "API Key Exposure");
      expect(keyMatch).toBeDefined();
    });

    it("passes clean input", async () => {
      const result = await filterContent("What are the pension requirements for a military veteran?");
      expect(result.passed).toBe(true);
      expect(result.violations).toHaveLength(0);
    });
  });
});
