import { describe, expect, it } from "vitest";
import { buildMergedNewsFeed, mapNnaApiNewsItems, parseFactCheckLandingItems, parseNnaLatestNewsItems, parseNnaRssItems } from "../routes/news";

describe("news feed merge", () => {
  it("maps the NNA backend news API payload", () => {
    const nnaPayload = {
      data: {
        news: [
          {
            id: 543718,
            url: "https://nna-leb.gov.lb/ar/news/short/543718",
            title: "سلامه: بعض الإعلام بات لا يشتغل الا على إثكاء نار الفتنة بين اللبنانيين",
            short_title: null,
            publish_date: 1_780_208_301,
            diff_for_humans: "قبل دقيقتين",
            image: "https://backend.nna-leb.gov.lb/uploads/267200/nna-watermark.jpg",
            category: { title: "سياسة" },
          },
        ],
      },
    };

    const mapped = mapNnaApiNewsItems(nnaPayload, 1_700_000_000_000);

    expect(mapped).toHaveLength(1);
    expect(mapped[0]).toMatchObject({
      id: "nna:543718",
      title: "سلامه: بعض الإعلام بات لا يشتغل الا على إثكاء نار الفتنة بين اللبنانيين",
      body: "قبل دقيقتين",
      category: "سياسة",
      image_url: "https://backend.nna-leb.gov.lb/uploads/267200/nna-watermark.jpg",
      source_url: "https://nna-leb.gov.lb/ar/news/short/543718",
      published_at: 1_780_208_301_000,
      created_by: "nna",
    });
  });

  it("parses NNA latest-news articles and merges them with admin items", () => {
    const nnaHtml = `
      <div>
        <a href="/ar/categories/5/politics">سياسة</a>
        <a href="/ar/news/543711/example-1">الشرق الأوسط: بيروت تكثّف اتصالاتها الدبلوماسية للتوصل إلى وقف إطلاق النار</a>
        <a href="/ar/categories/3/security-and-law">أمن وقضاء</a>
        <a href="/ar/news/543717/example-2">شهداء وجرحى في غارات استهدفت منازل سكنية في دير الزهراني فجر اليوم</a>
      </div>
    `;

    const nnaItems = parseNnaLatestNewsItems(nnaHtml, 1_700_000_000_000);

    expect(nnaItems).toHaveLength(2);
    expect(nnaItems[0]).toMatchObject({
      title: "الشرق الأوسط: بيروت تكثّف اتصالاتها الدبلوماسية للتوصل إلى وقف إطلاق النار",
      category: "سياسة",
      source_url: "https://www.nna-leb.gov.lb/ar/news/543711/example-1",
      created_by: "nna",
      is_published: 1,
    });
    expect(nnaItems[1]).toMatchObject({
      category: "أمن وقضاء",
      source_url: "https://www.nna-leb.gov.lb/ar/news/543717/example-2",
    });

    const adminRows = [
      {
        id: "admin-1",
        title: "خبر إداري مثبت",
        body: null,
        category: "سياسة",
        image_url: null,
        source_url: null,
        published_at: 1_700_000_500_000,
        is_published: 1,
        created_at: 1_700_000_500_000,
        updated_at: 1_700_000_500_000,
        created_by: "admin",
      },
      {
        id: "draft-1",
        title: "مسودة غير منشورة",
        body: null,
        category: "سياسة",
        image_url: null,
        source_url: null,
        published_at: 1_700_000_600_000,
        is_published: 0,
        created_at: 1_700_000_600_000,
        updated_at: 1_700_000_600_000,
        created_by: "admin",
      },
    ];

    const merged = buildMergedNewsFeed(adminRows, nnaItems, { limit: 10 });
    expect(merged.map((item) => item.id)).toEqual([
      "admin-1",
      "nna:https%3A%2F%2Fwww.nna-leb.gov.lb%2Far%2Fnews%2F543711%2Fexample-1",
      "nna:https%3A%2F%2Fwww.nna-leb.gov.lb%2Far%2Fnews%2F543717%2Fexample-2",
    ]);

    const politicsOnly = buildMergedNewsFeed(adminRows, nnaItems, { category: "سياسة", limit: 10 });
    expect(politicsOnly.map((item) => item.id)).toEqual([
      "admin-1",
      "nna:https%3A%2F%2Fwww.nna-leb.gov.lb%2Far%2Fnews%2F543711%2Fexample-1",
    ]);
  });

  it("parses NNA RSS items for public fallback", () => {
    const rssXml = `
      <?xml version="1.0" encoding="UTF-8"?>
      <rss version="2.0">
        <channel>
          <item>
            <title>غارة فجرا على البرج الشمالي</title>
            <pubDate>Thu, 28 May 2026 05:33:00 +0300</pubDate>
            <link>https://nna-leb.gov.lb/ar/news/short/543255</link>
            <description>وطنية - شن الطيران الحربي الإسرائيلي غارة على البرج الشمالي.</description>
            <guid>https://nna-leb.gov.lb/ar/news/short/543255</guid>
          </item>
          <item>
            <title>جيش العدو ينذر سكان صور ويهدد مباني عدة</title>
            <pubDate>Thu, 28 May 2026 05:31:00 +0300</pubDate>
            <link>https://nna-leb.gov.lb/ar/news/short/543254</link>
            <description>وطنية - إنذار إلى سكان صور ومبان عدة.</description>
            <guid>https://nna-leb.gov.lb/ar/news/short/543254</guid>
          </item>
        </channel>
      </rss>
    `;

    const items = parseNnaRssItems(rssXml, 1_700_000_000_000);

    expect(items).toHaveLength(2);
    expect(items[0]).toMatchObject({
      title: "غارة فجرا على البرج الشمالي",
      source_url: "https://nna-leb.gov.lb/ar/news/short/543255",
      body: "وطنية - شن الطيران الحربي الإسرائيلي غارة على البرج الشمالي.",
      category: null,
      created_by: "nna",
      is_published: 1,
    });
    expect(items[0].published_at).toBe(Date.parse("Thu, 28 May 2026 05:33:00 +0300"));
  });

  it("parses Fact Check Lebanon landing rumors", () => {
    const factCheckHtml = `
      <section>
        <a href="/auth/rumor/214/example-rumor">
          زائف سياسة "اليونيفيل": تحركات الآليات والعناصر تبديل دوري روتيني وليس انسحاباً
          تم النشر في: 2026-05-30 تم التحقق في: 2026-05-30
        </a>
      </section>
      <section>
        <a href="/auth/rumor/213/example-rumor-2">
          غير مؤكد متفرقات خبر متداول يحتاج إلى تدقيق إضافي
          تم النشر في: 2026-05-27 تم التحقق في: 2026-05-27
        </a>
      </section>
    `;

    const items = parseFactCheckLandingItems(factCheckHtml, 1_700_000_000_000);

    expect(items).toHaveLength(2);
    expect(items[0]).toMatchObject({
      title: "\"اليونيفيل\": تحركات الآليات والعناصر تبديل دوري روتيني وليس انسحاباً",
      status: "زائف",
      category: "سياسة",
      source_url: "https://factchecklebanon.nna-leb.gov.lb/auth/rumor/214/example-rumor",
      source_name: "Fact Check Lebanon",
    });
    expect(items[0].published_at).toBe(Date.parse("2026-05-30T00:00:00.000Z"));
    expect(items[0].verified_at).toBe(Date.parse("2026-05-30T00:00:00.000Z"));

    expect(items[1]).toMatchObject({
      status: "غير مؤكد",
      category: "متفرقات",
    });
  });
});