import { useEffect, useMemo, useState } from "react";
import { useApp } from "../../store/app";
import { normalizeSearchableArabicInput } from "../../lib/lang";

type DirectoryEntry = {
  id?: string;
  name: string;
  phones?: string[];
  phone?: string;
  note?: string;
  category?: string;
  subCategory?: string;
  source?: string;
  sourceReliability?: string;
  priority?: number;
};

type DirectoryCategory = {
  id: string;
  label: string;
  hint: string;
};

type Props = Readonly<{
  onDone: () => void;
  initialCategory?: string;
}>;

const DIRECTORY_CATEGORIES: DirectoryCategory[] = [
  { id: "hospitals", label: "مستشفيات", hint: "المستشفيات والمراكز الطبية" },
  { id: "emergency", label: "أرقام طوارئ", hint: "أرقام الإسعاف والحماية" },
  { id: "official", label: "إدارات رسمية", hint: "جهات حكومية ورسمية" },
  { id: "military", label: "طبابة عسكرية", hint: "الطبابة والخدمات العسكرية" },
  { id: "banks", label: "مصارف / دفع معاشات", hint: "البنوك وخدمات الدفع" },
  { id: "pension", label: "تقاعد ومعاشات", hint: "جهات التقاعد وصرف المعاش" },
  { id: "review", label: "مراكز المراجعة", hint: "دوائر ومراكز متابعة المعاملات" },
  { id: "funds", label: "صندوق / تعاضد", hint: "الصناديق والتعاضد" },
  { id: "other", label: "أخرى", hint: "أرقام ومؤسسات إضافية" },
];

const STARTER: DirectoryEntry[] = [
  { id: "hospitals-1", name: "المستشفى العسكري", phones: ["01-820000"], category: "hospitals", subCategory: "مستشفيات لبنانية", source: "user_provided_hospital_list", sourceReliability: "user_provided_unverified" },
  { id: "hospital-jabal-lubnan", name: "مستشفى جبل لبنان", phones: ["05-957000", "05-955855", "05-955446"], category: "hospitals", subCategory: "مستشفيات لبنانية", source: "user_provided_hospital_list", sourceReliability: "user_provided_unverified" },
  { id: "hospital-aubmc", name: "مستشفى الجامعة الأميركية في بيروت", phones: ["01-350000"], category: "hospitals", subCategory: "مستشفيات لبنانية", source: "user_provided_hospital_list", sourceReliability: "user_provided_unverified" },
  { id: "hospital-roum", name: "مستشفى الروم الجامعي", phones: ["01-614400"], category: "hospitals", subCategory: "مستشفيات لبنانية", source: "user_provided_hospital_list", sourceReliability: "user_provided_unverified" },
  { id: "hospital-mashreq", name: "مستشفى المشرق", phones: ["01-653000"], category: "hospitals", subCategory: "مستشفيات لبنانية", source: "user_provided_hospital_list", sourceReliability: "user_provided_unverified" },
  { id: "hospital-anfal", name: "مستشفى سيدة المعونات", phones: ["01-478300"], category: "hospitals", subCategory: "مستشفيات لبنانية", source: "user_provided_hospital_list", sourceReliability: "user_provided_unverified" },
  { id: "hospital-beirut-gov", name: "مستشفى بيروت الحكومي", phones: ["01-612600"], category: "hospitals", subCategory: "مستشفيات لبنانية", source: "user_provided_hospital_list", sourceReliability: "user_provided_unverified" },
  { id: "hospital-st-georges", name: "مستشفى القديس جورج", phones: ["01-339000"], category: "hospitals", subCategory: "مستشفيات لبنانية", source: "user_provided_hospital_list", sourceReliability: "user_provided_unverified" },
  {
    id: "bank-byblos",
    name: "بنك بيبلوس",
    phones: ["1650", "01-205050"],
    note: "خدمة الزبائن للمصرف والخدمات الرقمية.",
    category: "banks",
    subCategory: "مصارف لبنانية",
    source: "byblos_bank_homepage_help_section",
    sourceReliability: "official_site_footer",
    priority: 10,
  },
  {
    id: "bank-credit-libanais",
    name: "كريدي ليبانيه",
    phones: ["1518", "01-607100", "01-608282"],
    note: "خدمة الزبائن ودعم البطاقات.",
    category: "banks",
    subCategory: "مصارف لبنانية",
    source: "credit_libanais_contact_page",
    sourceReliability: "official_site_contact",
    priority: 20,
  },
  {
    id: "bank-sgbl",
    name: "SGBL",
    phones: ["1274", "03-477777"],
    note: "قناة Talk to Us وخدمات الدفع الرقمية.",
    category: "banks",
    subCategory: "مصارف لبنانية",
    source: "sgbl_homepage_help_section",
    sourceReliability: "official_site_footer",
    priority: 30,
  },
  {
    id: "bank-blc",
    name: "BLC Bank",
    phones: ["1510"],
    note: "الخط الساخن للمصرف.",
    category: "banks",
    subCategory: "مصارف لبنانية",
    source: "blc_bank_homepage_header",
    sourceReliability: "official_site_header",
    priority: 40,
  },
  {
    id: "payment-omt",
    name: "OMT",
    phones: ["01-391000"],
    note: "خدمة الزبائن للتحويلات والمدفوعات.",
    category: "banks",
    subCategory: "مزودو دفع وتحويل",
    source: "omt_headquarters_contact_page",
    sourceReliability: "official_site_contact",
    priority: 50,
  },
  {
    id: "payment-libanpost",
    name: "LibanPost",
    phones: ["1577", "01-629628"],
    note: "خدمة الزبائن للمدفوعات والتحصيل.",
    category: "banks",
    subCategory: "مزودو دفع وتحصيل",
    source: "libanpost_tools_support_contact_page",
    sourceReliability: "official_site_contact",
    priority: 60,
  },
  {
    id: "payment-bdl",
    name: "مصرف لبنان - دائرة أنظمة المدفوعات",
    phones: ["01-750420", "01-750000"],
    note: "الدفع الرسمي والتحويلات؛ الرقم الثاني هو بدالة المركز.",
    category: "banks",
    subCategory: "جهات تنظيمية ودفع",
    source: "banque_du_liban_contact_page",
    sourceReliability: "official_site_contact",
    priority: 70,
  },
  { id: "pension-1", name: "دائرة التقاعد", phones: ["01-612200"], category: "pension" },
  { id: "veterans-affairs", name: "مديرية شؤون المحاربين القدامى", phones: ["01-612000"], category: "official" },
  { id: "hotline-1", name: "الخط الساخن", phones: ["1515"], category: "emergency" },
  { id: "emergency-1", name: "الطوارئ", phones: ["112"], category: "emergency" },
  { id: "ambulance-1", name: "الإسعاف اللبناني", phones: ["140"], category: "emergency" },
  { id: "fire-1", name: "الدفاع المدني", phones: ["175"], category: "emergency" },
  { id: "review-1", name: "مديرية شؤون الأفراد", phones: ["01-612100"], category: "review", note: "مراجعة المعاملات العسكرية" },
  { id: "review-2", name: "مركز مراجعة المتقاعدين", phones: ["01-612150"], category: "review", note: "خدمات المتقاعدين وذويهم" },
  { id: "review-3", name: "قسم متابعة الطلبات", phones: ["01-612120"], category: "review", note: "متابعة حالة المعاملة واستفسارات" },
];

function sortDirectoryEntries(items: DirectoryEntry[]) {
  return [...items].sort((left, right) => {
    const priorityDelta = (left.priority ?? 999) - (right.priority ?? 999);
    if (priorityDelta !== 0) return priorityDelta;
    return left.name.localeCompare(right.name, "ar");
  });
}

function getStarterEntries(category?: string | null, query?: string) {
  const normalizedQuery = query ? normalizeSearchableArabicInput(query) : "";
  return sortDirectoryEntries(
    STARTER.filter((entry) => {
      if (category && entry.category !== category) return false;
      if (!normalizedQuery) return true;

      const haystack = normalizeSearchableArabicInput([
        entry.name,
        entry.phone || "",
        ...(entry.phones || []),
        entry.note || "",
        entry.subCategory || "",
      ].join(" "));

      return haystack.includes(normalizedQuery);
    }),
  );
}

export function DirectorySheet({ onDone, initialCategory }: Props) {
  const { apiBaseUrl } = useApp();
  const [q, setQ] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(initialCategory ?? null);
  const [items, setItems] = useState<DirectoryEntry[]>(() => getStarterEntries(initialCategory));
  const [loading, setLoading] = useState(false);
  const [hint, setHint] = useState("");

  // Sync when the sheet is opened with a different initialCategory (e.g. deep-link from a tile)
  useEffect(() => {
    setSelectedCategory(initialCategory ?? null);
    setQ("");
    setHint("");
    setItems(getStarterEntries(initialCategory));
  }, [initialCategory]);

  const debounced = useMemo(() => normalizeSearchableArabicInput(q), [q]);

  useEffect(() => {
    let alive = true;
    async function tryFetch(url: string) {
      const res = await fetch(url, { method: "GET" });
      if (!res.ok) throw new Error("bad");
      return await res.json();
    }

    async function load() {
      const query = debounced;
      const categoryLabel = selectedCategory
        ? DIRECTORY_CATEGORIES.find((cat) => cat.id === selectedCategory)?.label || selectedCategory
        : "";
      const categoryTerm = selectedCategory ? ` ${categoryLabel}` : "";

      if (!query && selectedCategory) {
        setLoading(true);
        setHint("");
        const candidates = [
          `${apiBaseUrl}/api/v2/directory/search?q=${encodeURIComponent(categoryLabel)}`,
          `${apiBaseUrl}/api/directory/search?q=${encodeURIComponent(categoryLabel)}`,
          `${apiBaseUrl}/api/v2/contacts/search?q=${encodeURIComponent(categoryLabel)}`,
          `${apiBaseUrl}/api/contacts/search?q=${encodeURIComponent(categoryLabel)}`,
        ];

        for (const url of candidates) {
          try {
            const data = await tryFetch(url);
            const arr = (data?.results ?? data?.items ?? data?.entries ?? data) as any[];
            if (!alive) return;
            if (Array.isArray(arr) && arr.length) {
              const mapped = arr
                .map((x) => {
                  const name = String(x.name ?? x.title ?? x.entity ?? x.department ?? "");
                  const phone = x.phone ? String(x.phone) : undefined;
                  const fallbackPhone = x.number ? String(x.number) : undefined;
                  const note = x.note ? String(x.note) : undefined;
                  const fallbackNote = x.role ? String(x.role) : undefined;
                  const source = x.source ? String(x.source) : undefined;
                  const sourceReliability = x.sourceReliability ? String(x.sourceReliability) : undefined;
                  const subCategory = x.subCategory ? String(x.subCategory) : undefined;
                  const id = x.id ? String(x.id) : undefined;

                  return {
                    category: selectedCategory,
                    id,
                    name,
                    phone: phone || fallbackPhone,
                    note: note || fallbackNote,
                    source,
                    sourceReliability,
                    subCategory,
                  };
                })
                .filter((e) => e.name);
              if (mapped.length) {
                setItems(mapped);
                setLoading(false);
                return;
              }
            }
          } catch {
            // try next
          }
        }

        const local = getStarterEntries(selectedCategory);
        setItems(local.length ? local : []);
        setHint(local.length ? "" : "لا توجد أرقام مسجلة ضمن هذا التصنيف بعد.");
        setLoading(false);
        return;
      }

      if (!query) {
        setItems([]);
        setHint("");
        return;
      }

      setLoading(true);
      setHint("");
      const candidates = [
        `${apiBaseUrl}/api/v2/directory/search?q=${encodeURIComponent(query + categoryTerm)}`,
        `${apiBaseUrl}/api/directory/search?q=${encodeURIComponent(query + categoryTerm)}`,
        `${apiBaseUrl}/api/v2/contacts/search?q=${encodeURIComponent(query + categoryTerm)}`,
        `${apiBaseUrl}/api/contacts/search?q=${encodeURIComponent(query + categoryTerm)}`,
      ];

      for (const url of candidates) {
        try {
          const data = await tryFetch(url);
          const arr = (data?.results ?? data?.items ?? data?.entries ?? data) as any[];
          if (!alive) return;
          if (Array.isArray(arr)) {
            const mapped = arr
              .map((x) => {
                const name = String(x.name ?? x.title ?? x.entity ?? x.department ?? "");
                const phone = x.phone ? String(x.phone) : undefined;
                const fallbackPhone = x.number ? String(x.number) : undefined;
                const note = x.note ? String(x.note) : undefined;
                const fallbackNote = x.role ? String(x.role) : undefined;
                const source = x.source ? String(x.source) : undefined;
                const sourceReliability = x.sourceReliability ? String(x.sourceReliability) : undefined;
                const subCategory = x.subCategory ? String(x.subCategory) : undefined;
                const id = x.id ? String(x.id) : undefined;

                return {
                  ...((selectedCategory && { category: selectedCategory }) || {}),
                  id,
                  name,
                  phone: phone || fallbackPhone,
                  note: note || fallbackNote,
                  source,
                  sourceReliability,
                  subCategory,
                };
              })
              .filter((e) => e.name);
            if (mapped.length) {
              setItems(mapped);
              setLoading(false);
              return;
            }
          }
        } catch {
          // try next
        }
      }

      const local = getStarterEntries(selectedCategory, query);
      setItems(local.length ? local : []);
      setHint(local.length ? "" : "ما لقيت نتيجة مباشرة… جرّب تكتب اسم الدائرة أو الرقم.");
      setLoading(false);
    }

    const t = setTimeout(load, 250);
    return () => {
      alive = false;
      clearTimeout(t as any);
    };
  }, [apiBaseUrl, debounced, selectedCategory]);

  return (
    <div className="wt-sheet">
      <div className="wt-sheet__row">
        <input
          className="wt-input wt-input--sheet"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={selectedCategory ? `ابحث في ${DIRECTORY_CATEGORIES.find((cat) => cat.id === selectedCategory)?.label || "التصنيف"}` : "دوّر على تصنيف أو رقم (مثلاً: مستشفى / 112)"}
        />
        <button className="wt-btn wt-btn--ghost" type="button" onClick={onDone}>
          إلغاء
        </button>
      </div>

      {selectedCategory ? (
        <div className="wt-sheet__row wt-sheet__row--header">
          <div>
            <h2>{DIRECTORY_CATEGORIES.find((cat) => cat.id === selectedCategory)?.label}</h2>
            <p className="wt-sheet__subtitle">ابحث باسم الجهة أو الرقم داخل هذا التصنيف</p>
          </div>
          <button className="wt-btn wt-btn--ghost" type="button" onClick={() => { setSelectedCategory(null); setItems([]); setHint(""); setQ(""); }}>
            رجوع إلى التصنيفات
          </button>
        </div>
      ) : null}

      {loading ? <div className="wt-muted">عم دوّر…</div> : null}
      {hint ? <div className="wt-hint">{hint}</div> : null}

      {!selectedCategory ? (
        <div className="directory-category-grid">
          {DIRECTORY_CATEGORIES.map((category) => (
            <button
              type="button"
              key={category.id}
              data-feature-key={category.id}
              className="wt-card wt-card--clickable"
              onClick={() => {
                setSelectedCategory(category.id);
                setItems(getStarterEntries(category.id));
                setHint("");
              }}
            >
              <div>
                <h3>{category.label}</h3>
                <p>{category.hint}</p>
              </div>
              <span className="wt-chip wt-chip--muted">فتح</span>
            </button>
          ))}
        </div>
      ) : (
        <div className="wt-list">
          {items.map((e) => (
            <div className="wt-list__item" key={`${e.id ?? e.name}-${e.phone || "no-phone"}`}>
              <div className="wt-list__main">
                <div className="wt-list__title">{e.name}</div>
                {e.note ? <div className="wt-list__sub">{e.note}</div> : null}
                {e.subCategory ? (
                  <div className="wt-list__sub">{e.subCategory}</div>
                ) : null}
              </div>
              {((e.phones?.length ?? 0) > 0 || e.phone) ? (
                <div className="wt-list__actions">
                  <a
                    className="wt-chip"
                    href={`tel:${((e.phones && e.phones[0]) || e.phone || "").split(/\s+/).join("")}`}
                  >
                    {((e.phones && e.phones[0]) || e.phone)}
                  </a>
                  <button
                    className="wt-chip wt-chip--ghost"
                    type="button"
                    onClick={() => {
                      const text = (e.phones && e.phones.join(", ")) || e.phone || "";
                      globalThis.navigator.clipboard?.writeText(text);
                    }}
                  >
                    نسخ
                  </button>
                </div>
              ) : (
                <span className="wt-chip wt-chip--muted">غير متوفر</span>
              )}
            </div>
          ))}
          {items.length === 0 && !loading ? <div className="wt-list__empty">لا توجد نتائج لهذا البحث.</div> : null}
        </div>
      )}
    </div>
  );
}
