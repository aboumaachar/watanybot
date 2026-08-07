
// ADDRESS_NETWORK_CANONICAL_ADDRESS_WIDGET_MIGRATION_REVIEWED
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { CalendarCancel24Regular, CalendarCheckmark24Regular, NumberSymbol24Regular } from "../theme/watany-v4/legacyIconBridge";
import UtilityHeaderTitleRow from "../components/UtilityHeaderTitleRow";
import { armyVolunteeringCategories, armyVolunteeringSource } from "../features/army-volunteering/armyVolunteering.data";
import { api } from "../lib/api";
import { DEFAULT_APPARATUS_ORIGINS, normalizeApparatusName, resolveApparatusIcon } from "../lib/apparatusIcons";
import { useApp } from "../store/app";
import type { RecruitmentAnnouncement } from "../types/domain";
// APEX_CSS_FREEZE_DISABLED_IMPORT import "../styles/jobs.css";

type SectionMode = "announcements" | "conditions" | "results";
type DetailTab = "process" | "results" | "final";

type RecruitmentOverviewViewProps = Readonly<{
  visibleAnnouncements: RecruitmentAnnouncement[];
  resultHighlights: Array<{ id: string; title: string; status: string }>;
  apparatusCounts: Record<string, number>;
  sectionMode: SectionMode;
  setSectionMode: (mode: SectionMode) => void;
  query: string;
  setQuery: (value: string) => void;
  apparatusFilter: string;
  setApparatusFilter: (value: string) => void;
  error: string | null;
  loading: boolean;
  onSelectAnnouncement: (id: string) => void;
}>;

type ResultHighlight = { id: string; title: string; status: string };

type RecruitmentLauncherContentProps = Readonly<{
  sectionMode: SectionMode;
  resultHighlights: ResultHighlight[];
}>;

type RecruitmentAnnouncementsSectionProps = Readonly<{
  visibleAnnouncements: RecruitmentAnnouncement[];
  apparatusCounts: Record<string, number>;
  query: string;
  setQuery: (value: string) => void;
  apparatusFilter: string;
  setApparatusFilter: (value: string) => void;
  error: string | null;
  loading: boolean;
  onSelectAnnouncement: (id: string) => void;
}>;

const SECTION_MODE_ITEMS: ReadonlyArray<{ id: SectionMode; label: string; icon: string }> = [
  { id: "announcements", label: "الدورات", icon: "📣" },
  { id: "conditions", label: "الشروط", icon: "📜" },
  { id: "results", label: "النتائج", icon: "✅" },
];

function parseTimestamp(value?: string): number | null {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.getTime();
}

function compareAnnouncements(left: RecruitmentAnnouncement, right: RecruitmentAnnouncement): number {
  const leftTs = parseTimestamp(left.startDate) ?? parseTimestamp(left.updatedAt) ?? parseTimestamp(left.createdAt) ?? 0;
  const rightTs = parseTimestamp(right.startDate) ?? parseTimestamp(right.updatedAt) ?? parseTimestamp(right.createdAt) ?? 0;
  return rightTs - leftTs || right.updatedAt.localeCompare(left.updatedAt);
}

function getEffectiveStatus(announcement: RecruitmentAnnouncement): RecruitmentAnnouncement["status"] {
  if (announcement.status === "cancelled" || announcement.status === "draft") {
    return announcement.status;
  }

  const deadlineTs = parseTimestamp(announcement.endDate);
  if (deadlineTs !== null && deadlineTs < Date.now()) {
    return "expired";
  }

  return announcement.status;
}

function getStatusLabel(announcement: RecruitmentAnnouncement): string {
  switch (getEffectiveStatus(announcement)) {
    case "published":
      return "مفتوح حالياً";
    case "expired":
      return "منتهٍ";
    case "cancelled":
      return "ملغى";
    case "draft":
      return "مسودة غير منشورة";
    default:
      return announcement.status;
  }
}

function formatDate(value?: string): string {
  if (!value) return "غير محدد";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat("ar-LB", { dateStyle: "medium" }).format(parsed);
}

function isClosingSoon(announcement: RecruitmentAnnouncement): boolean {
  const deadlineTs = parseTimestamp(announcement.endDate);
  if (deadlineTs === null) return false;
  const diff = deadlineTs - Date.now();
  return diff > 0 && diff <= 7 * 86_400_000;
}

function hasSourceEvidence(announcement: RecruitmentAnnouncement): boolean {
  return Boolean(
    announcement.sourceUrl?.trim()
    || announcement.sourceName?.trim()
    || announcement.notes?.trim(),
  );
}

function announcementMatchesQuery(announcement: RecruitmentAnnouncement, query: string): boolean {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return true;

  const haystack = [
    announcement.title,
    announcement.apparatusName,
    announcement.announcementNumber,
    announcement.applicationLocation,
    announcement.applicationMethod,
    announcement.sourceName,
    announcement.notes,
    ...announcement.conditions,
    ...announcement.requiredDocuments,
    ...announcement.eligibleCategories,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return haystack.includes(normalizedQuery);
}

function statusBadgeClass(announcement: RecruitmentAnnouncement): string {
  switch (getEffectiveStatus(announcement)) {
    case "published":
      return "jobs-badge jobs-badge--veteran";
    case "expired":
      return "jobs-badge jobs-badge--featured";
    case "cancelled":
      return "jobs-badge jobs-badge--urgent";
    default:
      return "jobs-badge jobs-badge--featured";
  }
}

function getExamResultSummary(announcement: RecruitmentAnnouncement): string {
  const status = getEffectiveStatus(announcement);
  if (status === "published") {
    return "الامتحانات قيد المتابعة ولم تصدر النتائج الرسمية بعد.";
  }
  if (status === "expired") {
    return "انتهت فترة التقديم ويمكن مراجعة الجهة الرسمية لنتائج الامتحانات.";
  }
  if (status === "cancelled") {
    return "تم إلغاء هذه المباراة، ولا توجد نتائج امتحانات معتمدة.";
  }
  return "الحالة حالياً مسودة، ولم تبدأ مرحلة النتائج.";
}

function getFinalApprovalSummary(announcement: RecruitmentAnnouncement): string {
  const status = getEffectiveStatus(announcement);
  if (status === "published") {
    return "القبول النهائي قيد التحضير بانتظار استكمال المراحل الرسمية.";
  }
  if (status === "expired") {
    return "يمكن متابعة نتيجة القبول النهائي عبر الجهة الرسمية المعلنة.";
  }
  if (status === "cancelled") {
    return "لا توجد نتيجة قبول نهائية لأن الإعلان أُلغي.";
  }
  return "لا توجد موافقة نهائية منشورة بعد.";
}

function AnnouncementCard({
  announcement,
  onOpen,
}: Readonly<{
  announcement: RecruitmentAnnouncement;
  onOpen: () => void;
}>) {
  return (
    <button
      type="button"
      className="jobs-card jobs-card--interactive"
      onClick={onOpen}
    >
      <div className="jobs-card__header">
        <span className={statusBadgeClass(announcement)}>{getStatusLabel(announcement)}</span>
        {isClosingSoon(announcement) ? <span className="jobs-badge jobs-badge--urgent">ينتهي قريباً</span> : null}
      </div>

      <div className="jobs-card__title-row">
        <div>
          <h4>{announcement.title}</h4>
          <div className="jobs-card__employer">{announcement.apparatusName}</div>
        </div>
      </div>

      <div className="jobs-card__meta">
        {announcement.announcementNumber ? (
          <span>
            <NumberSymbol24Regular aria-hidden />
            <span>{announcement.announcementNumber}</span>
          </span>
        ) : null}
        <span>
          <CalendarCheckmark24Regular aria-hidden />
          <span>{formatDate(announcement.startDate || announcement.createdAt)}</span>
        </span>
        <span>
          <CalendarCancel24Regular aria-hidden />
          <span>{formatDate(announcement.endDate)}</span>
        </span>
      </div>
    </button>
  );
}

function filterAnnouncements(
  announcements: RecruitmentAnnouncement[],
  query: string,
  apparatusFilter: string,
): RecruitmentAnnouncement[] {
  return announcements.filter((announcement) => {
    if (!announcementMatchesQuery(announcement, query)) return false;
    if (
      apparatusFilter !== "all"
      && normalizeApparatusName(announcement.apparatusName) !== normalizeApparatusName(apparatusFilter)
    ) return false;
    return true;
  });
}

function buildApparatusCounts(announcements: RecruitmentAnnouncement[]): Record<string, number> {
  return DEFAULT_APPARATUS_ORIGINS.reduce<Record<string, number>>((counts, label) => {
    counts[label] = announcements.filter((item) => normalizeApparatusName(item.apparatusName) === normalizeApparatusName(label)).length;
    return counts;
  }, {});
}

function buildResultHighlights(announcements: RecruitmentAnnouncement[]): Array<{ id: string; title: string; status: string }> {
  return [...announcements]
    .sort(compareAnnouncements)
    .slice(0, 5)
    .map((item) => ({ id: item.id, title: item.title, status: getStatusLabel(item) }));
}

function DetailView({
  announcement,
  onBack,
}: Readonly<{
  announcement: RecruitmentAnnouncement;
  onBack: () => void;
}>) {
  const [activeTab, setActiveTab] = useState<DetailTab>("process");
  const sourceVerified = hasSourceEvidence(announcement);
  const processStart = formatDate(announcement.startDate || announcement.createdAt);
  const examWindow = formatDate(announcement.endDate);

  return (
    <div className="jobs-detail">
      <button type="button" className="jobs-detail__back" onClick={onBack}>رجوع إلى الأرشيف</button>

      <div className="jobs-card">
        <div className="jobs-detail__header">
          <span className={statusBadgeClass(announcement)}>{getStatusLabel(announcement)}</span>
          {sourceVerified ? <span className="jobs-badge jobs-badge--featured">مصدر موثّق</span> : null}
        </div>

        <h3>{announcement.title}</h3>
        <div className="jobs-detail__employer-name">{announcement.apparatusName}</div>

        <div className="jobs-detail__grid">
          <div className="jobs-detail__cell">
            <strong>بدء التقديم</strong>
            {processStart}
          </div>
          <div className="jobs-detail__cell">
            <strong>نتائج الامتحان</strong>
            {examWindow}
          </div>
          <div className="jobs-detail__cell">
            <strong>مكان التقديم</strong>
            {announcement.applicationLocation || "بحسب نص الإعلان الرسمي"}
          </div>
          <div className="jobs-detail__cell">
            <strong>طريقة التقديم</strong>
            {announcement.applicationMethod || "تُراجع الجهة المعنية"}
          </div>
        </div>

        <div className="jobs-detail-tabs" role="tablist" aria-label="تفاصيل الإعلان">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "process"}
            className={`jobs-detail-tab${activeTab === "process" ? " is-active" : ""}`}
            onClick={() => setActiveTab("process")}
          >
            <span className="jobs-detail-tab__icon" aria-hidden>🧭</span>
            <span className="jobs-detail-tab__label">صفحة العملية</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "results"}
            className={`jobs-detail-tab${activeTab === "results" ? " is-active" : ""}`}
            onClick={() => setActiveTab("results")}
          >
            <span className="jobs-detail-tab__icon" aria-hidden>📝</span>
            <span className="jobs-detail-tab__label">صفحة نتائج الامتحان</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "final"}
            className={`jobs-detail-tab${activeTab === "final" ? " is-active" : ""}`}
            onClick={() => setActiveTab("final")}
          >
            <span className="jobs-detail-tab__icon" aria-hidden>🏁</span>
            <span className="jobs-detail-tab__label">صفحة القبول النهائي</span>
          </button>
        </div>

        {activeTab === "process" ? (
          <section className="jobs-process-panel">
            <h4>خطوات العملية</h4>
            <ul>
              <li>بدء استقبال الطلبات: {processStart}</li>
              <li>طريقة التقديم: {announcement.applicationMethod || "بحسب تعليمات الجهة"}</li>
              <li>مكان التقديم: {announcement.applicationLocation || "يُراجع الإعلان الرسمي"}</li>
            </ul>
          </section>
        ) : null}

        {activeTab === "results" ? (
          <section className="jobs-process-panel">
            <h4>نتائج الامتحان</h4>
            <p>{getExamResultSummary(announcement)}</p>
            <p>آخر موعد مرتبط بالإعلان: {examWindow}</p>
          </section>
        ) : null}

        {activeTab === "final" ? (
          <section className="jobs-process-panel">
            <h4>نتيجة القبول النهائي</h4>
            <p>{getFinalApprovalSummary(announcement)}</p>
            <p>الحالة الحالية: {getStatusLabel(announcement)}</p>
          </section>
        ) : null}

        {announcement.conditions.length > 0 ? (
          <section>
            <h4>شروط التطوع</h4>
            <ul>{announcement.conditions.map((item) => <li key={item}>{item}</li>)}</ul>
          </section>
        ) : null}

        {announcement.requiredDocuments.length > 0 ? (
          <section>
            <h4>المستندات المطلوبة</h4>
            <ul>{announcement.requiredDocuments.map((item) => <li key={item}>{item}</li>)}</ul>
          </section>
        ) : null}

        <div className="jobs-detail__actions">
          <button type="button" className="jobs-btn" onClick={onBack}>العودة إلى الإعلانات</button>
        </div>
      </div>
    </div>
  );
}

function RecruitmentOverviewView({
  visibleAnnouncements,
  resultHighlights,
  apparatusCounts,
  sectionMode,
  setSectionMode,
  query,
  setQuery,
  apparatusFilter,
  setApparatusFilter,
  error,
  loading,
  onSelectAnnouncement,
}: RecruitmentOverviewViewProps) {
  return (
    <>
      <div className="utility-header">
        <UtilityHeaderTitleRow
          titleClassName="utility-title"
          title="التطويع"
          infoText="إعلانات التطويع الرسمية فقط، ومنفصلة عن الوظائف المدنية."
          infoLabel="حول قسم التطويع"
        />
      </div>

      <section className="jobs-card jobs-card--static" aria-label="لوحة التطوع">
        <div className="jobs-launcher-icons">
          {SECTION_MODE_ITEMS.map((item) => (
            <button
              key={item.id}
              data-feature-key={item.id}
              type="button"
              className={`jobs-launcher-icon${sectionMode === item.id ? " is-active" : ""}`}
              onClick={() => setSectionMode(item.id)}
            >
              <span className="jobs-launcher-icon__glyph" aria-hidden>{item.icon}</span>
              <span>{item.label}</span>
            </button>
          ))}
        </div>

        {sectionMode === "announcements" ? (
          <p className="jobs-launcher-note">اختر جهازاً أمنياً من الشريط الثابت لفلترة الإعلانات.</p>
        ) : null}

        <RecruitmentLauncherContent sectionMode={sectionMode} resultHighlights={resultHighlights} />
      </section>

      {sectionMode === "announcements" ? (
        <RecruitmentAnnouncementsSection
          visibleAnnouncements={visibleAnnouncements}
          apparatusCounts={apparatusCounts}
          query={query}
          setQuery={setQuery}
          apparatusFilter={apparatusFilter}
          setApparatusFilter={setApparatusFilter}
          error={error}
          loading={loading}
          onSelectAnnouncement={onSelectAnnouncement}
        />
      ) : null}

      {sectionMode === "results" && !loading && !error && resultHighlights.length === 0 ? (
        <div className="jobs-empty">
          <p>no records found</p>
        </div>
      ) : null}
    </>
  );
}

function RecruitmentLauncherContent({ sectionMode, resultHighlights }: RecruitmentLauncherContentProps) {
  if (sectionMode === "conditions") {
    return (
      <>
        <div className="jobs-launcher-tags" aria-label="فئات شروط التطوع">
          {armyVolunteeringCategories.map((category) => (
            <span key={category.id} className="jobs-badge jobs-badge--featured">{category.titleAr}</span>
          ))}
        </div>

        <div className="jobs-detail__actions">
          <Link className="jobs-btn jobs-btn--primary" to={armyVolunteeringSource.route}>فتح دليل الشروط داخل موطني</Link>
        </div>
      </>
    );
  }

  if (sectionMode === "results") {
    return (
      <div className="jobs-launcher-results" aria-label="نتائج مختصرة">
        {resultHighlights.length > 0 ? resultHighlights.map((item) => (
          <div key={item.id} className="jobs-launcher-results__item">
            <strong>{item.title}</strong>
            <span>{item.status}</span>
          </div>
        )) : <p>no records found</p>}
      </div>
    );
  }

  return null;
}

function RecruitmentAnnouncementsSection({
  visibleAnnouncements,
  apparatusCounts,
  query,
  setQuery,
  apparatusFilter,
  setApparatusFilter,
  error,
  loading,
  onSelectAnnouncement,
}: RecruitmentAnnouncementsSectionProps) {
  return (
    <>
      <div className="jobs-search">
        <input className="jobs-search__input" placeholder="ابحث بالجهة أو رقم الإعلان أو نص الشرط..." value={query} onChange={(event) => setQuery(event.target.value)} />
      </div>

      <div className="jobs-apparatus-sticky wc-feature-rail" aria-label="تصفية الإعلانات حسب الجهاز">
        {DEFAULT_APPARATUS_ORIGINS.map((label) => {
          const isActive = apparatusFilter !== "all" && normalizeApparatusName(apparatusFilter) === normalizeApparatusName(label);
          const logo = resolveApparatusIcon(label);
          return (
            <button
              key={label}
              type="button"
              className={`jobs-apparatus-icon${isActive ? " is-active" : ""}`}
              onClick={() => setApparatusFilter(isActive ? "all" : label)}
            >
              <span className="jobs-apparatus-icon__glyph" aria-hidden>
                {logo ? <img src={logo.src} alt={logo.alt} loading="lazy" /> : "🏛"}
              </span>
              <span className="jobs-apparatus-icon__label">{label}</span>
              <em className="jobs-apparatus-icon__count">{apparatusCounts[label] ?? 0}</em>
            </button>
          );
        })}
      </div>

      {error ? <div className="jobs-empty"><p>{error}</p></div> : null}
      {loading ? <div className="jobs-stats">جارٍ تحميل الإعلانات...</div> : null}

      {error ? null : (
        <div className="jobs-list">
          {visibleAnnouncements.map((announcement) => (
            <AnnouncementCard key={announcement.id} announcement={announcement} onOpen={() => onSelectAnnouncement(announcement.id)} />
          ))}
        </div>
      )}

      {loading || error || visibleAnnouncements.length > 0 ? null : (
        <div className="jobs-empty">
          <p>no records found</p>
        </div>
      )}
    </>
  );
}

export default function RecruitmentPage() {
  const { apiBaseUrl } = useApp();
  const [announcements, setAnnouncements] = useState<RecruitmentAnnouncement[]>([]);
  const [sectionMode, setSectionMode] = useState<SectionMode>("announcements");
  const [query, setQuery] = useState("");
  const [apparatusFilter, setApparatusFilter] = useState("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    async function loadAnnouncements() {
      setLoading(true);
      setError(null);
      try {
        const items = await api.getRecruitmentAnnouncements(apiBaseUrl);
        if (!active) return;
        setAnnouncements([...items].sort(compareAnnouncements));
      } catch (nextError) {
        if (!active) return;
        setError(nextError instanceof Error ? nextError.message : "تعذر تحميل إعلانات التطوع");
      } finally {
        if (active) setLoading(false);
      }
    }
    void loadAnnouncements();
    return () => {
      active = false;
    };
  }, [apiBaseUrl]);

  const visibleAnnouncements = useMemo(() => filterAnnouncements(announcements, query, apparatusFilter), [announcements, query, apparatusFilter]);
  const apparatusCounts = useMemo(() => buildApparatusCounts(announcements), [announcements]);
  const resultHighlights = useMemo(() => buildResultHighlights(announcements), [announcements]);

  const selectedAnnouncement = selectedId ? announcements.find((item) => item.id === selectedId) ?? null : null;

  if (selectedAnnouncement) {
    return (
      <div className="jobs-page">
        <DetailView announcement={selectedAnnouncement} onBack={() => setSelectedId(null)} />
      </div>
    );
  }

  return (
    <div className="jobs-page">
      <RecruitmentOverviewView
        visibleAnnouncements={visibleAnnouncements}
        resultHighlights={resultHighlights}
        apparatusCounts={apparatusCounts}
        sectionMode={sectionMode}
        setSectionMode={setSectionMode}
        query={query}
        setQuery={setQuery}
        apparatusFilter={apparatusFilter}
        setApparatusFilter={setApparatusFilter}
        error={error}
        loading={loading}
        onSelectAnnouncement={setSelectedId}
      />
    </div>
  );
}


