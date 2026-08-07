import { describe, expect, it } from "vitest";
import { getRabitaLegalReference } from "./legal-rabita";

describe("getRabitaLegalReference", () => {
  it("exposes the Rabita listing metadata for the legal page", () => {
    const reference = getRabitaLegalReference();

    expect(reference).not.toBeNull();
    expect(reference?.categoryLabel).toBe("القوانين والأنظمة");
    expect(reference?.title).toBe("الرابطة");
    expect(reference?.listingPathAr).toBe("القوانين والأنظمة > الرابطة");
    expect(reference?.manifest).toBe("kb/sources/laws-regulations/rabita/manifests/rabita_laws_regulations.manifest.json");
    expect(reference?.documents).toEqual([
      { id: "rabita_basic_statute", titleAr: "النظام الأساسي للرابطة" },
      { id: "rabita_internal_rules", titleAr: "النظام الداخلي للرابطة" },
    ]);
  });
});