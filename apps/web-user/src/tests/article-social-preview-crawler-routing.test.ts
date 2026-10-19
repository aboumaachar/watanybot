import * as fs from "node:fs";
import * as path from "node:path";
import { describe, expect, it } from "vitest";

describe("article social preview crawler routing", () => {
  it("routes current Meta and WhatsApp crawlers to server-rendered article previews", () => {
    const source = fs.readFileSync(path.join(process.cwd(), "public/.htaccess"), "utf8");
    const start = source.indexOf("# ARTICLE_SOCIAL_PREVIEW_V5_BEGIN");
    const end = source.indexOf("# ARTICLE_SOCIAL_PREVIEW_V5_END");
    expect(start).toBeGreaterThanOrEqual(0);
    expect(end).toBeGreaterThan(start);

    const block = source.slice(start, end);
    const userAgentConditions = block
      .split(/\r?\n/)
      .filter((line) => line.includes("RewriteCond %{HTTP_USER_AGENT}"));

    expect(userAgentConditions).toHaveLength(2);
    for (const condition of userAgentConditions) {
      expect(condition).toContain("facebookexternalhit");
      expect(condition).toContain("WhatsApp");
      expect(condition).toContain("meta-externalagent");
      expect(condition).toContain("meta-externalfetcher");
    }
  });
});
