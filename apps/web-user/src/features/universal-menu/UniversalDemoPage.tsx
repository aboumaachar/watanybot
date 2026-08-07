import React, { useMemo, useState } from "react";
import UniversalListingCard from "../../components/universal/UniversalListingCard";
// APEX_CSS_FREEZE_DISABLED_IMPORT import "./universal-demo.css";

type MenuGroup = {
  id: string;
  title: string;
  subtitle: string;
  items: string[];
};

type PreviewCard = {
  id: string;
  tone: string;
  title: string;
  badges: string[];
  summary: string;
  flow: string[];
  ctas: Array<{ label: string; href: string }>;
  related: string[];
};

const MENU_GROUPS: MenuGroup[] = [
  {
    id: "official-services",
    title: "الخدمات الرسمية",
    subtitle: "إجراءات، نماذج، ومراجعات",
    items: ["دفتر التقاعد", "الوضع العائلي", "بدل ضائع", "إفادة قيد"],
  },
  {
    id: "benefits",
    title: "المنح والمساعدات",
    subtitle: "منح مدرسية، رواتب، وتعويضات",
    items: ["المنح المدرسية", "المساعدات الاجتماعية", "بدلات العلاج", "تعويضات الورثة"],
  },
  {
    id: "employment",
    title: "التشغيل والفرص",
    subtitle: "وظائف، سوق العمل، واستشارات",
    items: ["فرص العمل", "سوق الخدمات", "ملف السائق", "طلبات الاعتماد"],
  },
  {
    id: "documents",
    title: "الوثائق والنماذج",
    subtitle: "عرض النماذج وتحضير المستندات",
    items: ["نماذج الطلبات", "المرفقات المطلوبة", "المراجعات الأخيرة", "أدلة الاستخدام"],
  },
];

const PREVIEW_CARDS: PreviewCard[] = [
  {
    id: "retirement-reissue",
    tone: "ت1",
    title: "طلب دفتر تقاعد بدل عن ضائع",
    badges: ["رسمي", "إجراء", "نموذج"],
    summary: "معاينة بطاقة موحدة لإجراء حكومي مع مسار واضح، أزرار محلية، وتوسعة تفصيلية دون تغيير الصفحات الحية.",
    flow: [
      "تأكيد بيانات صاحب الطلب والصفة.",
      "إرفاق المستندات أو مراجعة الناقص.",
      "فتح النموذج المحلي أو الانتقال إلى لائحة النماذج فقط.",
    ],
    ctas: [
      { label: "فتح النموذج المحلي", href: "/forms/viewer/123" },
      { label: "لائحة النماذج", href: "/forms" },
    ],
    related: ["دفتر التقاعد", "إفادة قيد", "تعديل الوضع العائلي"],
  },
  {
    id: "family-status",
    tone: "ت2",
    title: "طلب تعديل الوضع العائلي",
    badges: ["رسمي", "وثائق"],
    summary: "يبيّن هذا النموذج كيف تبقى بطاقة الإجراء موحدة مع شريط علاقات وإجراءات محلية فقط، من دون المساس بعارض النماذج الحالي.",
    flow: [
      "اختيار سبب التعديل وإدخال البيانات الأساسية.",
      "مراجعة قائمة الثبوتيات قبل الإرسال.",
      "فتح الطلب أو التوسع في المعلومات من البطاقة نفسها.",
    ],
    ctas: [
      { label: "معاينة المستندات", href: "/forms" },
      { label: "بدء الطلب", href: "/forms/viewer/123" },
    ],
    related: ["إفادة عائلية", "بيان خدمة", "تعويضات الأسرة"],
  },
  {
    id: "school-grant",
    tone: "م1",
    title: "منحة مدرسية للمستفيدين",
    badges: ["منحة", "مراجعة"],
    summary: "مثال على توحيد بطاقات القوائم بين الإجراءات والمنح مع الإبقاء على المسار الحالي لصفحة المنح المدرسية بدون أي استبدال.",
    flow: [
      "تحديد فئة المستفيد والسنة الدراسية.",
      "تجهيز إفادات المدرسة والبيانات العسكرية.",
      "الرجوع إلى صفحة المنحة الحالية عند الحاجة إلى الحساب الكامل.",
    ],
    ctas: [
      { label: "الذهاب إلى صفحة المنح", href: "/school-grants" },
      { label: "النماذج المرتبطة", href: "/forms" },
    ],
    related: ["المنح المدرسية", "الرواتب", "تعويضات التعليم"],
  },
];

export default function UniversalDemoPage() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuQuery, setMenuQuery] = useState("");
  const [activeGroupId, setActiveGroupId] = useState(MENU_GROUPS[0]?.id ?? "official-services");

  const filteredGroups = useMemo(() => {
    const query = menuQuery.trim();
    if (!query) {
      return MENU_GROUPS;
    }

    return MENU_GROUPS.map((group) => ({
      ...group,
      items: group.items.filter((item) => item.includes(query) || group.title.includes(query) || group.subtitle.includes(query)),
    })).filter((group) => group.items.length > 0 || group.title.includes(query) || group.subtitle.includes(query));
  }, [menuQuery]);

  const activeGroup = filteredGroups.find((group) => group.id === activeGroupId)
    ?? MENU_GROUPS.find((group) => group.id === activeGroupId)
    ?? MENU_GROUPS[0];

  const activeCountLabel = activeGroup ? `${activeGroup.items.length} عناصر` : "0 عناصر";

  function openHref(href: string) {
    window.location.href = href;
  }

  function buildExpanded(card: PreviewCard) {
    return (
      <div className="universal-preview__expandedStack">
        <section className="universal-preview__miniSection">
          <h4>المسار المقترح</h4>
          <ol className="universal-preview__flow">
            {card.flow.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
        </section>

        <section className="universal-preview__miniSection">
          <h4>إجراءات محلية فقط</h4>
          <div className="universal-preview__ctaGrid">
            {card.ctas.map((cta) => (
              <button
                key={cta.href + cta.label}
                type="button"
                className="universal-preview__localCta"
                onClick={() => openHref(cta.href)}
              >
                {cta.label}
              </button>
            ))}
          </div>
        </section>

        <section className="universal-preview__miniSection">
          <h4>إجراءات مرتبطة</h4>
          <div className="universal-preview__relatedStrip">
            {card.related.map((item) => (
              <button key={item} type="button" className="universal-preview__relatedChip">
                {item}
              </button>
            ))}
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="universal-preview" dir="rtl">
      <div className="universal-preview__page">
        <header className="universal-preview__header">
          <div className="universal-preview__brandText">
            <strong>موطني</strong>
            <span>مساعد المحاربين القدامى</span>
          </div>
          <button type="button" className="universal-preview__headerButton">الإشعارات</button>
          <button type="button" className="universal-preview__headerButton">الحساب</button>
        </header>

        <div className="universal-preview__ticker">
          <b>مباشر</b>
          <span>معاينة معزولة للـ Universal Menu + Listing Cards بدون أي تغيير في الصفحة الرئيسية أو عارض النماذج أو نظام الأيقونات.</span>
        </div>

        <div className="universal-preview__toolbar">
          <button type="button" className="universal-preview__menuTrigger" onClick={() => setMenuOpen((open) => !open)}>
            <span className="universal-preview__burger" aria-hidden="true">
              <i />
              <i />
              <i />
            </span>
            <span>القائمة</span>
          </button>

          <div className="universal-preview__featureChip">
            <div className="universal-preview__featureCopy">
              <strong>{activeGroup?.title ?? "الخدمات الرسمية"}</strong>
              <span>{activeGroup?.subtitle ?? "إجراءات، نماذج، ومراجعات"}</span>
            </div>
            <small>{activeCountLabel}</small>
          </div>

          <button type="button" className="universal-preview__searchMini" onClick={() => setMenuOpen(true)}>
            بحث
          </button>
        </div>

        <div className={menuOpen ? "universal-preview__dropdownShell is-open" : "universal-preview__dropdownShell"}>
          <div className="universal-preview__dropdownPanel">
            <div className="universal-preview__panelSearch">
              <input
                type="search"
                value={menuQuery}
                onChange={(event) => setMenuQuery(event.target.value)}
                placeholder="ابحث داخل فئات المعاينة"
              />
            </div>

            <div className="universal-preview__accordion">
              {filteredGroups.map((group) => {
                const isActive = group.id === activeGroup?.id;
                return (
                  <section key={group.id} className={isActive ? "universal-preview__group is-active" : "universal-preview__group"}>
                    <button
                      type="button"
                      className="universal-preview__groupButton"
                      onClick={() => setActiveGroupId(group.id)}
                    >
                      <div className="universal-preview__groupCopy">
                        <strong>{group.title}</strong>
                        <small>{group.subtitle}</small>
                      </div>
                      <span className="universal-preview__groupArrow">{isActive ? "−" : "+"}</span>
                    </button>

                    <div className="universal-preview__subMenu">
                      {group.items.map((item) => (
                        <button
                          key={item}
                          type="button"
                          className={item === group.items[0] && isActive ? "universal-preview__subItem is-current" : "universal-preview__subItem"}
                          onClick={() => {
                            setActiveGroupId(group.id);
                            setMenuOpen(false);
                          }}
                        >
                          <span className="universal-preview__subItemMini">{group.title.slice(0, 1)}</span>
                          <span>{item}</span>
                        </button>
                      ))}
                    </div>
                  </section>
                );
              })}

              {filteredGroups.length === 0 && (
                <div className="universal-preview__emptySearch">لا توجد عناصر مطابقة في هذه المعاينة.</div>
              )}
            </div>
          </div>
        </div>

        <main className="universal-preview__content">
          <div className="universal-preview__feedTools">
            <button type="button">الكل</button>
            <button type="button">الأكثر استخداماً</button>
            <button type="button">طلبات جاهزة</button>
            <button type="button">مراجعات مرتبطة</button>
          </div>

          <section className="universal-preview__heroCard">
            <p className="universal-preview__heroEyebrow">معاينة v10 بدون الشعار</p>
            <h2>تثبيت شكل القائمة والبطاقات في طبقة منفصلة</h2>
            <p>
              هذه الشاشة تحاكي الحزمة المرجعية مع إزالة علامة الشعار من الرأس فقط، مع الإبقاء على العنوان، التثبيت العلوي، الشريط الإخباري، القائمة المضغوطة، البطاقات، وشريط الدردشة السفلي.
            </p>
          </section>

          <section>
            {PREVIEW_CARDS.map((card) => (
              <UniversalListingCard
                key={card.id}
                title={card.title}
                icon={<span className="universal-preview__toneBadge">{card.tone}</span>}
                badges={card.badges}
                summary={card.summary}
                actions={card.ctas.map((cta, index) => ({
                  label: index === 0 ? cta.label : cta.label,
                  onClick: () => openHref(cta.href),
                }))}
                expanded={buildExpanded(card)}
              />
            ))}
          </section>
        </main>

        <div className="universal-preview__floatingChat">
          <button type="button">المساعد</button>
          <div className="universal-preview__chatInput">اسأل عن الإجراء، أو افتح النموذج المحلي المناسب من هذه المعاينة.</div>
          <button type="button" className="universal-preview__sendButton">إرسال</button>
        </div>
      </div>
    </div>
  );
}
