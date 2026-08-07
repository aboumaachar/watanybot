/**
 * service-catalog.ts — Single source of truth for the service taxonomy.
 *
 * BurgerDrawer and other launchers import from here. Add `shortLabel` when
 * the compact drawer label should differ from the primary label.
 *
 * Rules enforced in this catalog:
 *  - المعاملات والإجراءات (procedures): admin procedures only — NO marketplace.
 *  - السوق (marketplace): sell/buy ads only — separate root category.
 *  - التطويع (recruitment): military/security only — NOT civilian employment.
 *  - دليل الجهات (directory): phonebook/contact items only.
 *  - القوانين: now listed under المساعد while still opening /legal.
 */

import type { Mode } from "../store/app";
import type { FeatureId } from "../store/features";

/* ── Types ─────────────────────────────────────────────────────── */

export type TileAction =
  | { kind: "mode";  mode: Mode }
  | { kind: "event"; name: string; detail?: Record<string, unknown> }
  | { kind: "route"; path: string }
  | { kind: "none" };

export type ServiceIcon = () => null;

function createServiceIcon(): ServiceIcon {
  return () => null;
}

const sharedServiceIcon = createServiceIcon();
const AlertOn24Filled = sharedServiceIcon;
const Apps24Filled = sharedServiceIcon;
const BookOpen24Filled = sharedServiceIcon;
const Bot24Filled = sharedServiceIcon;
const Briefcase24Filled = sharedServiceIcon;
const Building24Filled = sharedServiceIcon;
const BuildingBank24Filled = sharedServiceIcon;
const BuildingGovernment24Filled = sharedServiceIcon;
const BuildingHome24Filled = sharedServiceIcon;
const BuildingRetailShield24Filled = sharedServiceIcon;
const Calculator24Filled = sharedServiceIcon;
const ClipboardTask24Filled = sharedServiceIcon;
const DataTrending24Filled = sharedServiceIcon;
const DocumentBulletList24Filled = sharedServiceIcon;
const DocumentFolder24Filled = sharedServiceIcon;
const DocumentText24Filled = sharedServiceIcon;
const Flash24Filled = sharedServiceIcon;
const HeartPulse24Filled = sharedServiceIcon;
const HatGraduation24Filled = sharedServiceIcon;
const Megaphone24Filled = sharedServiceIcon;
const News24Filled = sharedServiceIcon;
const Person24Filled = sharedServiceIcon;
const PersonCircle24Filled = sharedServiceIcon;
const PersonStar24Filled = sharedServiceIcon;
const PersonSupport24Filled = sharedServiceIcon;
const Phone24Filled = sharedServiceIcon;
const QuestionCircle24Filled = sharedServiceIcon;
const Save24Filled = sharedServiceIcon;
const Search24Filled = sharedServiceIcon;
const Settings24Filled = sharedServiceIcon;
const ShieldCheckmark24Filled = sharedServiceIcon;
const ShieldTask24Filled = sharedServiceIcon;
const Star24Filled = sharedServiceIcon;
const Warning24Filled = sharedServiceIcon;

export type ServiceTile = {
  id: string;
  icon: ServiceIcon;
  /** Primary label shown for the service tile */
  label: string;
  /** Compact label for BurgerDrawer (falls back to label when absent) */
  shortLabel?: string;
  color: string;
  action: TileAction;
  featureId?: FeatureId;
  adminOnly?: boolean;
  future?: boolean;
  listingPathAr?: string;
  manifest?: string;
  documents?: Array<{ id: string; titleAr: string }>;
  /** Search keywords used by service discovery surfaces */
  keywords: string[];
};

export type ServiceCategory = {
  id: string;
  /** Root category icon */
  icon: ServiceIcon;
  label: string;
  /** Subtitle shown under the category header in tile view */
  description?: string;
  /** Whether this category appears on the main /services landing page */
  showInServices?: boolean;
  tiles: ServiceTile[];
};

/* ── Catalog ───────────────────────────────────────────────────── */

export const SERVICE_CATEGORIES: ServiceCategory[] = [
  {
    id: "assistant",
    icon: Bot24Filled,
    label: "المساعد",
    description: "المعاشات، المعاملات، المساعدات المدرسية، القوانين، والاستطلاعات",
    showInServices: true,
    tiles: [
      { id: "salary",      icon: Calculator24Filled, label: "حاسبة المعاش",       shortLabel: "حاسبة المعاش",   color: "green",  action: { kind: "route", path: "/salary" }, featureId: "salary", keywords: ["معاش","حاسبة","رتبة","درجة","احتساب"] },
      { id: "salary-attestation", icon: DocumentText24Filled, label: "إفادة بالراتب", shortLabel: "إفادة بالراتب", color: "orange", action: { kind: "route", path: "https://eservices.finance.gov.lb/RetiredInfo.aspx" }, featureId: "salary", keywords: ["إفادة","افادة","راتب","إفادة بالراتب","إفادة الراتب","تقاعد"] },
      { id: "official-services", icon: BuildingGovernment24Filled, label: "روابط مفيدة", shortLabel: "روابط مفيدة", color: "orange", action: { kind: "route", path: "/services/official" }, featureId: "govservices", keywords: ["خدمة رسمية","الخدمات الرسمية","روابط مفيدة","رسمية","استعلام رسمي","مساعدات مرضية","مخالفات رادار","إخراج قيد","طبابة"] },
      { id: "al-wafiyat", icon: DocumentText24Filled, label: "الوفيات الرسمية", shortLabel: "الوفيات", color: "slate", action: { kind: "route", path: "/al-wafiyat" }, keywords: ["وفيات","وفاة","تعازي","جيش","قوى الأمن","مصدر رسمي","وطنى"] },
      { id: "school-grants", icon: HatGraduation24Filled, label: "المساعدات المدرسية", color: "blue", action: { kind: "route", path: "/school-grants" }, featureId: "school-grants", keywords: ["مدرسية","مدرسة","جامعة","منحة","مساعدة"] },
      { id: "procedures",  icon: DocumentBulletList24Filled, label: "المعاملات",          color: "blue",   action: { kind: "route", path: "/procedures" }, featureId: "procedures", keywords: ["إجراء","معاملة","طلب","خطوات"] },
      { id: "forms",       icon: ClipboardTask24Filled, label: "النماذج الرسمية", color: "purple", action: { kind: "route", path: "/forms" }, featureId: "forms", keywords: ["نموذج","طلب","استمارة","ورقة"] },
      { id: "laws",        icon: BookOpen24Filled, label: "القوانين",           color: "orange", action: { kind: "route", path: "/legal" }, keywords: ["قانون","نظام","مادة","مرسوم"] },
      { id: "directory",   icon: Phone24Filled, label: "الدليل",               color: "teal",   action: { kind: "event", name: "watany-open-directory" }, keywords: ["دليل","جهات","أرقام","طوارئ","مصارف"] },
      { id: "faq",         icon: QuestionCircle24Filled, label: "الأسئلة الشائعة",    color: "blue",   action: { kind: "mode", mode: "faq" }, featureId: "ticker_faq", keywords: ["سؤال","جواب","شائع","استفسار"] },
      { id: "saved",       icon: Save24Filled, label: "المحفوظات",         color: "purple", action: { kind: "mode", mode: "saved" }, featureId: "saved", keywords: ["محفوظ","سابق","تاريخ"] },
    ],
  },

  {
    id: "health",
    icon: HeartPulse24Filled,
    label: "الصحة والاستشفاء",
    description: "المستشفيات، الاستفسار عن الأدوية",
    tiles: [
      { id: "hospitals", icon: Building24Filled, label: "المستشفيات المعتمدة", color: "red",    action: { kind: "event", name: "watany-open-directory", detail: { category: "hospitals" } }, keywords: ["مستشفى","مستشفيات","طوارئ"] },
      { id: "meds",      icon: Search24Filled, label: "الاستفسار عن الأدوية",             color: "teal",  action: { kind: "route", path: "/search" }, keywords: ["دواء","صيدلية","علاج"] },
    ],
  },

  {
    id: "laws-regulations",
    icon: BookOpen24Filled,
    label: "القوانين والأنظمة",
    description: "المكتبة القانونية ومراجع الرابطة",
    showInServices: false,
    tiles: [
      {
        id: "legal-library",
        icon: BookOpen24Filled,
        label: "المكتبة القانونية",
        shortLabel: "القوانين",
        color: "orange",
        action: { kind: "route", path: "/legal" },
        keywords: ["قوانين", "أنظمة", "مراسيم", "مذكرات", "قانون"],
      },
      {
        id: "rabita",
        icon: DocumentFolder24Filled,
        label: "الرابطة",
        shortLabel: "الرابطة",
        color: "teal",
        action: { kind: "route", path: "/legal" },
        listingPathAr: "القوانين والأنظمة > الرابطة",
        manifest: "kb/sources/laws-regulations/rabita/manifests/rabita_laws_regulations.manifest.json",
        documents: [
          { id: "rabita_basic_statute", titleAr: "النظام الأساسي للرابطة" },
          { id: "rabita_internal_rules", titleAr: "النظام الداخلي للرابطة" },
        ],
        keywords: ["رابطة", "الرابطة", "النظام الأساسي", "النظام الداخلي", "نوادي", "قوانين الرابطة"],
      },
    ],
  },

  {
    id: "jobs",
    icon: Briefcase24Filled,
    label: "الوظائف",
    description: "بحث وظائف وفرص مفضلة للمحاربين",
    showInServices: true,
    tiles: [
      { id: "jobs-search", icon: Search24Filled, label: "بحث الوظائف", color: "teal", action: { kind: "route", path: "/jobs" }, featureId: "jobs", keywords: ["وظائف","عمل","توظيف","فرص"] },
      { id: "jobs-veteran", icon: ShieldCheckmark24Filled, label: "فرص للمحاربين", color: "blue", action: { kind: "route", path: "/jobs?veteran=1" }, featureId: "jobs", keywords: ["محاربين","أفضلية","عسكري متقاعد","وظائف للمحاربين"] },
      { id: "jobs-requests", icon: PersonStar24Filled, label: "طلبات المحاربين", color: "orange", action: { kind: "route", path: "/jobs" }, featureId: "jobs", keywords: ["طلبات وظائف","طلب وظيفة","احتياجات المحاربين"] },
    ],
  },

  {
    id: "recruitment",
    icon: Megaphone24Filled,
    label: "التطويع",
    description: "إعلانات التطويع الرسمية",
    showInServices: true,
    tiles: [
      { id: "recruitment-ann", icon: Megaphone24Filled, label: "إعلانات التطويع", color: "blue", action: { kind: "route", path: "/services/recruitment" }, featureId: "jobs", keywords: ["تطويع","تجنيد","دورة","إعلان","قوى أمن","جيش"] },
      { id: "recruitment-terms", icon: ShieldTask24Filled, label: "شروط التطويع", color: "teal", action: { kind: "route", path: "/services/official/army-volunteering-conditions" }, featureId: "jobs", keywords: ["شروط التطويع","شروط","تطوع","متطلبات"] },
    ],
  },

  {
    id: "marketplace",
    icon: BuildingHome24Filled,
    label: "السوق المجتمعي",
    description: "تصفح البيع والشراء والإعلانات المجتمعية",
    tiles: [
      { id: "mkt-browse", icon: BuildingHome24Filled, label: "تصفح الإعلانات", color: "orange", action: { kind: "route", path: "/marketplace" }, featureId: "marketplace", keywords: ["سوق","إعلانات","عرض"] },
      { id: "mkt-post",   icon: Apps24Filled, label: "إضافة إعلان",    color: "teal",   action: { kind: "route", path: "/marketplace" }, featureId: "marketplace", keywords: ["بيع","نشر","إعلان"] },
      { id: "mkt-mine",   icon: Person24Filled, label: "إعلاناتي",       color: "purple", action: { kind: "route", path: "/marketplace" }, featureId: "marketplace", keywords: ["إعلاناتي","خاصة"] },
      { id: "mkt-search", icon: Search24Filled, label: "البحث عن عرض",   color: "blue",   action: { kind: "route", path: "/marketplace" }, featureId: "marketplace", keywords: ["بحث","عرض","طلب"] },
    ],
  },

  {
    id: "directory",
    icon: Phone24Filled,
    label: "الدليل",
    description: "أرقام الطوارئ، الجهات الرسمية، المستشفيات، المصارف",
    showInServices: false,
    tiles: [
      { id: "hospitals", icon: Building24Filled, label: "المستشفيات",        shortLabel: "المستشفيات", color: "orange", action: { kind: "event", name: "watany-open-directory", detail: { category: "hospitals" } }, keywords: ["مستشفى","مستشفيات","طوارئ"] },
      { id: "emergency", icon: AlertOn24Filled, label: "أرقام الطوارئ",      shortLabel: "الطوارئ",     color: "red",    action: { kind: "event", name: "watany-open-directory", detail: { category: "emergency" } }, keywords: ["طوارئ","إسعاف","نجدة"] },
      { id: "entities",  icon: BuildingGovernment24Filled, label: "الإدارات الرسمية",   shortLabel: "الجهات",      color: "blue",   action: { kind: "event", name: "watany-open-directory", detail: { category: "official" } }, keywords: ["جهة","رسمية","مؤسسة","حكومة"] },
      { id: "banks",     icon: BuildingBank24Filled, label: "مصارف الدفع",       shortLabel: "البنوك",      color: "teal",   action: { kind: "event", name: "watany-open-directory", detail: { category: "banks" } }, keywords: ["بنك","مصرف","مالية"] },
      { id: "review",    icon: PersonSupport24Filled, label: "مراكز المراجعة",     shortLabel: "مراجعة",     color: "gold",   action: { kind: "event", name: "watany-open-directory", detail: { category: "review" } }, keywords: ["مركز","مراجعة","دائرة"] },
    ],
  },

  {
    id: "community",
    icon: PersonSupport24Filled,
    label: "المجتمع والتواصل",
    showInServices: false,
    tiles: [
      { id: "community", icon: PersonSupport24Filled, label: "المجتمع",    color: "green",  action: { kind: "mode", mode: "community" }, keywords: ["مجتمع","نقاش","دردشة"] },
      { id: "groups",    icon: PersonSupport24Filled, label: "المجموعات",  color: "blue",   action: { kind: "mode", mode: "groups" }, featureId: "groups", keywords: ["مجموعة","فريق","غرفة"] },
      { id: "news",      icon: News24Filled, label: "الأخبار",    color: "orange", action: { kind: "mode", mode: "ticker" }, keywords: ["أخبار","إعلانات","تحديثات"] },
      { id: "live",      icon: Flash24Filled, label: "مباشر",      color: "red",    action: { kind: "mode", mode: "community" }, keywords: ["مباشر","بث","جلسة"] },
      { id: "media",     icon: DataTrending24Filled, label: "الإعلام",    color: "purple", action: { kind: "mode", mode: "media" }, featureId: "media", keywords: ["إعلام","فيديو","بث"] },
    ],
  },

  {
    id: "account",
    icon: PersonCircle24Filled,
    label: "حسابي",
    tiles: [
      { id: "profile",       icon: PersonCircle24Filled, label: "حسابي",       color: "slate",  action: { kind: "mode", mode: "profile" }, featureId: "profile", keywords: ["حساب","ملف","شخصي"] },
      { id: "settings",      icon: Settings24Filled, label: "الإعدادات",   color: "slate",  action: { kind: "route", path: "/settings" }, keywords: ["إعدادات","ضبط","خيارات"] },
      { id: "notifications", icon: AlertOn24Filled, label: "الإشعارات",   color: "orange", action: { kind: "mode", mode: "notifications" }, featureId: "notifications", keywords: ["إشعار","تنبيه","نوتيفيكيشن"] },
      { id: "bookmarks",     icon: Star24Filled, label: "المفضلة",     color: "gold",   action: { kind: "mode", mode: "bookmarks" }, featureId: "bookmarks", adminOnly: true, keywords: ["مفضلة","نجمة","حفظ"] },
      { id: "alerts",        icon: Warning24Filled, label: "التنبيهات",   color: "red",    action: { kind: "mode", mode: "alerts" }, featureId: "alerts", keywords: ["تنبيه","تحذير","إنذار"] },
      { id: "al-wafiyat-admin", icon: ShieldCheckmark24Filled, label: "إدارة الوفيات الرسمية", shortLabel: "إدارة الوفيات", color: "slate", action: { kind: "route", path: "/admin/al-wafiyat" }, adminOnly: true, keywords: ["إدارة الوفيات","اعتماد","وفيات","استيراد","مصادر رسمية"] },
      { id: "superadmin",    icon: BuildingRetailShield24Filled,label: "لوحة الإدارة",color: "slate",  action: { kind: "mode", mode: "superadmin" }, adminOnly: true, keywords: ["إدارة","مشرف","لوحة"] },
    ],
  },
];
