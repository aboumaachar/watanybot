import { describe, expect, it } from "vitest";

import { SERVICE_CATEGORIES } from "./service-catalog";

describe("rabita live app listing", () => {
  it("publishes a visible laws-regulations category with a Rabita listing", () => {
    const lawsCategory = SERVICE_CATEGORIES.find((category) => category.id === "laws-regulations");
    const rabitaTile = lawsCategory?.tiles.find((tile) => tile.id === "rabita");

    expect(lawsCategory).toMatchObject({
      id: "laws-regulations",
      label: "القوانين والأنظمة",
    });

    expect(rabitaTile).toMatchObject({
      id: "rabita",
      label: "الرابطة",
      action: { kind: "route", path: "/legal" },
      listingPathAr: "القوانين والأنظمة > الرابطة",
      manifest: "kb/sources/laws-regulations/rabita/manifests/rabita_laws_regulations.manifest.json",
      documents: [
        { id: "rabita_basic_statute", titleAr: "النظام الأساسي للرابطة" },
        { id: "rabita_internal_rules", titleAr: "النظام الداخلي للرابطة" },
      ],
    });
  });
});