import { type CSSProperties, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { WatanyLandingBodyTemplate } from "../../components/template";
import { LebanonAddressSelector } from "../../components/address/LebanonAddressSelector";
import type { LebanonAddressValue } from "../../components/address/addressTypes";
import { api } from "../../lib/api";
import { listSavedJobs, saveJob, unsaveJob } from "../../lib/jobs-api";
import { useApp } from "../../store/app";
import type { JobVacancy } from "../../types/domain";
import { isLoginRequiredError, LOGIN_REQUIRED_GATE_MESSAGE_AR } from "../../lib/login-required";
// APEX_CSS_FREEZE_DISABLED_IMPORT import "./market-jobs-mobile-landing.css";

export type LandingNavItem = {
  icon: string;
  label: string;
  href: string;
};

export type LandingShortcut = {
  icon: string;
  label: string;
  description: string;
  href: string;
};

export type LandingFilter = {
  icon: string;
  label: string;
  value: string;
};

export type LandingSectionItem = {
  title: string;
  meta: string;
  badge: string;
  href?: string;
};

export type LandingSection = {
  title: string;
  actionLabel: string;
  actionHref: string;
  items: LandingSectionItem[];
};

export type MarketCategoryRail = {
  id: string;
  icon: string;
  title: string;
  description: string;
  actionLabel: string;
  actionHref: string;
  items: LandingSectionItem[];
};

export type FeaturedJobListing = {
  title: string;
  company: string;
  location: string;
  summary: string;
  badge: string;
  href: string;
};

export type LandingConfig = {
  id: "market" | "jobs";
  title: string;
  eyebrow: string;
  subtitle: string;
  navLabel: string;
  searchLabel: string;
  searchPlaceholder: string;
  primaryActionLabel: string;
  primaryActionHref: string;
  secondaryActionLabel: string;
  secondaryActionHref: string;
  navItems: LandingNavItem[];
  shortcuts: LandingShortcut[];
  categories: LandingShortcut[];
  filters: LandingFilter[];
  statusCards: LandingShortcut[];
  sections: LandingSection[];
  categoryRails?: MarketCategoryRail[];
  featuredListings?: FeaturedJobListing[];
};


const JOBS_USER_ID = "jobs-mobile-local-user";
const JOBS_CV_STORAGE_KEY = "watany.jobs.cv.upload.v1";
const EMPTY_ADDRESS: LebanonAddressValue = {
  mohafaza: "",
  qaza: "",
  village: "",
  exactAddress: "",
  displayAddress: "",
  source: "manual",
  status: "idle",
};

const JOB_SECTOR_LABELS: Record<string, string> = {
  security: "الأمن",
  operations: "العمليات",
  field: "ميداني",
  support: "الدعم",
  community: "مجتمعي",
  casework: "متابعة ملفات",
  logistics: "اللوجستيات",
  planning: "التخطيط",
  coordination: "التنسيق",
};


const JOB_LOCATION_METADATA: Record<string, { mohafaza: string; qaza: string; village: string }> = {
  job_v2_001: { mohafaza: "بيروت", qaza: "بيروت", village: "الحمرا" },
  job_v2_002: { mohafaza: "الشمال", qaza: "طرابلس", village: "طرابلس" },
  job_v2_003: { mohafaza: "الجنوب", qaza: "صيدا", village: "صيدا" },
  job_v2_004: { mohafaza: "بيروت", qaza: "بيروت", village: "الأشرفية" },
  job_v2_005: { mohafaza: "بيروت", qaza: "بيروت", village: "رأس بيروت" },
  job_v2_006: { mohafaza: "بيروت", qaza: "بيروت", village: "المزرعة" },
  job_v2_007: { mohafaza: "الشمال", qaza: "طرابلس", village: "الميناء" },
  job_v2_008: { mohafaza: "جبل لبنان", qaza: "كسروان", village: "جونية" },
};

const JOB_COMPANY_WHATSAPP_PHONES: Record<string, string> = {
  job_v2_001: "+96176111001",
  job_v2_002: "+96176111002",
  job_v2_003: "+96176111003",
  job_v2_004: "+96176111004",
  job_v2_005: "+96176111005",
  job_v2_006: "+96176111006",
  job_v2_007: "+96176111007",
  job_v2_008: "+96176111008",
};

function resolveJobLocationMeta(job: JobVacancy) {
  return JOB_LOCATION_METADATA[job.id] || {
    mohafaza: job.location,
    qaza: job.location,
    village: job.location,
  };
}

function getJobsSectionTitle(section: string) {
  if (section === "saved") return "الوظائف المحفوظة";
  if (section === "cv") return "السيرة الذاتية";
  return "الوظائف المتاحة";
}

function getJobModeLabel(mode: JobVacancy["mode"]) {
  if (mode === "remote") return "عن بعد";
  if (mode === "hybrid") return "هجين";
  return "حضوري";
}

function resolveJobWhatsAppPhone(job: JobVacancy) {
  return JOB_COMPANY_WHATSAPP_PHONES[job.id] || "+96170000000";
}

function buildWhatsAppJobHref(job: JobVacancy) {
  const companyPhone = resolveJobWhatsAppPhone(job).replace(/\D/g, "");
  const shareText = encodeURIComponent(buildJobShareText(job.title, job.company, job.location));
  return `https://wa.me/${companyPhone}?text=${shareText}`;
}

function buildJobShareText(jobTitle: string, company: string, locationText: string) {
  return `فرصة عمل: ${jobTitle}\n${company} · ${locationText}\n${globalThis.location.href}`;
}

async function shareJobWithFallback(jobTitle: string, company: string, locationText: string) {
  const shareText = buildJobShareText(jobTitle, company, locationText);

  if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
    try {
      await navigator.share({
        title: jobTitle,
        text: shareText,
        url: globalThis.location.href,
      });
      return;
    } catch {
      // Fallback to clipboard below.
    }
  }

  try {
    await navigator.clipboard.writeText(shareText);
  } catch {
    // Ignore clipboard failures; user still has the WhatsApp action.
  }
}


export function MobileFeatureLandingPage({ config }: { readonly config: LandingConfig }) {
  return <MobileFeatureLandingPageImpl config={config} />;
}

function MobileFeatureLandingPageImpl({ config }: { readonly config: LandingConfig }) { // NOSONAR
  const location = useLocation();
  const navigate = useNavigate();
  const { profile } = useApp();
  const [activeFilter, setActiveFilter] = useState(config.filters[0]?.value ?? "all");
  const [searchQuery, setSearchQuery] = useState("");
  const [jobModeFilter, setJobModeFilter] = useState<"all" | JobVacancy["mode"]>("all");
  const [jobSort, setJobSort] = useState<"newest" | "oldest">("newest");
  const [jobListings, setJobListings] = useState<JobVacancy[]>([]);
  const [jobsState, setJobsState] = useState<"idle" | "loading" | "ready" | "error">(config.id === "jobs" ? "loading" : "idle");
  const [favoriteState, setFavoriteState] = useState<"idle" | "loading" | "ready" | "error">(config.id === "jobs" ? "loading" : "idle");
  const [favoriteJobIds, setFavoriteJobIds] = useState<string[]>([]);
  const [locationSheetOpen, setLocationSheetOpen] = useState(false);
  const [selectedAddress, setSelectedAddress] = useState<LebanonAddressValue>(EMPTY_ADDRESS);
  const [expandedJobId, setExpandedJobId] = useState<string | null>(null);
  const [cvFileName, setCvFileName] = useState("");
  const [cvUpdatedAt, setCvUpdatedAt] = useState("");
  const [loginGateMessage, setLoginGateMessage] = useState<string | null>(null);
  const [marketPopup, setMarketPopup] = useState<{ item: LandingSectionItem; rail: MarketCategoryRail } | null>(null);
  const [marketActionNotice, setMarketActionNotice] = useState<string | null>(null);

  function promptRegistrationForAction() {
    setLoginGateMessage(LOGIN_REQUIRED_GATE_MESSAGE_AR);
    globalThis.setTimeout(() => {
      navigate(`/register?next=${encodeURIComponent(location.pathname + location.search + location.hash)}`);
    }, 120);
  }

  const currentJobsSection = useMemo(() => new URLSearchParams(location.search).get("section") || "jobs", [location.search]);

  useEffect(() => {
    if (config.id !== "jobs") return;
    try {
      const raw = globalThis.localStorage.getItem(JOBS_CV_STORAGE_KEY);
      if (!raw) return;
      const saved = JSON.parse(raw) as { fileName?: string; updatedAt?: string };
      if (typeof saved.fileName === "string") setCvFileName(saved.fileName);
      if (typeof saved.updatedAt === "string") setCvUpdatedAt(saved.updatedAt);
    } catch {
      // Ignore broken local CV metadata.
    }
  }, [config.id]);


  useEffect(() => {
    if (config.id !== "jobs") return;

    let cancelled = false;
    setFavoriteState("loading");
    listSavedJobs(JOBS_USER_ID)
      .then((response) => {
        if (cancelled) return;
        setFavoriteJobIds(response.saved.map((item) => item.job_id));
        setFavoriteState("ready");
      })
      .catch(() => {
        if (cancelled) return;
        setFavoriteJobIds([]);
        setFavoriteState("error");
      });

    return () => {
      cancelled = true;
    };
  }, [config.id]);

  useEffect(() => {
    if (config.id !== "jobs") return;

    let cancelled = false;
    setJobsState("loading");

    api.searchJobs("")
      .then((results) => {
        if (cancelled) return;
        setJobListings(results);
        setJobsState("ready");
      })
      .catch(() => {
        if (cancelled) return;
        setJobListings([]);
        setJobsState("error");
      });

    return () => {
      cancelled = true;
    };
  }, [config.id]);

  const visibleJobListings = useMemo(() => {
    if (config.id !== "jobs") return [];
    const normalizedQuery = searchQuery.trim().toLocaleLowerCase("ar");
    const filtered = jobListings.filter((job) => {
      const meta = resolveJobLocationMeta(job);
      const matchesLocation = (!selectedAddress.mohafaza || meta.mohafaza === selectedAddress.mohafaza)
        && (!selectedAddress.qaza || meta.qaza === selectedAddress.qaza)
        && (!selectedAddress.village || meta.village === selectedAddress.village);
      const searchableText = [job.title, job.company, job.location, job.summary, ...job.tags]
        .join(" ")
        .toLocaleLowerCase("ar");
      const matchesSearch = !normalizedQuery || searchableText.includes(normalizedQuery);
      const matchesMode = jobModeFilter === "all" || job.mode === jobModeFilter;

      if (!matchesLocation || !matchesSearch || !matchesMode) return false;
      if (currentJobsSection === "saved" && !favoriteJobIds.includes(job.id)) return false;
      if (activeFilter === "all") return true;
      return job.tags.includes(activeFilter);
    });

    return [...filtered].sort((first, second) => {
      const firstTime = new Date(first.postedAt).getTime();
      const secondTime = new Date(second.postedAt).getTime();
      return jobSort === "newest" ? secondTime - firstTime : firstTime - secondTime;
    });
  }, [activeFilter, config.id, currentJobsSection, favoriteJobIds, jobListings, jobModeFilter, jobSort, searchQuery, selectedAddress]);

  const jobsSectorFilters = useMemo(() => {
    if (config.id !== "jobs") return config.filters;

    const seen = new Set<string>();
    const items = [{ icon: "✨", label: "الكل", value: "all" }];

    for (const job of jobListings) {
      for (const tag of job.tags) {
        if (seen.has(tag)) continue;
        seen.add(tag);
        items.push({ icon: "#", label: JOB_SECTOR_LABELS[tag] || tag, value: tag });
      }
    }

    return items;
  }, [config.filters, config.id, jobListings]);


  function resolveLandingHref(href: string) {
    if (!href.startsWith("/")) return href;

    const [pathname, rawSearch = ""] = href.split("?");
    const search = rawSearch ? `?${rawSearch}` : "";

    if (pathname === "/market" || pathname === "/jobs") {
      return `${location.pathname}${search}`;
    }

    return `${pathname}${search}`;
  }

  function isNavItemActive(itemHref: string) {
    const resolvedHref = resolveLandingHref(itemHref);
    if (resolvedHref.startsWith("#")) return resolvedHref === location.hash;
    const [pathname, rawSearch = ""] = resolvedHref.split("?");
    const search = rawSearch ? `?${rawSearch}` : "";
    return pathname === location.pathname && search === location.search;
  }

  async function toggleFavoriteJob(jobId: string) {
    const isSaved = favoriteJobIds.includes(jobId);
    try {
      setLoginGateMessage(null);
      if (isSaved) {
        await unsaveJob(jobId, JOBS_USER_ID);
        setFavoriteJobIds((current) => current.filter((item) => item !== jobId));
      } else {
        await saveJob(jobId, JOBS_USER_ID);
        setFavoriteJobIds((current) => (current.includes(jobId) ? current : [...current, jobId]));
      }
      setFavoriteState("ready");
    } catch (error) {
      if (isLoginRequiredError(error)) {
        promptRegistrationForAction();
        return;
      }
      setFavoriteState("error");
    }
  }

  function handleCvUpload(file: File | null) {
    if (!file) return;
    const updatedAt = new Date().toISOString();
    setCvFileName(file.name);
    setCvUpdatedAt(updatedAt);
    try {
      globalThis.localStorage.setItem(JOBS_CV_STORAGE_KEY, JSON.stringify({ fileName: file.name, updatedAt }));
    } catch {
      // Ignore localStorage failures.
    }
  }

  function openJobDetails(jobId: string) {
    setLoginGateMessage(null);
    setExpandedJobId((current) => (current === jobId ? null : jobId));
  }

  const isJobsPage = config.id === "jobs";
  const showNav = config.navItems.length > 0;
  const showLocationFilter = isJobsPage && locationSheetOpen;
  const jobsSectionTitle = getJobsSectionTitle(currentJobsSection);
  const visibleFeaturedListings = useMemo(() => {
    if (!config.featuredListings?.length) return [];
    const normalizedQuery = searchQuery.trim().toLocaleLowerCase("ar");
    return config.featuredListings.filter((listing) => {
      if (!normalizedQuery) return true;
      return [listing.title, listing.company, listing.location, listing.summary, listing.badge]
        .join(" ")
        .toLocaleLowerCase("ar")
        .includes(normalizedQuery);
    });
  }, [config.featuredListings, searchQuery]);
  const displayedListingCount = visibleJobListings.length + visibleFeaturedListings.length;
  const showCvCard = jobsState === "ready" && currentJobsSection === "cv";
  const showJobListings = jobsState === "ready" && currentJobsSection !== "cv" && visibleJobListings.length > 0;
  const showJobsEmptyState = jobsState === "ready" && currentJobsSection !== "cv" && visibleJobListings.length === 0;
  const visibleShortcuts = config.id === "market" ? config.shortcuts.slice(0, 2) : config.shortcuts;
  const visibleCategories = config.id === "market" ? config.categories.slice(0, 2) : config.categories;
  const visibleStatusCards = config.id === "market" ? config.statusCards.slice(0, 2) : config.statusCards;
  const visibleSections = config.id === "market" ? config.sections.slice(0, 1) : config.sections;
  const visibleSectionItems = config.id === "market" ? 3 : undefined;
  const visibleMarketRails = useMemo(() => {
    if (config.id !== "market" || !config.categoryRails) return [];
    const normalizedQuery = searchQuery.trim().toLocaleLowerCase("ar");
    return config.categoryRails
      .map((rail) => ({
        ...rail,
        items: rail.items.filter((item) => !normalizedQuery || [item.title, item.meta, item.badge].join(" ").toLocaleLowerCase("ar").includes(normalizedQuery)),
      }))
      .filter((rail) => rail.items.length > 0);
  }, [config.categoryRails, config.id, searchQuery]);
  const marketGridStyle: CSSProperties | undefined = config.id === "market" ? { gridAutoFlow: "row", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", overflowX: "visible" } : undefined;
  const marketNavStyle: CSSProperties | undefined = config.id === "market" ? { flexWrap: "wrap", gap: "0.5rem", justifyContent: "center", overflowX: "visible" } : undefined;

  return (
    <WatanyLandingBodyTemplate>
      <main className={`mj-mobile-landing mj-mobile-landing--${config.id}`} dir="rtl" data-market-jobs-mobile-landing="true">
      {showNav ? (
        <div className={config.id === "jobs" ? "mj-sticky-icon-nav mj-sticky-icon-nav--tabs" : "mj-sticky-icon-nav"} aria-label={config.navLabel} data-icon-only-sticky-nav="true" style={marketNavStyle}>
          {config.navItems.map((item) => (
            <a
              className={isNavItemActive(item.href) ? "mj-sticky-icon-nav__item mj-sticky-icon-nav__item--active" : "mj-sticky-icon-nav__item"}
              href={resolveLandingHref(item.href)}
              key={`${config.id}-${item.label}`}
              title={item.label}
              aria-label={item.label}
            >
              {config.id === "market" ? (
                <>
                  <span className="mj-sticky-icon-nav__icon" aria-hidden="true">{item.icon}</span>
                  <span className="mj-sticky-icon-nav__label">{item.label}</span>
                </>
              ) : config.id === "jobs" ? <span className="mj-sticky-icon-nav__label">{item.label}</span> : <span className="mj-sticky-icon-nav__icon" aria-hidden="true">{item.icon}</span>}
              {config.id === "market" || config.id === "jobs" ? null : <span className="mj-sr-only">{item.label}</span>}
            </a>
          ))}
          {isJobsPage ? (
            <button
              type="button"
              className={selectedAddress.displayAddress ? "mj-sticky-icon-nav__item mj-sticky-icon-nav__item--location mj-sticky-icon-nav__item--active" : "mj-sticky-icon-nav__item mj-sticky-icon-nav__item--location"}
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                setLocationSheetOpen((current) => !current);
              }}
              aria-label="اختيار الموقع"
            >
              <span className="mj-sticky-icon-nav__label">{selectedAddress.village || selectedAddress.qaza || selectedAddress.mohafaza || "الموقع"}</span>
            </button>
          ) : null}
        </div>
      ) : null}

      {config.id === "market" ? (
        <>
          <section className="mj-market-hero" aria-labelledby="market-page-title">
            <div className="mj-market-hero__copy">
              <p className="mj-market-hero__eyebrow">{config.eyebrow}</p>
              <h1 id="market-page-title">{config.title}</h1>
              <p>{config.subtitle}</p>
            </div>
            <div className="mj-market-hero__actions">
              <a className="mj-market-hero__primary" href={config.primaryActionHref}>إضافة إعلان</a>
              <a className="mj-market-hero__secondary" href={config.secondaryActionHref}>إعلاناتي</a>
            </div>
          </section>
          <section className="mj-market-search" aria-label={config.searchLabel}>
            <label htmlFor="market-landing-search">{config.searchLabel}</label>
            <div className="mj-market-search__control">
              <input id="market-landing-search" type="search" value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder={config.searchPlaceholder} autoComplete="off" />
              {searchQuery ? <button type="button" onClick={() => setSearchQuery("")} aria-label="مسح البحث">×</button> : null}
            </div>
          </section>
          {marketActionNotice ? <p className="mj-market-action-notice" role="status">{marketActionNotice}</p> : null}
        </>
      ) : null}

      {isJobsPage ? (
        <section className="mj-jobs-hero" aria-labelledby="jobs-page-title">
          <div>
            <p className="mj-jobs-hero__eyebrow">{config.eyebrow}</p>
            <h1 id="jobs-page-title">{config.title}</h1>
            <p>{config.subtitle}</p>
          </div>
          <div className="mj-jobs-hero__signal" aria-label="حالة فرص العمل">
            <strong>{displayedListingCount}</strong>
            <span>فرصة معروضة</span>
          </div>
        </section>
      ) : null}

      {showLocationFilter ? (
        <section className="mj-inline-sheet" aria-label="فلترة الوظائف حسب الموقع">
          <div className="mj-inline-sheet__head">
            <h2>الموقع</h2>
            <button type="button" onClick={() => setLocationSheetOpen(false)}>إغلاق</button>
          </div>
          <LebanonAddressSelector
            value={selectedAddress}
            onChange={setSelectedAddress}
            className="mj-address-selector"
            exactAddressLabel="تفصيل إضافي"
            exactAddressPlaceholder="اختياري"
          />
          <div className="mj-inline-sheet__actions">
            <button type="button" className="mj-inline-sheet__ghost" onClick={() => setSelectedAddress(EMPTY_ADDRESS)}>مسح الفلتر</button>
            <button type="button" className="mj-inline-sheet__primary" onClick={() => setLocationSheetOpen(false)}>تطبيق</button>
          </div>
        </section>
      ) : null}

      <section className="mj-search-panel" aria-label={config.searchLabel} data-search-filter-bar="true">
        {isJobsPage ? (
          <div className="mj-search-panel__row mj-search-panel__row--search">
            <label className="mj-sr-only" htmlFor="jobs-search">{config.searchLabel}</label>
            <input
              id="jobs-search"
              className="mj-search-panel__input"
              type="search"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder={config.searchPlaceholder}
              autoComplete="off"
            />
            {searchQuery ? (
              <button type="button" className="mj-search-panel__clear" onClick={() => setSearchQuery("")} aria-label="مسح البحث">×</button>
            ) : null}
          </div>
        ) : null}
        {isJobsPage ? (
          <div className="mj-search-panel__controls" aria-label="خيارات ترتيب وتصفية الوظائف">
            <label>
              <span>نمط العمل</span>
              <select value={jobModeFilter} onChange={(event) => setJobModeFilter(event.target.value as typeof jobModeFilter)}>
                <option value="all">كل الأنماط</option>
                <option value="onsite">حضوري</option>
                <option value="hybrid">هجين</option>
                <option value="remote">عن بعد</option>
              </select>
            </label>
            <label>
              <span>الترتيب</span>
              <select value={jobSort} onChange={(event) => setJobSort(event.target.value as typeof jobSort)}>
                <option value="newest">الأحدث أولاً</option>
                <option value="oldest">الأقدم أولاً</option>
              </select>
            </label>
          </div>
        ) : null}
        <ul className="mj-filter-chips" aria-label="فلاتر سريعة" style={marketGridStyle}>
          {jobsSectorFilters.map((filter) => (
            <button
              className={filter.value === activeFilter ? "mj-filter-chip mj-filter-chip--active" : "mj-filter-chip"}
              type="button"
              key={filter.value}
              onClick={() => setActiveFilter(filter.value)}
            >
              <span aria-hidden="true">{filter.icon}</span>
              <span>{filter.label}</span>
            </button>
          ))}
        </ul>
      </section>

      {isJobsPage ? (
        <section className="mj-feed-section mj-job-listings-section watany-listing-surface" aria-label="الوظائف المتاحة" data-job-listings="true">
          <div className="mj-section-heading watany-listing-surface__header">
            <h2 className="watany-listing-surface__title">{jobsSectionTitle}</h2>
            <span className="mj-job-listings-count">{displayedListingCount} فرصة</span>
          </div>
          {visibleFeaturedListings.length ? (
            <div className="mj-job-listings" aria-label="فرص مميزة">
              {visibleFeaturedListings.map((listing) => (
                <article className="mj-job-card mj-job-card--compact is-expanded" key={listing.href}>
                  <div className="mj-job-card__head">
                    <div className="mj-job-card__title-group">
                      <strong className="mj-job-card__title">{listing.title}</strong>
                      <span className="mj-job-card__badge mj-job-card__badge--new">{listing.badge}</span>
                      <small className="mj-job-card__company">{listing.company} · {listing.location}</small>
                    </div>
                  </div>
                  <div className="mj-job-card__body">
                    <p className="mj-job-card__summary">{listing.summary}</p>
                    <div className="mj-job-card__actions-row">
                      <a className="mj-inline-sheet__primary" href={resolveLandingHref(listing.href)}>التفاصيل والتسجيل</a>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          ) : null}
          {selectedAddress.displayAddress ? <div className="mj-jobs-toolbar-note">تصفية الموقع: {selectedAddress.displayAddress}</div> : null}
          {favoriteState === "error" ? <div className="mj-empty-state">تعذر مزامنة الوظائف المحفوظة الآن.</div> : null}
          {loginGateMessage ? <div className="mj-empty-state">{loginGateMessage}</div> : null}
          {jobsState === "loading" ? <div className="mj-empty-state">جاري تحميل الوظائف...</div> : null}
          {jobsState === "error" ? <div className="mj-empty-state">تعذر تحميل الوظائف حالياً.</div> : null}
          {showCvCard ? (
            <div className="mj-job-card">
              <div className="mj-job-card__head">
                <strong>تفعيل السيرة الذاتية</strong>
                <span>{cvFileName ? "مفعلة" : "غير مرفوعة"}</span>
              </div>
              <p>يمكنك رفع ملف السيرة الذاتية مرة واحدة الآن لتسريع التقديم. بيانات الملف محفوظة على جهازك الحالي فقط.</p>
              <label className="mj-review-trigger" style={{ display: "inline-flex", justifyContent: "center", cursor: "pointer" }}>
                <span>رفع/تحديث السيرة الذاتية</span>
                <input
                  type="file"
                  accept=".pdf,.doc,.docx"
                  style={{ display: "none" }}
                  onChange={(event) => handleCvUpload(event.target.files?.[0] ?? null)}
                />
              </label>
              {cvFileName ? <small>آخر ملف: {cvFileName} · {new Date(cvUpdatedAt || Date.now()).toLocaleString("ar-LB")}</small> : <small>لا يوجد ملف مرفوع بعد.</small>}
              {profile.isAuthed ? null : <div className="mj-empty-state">يلزم تسجيل الدخول لتفعيل التقديم الفعلي على الوظائف.</div>}
            </div>
          ) : null}
          {showJobListings ? (
            <div className="mj-job-listings">
              {visibleJobListings.map((job) => {
                const modeLabel = getJobModeLabel(job.mode);
                // Show full job details to all users. Actions that require authentication
                // (saving, applying, reviewing) will still prompt registration when needed.
                const published = (job as any).publishedAt || (job as any).postedAt || (job as any).createdAt || null;
                const isNew = published ? (Date.now() - new Date(published).getTime()) <= 7 * 24 * 60 * 60 * 1000 : false;
                const compact = expandedJobId !== job.id;

                return (
                  <article className={`mj-job-card mj-job-card--compact ${compact ? "is-compact" : "is-expanded"}`} key={job.id}>
                    <div className="mj-job-card__head">
                      <div className="mj-job-card__title-group">
                        <strong className="mj-job-card__title">{job.title}</strong>
                        {isNew ? <span className="mj-job-card__badge mj-job-card__badge--new">جديد</span> : null}
                        <small className="mj-job-card__company">{job.company}</small>
                      </div>
                      <div className="mj-job-card__actions">
                        <button
                          type="button"
                          aria-label={compact ? "expand" : "collapse"}
                          className="mj-job-card__toggle"
                          onClick={() => openJobDetails(job.id)}
                        >
                          {compact ? "+" : "−"}
                        </button>
                      </div>
                    </div>

                    {compact ? null : (
                      <div className="mj-job-card__body">
                        <div className="mj-job-card__meta" aria-label="بيانات الوظيفة">
                          <span className="mj-job-card__meta-item">⌖ {job.location}</span>
                          <span className="mj-job-card__meta-item">◷ {modeLabel}</span>
                          <span className="mj-job-card__meta-item">◴ {published ? new Date(published).toLocaleDateString("ar-LB") : "تاريخ النشر غير متاح"}</span>
                        </div>
                        <p className="mj-job-card__summary">{job.summary || "فرصة عمل متاحة حالياً ضمن منصة الوظائف."}</p>
                        {job.tags.length > 0 ? (
                          <div className="mj-job-card__tags" aria-label="وسوم الوظيفة">
                            {job.tags.map((tag) => (
                              <span key={`${job.id}-${tag}`}>{tag}</span>
                            ))}
                          </div>
                        ) : null}
                        <div className="mj-job-card__actions-row">
                          <button type="button" className="mj-inline-sheet__ghost" onClick={() => toggleFavoriteJob(job.id)}>
                            {favoriteJobIds.includes(job.id) ? "★ المحفوظة" : "☆ احفظ"}
                          </button>
                          <button type="button" className="mj-inline-sheet__ghost" onClick={() => void shareJobWithFallback(job.title, job.company, job.location)}>
                            شارك
                          </button>
                          <a
                            className="mj-inline-sheet__ghost mj-inline-sheet__ghost--whatsapp"
                            href={buildWhatsAppJobHref(job)}
                            target="_blank"
                            rel="noreferrer"
                          >
                            واتساب
                          </a>
                          <a className="mj-inline-sheet__primary" href={`/register?next=${encodeURIComponent(location.pathname + location.search + location.hash)}`}>
                            قدّم الآن
                          </a>
                        </div>
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          ) : null}
          {showJobsEmptyState ? <div className="mj-empty-state">{currentJobsSection === "saved" ? "لا توجد وظائف محفوظة حالياً." : "لا توجد وظائف معروضة حالياً."}</div> : null}
        </section>
      ) : null}

      {config.shortcuts.length > 0 ? (
        <section className="mj-shortcut-grid" aria-label="الميزات الرئيسية" data-shortcut-grid="true" style={marketGridStyle}>
          {visibleShortcuts.map((shortcut) => (
            <a className="mj-shortcut-card" href={resolveLandingHref(shortcut.href)} key={`${config.id}-shortcut-${shortcut.label}`}>
              <span className="mj-shortcut-card__icon" aria-hidden="true">{shortcut.icon}</span>
              <span className="mj-shortcut-card__label">{shortcut.label}</span>
              <span className="mj-shortcut-card__desc">{shortcut.description}</span>
            </a>
          ))}
        </section>
      ) : null}

      {config.id === "market" ? (
        <>
          <section className="mj-market-category-directory" aria-labelledby="market-category-title">
            <div className="mj-market-section-heading">
              <div>
                <p>اختصر الطريق</p>
                <h2 id="market-category-title">تصفح حسب الفئة</h2>
              </div>
              <span>{config.categories.length} فئات</span>
            </div>
            <div className="mj-market-category-grid">
              {config.categories.map((marketCategory) => (
                <a className="mj-market-category-card" href={resolveLandingHref(marketCategory.href)} key={`market-category-${marketCategory.label}`}>
                  <span className="mj-market-category-card__icon" aria-hidden="true">{marketCategory.icon}</span>
                  <strong>{marketCategory.label}</strong>
                  <small>{marketCategory.description}</small>
                </a>
              ))}
            </div>
          </section>

          <section className="mj-market-status" aria-label="متابعة السوق">
            <div className="mj-market-section-heading">
              <div>
                <p>كل ما يخصك في مكان واحد</p>
                <h2>المتابعة والثقة</h2>
              </div>
              <a href="/marketplace?section=my-listings">إعلاناتي</a>
            </div>
            <div className="mj-market-status__rail">
              {config.statusCards.map((card) => (
                <a className="mj-market-status-card" href={resolveLandingHref(card.href)} key={`market-status-${card.label}`}>
                  <span aria-hidden="true">{card.icon}</span>
                  <strong>{card.label}</strong>
                  <small>{card.description}</small>
                </a>
              ))}
            </div>
          </section>

          <section className="mj-market-rails" aria-label="إعلانات السوق حسب الفئة">
            <div className="mj-market-section-heading mj-market-rails__heading">
              <div>
                <p>بيانات تجريبية للعرض</p>
                <h2>إعلانات مختارة من السوق</h2>
              </div>
              <span>{visibleMarketRails.reduce((total, rail) => total + rail.items.length, 0)} إعلان</span>
            </div>
            {visibleMarketRails.length > 0 ? visibleMarketRails.map((rail) => (
              <section className="mj-market-rail" aria-labelledby={`market-rail-${rail.id}`} key={`market-rail-${rail.id}`}>
                <div className="mj-market-rail__heading">
                  <div>
                    <span aria-hidden="true">{rail.icon}</span>
                    <div>
                      <h3 id={`market-rail-${rail.id}`}>{rail.title}</h3>
                      <p>{rail.description}</p>
                    </div>
                  </div>
                  <a href={resolveLandingHref(rail.actionHref)}>{rail.actionLabel}</a>
                </div>
                <div className="mj-market-rail__track">
                  {rail.items.map((item) => (
                    <a
                      className="mj-market-listing-card"
                      href={resolveLandingHref(item.href || rail.actionHref)}
                      aria-haspopup="dialog"
                      onClick={(event) => {
                        event.preventDefault();
                        setMarketPopup({ item, rail });
                      }}
                      key={`${rail.id}-${item.title}`}
                    >
                      <span className="mj-market-listing-card__badge">{item.badge}</span>
                      <strong>{item.title}</strong>
                      <small>{item.meta}</small>
                      <span className="mj-market-listing-card__link">التفاصيل ←</span>
                    </a>
                  ))}
                </div>
              </section>
            )) : (
              <div className="mj-empty-state">لا توجد إعلانات تطابق بحثك. جرّب كلمة أخرى.</div>
            )}
          </section>
        </>
      ) : (
        <>
          <section className="mj-category-block" aria-label="الفئات" data-category-grid="true">
            <div className="mj-section-heading">
              <h2>الفئات</h2>
              <a href={resolveLandingHref(`/${config.id}?section=categories`)}>عرض الكل</a>
            </div>
            <div className="mj-category-grid" style={marketGridStyle}>
              {visibleCategories.map((category) => (
                <a className="mj-category-pill" href={resolveLandingHref(category.href)} key={`${config.id}-category-${category.label}`}>
                  <span aria-hidden="true">{category.icon}</span>
                  <span>{category.label}</span>
                </a>
              ))}
            </div>
          </section>

          <section className="mj-jobs-status" aria-label="الحالة والمتابعة" data-status-strip="true">
            <div className="mj-section-heading mj-jobs-status__heading">
              <div>
                <p>تابع خطواتك التالية</p>
                <h2>الحالة والمتابعة</h2>
              </div>
              <span>{visibleStatusCards.length} مسارات</span>
            </div>
            <div className="mj-status-strip" style={marketGridStyle}>
              {visibleStatusCards.map((card) => (
                <a className="mj-status-card" href={resolveLandingHref(card.href)} key={`${config.id}-status-${card.label}`}>
                  <span aria-hidden="true">{card.icon}</span>
                  <strong>{card.label}</strong>
                  <small>{card.description}</small>
                </a>
              ))}
            </div>
          </section>

          <section className="mj-feed-sections" aria-label="أقسام مقترحة" data-feed-sections="true">
            {visibleSections.map((section) => (
              <article className="mj-feed-section" key={`${config.id}-section-${section.title}`}>
                <div className="mj-section-heading">
                  <h2>{section.title}</h2>
                  {config.id === "market" ? (
                    <span>{section.actionLabel}</span>
                  ) : (
                    <a href={resolveLandingHref(section.actionHref)}>{section.actionLabel}</a>
                  )}
                </div>
                <div className="mj-feed-cards" style={marketGridStyle}>
                  {section.items.length > 0 ? section.items.slice(0, visibleSectionItems).map((item) => {
                    const cardContent = (
                      <>
                        <span className="mj-feed-card__badge">{item.badge}</span>
                        <strong>{item.title}</strong>
                        <small>{item.meta}</small>
                      </>
                    );

                    return item.href ? (
                      <a className="mj-feed-card" href={resolveLandingHref(item.href)} key={`${section.title}-${item.title}`}>
                        {cardContent}
                      </a>
                    ) : (
                      <div className="mj-feed-card" key={`${section.title}-${item.title}`}>
                        {cardContent}
                      </div>
                    );
                  }) : (
                    <div className="mj-empty-state">لا توجد نتائج مطابقة. جرّب كلمات أو فلاتر أخرى، أو اختر "او شي تاني".</div>
                  )}
                </div>
              </article>
            ))}
          </section>
        </>
      )}

      {marketPopup ? (
        <div className="mj-market-dialog-backdrop" role="presentation" onClick={() => setMarketPopup(null)}>
          <section
            className="mj-market-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="mj-market-dialog-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mj-market-dialog__head">
              <span className="mj-market-listing-card__badge">{marketPopup.item.badge}</span>
              <button type="button" className="mj-market-dialog__close" onClick={() => setMarketPopup(null)} aria-label="إغلاق تفاصيل الإعلان">×</button>
            </div>
            <p className="mj-market-dialog__eyebrow">{marketPopup.rail.title}</p>
            <h2 id="mj-market-dialog-title">{marketPopup.item.title}</h2>
            <p className="mj-market-dialog__meta">{marketPopup.item.meta}</p>
            <p className="mj-market-dialog__copy">يمكنك متابعة الإعلانات المشابهة أو التواصل معنا للعثور على العرض المناسب لك.</p>
            <div className="mj-market-dialog__actions">
              <a className="mj-market-dialog__primary" href={resolveLandingHref(marketPopup.item.href || marketPopup.rail.actionHref)}>عرض إعلانات الفئة</a>
              <a className="mj-market-dialog__secondary" href={`/chat?draft=${encodeURIComponent(`أرغب بمعلومات عن الإعلان: ${marketPopup.item.title}`)}`}>تواصل للاستفسار</a>
              <button type="button" className="mj-market-dialog__save" onClick={() => { setMarketActionNotice("تم حفظ الإعلان للمتابعة لاحقاً."); setMarketPopup(null); }}>حفظ للمتابعة</button>
            </div>
          </section>
        </div>
      ) : null}
      </main>
    </WatanyLandingBodyTemplate>
  );
}


