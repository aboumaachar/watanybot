import { describe, expect, it } from "vitest";
import { finalizeWatanyAgentAnswer } from "../services/watany-ai-agent-bridge";
import {
  extractHolidayAudienceFromRequestLike,
  extractHolidayAudienceFromUserProfile,
  normalizeHolidayAudience,
  resolveHolidayGreetingOptions
} from "../services/watany-audience-context";

const armyDay = new Date(new Date().getFullYear(), 7, 1);
const normalDay = new Date(new Date().getFullYear(), 5, 15);

describe("holiday audience context", () => {
  it("normalizes Lebanese Army audience aliases", () => {
    expect(normalizeHolidayAudience("الجيش اللبناني")).toBe("ARMY");
    expect(normalizeHolidayAudience("LAF")).toBe("ARMY");
  });

  it("normalizes ISF audience aliases", () => {
    expect(normalizeHolidayAudience("قوى الأمن الداخلي")).toBe("ISF");
    expect(normalizeHolidayAudience("ISF")).toBe("ISF");
  });

  it("extracts audience from user profile apparatus", () => {
    expect(extractHolidayAudienceFromUserProfile({ apparatus: "الجيش اللبناني" })).toBe("ARMY");
    expect(extractHolidayAudienceFromUserProfile({ securityApparatus: "قوى الأمن الداخلي" })).toBe("ISF");
  });

  it("extracts audience from request body/profile/header", () => {
    expect(
      extractHolidayAudienceFromRequestLike({
        body: { userProfile: { apparatus: "الجيش اللبناني" } },
        headers: {}
      })
    ).toBe("ARMY");

    expect(
      extractHolidayAudienceFromRequestLike({
        body: {},
        headers: { "x-watany-audience": "ISF" }
      })
    ).toBe("ISF");
  });

  it("resolves holiday options with nowOverride", () => {
    const options = resolveHolidayGreetingOptions({
      userProfile: { apparatus: "الجيش اللبناني" },
      nowOverride: armyDay
    });

    expect(options.audience).toBe("ARMY");
    expect(options.nowOverride?.getMonth()).toBe(7);
  });

  it("applies Army Day greeting when userProfile apparatus is Army", () => {
    const answer = finalizeWatanyAgentAnswer("مرحبا", "المعاش يصرف في بداية الشهر.", {
      userProfile: { apparatus: "الجيش اللبناني" },
      nowOverride: armyDay
    });

    expect(answer.startsWith("بمناسبة عيد الجيش اللبناني")).toBe(true);
  });

  it("does not apply Army Day greeting to ISF audience", () => {
    const answer = finalizeWatanyAgentAnswer("مرحبا", "المعاش يصرف في بداية الشهر.", {
      userProfile: { apparatus: "قوى الأمن الداخلي" },
      nowOverride: armyDay
    });

    expect(answer.startsWith("بمناسبة عيد الجيش اللبناني")).toBe(false);
  });

  it("does not apply holiday greeting on a normal day", () => {
    const answer = finalizeWatanyAgentAnswer("مرحبا", "المعاش يصرف في بداية الشهر.", {
      userProfile: { apparatus: "الجيش اللبناني" },
      nowOverride: normalDay
    });

    expect(answer.includes("بمناسبة عيد الجيش اللبناني")).toBe(false);
  });
});