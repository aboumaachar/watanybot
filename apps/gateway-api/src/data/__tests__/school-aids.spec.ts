import { getSchoolAidRequiredItem, schoolAidFormItems } from "../school-aids-required-items";

describe("school-aids data", () => {
  test("all public school-aid forms use image-only preview/download URLs", () => {
    expect(schoolAidFormItems).toHaveLength(3);
    expect(getSchoolAidRequiredItem("school-aid-application")).toBeUndefined();

    const isImageUrl = (url: string) => /\.(?:png|jpe?g|webp)(?:$|[?#])/i.test(url);
    for (const item of schoolAidFormItems) {
      expect(item.sourceStatus).toBe("OFFICIAL_FILE_ATTACHED");
      expect(isImageUrl(item.previewUrl)).toBe(true);
      expect(isImageUrl(item.downloadUrl)).toBe(true);
      expect(item.previewUrl.endsWith(".html")).toBe(false);
      expect(item.previewUrl.endsWith(".pdf")).toBe(false);
      expect(item.preferUniversal).toBe(true);
    }
  });
});
