import { getSchoolAidRequiredItem } from "../school-aids-required-items";

describe("school-aids data", () => {
  test("annex items and certificate use PDF preview/download URLs", () => {
    const annexZ = getSchoolAidRequiredItem("annex-z");
    const annexJ = getSchoolAidRequiredItem("annex-j");
    const cert = getSchoolAidRequiredItem("school-year-completion-certificate");

    expect(annexZ).toBeDefined();
    expect(annexJ).toBeDefined();
    expect(cert).toBeDefined();

    expect(annexZ!.previewUrl.endsWith(".pdf") || annexZ!.previewUrl.endsWith(".html")).toBe(true);
    expect(annexJ!.previewUrl.endsWith(".pdf") || annexJ!.previewUrl.endsWith(".html")).toBe(true);
    expect(cert!.previewUrl.endsWith(".pdf") || cert!.previewUrl.endsWith(".html")).toBe(true);
  });
});
