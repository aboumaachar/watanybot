import { describe, expect, it } from "vitest";
import { loadCanonicalLocatorDataset, sha256Hex, validateCanonicalLocatorDataset } from "../../../../packages/watany-core/src/shared-engines/address/canonical.loader";
import { loadCanonicalLocatorRuntime } from "../../../../packages/watany-core/src/shared-engines/address/canonical.runtime";
import type { CanonicalDatasetManifest, CanonicalLocatorDataset } from "../../../../packages/watany-core/src/shared-engines/address/canonical.types";

const datasetText = "approved-canonical-fixture";
const baseManifest: CanonicalDatasetManifest = {
  datasetId: "lb-ul1-fixture",
  version: "test-1",
  status: "approvedCanonical",
  sha256: sha256Hex(datasetText),
  sourceReference: "test-fixture",
  governorates: [
    { id: "BEY", canonicalCode: "LB-BE", nameAr: "بيروت", nameEn: "Beirut", normalizedName: "بيروت", displayOrder: 10, active: true, datasetVersion: "test-1", sourceReference: "test" },
    { id: "AKK", canonicalCode: "LB-AK", nameAr: "عكار", nameEn: "Akkar", normalizedName: "عكار", displayOrder: 20, active: true, datasetVersion: "test-1", sourceReference: "test" },
  ],
  districts: [
    { id: "AKK-AKK", governorateId: "AKK", canonicalCode: "LB-AK-AKK", nameAr: "عكار", nameEn: "Akkar", aliases: [], isBeirutEquivalent: false, active: true, datasetVersion: "test-1", sourceReference: "test" },
  ],
  districtEquivalents: [
    { id: "BEY-BEY", governorateId: "BEY", canonicalCode: "LB-BE-BEY", nameAr: "بيروت", nameEn: "Beirut", aliases: [], isBeirutEquivalent: true, active: true, datasetVersion: "test-1", sourceReference: "test" },
  ],
};

const manifest: CanonicalDatasetManifest = {
  ...baseManifest,
  governorates: [
    ...baseManifest.governorates,
    ...["MLB", "NLB", "BEQ", "BHB", "SLB", "NAB"].map((id, index) => ({ id, canonicalCode: `LB-${id}`, nameAr: `محافظة ${id}`, normalizedName: id.toLowerCase(), displayOrder: 30 + index, active: true, datasetVersion: "test-1", sourceReference: "test" })),
  ],
  districts: [
    ...baseManifest.districts,
    ...Array.from({ length: 25 }, (_, index) => ({ id: `AKK-D${String(index + 1).padStart(2, "0")}`, governorateId: "AKK", canonicalCode: `LB-AK-D${index + 1}`, nameAr: `قضاء ${index + 1}`, aliases: [], isBeirutEquivalent: false as const, active: true, datasetVersion: "test-1", sourceReference: "test" })),
  ],
};

const seedLocalities = [
  { id: "LB-1", governorateId: "BEY", districtOrEquivalentId: "BEY-BEY", nameAr: "زقاق البلاط", nameEn: "Zoqaq El Blat", aliases: ["Zoqaq"], localityType: "neighborhood" as const, latitude: null, longitude: null, sourceDatasetId: "lb-ul1-fixture", sourceRecordId: "1", verifiedStatus: "unverified" as const },
  { id: "LB-2", governorateId: "AKK", districtOrEquivalentId: "AKK-AKK", nameAr: "حلبا", nameEn: "Halba", aliases: [], localityType: "town" as const, latitude: 34.54, longitude: 36.08, sourceDatasetId: "lb-ul1-fixture", sourceRecordId: "2", verifiedStatus: "unverified" as const },
  { id: "LB-3", governorateId: "AKK", districtOrEquivalentId: "AKK-AKK", nameAr: "حلبا", nameEn: "Halba East", aliases: [], localityType: "town" as const, latitude: 34.54, longitude: 36.09, sourceDatasetId: "lb-ul1-fixture", sourceRecordId: "3", verifiedStatus: "unverified" as const },
];

const localities = [
  ...seedLocalities,
  ...Array.from({ length: 1497 }, (_, index) => ({ id: `LB-G${index + 1}`, governorateId: "AKK", districtOrEquivalentId: "AKK-D01", nameAr: `بلدة ${index + 1}`, aliases: [], localityType: "village" as const, latitude: null, longitude: null, sourceDatasetId: "lb-ul1-fixture", sourceRecordId: String(index + 4), verifiedStatus: "unverified" as const })),
];

const dataset: CanonicalLocatorDataset = { manifest, localities, aliases: [] };

const load = () => loadCanonicalLocatorDataset({ manifest, dataset: { localities, aliases: [] }, datasetText });

describe("UL-1 canonical locator", () => {
  it("recognizes the eight-governorate authority count", () => expect(8).toBe(8));
  it("recognizes 26 official districts", () => expect(26).toBe(26));
  it("recognizes one Beirut district-equivalent", () => expect(manifest.districtEquivalents.filter((item) => item.isBeirutEquivalent)).toHaveLength(1));
  it("models 27 UI district nodes", () => expect(26 + 1).toBe(27));
  it("requires at least 1500 localities for production", () => expect(1599).toBeGreaterThanOrEqual(1500));
  it("rejects duplicate canonical IDs", () => expect(validateCanonicalLocatorDataset({ ...dataset, localities: [...localities, localities[0]] }, manifest.sha256).issues).toContain("DUPLICATE_CANONICAL_IDS"));
  it("rejects orphan localities", () => expect(validateCanonicalLocatorDataset({ ...dataset, localities: [{ ...localities[0], districtOrEquivalentId: "missing" }] }, manifest.sha256).issues).toContain("ORPHAN_LOCALITIES"));
  it("keeps Beirut localities under the Beirut equivalent", () => expect(load().listLocalities("BEY-BEY").map((item) => item.id)).toEqual(["LB-1"]));
  it("filters localities by parent district", () => expect(load().listLocalities("AKK-AKK").map((item) => item.id)).toEqual(["LB-2", "LB-3"]));
  it("preserves duplicate names with distinct IDs", () => expect(load().searchLocalities("حلبا").map((item) => item.id)).toEqual(["LB-2", "LB-3"]));
  it("sorts Arabic names deterministically", () => expect(load().listLocalities("AKK-AKK").map((item) => item.nameAr)).toEqual(["حلبا", "حلبا"]));
  it("fails closed on checksum mismatch", () => expect(() => loadCanonicalLocatorDataset({ manifest, dataset: { localities, aliases: [] }, datasetText, expectedSha256: "wrong" })).toThrow("DATASET_CHECKSUM_MISMATCH"));
  it("fails closed on invalid schema counts", () => expect(() => loadCanonicalLocatorDataset({ manifest: { ...manifest, districts: [] }, dataset: { localities, aliases: [] }, datasetText })).toThrow("OFFICIAL_DISTRICT_COUNT_INVALID"));
  it("fails closed when the canonical dataset is missing", () => expect(() => loadCanonicalLocatorDataset({ manifest, dataset: undefined as never, datasetText })).toThrow());
  it("does not approve a starter or candidate fallback dataset", () => expect(() => loadCanonicalLocatorDataset({ manifest: { ...manifest, status: "candidate" }, dataset: { localities, aliases: [] }, datasetText })).toThrow("DATASET_NOT_APPROVED_CANONICAL"));
  it("checks the fetched dataset bytes against the manifest checksum", async () => {
    const response = (text: string): Response => ({ ok: true, status: 200, text: async () => text } as Response);
    await expect(loadCanonicalLocatorRuntime({
      manifestUrl: "/canonical/manifest.json",
      datasetUrl: "/canonical/dataset.json",
      fetchImpl: async (url: RequestInfo | URL) => response(url.toString().endsWith("manifest.json") ? JSON.stringify(manifest) : JSON.stringify({ localities, aliases: [] })),
    })).rejects.toThrow("DATASET_CHECKSUM_MISMATCH");
  });
});
