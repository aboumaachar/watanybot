export type FactCheckFallbackItem = {
  id: string;
  title: string;
  summary: string | null;
  category: string | null;
  status: "زائف" | "صحيح" | "غير مؤكد" | null;
  image_url: string | null;
  source_url: string;
  published_at: number;
  verified_at: number | null;
  source_name: string;
};

export const FACTCHECK_FALLBACK_CAPTURED_AT = "2026-10-03T09:15:00.000Z";
const FACTCHECK_LIST_URL = "https://factchecklebanon.nna-leb.gov.lb/rumors/list";
const FACTCHECK_ITEM_URLS: Record<number, string> = {
  234: "https://factchecklebanon.nna-leb.gov.lb/auth/rumor/234/%D9%84%D8%A7-%D8%AA%D8%AD%D8%B0%D9%8A%D8%B1-%D9%83%D9%86%D8%AF%D9%8A%D8%A7-%D8%AC%D8%AF%D9%8A%D8%AF%D8%A7-%D9%8A%D8%AF%D8%B9%D9%88-%D9%85%D9%88%D8%A7%D8%B7%D9%86%D9%8A%D9%87%D8%A7-%D8%A5%D9%84%D9%89-%D9%85%D8%BA%D8%A7%D8%AF%D8%B1%D8%A9-%D9%84%D8%A8%D9%86%D8%A7",
  233: "https://factchecklebanon.nna-leb.gov.lb/auth/rumor/233/alghaaa-zfaf-ngl-aaly-hsn-khlyl-tm-mn-algh-aldaaay-olys-adar-ksr-srsk",
  231: "https://factchecklebanon.nna-leb.gov.lb/auth/rumor/231/%D8%AE%D8%A8%D8%B1-%D8%A5%D9%82%D9%81%D8%A7%D9%84-%D8%B7%D8%B1%D9%8A%D9%82-%D8%A7%D9%84%D9%86%D8%A7%D8%B9%D9%85%D8%A9-%D8%A7%D8%AD%D8%AA%D8%AC%D8%A7%D8%AC%D8%A7-%D8%B9%D9%84%D9%89-%D8%A7%D9%84%D8%A3%D9%88%D8%B6%D8%A7%D8%B9-%D8%A7%D9%84%D9%85%D8%B9%D9%8A%D8%B4%D9%8A",
  230: "https://factchecklebanon.nna-leb.gov.lb/auth/rumor/230/aaayl-sory-ttaard-lhal-hstyry-baad-tnaol-shokola-oalthkykat-mstmr",
  228: "https://factchecklebanon.nna-leb.gov.lb/auth/rumor/228/khbr-alghaaa-alhdod-maa-sorya-oalsmah-bdkhol-alsoryyn-al-lbnan-mn-don-akam-ao-rsom-zayf",
};

function officialSnapshotItem(
  id: number,
  title: string,
  category: string,
  publishedDate: string,
): FactCheckFallbackItem {
  const publishedAt = Date.parse(`${publishedDate}T00:00:00.000Z`);
  return {
    id: `factcheck:snapshot:${id}`,
    title,
    summary: null,
    category,
    status: "زائف",
    image_url: null,
    source_url: FACTCHECK_ITEM_URLS[id] || FACTCHECK_LIST_URL,
    published_at: publishedAt,
    verified_at: publishedAt,
    source_name: "Fact Check Lebanon",
  };
}

export const FACTCHECK_FALLBACK_ITEMS: readonly FactCheckFallbackItem[] = [
  officialSnapshotItem(234, "لا تحذير كنديا جديداً يدعو مواطنيها إلى مغادرة لبنان", "أمن وقضاء", "2026-10-02"),
  officialSnapshotItem(233, "الغاء زفاف نجل علي حسن خليل تمّ من الجهة الداعية وليس إدارة قصر سرسق", "متفرقات", "2026-09-13"),
  officialSnapshotItem(231, "خبر إقفال طريق الناعمة احتجاجاً على الأوضاع المعيشية غير صحيح والصورة قديمة", "متفرقات", "2026-08-12"),
  officialSnapshotItem(230, "عائلة سورية تتعرض لحالة هستيرية بعد تناول شوكولا... والتحقيقات مستمرة", "متفرقات", "2026-08-07"),
  officialSnapshotItem(228, "خبر إلغاء الحدود مع سوريا والسماح بدخول السوريين إلى لبنان من دون إقامة أو رسوم زائف", "سياسة", "2026-07-21"),
];

export function getFactCheckFallbackItems(limit: number): FactCheckFallbackItem[] {
  const resolvedLimit = Math.min(Math.max(Math.floor(limit) || 1, 1), FACTCHECK_FALLBACK_ITEMS.length);
  return FACTCHECK_FALLBACK_ITEMS.slice(0, resolvedLimit).map((item) => ({ ...item }));
}
