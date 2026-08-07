import { describe, it, expect } from "vitest";
import { getTodayHoliday, prependHolidayGreeting } from "../services/watany-holiday-greetings";

const armyDay   = new Date(new Date().getFullYear(), 7, 1);
const indepDay  = new Date(new Date().getFullYear(), 10, 22);
const normalDay = new Date(new Date().getFullYear(), 5, 15);

describe("getTodayHoliday", () => {
  it("returns Army Day for ARMY audience on Aug 1", () => {
    const h = getTodayHoliday({ audience: "ARMY", nowOverride: armyDay });
    expect(h).not.toBeNull();
    expect(h?.nameAr).toBe("eid el jaish");
  });
  it("returns null for ISF audience on Army Day", () => {
    const h = getTodayHoliday({ audience: "ISF", nowOverride: armyDay });
    expect(h).toBeNull();
  });
  it("returns Independence Day for ALL on Nov 22", () => {
    const h = getTodayHoliday({ audience: "ALL", nowOverride: indepDay });
    expect(h).not.toBeNull();
    expect(h?.nameAr).toBe("eid el istiqlal");
  });
  it("returns null on a normal non-holiday day", () => {
    expect(getTodayHoliday({ nowOverride: normalDay })).toBeNull();
  });
});

describe("prependHolidayGreeting", () => {
  it("prepends Army Day greeting for ARMY on Aug 1", () => {
    const answer = "المعاش يصرف في بداية الشهر.";
    const result = prependHolidayGreeting(answer, { audience: "ARMY", nowOverride: armyDay });
    expect(result.startsWith("بمناسبة عيد الجيش")).toBe(true);
    expect(result).toContain(answer);
  });
  it("does not prepend on a normal day", () => {
    const answer = "المعاش يصرف في بداية الشهر.";
    expect(prependHolidayGreeting(answer, { nowOverride: normalDay })).toBe(answer);
  });
  it("is idempotent", () => {
    const answer = "يمكنك مراجعة مديرية الشؤون.";
    const once  = prependHolidayGreeting(answer, { audience: "ALL", nowOverride: indepDay });
    const twice = prependHolidayGreeting(once,   { audience: "ALL", nowOverride: indepDay });
    expect(once).toBe(twice);
  });
  it("prepends Independence Day greeting on Nov 22", () => {
    const answer = "يمكنك مراجعة مديرية الشؤون.";
    const result = prependHolidayGreeting(answer, { audience: "ALL", nowOverride: indepDay });
    expect(result).toContain("عيد الاستقلال");
    expect(result).toContain(answer);
  });
  it("holiday greeting comes first when regular greeting is already in answer", () => {
    const answer = "اهلا وسهلا فيك.\n\nالمعاش يصرف في بداية الشهر.";
    const result = prependHolidayGreeting(answer, { audience: "ALL", nowOverride: indepDay });
    expect(result.startsWith("بمناسبة عيد الاستقلال")).toBe(true);
    expect(result).toContain("اهلا وسهلا");
  });
});