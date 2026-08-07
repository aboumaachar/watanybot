import { type ChangeEvent, type FormEvent, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { createReview, listReviews } from "../../lib/reviews-api";
import { api } from "../../lib/api";
import { useApp } from "../../store/app";
import { isLoginRequiredError, LOGIN_REQUIRED_GATE_MESSAGE_AR } from "../../lib/login-required";
import { LebanonAddressSelector, type LebanonAddressValue } from "../../components/address";
// APEX_CSS_FREEZE_DISABLED_IMPORT import "./market-mobile-commerce.css";

type MarketIntent = "buy" | "sell" | "service" | "skill";
type ContactPreference = "WHATSAPP" | "PHONE" | "IN_APP";

type MarketListing = {
  id: string;
  title: string;
  description?: string;
  category: string;
  intent: MarketIntent;
  priceLabel: string;
  mohafaza: string;
  caza: string;
  village: string;
  exactAddress?: string;
  locationLabel?: string;
  contactPreference: ContactPreference;
  trustStatus: string;
  moderationStatus: string;
  lifecycleStatus?: string;
  createdAt?: string;
  updatedAt?: string;
  emoji: string;
  isOwnerListing?: boolean;
  isSavedDemo?: boolean;
  isFavorited?: boolean;
  favouriteCount?: number;
  reportCount?: number;
  ownerId?: string;
  sellerUserId?: string;
  sellerName?: string;
  sellerPhone?: string;
  sellerWhatsapp?: string;
  sellerEmail?: string;
  primaryImageUrl?: string;
  images?: Array<{ id?: string; url: string; filename?: string; mimeType?: string; size?: number }>;
};

type MarketListingImage = {
  id?: string;
  url: string;
  filename?: string;
  mimeType?: string;
  size?: number;
};

type MarketCategoryChip = {
  id: string;
  icon: string;
  label: string;
  description?: string;
  enabled?: boolean;
  sortOrder?: number;
};

type MarketSellerProfile = {
  seller: {
    id: string;
    label: string;
    trustStatus: string;
    featuredVeteranSeller?: boolean;
    verifiedByWatany?: boolean;
    listingCount: number;
  };
  listings: MarketListing[];
};

type MarketReview = {
  id: string;
  targetId: string;
  score: number;
  note: string;
  createdAt: string;
};

const LEBANON_ADDRESS = {
  "بيروت": {
    "بيروت": ["الأشرفية", "الحمرا", "المزرعة", "رأس بيروت", "المصيطبة"],
  },
  "جبل لبنان": {
    "المتن": ["جل الديب", "برمانا", "بيت مري", "الدكوانة", "سن الفيل"],
    "كسروان": ["جونية", "ذوق مصبح", "غزير", "حراجل", "فتقا"],
    "بعبدا": ["بعبدا", "الحدث", "الشياح", "الحازمية"],
    "الشوف": ["بيت الدين", "دير القمر", "بعقلين", "الدامور"],
    "عاليه": ["عاليه", "بحمدون", "سوق الغرب"],
    "جبيل": ["جبيل", "عمشيت", "إده", "قرطبا"],
  },
  "الشمال": {
    "طرابلس": ["طرابلس", "الميناء", "القبة"],
    "زغرتا": ["زغرتا", "إهدن", "مرياطة"],
    "الكورة": ["أميون", "بترومين", "كفرعقا"],
    "البترون": ["البترون", "تنورين", "شكا"],
    "بشري": ["بشري", "حدث الجبة"],
    "المنية الضنية": ["المنية", "سير الضنية", "بخعون"],
  },
  "عكار": {
    "عكار": ["حلبا", "القبيات", "ببنين", "العبدة"],
  },
  "البقاع": {
    "زحلة": ["زحلة", "تعلبايا", "سعدنايل", "شتورا"],
    "البقاع الغربي": ["جب جنين", "القرعون", "صغبين"],
    "راشيا": ["راشيا", "ينطا", "كفرمشكي"],
  },
  "بعلبك الهرمل": {
    "بعلبك": ["بعلبك", "دورس", "النبي شيت", "رأس بعلبك"],
    "الهرمل": ["الهرمل", "القاع", "اللبوة"],
  },
  "الجنوب": {
    "صيدا": ["صيدا", "الهلالية", "مجدليون"],
    "صور": ["صور", "العباسية", "قانا"],
    "جزين": ["جزين", "لبعا", "كفرحونة"],
  },
  "النبطية": {
    "النبطية": ["النبطية", "كفررمان", "حبوش"],
    "مرجعيون": ["مرجعيون", "الخيام", "القليعة"],
    "بنت جبيل": ["بنت جبيل", "عيناتا", "رميش"],
    "حاصبيا": ["حاصبيا", "شبعا", "الهبارية"],
  },
} as const;

const INTENTS: Array<{ id: MarketIntent; icon: string; label: string }> = [
  { id: "buy", icon: "🛍️", label: "أشتري" },
  { id: "sell", icon: "🏷️", label: "أبيع" },
  { id: "service", icon: "🛠️", label: "خدمة" },
  { id: "skill", icon: "⭐", label: "مهارتي" },
];

const CATEGORIES = [
  { id: "all", icon: "✨", label: "الكل" },
  { id: "transport", icon: "🚕", label: "نقل" },
  { id: "services", icon: "🛠️", label: "خدمات" },
  { id: "freelance", icon: "💼", label: "أعمال" },
  { id: "property", icon: "🏠", label: "عقارات" },
  { id: "cars", icon: "🚗", label: "سيارات" },
  { id: "items", icon: "📦", label: "أغراض" },
];

const LISTING_TYPES = [
  { value: "all", label: "كل الأنواع" },
  { value: "sell", label: "بيع" },
  { value: "buy", label: "شراء" },
  { value: "service", label: "خدمة" },
  { value: "skill", label: "مهارة / عمل حر" },
  { value: "transport", label: "تاكسي / نقل" },
] as const;

const SAMPLE_LISTINGS: MarketListing[] = [
  {
    id: "sample-wheelchair",
    title: "كرسي متحرك خفيف الوزن",
    category: "items",
    intent: "sell",
    priceLabel: "120 USD",
    mohafaza: "بيروت",
    caza: "بيروت",
    village: "الأشرفية",
    locationLabel: "بيروت · بحالة جيدة",
    contactPreference: "PHONE",
    trustStatus: "موثّق",
    moderationStatus: "APPROVED",
    emoji: "♿",
    isSavedDemo: true,
  },
  {
    id: "sample-uniform",
    title: "بدلة خدمة عسكرية كاملة",
    category: "items",
    intent: "sell",
    priceLabel: "40 USD",
    mohafaza: "الجنوب",
    caza: "صيدا",
    village: "صيدا",
    locationLabel: "صيدا · قياس L",
    contactPreference: "WHATSAPP",
    trustStatus: "موثّق",
    moderationStatus: "APPROVED",
    emoji: "🎽",
    isOwnerListing: true,
  },
  {
    id: "sample-transport-line",
    title: "خدمة نقل يومية بيروت - جونية",
    category: "transport",
    intent: "service",
    priceLabel: "15 USD",
    mohafaza: "بيروت",
    caza: "بيروت",
    village: "الحمرا",
    locationLabel: "بيروت · جونية · ذهاب وإياب",
    contactPreference: "WHATSAPP",
    trustStatus: "مراجع",
    moderationStatus: "APPROVED",
    emoji: "🚕",
    isSavedDemo: true,
  },
  {
    id: "sample-generator-repair",
    title: "صيانة كهرباء ومولدات منزلية",
    category: "services",
    intent: "service",
    priceLabel: "25 USD",
    mohafaza: "جبل لبنان",
    caza: "كسروان",
    village: "جونية",
    locationLabel: "كسروان · متاح اليوم",
    contactPreference: "WHATSAPP",
    trustStatus: "موثّق",
    moderationStatus: "APPROVED",
    emoji: "🔧",
    isOwnerListing: true,
  },
  {
    id: "sample-guide",
    title: "مرشد سياحي لرحلات الجبل والشمال",
    category: "freelance",
    intent: "skill",
    priceLabel: "60 USD",
    mohafaza: "الشمال",
    caza: "طرابلس",
    village: "الميناء",
    locationLabel: "عربي / إنجليزي · حجز خاص",
    contactPreference: "WHATSAPP",
    trustStatus: "موثّق",
    moderationStatus: "APPROVED",
    emoji: "🧭",
    isSavedDemo: true,
  },
  {
    id: "sample-flat-rent",
    title: "شقة مفروشة للإيجار الشهري",
    category: "property",
    intent: "sell",
    priceLabel: "350 USD",
    mohafaza: "جبل لبنان",
    caza: "بعبدا",
    village: "الحدث",
    locationLabel: "قريبة من الخدمات · غرفتان",
    contactPreference: "PHONE",
    trustStatus: "موثّق",
    moderationStatus: "APPROVED",
    emoji: "🏠",
    isOwnerListing: true,
  },
  {
    id: "sample-rio-car",
    title: "سيارة كيا ريو 2014 للبيع",
    category: "cars",
    intent: "sell",
    priceLabel: "6800 USD",
    mohafaza: "البقاع",
    caza: "زحلة",
    village: "زحلة",
    locationLabel: "أوتوماتيك · ميكانيك نظيف",
    contactPreference: "PHONE",
    trustStatus: "مراجع",
    moderationStatus: "APPROVED",
    emoji: "🚗",
    isSavedDemo: true,
  },
  {
    id: "sample-laptop",
    title: "كمبيوتر محمول مستعمل للعمل المكتبي",
    category: "items",
    intent: "sell",
    priceLabel: "220 USD",
    mohafaza: "جبل لبنان",
    caza: "المتن",
    village: "جل الديب",
    locationLabel: "مناسب للدراسة والعمل",
    contactPreference: "WHATSAPP",
    trustStatus: "قيد الثقة",
    moderationStatus: "APPROVED",
    emoji: "💻",
  },
  {
    id: "sample-nursing-bed",
    title: "سرير تمريضي قابل للتعديل",
    category: "items",
    intent: "sell",
    priceLabel: "260 USD",
    mohafaza: "النبطية",
    caza: "النبطية",
    village: "كفررمان",
    locationLabel: "النبطية · مناسب للرعاية المنزلية",
    contactPreference: "PHONE",
    trustStatus: "موثّق",
    moderationStatus: "APPROVED",
    emoji: "🛏️",
  },
  {
    id: "sample-paint-team",
    title: "فريق دهان وترميم للشقق والمحلات",
    category: "services",
    intent: "service",
    priceLabel: "بحسب الكشف",
    mohafaza: "جبل لبنان",
    caza: "المتن",
    village: "سن الفيل",
    locationLabel: "المتن · مواعيد سريعة",
    contactPreference: "WHATSAPP",
    trustStatus: "مراجع",
    moderationStatus: "APPROVED",
    emoji: "🎨",
  },
  {
    id: "sample-buy-generator",
    title: "مطلوب مولد صغير بحالة جيدة",
    category: "items",
    intent: "buy",
    priceLabel: "حتى 300 USD",
    mohafaza: "البقاع",
    caza: "زحلة",
    village: "شتورا",
    locationLabel: "طلب شراء · دفع فوري",
    contactPreference: "IN_APP",
    trustStatus: "قيد الثقة",
    moderationStatus: "PENDING_REVIEW",
    emoji: "🔌",
    isOwnerListing: true,
    isSavedDemo: true,
  },
  {
    id: "sample-taxi-airport",
    title: "تاكسي من وإلى المطار على مدار الساعة",
    category: "transport",
    intent: "service",
    priceLabel: "20 USD",
    mohafaza: "بيروت",
    caza: "بيروت",
    village: "رأس بيروت",
    locationLabel: "حجز مسبق · استقبال بالمطار",
    contactPreference: "WHATSAPP",
    trustStatus: "موثّق",
    moderationStatus: "APPROVED",
    emoji: "✈️",
  },
  {
    id: "sample-office-desk",
    title: "مكتب خشبي مع أدراج للبيع",
    category: "items",
    intent: "sell",
    priceLabel: "95 USD",
    mohafaza: "الشمال",
    caza: "طرابلس",
    village: "القبة",
    locationLabel: "مناسب للمكتب المنزلي",
    contactPreference: "PHONE",
    trustStatus: "مراجع",
    moderationStatus: "NEEDS_REVISION",
    emoji: "🪑",
    isOwnerListing: true,
  },
  {
    id: "sample-photographer",
    title: "تصوير مناسبات ومنتجات للسوشال ميديا",
    category: "freelance",
    intent: "skill",
    priceLabel: "80 USD",
    mohafaza: "الجنوب",
    caza: "صور",
    village: "صور",
    locationLabel: "خبرة بالإعلانات والمتاجر",
    contactPreference: "WHATSAPP",
    trustStatus: "موثّق",
    moderationStatus: "APPROVED",
    emoji: "📸",
    isSavedDemo: true,
  },
];

const MARKET_CATEGORY_VALUES = new Set(["all", "transport", "services", "freelance", "property", "cars", "items"]);
const MARKET_INTENT_VALUES = new Set<MarketIntent>(["buy", "sell", "service", "skill"]);

function resolveIntent(value: unknown): MarketIntent {
  const normalized = safeString(value).toLowerCase();
  if (normalized === "buy" || normalized === "sell" || normalized === "service" || normalized === "skill") {
    return normalized;
  }
  return "service";
}

function getMarketplaceSectionCopy(section: string) {
  switch (section) {
    case "my-listings":
      return { title: "إعلاناتي", subtitle: "منشوراتي، ما ينتظر المراجعة، وما يحتاج تعديلاً." };
    case "saved":
      return { title: "محفوظاتي", subtitle: "إعلانات حفظتها للمتابعة والرجوع لاحقاً." };
    case "pending":
      return { title: "بانتظار المراجعة", subtitle: "إعلانات لم تُنشر بعد وتحتاج موافقة الإدارة." };
    case "approved":
      return { title: "الإعلانات المنشورة", subtitle: "عناصرك المقبولة والظاهرة حالياً في السوق." };
    case "trust":
    case "reports":
      return { title: "الثقة والبلاغات", subtitle: "إعلانات موثوقة أو مراجعة ضمن سلامة السوق." };
    case "nearby":
      return { title: "قريب مني", subtitle: "صفحة السوق جاهزة للفلترة حسب المنطقة." };
    case "services":
      return { title: "الخدمات المطلوبة", subtitle: "خدمات متاحة الآن مع مزودين موثوقين ومراجعين." };
    case "cars":
      return { title: "سوق السيارات", subtitle: "سيارات معروضة وطلبات شراء وقطع مرتبطة." };
    case "property":
      return { title: "العقارات", subtitle: "شقق وغرف وإيجارات شهرية ضمن مناطق مختلفة." };
    case "electronics":
      return { title: "الإلكترونيات", subtitle: "أجهزة ومستلزمات تقنية مع عروض جاهزة." };
    case "medical":
      return { title: "الدعم الطبي", subtitle: "معدات واحتياجات صحية للرعاية المنزلية." };
    case "furniture":
      return { title: "الأثاث والتجهيز", subtitle: "مكاتب وأثاث منزلي وعناصر للمساحات الصغيرة." };
    case "tools":
      return { title: "الأدوات والمعدات", subtitle: "عدة عمل ومستلزمات ورش وخدمات صيانة." };
    case "create":
      return { title: "إنشاء إعلان", subtitle: "أضف عرضاً جديداً وسيظهر هنا بعد المراجعة." };
    default:
      return { title: "إعلانات السوق", subtitle: "إعلانات بيع وشراء وخدمات مختارة للعرض التجريبي." };
  }
}

function getMarketplaceSectionBadge(section: string) {
  switch (section) {
    case "my-listings":
      return "لوحة المالك";
    case "saved":
      return "عناصر محفوظة";
    case "pending":
      return "بانتظار الموافقة";
    case "approved":
      return "منشور الآن";
    case "trust":
    case "reports":
      return "سلامة السوق";
    case "nearby":
      return "حسب المنطقة";
    case "services":
      return "طلب مرتفع";
    case "cars":
      return "سوق متخصص";
    case "property":
      return "عروض سكن";
    case "electronics":
      return "تقنية";
    case "medical":
      return "احتياجات صحية";
    case "furniture":
      return "أثاث وتجهيز";
    case "tools":
      return "عدة ومعدات";
    case "create":
      return "إضافة جديدة";
    default:
      return "عرض تجريبي";
  }
}

// ADDRESS_MOHAFAZA removed; use ADDRESS_MOHAFAZA_OPTIONS at file bottom

function safeString(value: unknown, fallback = ""): string {
  if (typeof value === "string") return value.trim() || fallback;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return fallback;
}

function pickEmoji(category: string): string {
  if (category === "transport") return "🚕";
  if (category === "services") return "🛠️";
  if (category === "freelance") return "💼";
  if (category === "property") return "🏠";
  if (category === "cars") return "🚗";
  if (category === "items") return "📦";
  return "🛒";
}

function buildListingLocation(row: Record<string, unknown>): string {
  const explicitLabel = safeString(row.locationLabel);
  if (explicitLabel) {
    return explicitLabel;
  }

  const hierarchy = [
    safeString(row.mohafaza),
    safeString(row.caza),
    safeString(row.village),
    safeString(row.exactAddress),
  ].filter(Boolean).join(" · ");

  if (hierarchy) {
    return hierarchy;
  }

  return safeString(row.location);
}

function toAddressValue(value?: Partial<LebanonAddressValue> | null): LebanonAddressValue {
  return {
    mohafaza: value?.mohafaza || "",
    qaza: value?.qaza || "",
    village: value?.village || "",
    exactAddress: value?.exactAddress || "",
    displayAddress: value?.displayAddress || "",
    source: value?.source,
    status: value?.status,
  };
}

function marketAddressFromListing(listing?: MarketListing | null): LebanonAddressValue {
  return toAddressValue({
    mohafaza: listing?.mohafaza || "",
    qaza: listing?.caza || "",
    village: listing?.village || "",
    exactAddress: listing?.exactAddress || "",
    displayAddress: listing?.locationLabel || "",
  });
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
        return;
      }
      reject(new Error("file reader returned unexpected result"));
    };
    reader.onerror = () => reject(reader.error || new Error("file reader failed"));
    reader.readAsDataURL(file);
  });
}

function normalizeListingImages(value: unknown): MarketListingImage[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const normalizedImages: MarketListingImage[] = [];
  for (const image of value) {
    if (!image || typeof image !== "object") {
      continue;
    }
    const imageRecord = image as Record<string, unknown>;
    const url = safeString(imageRecord.url);
    if (!url) {
      continue;
    }
    normalizedImages.push({
      id: safeString(imageRecord.id) || undefined,
      url,
      filename: safeString(imageRecord.filename) || undefined,
      mimeType: safeString(imageRecord.mimeType) || undefined,
      size: Number.isFinite(Number(imageRecord.size)) ? Number(imageRecord.size) : undefined,
    });
  }
  return normalizedImages;
}

function normalizeListing(raw: unknown, index: number): MarketListing {
  const row = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const category = safeString(row.category, "services");
  const numericPrice = Number(row.price);
  const currency = safeString(row.currency, "USD");
  const resolvedPriceLabel = safeString(
    row.priceLabel,
    Number.isFinite(numericPrice) && numericPrice > 0 ? `${numericPrice} ${currency}` : safeString(row.salaryRange, "اتصل للسعر"),
  );
  return {
    id: safeString(row.id, `listing-${index}`),
    title: safeString(row.title ?? row.titleAr, "إعلان من السوق"),
    description: safeString(row.description, ""),
    category,
    intent: resolveIntent(row.intent ?? row.type ?? row.listingType),
    priceLabel: resolvedPriceLabel,
    mohafaza: safeString(row.mohafaza ?? row.governorate, "لبنان"),
    caza: safeString(row.caza ?? row.district, ""),
    village: safeString(row.village ?? row.town, ""),
    exactAddress: safeString(row.exactAddress, ""),
    locationLabel: buildListingLocation(row),
    contactPreference: safeString(row.contactPreference, "WHATSAPP") as ContactPreference,
    trustStatus: safeString(row.trustStatus, "موثّق"),
    moderationStatus: safeString(row.moderationStatus ?? row.status, "APPROVED"),
    lifecycleStatus: safeString(row.status, "active"),
    createdAt: safeString(row.createdAt),
    updatedAt: safeString(row.updatedAt),
    emoji: pickEmoji(category),
    isOwnerListing: Boolean(row.isOwnerListing),
    isSavedDemo: Boolean(row.isSavedDemo),
    isFavorited: Boolean(row.isFavorited),
    favouriteCount: Number.isFinite(Number(row.favouriteCount)) ? Number(row.favouriteCount) : 0,
    reportCount: Number.isFinite(Number(row.reportCount)) ? Number(row.reportCount) : 0,
    ownerId: safeString(row.ownerId),
    sellerUserId: safeString(row.sellerUserId || row.ownerId),
    sellerName: safeString(row.sellerProfileLabel ?? row.seller, "مستخدم موطني"),
    sellerPhone: safeString(row.sellerPhone),
    sellerWhatsapp: safeString(row.sellerWhatsapp),
    sellerEmail: safeString(row.sellerEmail),
    primaryImageUrl: safeString(row.primaryImageUrl),
    images: normalizeListingImages(row.images),
  };
}

function apiBase(): string {
  const envBase = import.meta.env.VITE_GATEWAY_BASE_URL;
  if (typeof envBase === "string" && envBase.trim()) return envBase.trim().replace(/\/$/, "");
  return "";
}

export function MarketMobileCommerceLayout() {
  const { profile } = useApp();
  const navigate = useNavigate();
  const location = useLocation();
  const searchParams = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const currentSection = searchParams.get("section") || "browse";
  const [intent, setIntent] = useState<MarketIntent | "all">("all");
  const [category, setCategory] = useState("all");
  const [listingType, setListingType] = useState<(typeof LISTING_TYPES)[number]["value"]>("all");
  const [mohafaza, setMohafaza] = useState("");
  const [caza, setCaza] = useState("");
  const [village, setVillage] = useState("");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [listings, setListings] = useState<MarketListing[]>([]);
  const [marketCategories, setMarketCategories] = useState<MarketCategoryChip[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [submissionNotice, setSubmissionNotice] = useState<string | null>(null);
  const [marketReviews, setMarketReviews] = useState<MarketReview[]>([]);
  const [reviewTargetId, setReviewTargetId] = useState<string | null>(null);
  const [reviewScore, setReviewScore] = useState(5);
  const [reviewNote, setReviewNote] = useState("");
  const [reportTargetId, setReportTargetId] = useState<string | null>(null);
  const [reportReason, setReportReason] = useState("إعلان يحتاج مراجعة");
  const [reportNote, setReportNote] = useState("");
  const [detailListing, setDetailListing] = useState<MarketListing | null>(null);
  const [sellerProfile, setSellerProfile] = useState<MarketSellerProfile | null>(null);
  const [editingListingId, setEditingListingId] = useState<string | null>(null);
  const [formAddress, setFormAddress] = useState<LebanonAddressValue>(toAddressValue());
  const [draftImages, setDraftImages] = useState<File[]>([]);
  const [isSubmittingListing, setIsSubmittingListing] = useState(false);

  const editingListing = useMemo(
    () => listings.find((listing) => listing.id === editingListingId) || null,
    [editingListingId, listings],
  );

  const categoryOptions = useMemo(() => {
    if (marketCategories.length > 0) {
      return [{ id: "all", icon: "✨", label: "الكل" }, ...marketCategories];
    }
    return CATEGORIES;
  }, [marketCategories]);

  const cazaOptions = useMemo(() => {
    if (!mohafaza) return [];
    const entry = LEBANON_ADDRESS[mohafaza as keyof typeof LEBANON_ADDRESS];
    return entry ? Object.keys(entry) : [];
  }, [mohafaza]);

  const villageOptions = useMemo(() => {
    if (!mohafaza || !caza) return [];
    const entry = LEBANON_ADDRESS[mohafaza as keyof typeof LEBANON_ADDRESS] as Record<string, readonly string[]> | undefined;
    return entry?.[caza] ? Array.from(entry[caza]) : [];
  }, [mohafaza, caza]);

  useEffect(() => {
    let cancelled = false;

    async function loadMarketData() {
      setIsLoading(true);
      try {
        const [publicListings, ownListings, favoriteListings, categories] = await Promise.all([
          api.listMarketplace(apiBase()),
          profile.isAuthed ? api.listMyMarketplaceListings("", apiBase()).catch(() => []) : Promise.resolve([]),
          profile.isAuthed ? api.listMyFavoriteMarketplaceListings(apiBase()).catch(() => []) : Promise.resolve([]),
          api.listMarketCategories(apiBase()).catch(() => []),
        ]);

        if (cancelled) return;

        const favoriteIds = new Set(favoriteListings.map((listing) => listing.id));
        const merged = new Map<string, MarketListing>();
        for (const source of [publicListings, ownListings, favoriteListings]) {
          source.forEach((item, index) => {
            const normalized = normalizeListing(item, index);
            if (favoriteIds.has(normalized.id)) {
              normalized.isFavorited = true;
            }
            const existing = merged.get(normalized.id);
            merged.set(normalized.id, existing ? { ...existing, ...normalized } : normalized);
          });
        }

        setListings(Array.from(merged.values()));
        setMarketCategories(categories.map((entry) => ({
          id: entry.id,
          icon: entry.icon || pickEmoji(entry.id),
          label: entry.labelAr,
          description: entry.labelEn,
          enabled: entry.enabled,
          sortOrder: entry.sortOrder,
        })));
      } catch {
        if (!cancelled) {
          setListings(SAMPLE_LISTINGS);
          setSubmissionNotice("تعذر تحميل السوق من الخادم. يتم عرض بيانات محلية مؤقتة.");
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    void loadMarketData();
    return () => {
      cancelled = true;
    };
  }, [profile.isAuthed]);

  useEffect(() => {
    const queryCategory = searchParams.get("category");
    const queryIntent = searchParams.get("intent");
    const queryType = searchParams.get("type");
    const queryMohafaza = searchParams.get("mohafaza");
    const queryCaza = searchParams.get("caza");
    const queryVillage = searchParams.get("village");

    setCategory(queryCategory && MARKET_CATEGORY_VALUES.has(queryCategory) ? queryCategory : "all");
    setIntent(queryIntent && MARKET_INTENT_VALUES.has(queryIntent as MarketIntent) ? (queryIntent as MarketIntent) : "all");
    setListingType(queryType && LISTING_TYPES.some((item) => item.value === queryType) ? (queryType as (typeof LISTING_TYPES)[number]["value"]) : "all");
    setMohafaza(queryMohafaza || "");
    setCaza(queryCaza || "");
    setVillage(queryVillage || "");
    setCreateOpen(currentSection === "create");
    setSheetOpen(currentSection === "nearby" || currentSection === "filter");
    if (currentSection !== "create") {
      setEditingListingId(null);
      setDraftImages([]);
    }
  }, [currentSection, searchParams]);

  useEffect(() => {
    let cancelled = false;
    listReviews("market_listing")
      .then((response) => {
        if (!cancelled) setMarketReviews(response.reviews.map((review) => ({
          id: review.id,
          targetId: review.targetId,
          score: review.score,
          note: review.note || "",
          createdAt: review.createdAt,
        })));
      })
      .catch(() => {
        if (!cancelled) setMarketReviews([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    setCaza("");
    setVillage("");
  }, [mohafaza]);

  useEffect(() => {
    setVillage("");
  }, [caza]);

  const filteredListings = useMemo(() => {
    return listings.filter((listing) => {
      if (currentSection === "saved" && !listing.isFavorited) return false;
      if (currentSection === "my-listings" && !listing.isOwnerListing) return false;
      if (currentSection === "pending" && (!listing.isOwnerListing || listing.moderationStatus !== "PENDING_REVIEW")) return false;
      if (currentSection === "approved" && (!listing.isOwnerListing || listing.moderationStatus !== "APPROVED")) return false;
      if (currentSection === "reports" && !(listing.reportCount && listing.reportCount > 0)) return false;
      if (currentSection === "trust" && !["موثّق", "مراجع"].includes(listing.trustStatus)) return false;
      if (!["pending", "my-listings", "approved", "reports"].includes(currentSection) && listing.moderationStatus === "PENDING_REVIEW") return false;
      if (category !== "all" && listing.category !== category) return false;
      if (intent !== "all" && listing.intent !== intent) return false;
      if (listingType === "transport" && listing.category !== "transport") return false;
      if (listingType !== "all" && listingType !== "transport" && listing.intent !== listingType) return false;
      if (mohafaza && listing.mohafaza !== mohafaza) return false;
      if (caza && listing.caza !== caza) return false;
      if (village && listing.village !== village) return false;
      return true;
    });
  }, [category, caza, currentSection, intent, listingType, listings, mohafaza, village]);

  const sectionCopy = useMemo(() => getMarketplaceSectionCopy(currentSection), [currentSection]);
  const sectionBadge = useMemo(() => getMarketplaceSectionBadge(currentSection), [currentSection]);

  const marketReviewSummary = useMemo(() => {
    const grouped = new Map<string, { average: number; count: number; latestNote: string | null }>();
    for (const review of marketReviews) {
      const current = grouped.get(review.targetId);
      if (!current) {
        grouped.set(review.targetId, { average: review.score, count: 1, latestNote: review.note || null });
        continue;
      }
      const totalScore = current.average * current.count + review.score;
      grouped.set(review.targetId, {
        average: totalScore / (current.count + 1),
        count: current.count + 1,
        latestNote: review.note || current.latestNote,
      });
    }
    return grouped;
  }, [marketReviews]);

  function syncListing(nextListing: MarketListing) {
    setListings((current) => {
      const next = [...current];
      const index = next.findIndex((listing) => listing.id === nextListing.id);
      if (index >= 0) {
        next[index] = nextListing;
        return next;
      }
      return [nextListing, ...next];
    });
  }

  async function uploadSelectedImages(): Promise<Array<{ url: string; filename?: string; mimeType?: string; size?: number }>> {
    const uploadedImages: Array<{ url: string; filename?: string; mimeType?: string; size?: number }> = [];
    for (const file of draftImages) {
      const dataUrl = await readFileAsDataUrl(file);
      const uploaded = await api.uploadMarketplaceImage({
        filename: file.name,
        mimeType: file.type || "image/jpeg",
        dataUrl,
      }, apiBase());
      uploadedImages.push(uploaded);
    }
    return uploadedImages;
  }

  async function submitCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!profile.isAuthed) {
      promptRegistrationForMarketAction();
      return;
    }

    setIsSubmittingListing(true);
    const form = new FormData(event.currentTarget);
    const priceLabel = safeString(form.get("priceLabel"), "اتصل للسعر");
    const priceMatch = /\d+(?:[.,]\d+)?/.exec(priceLabel);
    const parsedPrice = Number((priceMatch?.[0] || "").replace(",", "."));
    const resolvedPrice = Number.isFinite(parsedPrice) && parsedPrice > 0 ? parsedPrice : 1;
    const listingLocation = [
      formAddress.mohafaza || "لبنان",
      formAddress.qaza,
      formAddress.village,
      formAddress.exactAddress || "",
    ].filter(Boolean).join(" · ") || "لبنان";
    const payload = {
      title: safeString(form.get("title"), "إعلان من السوق"),
      category: safeString(form.get("category"), "services"),
      description: safeString(form.get("description"), "إعلان مختصر من واجهة السوق الجديدة."),
      price: resolvedPrice,
      currency: "USD",
      location: listingLocation,
      locationLabel: listingLocation,
      mohafaza: formAddress.mohafaza,
      caza: formAddress.qaza,
      village: formAddress.village,
      exactAddress: formAddress.exactAddress,
      seller: safeString(profile.name, "مستخدم موطني"),
      contact: safeString(profile.phone || profile.email, "70000000"),
      sellerEmail: safeString(profile.email, ""),
      sellerWhatsapp: safeString(profile.phone, ""),
      listingType: listingType === "all" || listingType === "transport" ? undefined : listingType,
      contactPreference: safeString(form.get("contactPreference"), "IN_APP") as ContactPreference,
    };

    try {
      const uploadedImages = draftImages.length > 0 ? await uploadSelectedImages() : [];
      const created = editingListing
        ? await api.updateMarketplaceListing(editingListing.id, payload, apiBase())
        : await api.createListing({ ...payload, images: uploadedImages }, apiBase());
      const nextListing = normalizeListing(created, 0);
      if (editingListing && uploadedImages.length > 0) {
        const updated = await api.attachMarketplaceImages(editingListing.id, uploadedImages, apiBase());
        syncListing(normalizeListing(updated, 0));
      } else {
        syncListing(nextListing);
      }
      setSubmissionNotice(editingListing ? "تم تحديث الإعلان وإرساله إلى المراجعة عند الحاجة." : "تم إرسال الإعلان إلى مراجعة الإدارة.");
      setCreateOpen(false);
      setEditingListingId(null);
      setDraftImages([]);
      setFormAddress(toAddressValue());
    } catch (error) {
      if (isLoginRequiredError(error)) {
        setSubmissionNotice(LOGIN_REQUIRED_GATE_MESSAGE_AR);
        globalThis.setTimeout(() => {
          navigate(`/register?next=${encodeURIComponent(location.pathname + location.search + location.hash)}`);
        }, 120);
        return;
      }
      setSubmissionNotice("تعذر إرسال الإعلان الآن. يمكنك المحاولة لاحقاً أو التواصل مع الإدارة.");
    } finally {
      setIsSubmittingListing(false);
    }
  }

  function handleDraftImagesChange(event: ChangeEvent<HTMLInputElement>) {
    setDraftImages(Array.from(event.target.files || []).slice(0, 6));
  }

  async function handleFavoriteToggle(listing: MarketListing) {
    if (!profile.isAuthed) {
      promptRegistrationForMarketAction();
      return;
    }
    try {
      if (listing.isFavorited) {
        await api.unfavoriteMarketplaceListing(listing.id, apiBase());
        syncListing({ ...listing, isFavorited: false, favouriteCount: Math.max(0, (listing.favouriteCount || 1) - 1) });
      } else {
        await api.sendMarketplaceInterest(listing.id, apiBase());
        syncListing({ ...listing, isFavorited: true, favouriteCount: (listing.favouriteCount || 0) + 1 });
      }
    } catch {
      setSubmissionNotice("تعذر تحديث المحفوظات الآن.");
    }
  }

  async function handleLifecycleAction(listing: MarketListing, action: "reserve" | "sold" | "hide" | "archive" | "renew") {
    if (!profile.isAuthed) {
      promptRegistrationForMarketAction();
      return;
    }
    try {
      const updated = action === "reserve"
        ? await api.reserveMarketplaceListing(listing.id, apiBase())
        : action === "sold"
          ? await api.closeMarketplaceListing(listing.id, safeString(profile.phone || profile.email), apiBase())
          : action === "hide"
            ? await api.hideMarketplaceListing(listing.id, apiBase())
            : action === "archive"
              ? await api.archiveMarketplaceListing(listing.id, apiBase())
              : await api.renewMarketplaceListing(listing.id, apiBase());
      syncListing(normalizeListing(updated, 0));
    } catch {
      setSubmissionNotice("تعذر تنفيذ الإجراء على الإعلان حالياً.");
    }
  }

  async function openListingDetails(listing: MarketListing) {
    try {
      const [detail, seller] = await Promise.all([
        api.getMarketplaceListing(listing.id, apiBase()),
        listing.sellerUserId ? api.getMarketplaceSellerProfile(listing.sellerUserId, apiBase()).catch(() => null) : Promise.resolve(null),
      ]);
      setDetailListing(normalizeListing(detail, 0));
      setSellerProfile(seller ? {
        seller: seller.seller,
        listings: seller.listings.map((item, index) => normalizeListing(item, index)),
      } : null);
    } catch {
      setSubmissionNotice("تعذر تحميل تفاصيل الإعلان الآن.");
    }
  }

  async function submitReport() {
    if (!reportTargetId) return;
    if (!profile.isAuthed) {
      promptRegistrationForMarketAction();
      return;
    }
    try {
      await api.reportMarketplaceListing(reportTargetId, { reason: reportReason, note: reportNote.trim() }, apiBase());
      setSubmissionNotice("تم إرسال البلاغ إلى فريق المراجعة.");
      setReportTargetId(null);
      setReportReason("إعلان يحتاج مراجعة");
      setReportNote("");
      setListings((current) => current.map((listing) => listing.id === reportTargetId ? { ...listing, reportCount: (listing.reportCount || 0) + 1 } : listing));
    } catch {
      setSubmissionNotice("تعذر إرسال البلاغ الآن.");
    }
  }

  async function removeListingImage(listingId: string, imageId: string) {
    try {
      const updated = await api.removeMarketplaceImage(listingId, imageId, apiBase());
      const normalized = normalizeListing(updated, 0);
      syncListing(normalized);
      if (detailListing?.id === normalized.id) {
        setDetailListing(normalized);
      }
    } catch {
      setSubmissionNotice("تعذر حذف الصورة الآن.");
    }
  }

  function promptRegistrationForMarketAction(): void {
    setSubmissionNotice(LOGIN_REQUIRED_GATE_MESSAGE_AR);
    globalThis.setTimeout(() => {
      navigate(`/register?next=${encodeURIComponent(location.pathname + location.search + location.hash)}`);
    }, 120);
  }

  async function submitReview() {
    if (!reviewTargetId) return;
    if (!profile.isAuthed) {
      promptRegistrationForMarketAction();
      return;
    }
    try {
      const response = await createReview({
        targetType: "market_listing",
        targetId: reviewTargetId,
        score: reviewScore,
        note: reviewNote.trim(),
        userId: "market-mobile-local-user",
      });
      setMarketReviews((current) => [{
        id: response.review.id,
        targetId: response.review.targetId,
        score: response.review.score,
        note: response.review.note || "",
        createdAt: response.review.createdAt,
      }, ...current].slice(0, 60));
    } catch {
      return;
    }
    setReviewTargetId(null);
    setReviewScore(5);
    setReviewNote("");
  }

  function openCreateSheet(listing?: MarketListing) {
    setEditingListingId(listing?.id || null);
    setFormAddress(marketAddressFromListing(listing || null));
    setDraftImages([]);
    setCreateOpen(true);
  }

  function handleContactAction(listing: MarketListing) {
    if (listing.contactPreference === "IN_APP") {
      navigate(`/chat?draft=${encodeURIComponent(`أرغب بالتواصل بخصوص الإعلان: ${listing.title}`)}`);
      return;
    }
    const rawPhone = (listing.sellerWhatsapp || listing.sellerPhone || "").replace(/[^\d+]/g, "");
    if (!rawPhone) {
      setSubmissionNotice("بيانات التواصل غير متاحة لهذا الإعلان حالياً.");
      return;
    }
    if (listing.contactPreference === "PHONE") {
      globalThis.location.href = `tel:${rawPhone}`;
      return;
    }
    const waPhone = rawPhone.startsWith("+") ? rawPhone.slice(1) : rawPhone;
    globalThis.location.href = `https://wa.me/${waPhone}`;
  }

  return (
    <main className="market-commerce-page" dir="rtl" data-market-mobile-commerce-layout="v1" data-market-section={currentSection}>
      <header className="market-commerce-sticky-header">
        <div className="market-commerce-sticky-bar">
          <section className="market-commerce-intents" aria-label="اختصارات السوق">
            {INTENTS.map((item) => (
              <button key={item.id} className={intent === item.id ? "is-active" : ""} type="button" aria-label={item.label} title={item.label} onClick={() => setIntent(intent === item.id ? "all" : item.id)}>
                <span aria-hidden="true">{item.icon}</span>
                <span className="market-commerce-sr-only">{item.label}</span>
              </button>
            ))}
          </section>

          <button
            className="market-commerce-fab"
            type="button"
            aria-label="إنشاء إعلان"
            title="إنشاء إعلان"
            onClick={() => {
              if (!profile.isAuthed) {
                promptRegistrationForMarketAction();
                return;
              }
              openCreateSheet();
            }}
          >
            <span aria-hidden="true">＋</span>
            <span className="market-commerce-sr-only">إنشاء إعلان</span>
          </button>
        </div>
      </header>

      {submissionNotice ? <section className="market-commerce-feedback">{submissionNotice}</section> : null}

      <section className="market-commerce-chips" aria-label="فئات السوق">
        {categoryOptions.map((item) => (
          <button key={item.id} data-feature-key={item.id} className={category === item.id ? "is-active" : ""} type="button" onClick={() => setCategory(item.id)}>
            <span aria-hidden="true">{item.icon}</span>
            {item.label}
          </button>
        ))}
      </section>

      <section className="market-commerce-filter-row" aria-label="فلاتر السوق">
        <button type="button" className="is-active" onClick={() => setSheetOpen(true)}>
          📍 الموقع
        </button>
        <button type="button">الأحدث</button>
        <button type="button">السعر</button>
        <button type="button">موثّق</button>
        <button type="button" onClick={() => setSheetOpen(true)}>
          فلتر
        </button>
      </section>

      {currentSection === "browse" ? null : (
        <section className="market-commerce-my-listings" aria-label="إعلاناتي">
          <span aria-hidden="true">📋</span>
          <div>
            <strong>{sectionCopy.title}</strong>
            <small>{sectionCopy.subtitle}</small>
          </div>
          <mark className="market-commerce-section-badge">{sectionBadge}</mark>
        </section>
      )}

      <section className="market-commerce-listings" aria-label="الإعلانات">
        <div className="market-commerce-section-head">
          <h2 className="market-commerce-section-title">{sectionCopy.title}</h2>
          <button type="button" onClick={() => navigate("/marketplace?section=browse")}>عرض الكل</button>
        </div>

        {isLoading ? (
          <div className="market-commerce-empty">
            <span aria-hidden="true">⏳</span>
            <strong>جارٍ تحميل السوق</strong>
            <p>يتم جلب الإعلانات والفئات من الخادم الآن.</p>
          </div>
        ) : filteredListings.length === 0 ? (
          <div className="market-commerce-empty">
            <span aria-hidden="true">🔎</span>
            <strong>لا توجد نتائج مطابقة</strong>
            <p>جرّب إزالة فلتر أو البحث بكلمة أبسط.</p>
          </div>
        ) : (
          filteredListings.map((listing) => (
            <article key={listing.id} className="market-commerce-card">
              <div className="market-commerce-card-media" aria-hidden="true">
                {listing.primaryImageUrl ? <img src={listing.primaryImageUrl} alt={listing.title} /> : listing.emoji}
              </div>
              <div className="market-commerce-card-info">
                <h3>{listing.title}</h3>
                <p>
                  {listing.locationLabel || [listing.mohafaza, listing.caza, listing.village].filter(Boolean).join(" · ")}
                </p>
                <div className="market-commerce-price-row">
                  <strong>{listing.priceLabel}</strong>
                  <span>{listing.trustStatus}</span>
                  {listing.favouriteCount ? <span>🔖 {listing.favouriteCount}</span> : null}
                  {listing.reportCount ? <span>🚩 {listing.reportCount}</span> : null}
                  {marketReviewSummary.get(listing.id) ? <span>⭐ {marketReviewSummary.get(listing.id)?.average.toFixed(1)} ({marketReviewSummary.get(listing.id)?.count})</span> : null}
                </div>
                <div className="market-commerce-actions">
                  <button type="button" className="primary" onClick={() => handleContactAction(listing)}>
                    {listing.contactPreference === "IN_APP" ? "دردشة" : listing.contactPreference === "PHONE" ? "اتصال" : "واتساب"}
                  </button>
                  <button type="button" onClick={() => void handleFavoriteToggle(listing)}>
                    {listing.isFavorited ? "إلغاء الحفظ" : "حفظ"}
                  </button>
                  <button type="button" onClick={() => void openListingDetails(listing)}>
                    تفاصيل
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (!profile.isAuthed) {
                        promptRegistrationForMarketAction();
                        return;
                      }
                      setReviewTargetId(listing.id);
                      setReviewScore(5);
                      setReviewNote("");
                    }}
                  >
                    اكتب تقييم
                  </button>
                </div>
                {listing.isOwnerListing ? (
                  <div className="market-commerce-actions">
                    <button type="button" onClick={() => openCreateSheet(listing)}>تعديل</button>
                    <button type="button" onClick={() => void handleLifecycleAction(listing, "renew")}>تجديد</button>
                    <button type="button" onClick={() => void handleLifecycleAction(listing, "reserve")}>حجز</button>
                    <button type="button" onClick={() => void handleLifecycleAction(listing, "sold")}>تم البيع</button>
                    <button type="button" onClick={() => void handleLifecycleAction(listing, "hide")}>إخفاء</button>
                    <button type="button" onClick={() => void handleLifecycleAction(listing, "archive")}>أرشفة</button>
                  </div>
                ) : (
                  <div className="market-commerce-actions">
                    <button type="button" onClick={() => { setReportTargetId(listing.id); setReportNote(""); setReportReason("إعلان يحتاج مراجعة"); }}>إبلاغ</button>
                  </div>
                )}
                {reviewTargetId === listing.id ? (
                  <div className="market-commerce-review-box">
                    <div className="market-commerce-review-stars">
                      {[1, 2, 3, 4, 5].map((score) => (
                        <button key={`${listing.id}-${score}`} type="button" className={score <= reviewScore ? "is-active" : ""} onClick={() => setReviewScore(score)}>
                          ★
                        </button>
                      ))}
                    </div>
                    <textarea value={reviewNote} placeholder="شارك انطباعك عن الإعلان أو مقدم الخدمة" onChange={(event) => setReviewNote(event.target.value)} />
                    <div className="market-commerce-review-actions">
                      <button type="button" onClick={() => setReviewTargetId(null)}>إلغاء</button>
                      <button type="button" className="primary" onClick={submitReview}>إرسال</button>
                    </div>
                  </div>
                ) : null}
              </div>
            </article>
          ))
        )}
      </section>

      {sheetOpen ? (
        <section className="market-commerce-sheet" aria-label="فلترة السوق">
          <div className="market-commerce-sheet-handle" />
          <div className="market-commerce-sheet-head">
            <h2>فلترة السوق</h2>
            <button type="button" aria-label="إغلاق" onClick={() => setSheetOpen(false)}>×</button>
          </div>
          <label>
            <span>المحافظة</span>
            <select value={mohafaza} onChange={(event) => setMohafaza(event.target.value)}>
              <option value="">كل المحافظات</option>
              {ADDRESS_MOHAFAZA_OPTIONS.map((item) => (
                <option key={item} value={item}>{item}</option>
              ))}
            </select>
          </label>
          <label>
            <span>القضاء</span>
            <select value={caza} onChange={(event) => setCaza(event.target.value)} disabled={!mohafaza}>
              <option value="">اختر القضاء</option>
              {cazaOptions.map((item) => (
                <option key={item} value={item}>{item}</option>
              ))}
            </select>
          </label>
          <label>
            <span>البلدة / القرية</span>
            <select value={village} onChange={(event) => setVillage(event.target.value)} disabled={!caza}>
              <option value="">اختر البلدة</option>
              {villageOptions.map((item) => (
                <option key={item} value={item}>{item}</option>
              ))}
            </select>
          </label>
          <label>
            <span>نوع الإعلان</span>
            <select value={listingType} onChange={(event) => setListingType(event.target.value as (typeof LISTING_TYPES)[number]["value"])}>
              {LISTING_TYPES.map((item) => (
                <option key={item.value} value={item.value}>{item.label}</option>
              ))}
            </select>
          </label>
          <button type="button" className="market-commerce-apply" onClick={() => setSheetOpen(false)}>تطبيق الفلتر</button>
        </section>
      ) : null}

      {createOpen ? (
        <section className="market-commerce-sheet market-commerce-sheet--create" aria-label="إنشاء إعلان">
          <div className="market-commerce-sheet-handle" />
          <div className="market-commerce-sheet-head">
            <h2>{editingListing ? "تعديل الإعلان" : "إنشاء إعلان"}</h2>
            <button type="button" aria-label="إغلاق" onClick={() => { setCreateOpen(false); setEditingListingId(null); }}>×</button>
          </div>
          <form key={editingListing?.id || "create"} className="market-commerce-create-form" onSubmit={submitCreate}>
            <label>
              <span>العنوان</span>
              <input name="title" placeholder="مثلاً: خدمة تاكسي يومية" required defaultValue={editingListing?.title || ""} />
            </label>
            <label>
              <span>الفئة</span>
              <select name="category" defaultValue={editingListing?.category || "services"}>
                {categoryOptions.filter((item) => item.id !== "all").map((item) => (
                  <option key={item.id} value={item.id}>{item.label}</option>
                ))}
              </select>
            </label>
            <label>
              <span>السعر</span>
              <input name="priceLabel" placeholder="اتصل للسعر" defaultValue={editingListing?.priceLabel || ""} />
            </label>
            <label>
              <span>طريقة التواصل</span>
              <select name="contactPreference" defaultValue={editingListing?.contactPreference || "IN_APP"}>
                <option value="IN_APP">دردشة داخل موطني</option>
                <option value="WHATSAPP">واتساب</option>
                <option value="PHONE">اتصال</option>
              </select>
            </label>
            <label>
              <span>الوصف</span>
              <textarea name="description" placeholder="اكتب وصفاً قصيراً ومباشراً" defaultValue={editingListing?.description || ""} />
            </label>
            <LebanonAddressSelector
              key={`${editingListing?.id || "create"}-${formAddress.mohafaza}-${formAddress.qaza}-${formAddress.village}`}
              value={formAddress}
              onChange={setFormAddress}
              exactAddressPlaceholder="الشارع، المبنى، أو وصف دقيق للمكان"
            />
            <label>
              <span>صور الإعلان</span>
              <input type="file" accept="image/png,image/jpeg,image/webp" multiple onChange={handleDraftImagesChange} />
            </label>
            {draftImages.length > 0 ? <small>{draftImages.map((file) => file.name).join("، ")}</small> : null}
            {editingListing?.images?.length ? (
              <div className="market-commerce-actions">
                {editingListing.images.map((image) => (
                  <button key={image.id || image.url} type="button" onClick={() => image.id ? void removeListingImage(editingListing.id, image.id) : undefined}>
                    حذف صورة
                  </button>
                ))}
              </div>
            ) : null}
            <button type="submit" className="market-commerce-apply" disabled={isSubmittingListing}>{isSubmittingListing ? "جارٍ الحفظ..." : (editingListing ? "حفظ التعديلات" : "إرسال للمراجعة")}</button>
          </form>
        </section>
      ) : null}

      {detailListing ? (
        <section className="market-commerce-sheet market-commerce-sheet--create" aria-label="تفاصيل الإعلان">
          <div className="market-commerce-sheet-handle" />
          <div className="market-commerce-sheet-head">
            <h2>{detailListing.title}</h2>
            <button type="button" aria-label="إغلاق" onClick={() => { setDetailListing(null); setSellerProfile(null); }}>×</button>
          </div>
          {detailListing.primaryImageUrl ? <img src={detailListing.primaryImageUrl} alt={detailListing.title} /> : null}
          <p>{detailListing.description || "لا يوجد وصف إضافي."}</p>
          <p>{detailListing.locationLabel}</p>
          <p>الحالة: {detailListing.moderationStatus} · التشغيل: {detailListing.lifecycleStatus || "active"}</p>
          <p>البائع: {sellerProfile?.seller.label || detailListing.sellerName || detailListing.sellerUserId}</p>
          <div className="market-commerce-actions">
            <button type="button" className="primary" onClick={() => handleContactAction(detailListing)}>تواصل الآن</button>
            <button type="button" onClick={() => void handleFavoriteToggle(detailListing)}>{detailListing.isFavorited ? "إلغاء الحفظ" : "حفظ"}</button>
            {!detailListing.isOwnerListing ? <button type="button" onClick={() => { setReportTargetId(detailListing.id); setDetailListing(null); }}>إبلاغ</button> : null}
          </div>
          {sellerProfile ? <small>إعلانات هذا البائع: {sellerProfile.seller.listingCount}</small> : null}
        </section>
      ) : null}

      {reportTargetId ? (
        <section className="market-commerce-sheet market-commerce-sheet--create" aria-label="إرسال بلاغ">
          <div className="market-commerce-sheet-handle" />
          <div className="market-commerce-sheet-head">
            <h2>إبلاغ عن الإعلان</h2>
            <button type="button" aria-label="إغلاق" onClick={() => setReportTargetId(null)}>×</button>
          </div>
          <label>
            <span>سبب البلاغ</span>
            <input value={reportReason} onChange={(event) => setReportReason(event.target.value)} />
          </label>
          <label>
            <span>ملاحظات إضافية</span>
            <textarea value={reportNote} onChange={(event) => setReportNote(event.target.value)} placeholder="اشرح سبب البلاغ باختصار" />
          </label>
          <button type="button" className="market-commerce-apply" onClick={() => void submitReport()}>إرسال البلاغ</button>
        </section>
      ) : null}
    </main>
  );
}

const ADDRESS_MOHAFAZA_OPTIONS = Object.keys(LEBANON_ADDRESS);

export default MarketMobileCommerceLayout;
