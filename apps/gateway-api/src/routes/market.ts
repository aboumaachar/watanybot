import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import type { FastifyInstance, FastifyPluginAsync, FastifyReply, FastifyRequest } from "fastify";

export type MarketListingStatus = "PENDING_REVIEW" | "APPROVED" | "REJECTED" | "REMOVED";
export type MarketListingLifecycleStatus = "active" | "sold" | "reserved" | "hidden" | "archived";
export type MarketListingType = "SELL" | "BUY" | "DONATE" | "SERVICE";
export type MarketContactPreference = "WHATSAPP" | "PHONE" | "IN_APP";

export interface MarketCategory {
  id: string;
  labelAr: string;
  labelEn: string;
  icon: string;
  enabled: boolean;
  sortOrder: number;
}

export interface MarketImageAsset {
  id: string;
  url: string;
  filename?: string;
  mimeType?: string;
  size?: number;
  uploadedAt: string;
  sortOrder: number;
}

export interface MarketReport {
  id: string;
  listingId: string;
  reason: string;
  note: string;
  reporterId: string;
  createdAt: string;
  status: "OPEN" | "REVIEWED" | "DISMISSED";
}

export interface MarketFavorite {
  id: string;
  userId: string;
  listingId: string;
  createdAt: string;
}

export interface MarketOutboxEvent {
  id: string;
  aggregateType: "market_listing" | "market_category" | "market_report" | "market_favorite";
  aggregateId: string;
  eventType: string;
  createdAt: string;
  payload: Record<string, unknown>;
  mercurStatus: "pending" | "exported";
}

export interface MarketListing {
  id: string;
  ownerId: string;
  title: string;
  description: string;
  categoryId: string;
  listingType: MarketListingType;
  price: string;
  currency: string;
  condition: string;
  location: string;
  locationLabel: string;
  mohafaza?: string;
  caza?: string;
  village?: string;
  exactAddress?: string;
  sellerName: string;
  sellerPhone?: string;
  sellerWhatsapp?: string;
  sellerEmail?: string;
  contactPreference: MarketContactPreference;
  status: MarketListingStatus;
  lifecycleStatus: MarketListingLifecycleStatus;
  createdAt: string;
  updatedAt: string;
  approvedAt?: string;
  rejectedAt?: string;
  removedAt?: string;
  reservedAt?: string;
  soldAt?: string;
  hiddenAt?: string;
  archivedAt?: string;
  renewedAt?: string;
  expiresAt?: string;
  rejectionReason?: string;
  adminNote?: string;
  reportCount: number;
  images: MarketImageAsset[];
  trust: {
    verifiedByWatany: boolean;
    featuredVeteranSeller: boolean;
    sellerTrustLevel: "NEW" | "TRUSTED" | "FEATURED";
    note?: string;
  };
}

interface MarketStore {
  listings: MarketListing[];
  reports: MarketReport[];
  favorites: MarketFavorite[];
  categories: MarketCategory[];
  outbox: MarketOutboxEvent[];
}

interface CreateListingBody {
  title: string;
  description: string;
  categoryId: string;
  listingType: MarketListingType;
  price?: string;
  currency?: string;
  condition?: string;
  location?: string;
  locationLabel?: string;
  mohafaza?: string;
  caza?: string;
  village?: string;
  exactAddress?: string;
  seller?: string;
  contact?: string;
  sellerEmail?: string;
  sellerWhatsapp?: string;
  contactPreference?: MarketContactPreference;
  images?: Array<{
    url?: string;
    filename?: string;
    mimeType?: string;
    size?: number;
  }>;
}

interface RejectBody {
  reason?: string;
  note?: string;
}

interface TrustBody {
  verifiedByWatany?: boolean;
  featuredVeteranSeller?: boolean;
  sellerTrustLevel?: "NEW" | "TRUSTED" | "FEATURED";
  note?: string;
}

interface CategoryBody {
  id?: string;
  labelAr?: string;
  labelEn?: string;
  icon?: string;
  enabled?: boolean;
  sortOrder?: number;
}

export const MARKET_CATEGORIES: MarketCategory[] = [
  { id: "transport", labelAr: "نقل", labelEn: "Transport", icon: "🚕", enabled: true, sortOrder: 10 },
  { id: "services", labelAr: "خدمات", labelEn: "Services", icon: "🛠️", enabled: true, sortOrder: 20 },
  { id: "freelance", labelAr: "أعمال حرة", labelEn: "Freelance", icon: "💼", enabled: true, sortOrder: 30 },
  { id: "property", labelAr: "عقارات", labelEn: "Property", icon: "🏠", enabled: true, sortOrder: 40 },
  { id: "cars", labelAr: "سيارات", labelEn: "Cars", icon: "🚗", enabled: true, sortOrder: 50 },
  { id: "items", labelAr: "أغراض", labelEn: "Items", icon: "📦", enabled: true, sortOrder: 60 },
  { id: "other", labelAr: "او شي تاني", labelEn: "Other", icon: "➕", enabled: true, sortOrder: 999 },
];

const prohibitedWords = ["weapon", "gun", "ammo", "drug", "hashish", "thc", "porn", "سلاح", "ذخيرة", "مخدر", "حشيش"];

function nowIso(): string {
  return new Date().toISOString();
}

function normalizeText(value: unknown): string {
  return String(value ?? "").trim();
}

function readFlag(name: string, fallback = false): boolean {
  const raw = process.env[name];
  if (!raw) return fallback;
  const normalized = raw.trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes" || normalized === "on";
}

function normalizeRole(request: FastifyRequest): string {
  if (request.user?.role) {
    return String(request.user.role).toLowerCase();
  }
  const raw = request.headers["x-user-role"];
  return Array.isArray(raw) ? String(raw[0] ?? "").toLowerCase() : String(raw ?? "").toLowerCase();
}

function getUserId(request: FastifyRequest): string {
  const raw = request.headers["x-user-id"];
  return Array.isArray(raw) ? String(raw[0] ?? "").trim() : String(raw ?? "").trim();
}

function getAuthUserId(request: FastifyRequest): string {
  return String(request.user?.id ?? "").trim();
}

function resolveActorId(request: FastifyRequest, allowLegacyHeaders: boolean): string {
  const authUserId = getAuthUserId(request);
  if (authUserId) return authUserId;
  if (!allowLegacyHeaders) return "";
  return getUserId(request);
}

function isAdmin(request: FastifyRequest): boolean {
  const role = normalizeRole(request);
  return role === "admin" || role === "superadmin";
}

function isSuperadmin(request: FastifyRequest): boolean {
  return normalizeRole(request) === "superadmin";
}

function requireUser(request: FastifyRequest): string | null {
  const userId = getUserId(request);
  return userId.length > 0 ? userId : null;
}

function requireActorId(request: FastifyRequest, reply: FastifyReply, allowLegacyHeaders: boolean, requireActionsAuth: boolean): string | null {
  const actorId = resolveActorId(request, allowLegacyHeaders);
  if (requireActionsAuth && !actorId) {
    reply.code(401).send({ ok: false, error: "LOGIN_REQUIRED" });
    return null;
  }
  if (!actorId) {
    reply.code(401).send({ ok: false, error: "AUTH_REQUIRED" });
    return null;
  }
  return actorId;
}

function storePath(): string {
  const configuredPath = process.env.MARKET_STORE_PATH?.trim();
  if (configuredPath) {
    return path.isAbsolute(configuredPath) ? configuredPath : path.resolve(process.cwd(), configuredPath);
  }
  const cwd = process.cwd();
  const base = path.basename(cwd).toLowerCase() === "gateway-api" ? cwd : path.join(cwd, "apps", "gateway-api");
  return path.join(base, "data", "market", "market-store.json");
}

async function readStore(): Promise<MarketStore> {
  const file = storePath();
  try {
    const raw = await fs.readFile(file, "utf8");
    const parsed = JSON.parse(raw) as Partial<MarketStore>;
    const normalizedCategories = Array.isArray(parsed.categories) && parsed.categories.length > 0
      ? parsed.categories.map((category, index) => ({
          id: normalizeText(category.id) || `market-category-${index + 1}`,
          labelAr: normalizeText(category.labelAr) || "او شي تاني",
          labelEn: normalizeText(category.labelEn) || normalizeText(category.labelAr) || "Other",
          icon: normalizeText(category.icon) || "📦",
          enabled: category.enabled ?? true,
          sortOrder: Number.isFinite(Number(category.sortOrder)) ? Number(category.sortOrder) : (index + 1) * 10,
        }))
      : MARKET_CATEGORIES.map((item) => ({ ...item }));

    const normalizedListings = Array.isArray(parsed.listings)
        ? parsed.listings.map((listing, index) => {
          const legacyListing = listing as unknown as Record<string, unknown>;
          const categoryId = validateCategory(normalizeText(listing.categoryId || "other"), normalizedCategories);
          const listingLocation = buildLocationLabel({
            location: normalizeText(listing.location || "لبنان"),
            locationLabel: normalizeText(listing.locationLabel || ""),
            mohafaza: listing.mohafaza,
            caza: listing.caza,
            village: listing.village,
            exactAddress: listing.exactAddress,
          }) || normalizeText(listing.location || "لبنان");

          return {
            ...listing,
            id: normalizeText(listing.id) || `market-listing-${index + 1}`,
            ownerId: normalizeText(listing.ownerId || legacyListing.sellerUserId || "legacy-market-owner"),
            title: normalizeText(listing.title || "إعلان من السوق"),
            description: normalizeText(listing.description || ""),
            categoryId,
            listingType: (normalizeText(listing.listingType || "SELL") || "SELL") as MarketListingType,
            price: normalizeText(listing.price || ""),
            currency: normalizeText(listing.currency || "USD"),
            condition: normalizeText(listing.condition || "used"),
            location: listingLocation,
            locationLabel: normalizeText(listing.locationLabel || listingLocation),
            mohafaza: normalizeText(listing.mohafaza || "") || undefined,
            caza: normalizeText(listing.caza || "") || undefined,
            village: normalizeText(listing.village || "") || undefined,
            exactAddress: normalizeText(listing.exactAddress || "") || undefined,
            sellerName: normalizeText(listing.sellerName || legacyListing.seller || "مستخدم موطني"),
            sellerPhone: normalizeText(listing.sellerPhone || legacyListing.contact || "") || undefined,
            sellerWhatsapp: normalizeText(listing.sellerWhatsapp || legacyListing.contact || "") || undefined,
            sellerEmail: normalizeText(listing.sellerEmail || "") || undefined,
            contactPreference: normalizeContactPreference(listing.contactPreference || "IN_APP"),
            status: (normalizeText(listing.status || "PENDING_REVIEW") || "PENDING_REVIEW") as MarketListingStatus,
            lifecycleStatus: (normalizeText(listing.lifecycleStatus || "active") || "active") as MarketListingLifecycleStatus,
            createdAt: normalizeText(listing.createdAt || nowIso()),
            updatedAt: normalizeText(listing.updatedAt || listing.createdAt || nowIso()),
            reportCount: Number.isFinite(Number(listing.reportCount)) ? Number(listing.reportCount) : 0,
            images: Array.isArray(listing.images)
              ? listing.images.map((image, imageIndex) => ({
                  id: normalizeText(image.id) || randomUUID(),
                  url: normalizeText(image.url),
                  filename: normalizeText(image.filename || "") || undefined,
                  mimeType: normalizeText(image.mimeType || "") || undefined,
                  size: Number.isFinite(Number(image.size)) ? Number(image.size) : undefined,
                  uploadedAt: normalizeText(image.uploadedAt || nowIso()),
                  sortOrder: Number.isFinite(Number(image.sortOrder)) ? Number(image.sortOrder) : imageIndex,
                })).filter((image) => image.url)
              : [],
            trust: {
              verifiedByWatany: Boolean(listing.trust?.verifiedByWatany),
              featuredVeteranSeller: Boolean(listing.trust?.featuredVeteranSeller),
              sellerTrustLevel: listing.trust?.sellerTrustLevel || "NEW",
              note: normalizeText(listing.trust?.note || "") || undefined,
            },
          } satisfies MarketListing;
        })
      : [];

    return {
      listings: normalizedListings,
      reports: Array.isArray(parsed.reports) ? parsed.reports : [],
      favorites: Array.isArray(parsed.favorites) ? parsed.favorites : [],
      categories: normalizedCategories,
      outbox: Array.isArray(parsed.outbox) ? parsed.outbox : [],
    };
  } catch {
    return { listings: [], reports: [], favorites: [], categories: MARKET_CATEGORIES.map((item) => ({ ...item })), outbox: [] };
  }
}

async function writeStore(store: MarketStore): Promise<void> {
  const file = storePath();
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, `${JSON.stringify(store, null, 2)}\n`, "utf8");
}

function validateCategory(categoryId: string, categories: MarketCategory[] = MARKET_CATEGORIES): string {
  return categories.some((c) => c.id === categoryId && c.enabled) ? categoryId : "other";
}

export function validateContact(value: string): MarketContactPreference {
  const upper = value.toUpperCase();
  if (upper === "WHATSAPP" || upper === "PHONE" || upper === "IN_APP") {
    return upper as MarketContactPreference;
  }
  return "IN_APP";
}

export function normalizeContactPreference(value?: string): MarketContactPreference {
  const upper = String(value ?? "").trim().toUpperCase();
  if (upper === "WHATSAPP" || upper === "PHONE" || upper === "IN_APP") {
    return upper as MarketContactPreference;
  }
  return "IN_APP";
}

export function containsProhibitedContent(body: Partial<CreateListingBody>): boolean {
  const haystack = `${body.title ?? ""} ${body.description ?? ""}`.toLowerCase();
  return prohibitedWords.some((word) => haystack.includes(word.toLowerCase()));
}

export function containsProhibitedListingContent(body: Partial<CreateListingBody>): boolean {
  return containsProhibitedContent(body);
}

function buildLocationLabel(listing: Pick<MarketListing, "locationLabel" | "location" | "mohafaza" | "caza" | "village" | "exactAddress">): string {
  const explicitLabel = typeof listing.locationLabel === "string" ? listing.locationLabel.trim() : "";
  if (explicitLabel) {
    return explicitLabel;
  }

  const hierarchy = [listing.mohafaza, listing.caza, listing.village, listing.exactAddress]
    .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
    .join(" · ");

  if (hierarchy) {
    return hierarchy;
  }

  return typeof listing.location === "string" ? listing.location.trim() : "";
}

function deriveTrustStatus(listing: MarketListing): string {
  if (listing.trust.featuredVeteranSeller) return "موثّق";
  if (listing.trust.sellerTrustLevel === "TRUSTED") return "مراجع";
  if (listing.trust.sellerTrustLevel === "FEATURED") return "موثّق";
  return "قيد الثقة";
}

function isVisibleLifecycle(listing: MarketListing): boolean {
  return listing.lifecycleStatus !== "hidden" && listing.lifecycleStatus !== "archived";
}

function buildClientListing(listing: MarketListing, store: MarketStore, actorId?: string) {
  const favouriteCount = store.favorites.filter((favorite) => favorite.listingId === listing.id).length;
  return {
    id: listing.id,
    title: listing.title,
    price: listing.price,
    currency: listing.currency,
    location: buildLocationLabel(listing) || listing.location,
    locationLabel: buildLocationLabel(listing),
    mohafaza: listing.mohafaza,
    caza: listing.caza,
    village: listing.village,
    exactAddress: listing.exactAddress,
    seller: listing.sellerName,
    contact: listing.contactPreference === "IN_APP" ? "IN_APP" : (listing.sellerPhone || listing.sellerWhatsapp || listing.sellerEmail || ""),
    description: listing.description,
    category: listing.categoryId,
    status: listing.lifecycleStatus,
    createdAt: listing.createdAt,
    updatedAt: listing.updatedAt,
    ownerId: listing.ownerId,
    sellerUserId: listing.ownerId,
    sellerPhone: listing.sellerPhone,
    sellerWhatsapp: listing.sellerWhatsapp,
    sellerEmail: listing.sellerEmail,
    sellerProfileLabel: listing.sellerName,
    listingType: listing.listingType,
    contactPreference: listing.contactPreference,
    moderationStatus: listing.status,
    trustStatus: deriveTrustStatus(listing),
    trust: listing.trust,
    reportCount: listing.reportCount,
    favouriteCount,
    isFavorited: actorId ? store.favorites.some((favorite) => favorite.listingId === listing.id && favorite.userId === actorId) : false,
    isOwnerListing: actorId ? listing.ownerId === actorId : false,
    images: listing.images,
    primaryImageUrl: listing.images[0]?.url,
    reservedAt: listing.reservedAt,
    soldAt: listing.soldAt,
    archivedAt: listing.archivedAt,
    hiddenAt: listing.hiddenAt,
    renewedAt: listing.renewedAt,
    expiresAt: listing.expiresAt,
  };
}

function toPublicMarketCard(listing: MarketListing, store: MarketStore, actorId?: string) {
  const card = buildClientListing(listing, store, actorId);
  return {
    ...card,
    description: String(listing.description || "").slice(0, 220),
    sellerPhone: undefined,
    sellerWhatsapp: undefined,
    sellerEmail: undefined,
    contact: "",
    login_required_for_full_details: true,
  };
}

function toProtectedMarketDetail(listing: MarketListing, store: MarketStore, actorId?: string) {
  return {
    ...buildClientListing(listing, store, actorId),
    detail_access: "protected",
  };
}

function canManageListing(request: FastifyRequest, listing: MarketListing, allowLegacyHeaders: boolean): boolean {
  const actorId = resolveActorId(request, allowLegacyHeaders);
  return Boolean(actorId) && (actorId === listing.ownerId || isAdmin(request));
}

function isPubliclyVisibleListing(listing: MarketListing): boolean {
  return listing.status === "APPROVED" && isVisibleLifecycle(listing);
}

function normalizeLocationParts(body: Partial<CreateListingBody>) {
  const mohafaza = normalizeText(body.mohafaza);
  const caza = normalizeText(body.caza);
  const village = normalizeText(body.village);
  const exactAddress = normalizeText(body.exactAddress);
  const locationLabel = normalizeText(body.locationLabel);
  const location = normalizeText(body.location) || [mohafaza, caza, village, exactAddress].filter(Boolean).join(" · ") || "لبنان";
  return { location, locationLabel, mohafaza: mohafaza || undefined, caza: caza || undefined, village: village || undefined, exactAddress: exactAddress || undefined };
}

function validateUploadedImage(input: Partial<MarketImageAsset>): MarketImageAsset | null {
  const url = normalizeText(input.url);
  if (!/^\/runtime\/uploads\/[0-9]+-[a-f0-9]{24}\.(jpg|png|webp)$/i.test(url)) {
    return null;
  }
  const mimeType = normalizeText(input.mimeType).toLowerCase();
  if (mimeType && !["image/jpeg", "image/png", "image/webp"].includes(mimeType)) {
    return null;
  }
  const size = Number(input.size || 0);
  if (size > 5 * 1024 * 1024) {
    return null;
  }
  return {
    id: randomUUID(),
    url,
    filename: normalizeText(input.filename) || undefined,
    mimeType: mimeType || undefined,
    size: Number.isFinite(size) && size > 0 ? size : undefined,
    uploadedAt: nowIso(),
    sortOrder: 0,
  };
}

function appendOutboxEvent(store: MarketStore, aggregateType: MarketOutboxEvent["aggregateType"], aggregateId: string, eventType: string, payload: Record<string, unknown>) {
  store.outbox.unshift({
    id: randomUUID(),
    aggregateType,
    aggregateId,
    eventType,
    createdAt: nowIso(),
    payload,
    mercurStatus: "pending",
  });
}

function setLifecycleStatus(listing: MarketListing, lifecycleStatus: MarketListingLifecycleStatus) {
  const currentTime = nowIso();
  listing.lifecycleStatus = lifecycleStatus;
  listing.updatedAt = currentTime;

  if (lifecycleStatus === "reserved") listing.reservedAt = currentTime;
  if (lifecycleStatus === "sold") listing.soldAt = currentTime;
  if (lifecycleStatus === "hidden") listing.hiddenAt = currentTime;
  if (lifecycleStatus === "archived") listing.archivedAt = currentTime;
}

export const marketRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  const requireActionsAuth = readFlag("MARKET_ACTIONS_REQUIRE_AUTH", false);
  const allowLegacyHeaderAuth = readFlag("LEGACY_MARKET_HEADERS_AUTH", true);
  const requireDetailsAuth = readFlag("MARKET_DETAILS_REQUIRE_AUTH", false);
  const explicitPublicCardShaping = readFlag("MARKET_PUBLIC_CARD_EXPLICIT_SHAPING", false);

  app.get("/market/categories", async () => {
    const store = await readStore();
    const categories = [...store.categories]
      .filter((category) => category.enabled)
      .sort((left, right) => left.sortOrder - right.sortOrder || left.labelAr.localeCompare(right.labelAr, "ar"));
    return { ok: true, categories };
  });

  app.get("/market/listings", async (request) => {
    const query = request.query as Partial<{
      categoryId: string;
      q: string;
      includeFeatured: string;
      listingType: string;
      mohafaza: string;
      caza: string;
      village: string;
      ownerId: string;
      lifecycle: string;
    }>;
    const store = await readStore();
    const actorId = resolveActorId(request, allowLegacyHeaderAuth);
    let listings = store.listings.filter(isPubliclyVisibleListing);
    if (query.categoryId) listings = listings.filter((listing) => listing.categoryId === query.categoryId);
    if (query.listingType) listings = listings.filter((listing) => listing.listingType === query.listingType);
    if (query.includeFeatured === "true") listings = listings.filter((listing) => listing.trust.featuredVeteranSeller);
    if (query.mohafaza) listings = listings.filter((listing) => listing.mohafaza === query.mohafaza);
    if (query.caza) listings = listings.filter((listing) => listing.caza === query.caza);
    if (query.village) listings = listings.filter((listing) => listing.village === query.village);
    if (query.ownerId) listings = listings.filter((listing) => listing.ownerId === query.ownerId);
    if (query.lifecycle) listings = listings.filter((listing) => listing.lifecycleStatus === query.lifecycle);
    if (query.q) {
      const q = query.q.toLowerCase();
      listings = listings.filter((listing) => [
        listing.title,
        listing.description,
        buildLocationLabel(listing),
        listing.sellerName,
        listing.categoryId,
      ].join(" ").toLowerCase().includes(q));
    }

    const mapped = listings.map((listing) => toPublicMarketCard(listing, store, actorId));
    return { ok: true, total: mapped.length, listings: explicitPublicCardShaping ? mapped : mapped };
  });

  app.get("/market/listings/:id", async (request, reply) => {
    const params = request.params as { id: string };
    const store = await readStore();
    const actorId = resolveActorId(request, allowLegacyHeaderAuth);
    const listing = store.listings.find((item) => item.id === params.id);
    if (!listing) return reply.code(404).send({ ok: false, error: "NOT_FOUND" });

    const canManage = canManageListing(request, listing, allowLegacyHeaderAuth);
    if (!isPubliclyVisibleListing(listing) && !canManage) {
      return reply.code(404).send({ ok: false, error: "NOT_FOUND" });
    }

    if (requireDetailsAuth && !actorId) {
      return reply.code(401).send({ ok: false, error: "LOGIN_REQUIRED" });
    }

    if (!actorId) {
      return { ok: true, listing: toPublicMarketCard(listing, store), detail_access: "public_card" };
    }

    return { ok: true, listing: toProtectedMarketDetail(listing, store, actorId), detail_access: canManage ? "owner_or_admin" : "protected" };
  });

  app.get("/market/sellers/:ownerId", async (request, reply) => {
    const params = request.params as { ownerId: string };
    const store = await readStore();
    const actorId = resolveActorId(request, allowLegacyHeaderAuth);
    const listings = store.listings.filter((listing) => listing.ownerId === params.ownerId && isPubliclyVisibleListing(listing));
    const sellerSeed = listings[0] || store.listings.find((listing) => listing.ownerId === params.ownerId);
    if (!sellerSeed) {
      return reply.code(404).send({ ok: false, error: "NOT_FOUND" });
    }

    return {
      ok: true,
      seller: {
        id: params.ownerId,
        label: sellerSeed.sellerName,
        trustStatus: deriveTrustStatus(sellerSeed),
        featuredVeteranSeller: sellerSeed.trust.featuredVeteranSeller,
        verifiedByWatany: sellerSeed.trust.verifiedByWatany,
        listingCount: listings.length,
      },
      listings: listings.map((listing) => toPublicMarketCard(listing, store, actorId)),
    };
  });

  app.get("/market/my/listings", async (request, reply) => {
    const actorId = requireActorId(request, reply, allowLegacyHeaderAuth, requireActionsAuth);
    if (!actorId) return reply;
    const store = await readStore();
    const listings = store.listings
      .filter((listing) => listing.ownerId === actorId)
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
    return { ok: true, listings: listings.map((listing) => toProtectedMarketDetail(listing, store, actorId)) };
  });

  app.get("/market/my/favorites", async (request, reply) => {
    const actorId = requireActorId(request, reply, allowLegacyHeaderAuth, requireActionsAuth);
    if (!actorId) return reply;
    const store = await readStore();
    const favoriteListingIds = new Set(store.favorites.filter((favorite) => favorite.userId === actorId).map((favorite) => favorite.listingId));
    const listings = store.listings
      .filter((listing) => favoriteListingIds.has(listing.id) && isPubliclyVisibleListing(listing))
      .map((listing) => toProtectedMarketDetail(listing, store, actorId));
    return { ok: true, listings };
  });

  app.post("/market/listings", async (request, reply) => {
    const actorId = requireActorId(request, reply, allowLegacyHeaderAuth, requireActionsAuth);
    if (!actorId) return reply;

    const body = (request.body ?? {}) as Partial<CreateListingBody>;
    if (containsProhibitedContent(body)) return reply.code(400).send({ ok: false, error: "PROHIBITED_CONTENT" });
    const title = normalizeText(body.title);
    const description = normalizeText(body.description);
    if (title.length < 3 || description.length < 8) return reply.code(400).send({ ok: false, error: "INVALID_LISTING" });

    const store = await readStore();
    const contactPreference = normalizeContactPreference(body.contactPreference);
    const locationParts = normalizeLocationParts(body);
    const rawContact = normalizeText(body.contact);
    const sellerPhone = normalizeText(body.contact || "") || undefined;
    const sellerWhatsapp = normalizeText(body.sellerWhatsapp || rawContact) || undefined;
    const sellerEmail = normalizeText(body.sellerEmail || request.user?.email || "") || undefined;
    if (contactPreference !== "IN_APP" && !sellerPhone && !sellerWhatsapp) {
      return reply.code(400).send({ ok: false, error: "CONTACT_REQUIRED" });
    }

    const uploadedImages = Array.isArray(body.images) ? body.images.map(validateUploadedImage) : [];
    if (uploadedImages.some((image) => image === null)) {
      return reply.code(400).send({ ok: false, error: "INVALID_IMAGE_PAYLOAD" });
    }

    const createdAt = nowIso();
    const listing: MarketListing = {
      id: randomUUID(),
      ownerId: actorId,
      title,
      description,
      categoryId: validateCategory(normalizeText(body.categoryId || "other"), store.categories),
      listingType: (body.listingType || "SELL") as MarketListingType,
      price: normalizeText(body.price || ""),
      currency: normalizeText(body.currency || "USD"),
      condition: normalizeText(body.condition || "used"),
      location: locationParts.location,
      locationLabel: locationParts.locationLabel || locationParts.location,
      mohafaza: locationParts.mohafaza,
      caza: locationParts.caza,
      village: locationParts.village,
      exactAddress: locationParts.exactAddress,
      sellerName: normalizeText(body.seller || request.user?.email?.split("@")[0] || "مستخدم موطني"),
      sellerPhone,
      sellerWhatsapp,
      sellerEmail,
      contactPreference,
      status: "PENDING_REVIEW",
      lifecycleStatus: "active",
      createdAt,
      updatedAt: createdAt,
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      reportCount: 0,
      images: uploadedImages.filter((image): image is MarketImageAsset => Boolean(image)).map((image, index) => ({ ...image, sortOrder: index })),
      trust: { verifiedByWatany: false, featuredVeteranSeller: false, sellerTrustLevel: "NEW" },
    };

    store.listings.unshift(listing);
    appendOutboxEvent(store, "market_listing", listing.id, "listing.created", {
      ownerId: listing.ownerId,
      categoryId: listing.categoryId,
      moderationStatus: listing.status,
      lifecycleStatus: listing.lifecycleStatus,
    });
    await writeStore(store);
    return reply.code(201).send({ ok: true, listing: toProtectedMarketDetail(listing, store, actorId) });
  });

  app.patch("/market/listings/:id", async (request, reply) => {
    const actorId = requireActorId(request, reply, allowLegacyHeaderAuth, requireActionsAuth);
    if (!actorId) return reply;
    const params = request.params as { id: string };
    const body = (request.body ?? {}) as Partial<CreateListingBody>;
    const store = await readStore();
    const listing = store.listings.find((item) => item.id === params.id);
    if (!listing) return reply.code(404).send({ ok: false, error: "NOT_FOUND" });
    if (!canManageListing(request, listing, allowLegacyHeaderAuth)) {
      return reply.code(403).send({ ok: false, error: "FORBIDDEN" });
    }
    if (containsProhibitedContent(body)) return reply.code(400).send({ ok: false, error: "PROHIBITED_CONTENT" });

    const nextLocation = normalizeLocationParts({
      location: body.location ?? listing.location,
      locationLabel: body.locationLabel ?? listing.locationLabel,
      mohafaza: body.mohafaza ?? listing.mohafaza,
      caza: body.caza ?? listing.caza,
      village: body.village ?? listing.village,
      exactAddress: body.exactAddress ?? listing.exactAddress,
    });

    const contentChanged = [body.title, body.description, body.categoryId, body.location, body.locationLabel, body.mohafaza, body.caza, body.village, body.exactAddress, body.price, body.condition].some((value) => value !== undefined);

    if (body.title !== undefined) listing.title = normalizeText(body.title) || listing.title;
    if (body.description !== undefined) listing.description = normalizeText(body.description) || listing.description;
    if (body.categoryId !== undefined) listing.categoryId = validateCategory(normalizeText(body.categoryId || listing.categoryId), store.categories);
    if (body.listingType !== undefined) listing.listingType = body.listingType;
    if (body.price !== undefined) listing.price = normalizeText(body.price || listing.price);
    if (body.currency !== undefined) listing.currency = normalizeText(body.currency || listing.currency);
    if (body.condition !== undefined) listing.condition = normalizeText(body.condition || listing.condition);
    listing.location = nextLocation.location;
    listing.locationLabel = nextLocation.locationLabel || nextLocation.location;
    listing.mohafaza = nextLocation.mohafaza;
    listing.caza = nextLocation.caza;
    listing.village = nextLocation.village;
    listing.exactAddress = nextLocation.exactAddress;
    if (body.contactPreference !== undefined) listing.contactPreference = normalizeContactPreference(body.contactPreference);
    if (body.seller !== undefined) listing.sellerName = normalizeText(body.seller || listing.sellerName);
    if (body.contact !== undefined) {
      const nextContact = normalizeText(body.contact);
      listing.sellerPhone = nextContact || listing.sellerPhone;
      listing.sellerWhatsapp = nextContact || listing.sellerWhatsapp;
    }
    if (body.sellerEmail !== undefined) listing.sellerEmail = normalizeText(body.sellerEmail) || listing.sellerEmail;
    if (body.sellerWhatsapp !== undefined) listing.sellerWhatsapp = normalizeText(body.sellerWhatsapp) || listing.sellerWhatsapp;

    if (contentChanged && listing.status === "APPROVED") {
      listing.status = "PENDING_REVIEW";
      listing.approvedAt = undefined;
    }
    listing.updatedAt = nowIso();
    appendOutboxEvent(store, "market_listing", listing.id, "listing.updated", {
      ownerId: listing.ownerId,
      moderationStatus: listing.status,
      lifecycleStatus: listing.lifecycleStatus,
    });
    await writeStore(store);
    return { ok: true, listing: toProtectedMarketDetail(listing, store, actorId) };
  });

  app.post("/market/listings/:id/favorite", async (request, reply) => {
    const actorId = requireActorId(request, reply, allowLegacyHeaderAuth, requireActionsAuth);
    if (!actorId) return reply;
    const params = request.params as { id: string };
    const store = await readStore();
    const listing = store.listings.find((item) => item.id === params.id && isPubliclyVisibleListing(item));
    if (!listing) return reply.code(404).send({ ok: false, error: "NOT_FOUND" });
    const existing = store.favorites.find((favorite) => favorite.userId === actorId && favorite.listingId === listing.id);
    if (!existing) {
      store.favorites.unshift({ id: randomUUID(), userId: actorId, listingId: listing.id, createdAt: nowIso() });
      appendOutboxEvent(store, "market_favorite", listing.id, "favorite.created", { userId: actorId });
      await writeStore(store);
    }
    return { ok: true, listing: toProtectedMarketDetail(listing, store, actorId) };
  });

  app.delete("/market/listings/:id/favorite", async (request, reply) => {
    const actorId = requireActorId(request, reply, allowLegacyHeaderAuth, requireActionsAuth);
    if (!actorId) return reply;
    const params = request.params as { id: string };
    const store = await readStore();
    const nextFavorites = store.favorites.filter((favorite) => !(favorite.userId === actorId && favorite.listingId === params.id));
    if (nextFavorites.length !== store.favorites.length) {
      store.favorites = nextFavorites;
      appendOutboxEvent(store, "market_favorite", params.id, "favorite.removed", { userId: actorId });
      await writeStore(store);
    }
    return { ok: true };
  });

  app.post("/market/listings/:id/report", async (request, reply) => {
    const actorId = requireActorId(request, reply, allowLegacyHeaderAuth, requireActionsAuth);
    if (!actorId) return reply;

    const params = request.params as { id: string };
    const body = (request.body ?? {}) as Partial<{ reason: string; note: string }>;
    const store = await readStore();
    const listing = store.listings.find((item) => item.id === params.id && item.status !== "REMOVED");
    if (!listing) return reply.code(404).send({ ok: false, error: "NOT_FOUND" });
    listing.reportCount = (listing.reportCount || 0) + 1;
    listing.updatedAt = nowIso();
    if (listing.reportCount >= 3 && listing.status === "APPROVED") {
      listing.status = "PENDING_REVIEW";
    }
    const report = {
      id: randomUUID(),
      listingId: listing.id,
      reason: normalizeText(body.reason || "reported"),
      note: normalizeText(body.note || ""),
      reporterId: actorId,
      createdAt: nowIso(),
      status: "OPEN" as const,
    };
    store.reports.unshift(report);
    appendOutboxEvent(store, "market_report", report.id, "report.created", { listingId: listing.id, reporterId: actorId, reason: report.reason });
    await writeStore(store);
    return { ok: true, report, reportCount: listing.reportCount };
  });

  app.post("/market/listings/:id/reserve", async (request, reply) => {
    const actorId = requireActorId(request, reply, allowLegacyHeaderAuth, requireActionsAuth);
    if (!actorId) return reply;
    const params = request.params as { id: string };
    const store = await readStore();
    const listing = store.listings.find((item) => item.id === params.id);
    if (!listing) return reply.code(404).send({ ok: false, error: "NOT_FOUND" });
    if (!canManageListing(request, listing, allowLegacyHeaderAuth)) return reply.code(403).send({ ok: false, error: "FORBIDDEN" });
    setLifecycleStatus(listing, "reserved");
    appendOutboxEvent(store, "market_listing", listing.id, "listing.reserved", { ownerId: listing.ownerId });
    await writeStore(store);
    return { ok: true, listing: toProtectedMarketDetail(listing, store, actorId) };
  });

  app.post("/market/listings/:id/sold", async (request, reply) => {
    const actorId = requireActorId(request, reply, allowLegacyHeaderAuth, requireActionsAuth);
    if (!actorId) return reply;
    const params = request.params as { id: string };
    const store = await readStore();
    const listing = store.listings.find((item) => item.id === params.id);
    if (!listing) return reply.code(404).send({ ok: false, error: "NOT_FOUND" });
    if (!canManageListing(request, listing, allowLegacyHeaderAuth)) return reply.code(403).send({ ok: false, error: "FORBIDDEN" });
    setLifecycleStatus(listing, "sold");
    appendOutboxEvent(store, "market_listing", listing.id, "listing.sold", { ownerId: listing.ownerId });
    await writeStore(store);
    return { ok: true, listing: toProtectedMarketDetail(listing, store, actorId) };
  });

  app.post("/market/listings/:id/hide", async (request, reply) => {
    const actorId = requireActorId(request, reply, allowLegacyHeaderAuth, requireActionsAuth);
    if (!actorId) return reply;
    const params = request.params as { id: string };
    const store = await readStore();
    const listing = store.listings.find((item) => item.id === params.id);
    if (!listing) return reply.code(404).send({ ok: false, error: "NOT_FOUND" });
    if (!canManageListing(request, listing, allowLegacyHeaderAuth)) return reply.code(403).send({ ok: false, error: "FORBIDDEN" });
    setLifecycleStatus(listing, "hidden");
    appendOutboxEvent(store, "market_listing", listing.id, "listing.hidden", { ownerId: listing.ownerId });
    await writeStore(store);
    return { ok: true, listing: toProtectedMarketDetail(listing, store, actorId) };
  });

  app.post("/market/listings/:id/archive", async (request, reply) => {
    const actorId = requireActorId(request, reply, allowLegacyHeaderAuth, requireActionsAuth);
    if (!actorId) return reply;
    const params = request.params as { id: string };
    const store = await readStore();
    const listing = store.listings.find((item) => item.id === params.id);
    if (!listing) return reply.code(404).send({ ok: false, error: "NOT_FOUND" });
    if (!canManageListing(request, listing, allowLegacyHeaderAuth)) return reply.code(403).send({ ok: false, error: "FORBIDDEN" });
    setLifecycleStatus(listing, "archived");
    appendOutboxEvent(store, "market_listing", listing.id, "listing.archived", { ownerId: listing.ownerId });
    await writeStore(store);
    return { ok: true, listing: toProtectedMarketDetail(listing, store, actorId) };
  });

  app.post("/market/listings/:id/renew", async (request, reply) => {
    const actorId = requireActorId(request, reply, allowLegacyHeaderAuth, requireActionsAuth);
    if (!actorId) return reply;
    const params = request.params as { id: string };
    const store = await readStore();
    const listing = store.listings.find((item) => item.id === params.id);
    if (!listing) return reply.code(404).send({ ok: false, error: "NOT_FOUND" });
    if (!canManageListing(request, listing, allowLegacyHeaderAuth)) return reply.code(403).send({ ok: false, error: "FORBIDDEN" });
    listing.renewedAt = nowIso();
    listing.expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    setLifecycleStatus(listing, "active");
    appendOutboxEvent(store, "market_listing", listing.id, "listing.renewed", { ownerId: listing.ownerId, expiresAt: listing.expiresAt });
    await writeStore(store);
    return { ok: true, listing: toProtectedMarketDetail(listing, store, actorId) };
  });

  app.post("/market/listings/:id/images", async (request, reply) => {
    const actorId = requireActorId(request, reply, allowLegacyHeaderAuth, requireActionsAuth);
    if (!actorId) return reply;
    const params = request.params as { id: string };
    const body = (request.body ?? {}) as { images?: Array<Partial<MarketImageAsset>> };
    const store = await readStore();
    const listing = store.listings.find((item) => item.id === params.id);
    if (!listing) return reply.code(404).send({ ok: false, error: "NOT_FOUND" });
    if (!canManageListing(request, listing, allowLegacyHeaderAuth)) return reply.code(403).send({ ok: false, error: "FORBIDDEN" });

    const nextImages = Array.isArray(body.images) ? body.images.map(validateUploadedImage) : [];
    if (!nextImages.length || nextImages.some((image) => image === null)) {
      return reply.code(400).send({ ok: false, error: "INVALID_IMAGE_PAYLOAD" });
    }

    const sortOffset = listing.images.length;
    listing.images.push(...nextImages.filter((image): image is MarketImageAsset => Boolean(image)).map((image, index) => ({ ...image, sortOrder: sortOffset + index })));
    listing.updatedAt = nowIso();
    appendOutboxEvent(store, "market_listing", listing.id, "listing.images_attached", { ownerId: listing.ownerId, count: nextImages.length });
    await writeStore(store);
    return { ok: true, listing: toProtectedMarketDetail(listing, store, actorId) };
  });

  app.delete("/market/listings/:id/images/:imageId", async (request, reply) => {
    const actorId = requireActorId(request, reply, allowLegacyHeaderAuth, requireActionsAuth);
    if (!actorId) return reply;
    const params = request.params as { id: string; imageId: string };
    const store = await readStore();
    const listing = store.listings.find((item) => item.id === params.id);
    if (!listing) return reply.code(404).send({ ok: false, error: "NOT_FOUND" });
    if (!canManageListing(request, listing, allowLegacyHeaderAuth)) return reply.code(403).send({ ok: false, error: "FORBIDDEN" });

    const before = listing.images.length;
    listing.images = listing.images.filter((image) => image.id !== params.imageId).map((image, index) => ({ ...image, sortOrder: index }));
    if (before === listing.images.length) {
      return reply.code(404).send({ ok: false, error: "IMAGE_NOT_FOUND" });
    }
    listing.updatedAt = nowIso();
    appendOutboxEvent(store, "market_listing", listing.id, "listing.image_removed", { ownerId: listing.ownerId, imageId: params.imageId });
    await writeStore(store);
    return { ok: true, listing: toProtectedMarketDetail(listing, store, actorId) };
  });

  app.get("/market/admin/categories", async (request, reply) => {
    if (!isAdmin(request)) return reply.code(403).send({ ok: false, error: "ADMIN_REQUIRED" });
    const store = await readStore();
    return { ok: true, categories: [...store.categories].sort((left, right) => left.sortOrder - right.sortOrder || left.labelAr.localeCompare(right.labelAr, "ar")) };
  });

  app.post("/market/admin/categories", async (request, reply) => {
    if (!isSuperadmin(request)) return reply.code(403).send({ ok: false, error: "SUPERADMIN_REQUIRED" });
    const body = (request.body ?? {}) as CategoryBody;
    const labelAr = normalizeText(body.labelAr);
    if (!labelAr) {
      return reply.code(400).send({ ok: false, error: "INVALID_CATEGORY" });
    }
    const store = await readStore();
    const nextId = normalizeText(body.id) || `market-${randomUUID().slice(0, 8)}`;
    const existing = store.categories.find((category) => category.id === nextId);
    const category: MarketCategory = {
      id: nextId,
      labelAr,
      labelEn: normalizeText(body.labelEn || labelAr),
      icon: normalizeText(body.icon || existing?.icon || "📦"),
      enabled: body.enabled ?? existing?.enabled ?? true,
      sortOrder: Number.isFinite(Number(body.sortOrder)) ? Number(body.sortOrder) : (existing?.sortOrder ?? (store.categories.length + 1) * 10),
    };
    if (existing) {
      Object.assign(existing, category);
    } else {
      store.categories.push(category);
    }
    appendOutboxEvent(store, "market_category", category.id, existing ? "category.updated" : "category.created", { enabled: category.enabled, sortOrder: category.sortOrder });
    await writeStore(store);
    return { ok: true, category };
  });

  app.get("/market/admin/outbox", async (request, reply) => {
    if (!isAdmin(request)) return reply.code(403).send({ ok: false, error: "ADMIN_REQUIRED" });
    const store = await readStore();
    return { ok: true, events: store.outbox.slice(0, 200) };
  });

  app.get("/market/admin/listings", async (request, reply) => {
    if (!isAdmin(request)) return reply.code(403).send({ ok: false, error: "ADMIN_REQUIRED" });
    const query = request.query as Partial<{ status: MarketListingStatus | "REPORTED"; lifecycle: MarketListingLifecycleStatus }>;
    const store = await readStore();
    let listings = [...store.listings];
    if (query.status === "REPORTED") listings = listings.filter((listing) => listing.reportCount > 0);
    else if (query.status) listings = listings.filter((listing) => listing.status === query.status);
    if (query.lifecycle) listings = listings.filter((listing) => listing.lifecycleStatus === query.lifecycle);
    return { ok: true, listings, reports: store.reports };
  });

  app.get("/market/admin/reports", async (request, reply) => {
    if (!isAdmin(request)) return reply.code(403).send({ ok: false, error: "ADMIN_REQUIRED" });
    const store = await readStore();
    const reports = store.reports.map((report) => ({ ...report, listing: store.listings.find((listing) => listing.id === report.listingId) || null }));
    return { ok: true, reports };
  });

  app.post("/market/admin/listings/:id/approve", async (request, reply) => {
    if (!isAdmin(request)) return reply.code(403).send({ ok: false, error: "ADMIN_REQUIRED" });
    const params = request.params as { id: string };
    const store = await readStore();
    const listing = store.listings.find((item) => item.id === params.id);
    if (!listing) return reply.code(404).send({ ok: false, error: "NOT_FOUND" });
    listing.status = "APPROVED";
    listing.lifecycleStatus = "active";
    listing.approvedAt = nowIso();
    listing.updatedAt = nowIso();
    listing.rejectionReason = "";
    appendOutboxEvent(store, "market_listing", listing.id, "listing.approved", { ownerId: listing.ownerId, lifecycleStatus: listing.lifecycleStatus });
    await writeStore(store);
    return { ok: true, listing };
  });

  app.post("/market/admin/listings/:id/reject", async (request, reply) => {
    if (!isAdmin(request)) return reply.code(403).send({ ok: false, error: "ADMIN_REQUIRED" });
    const params = request.params as { id: string };
    const body = (request.body ?? {}) as RejectBody;
    const store = await readStore();
    const listing = store.listings.find((item) => item.id === params.id);
    if (!listing) return reply.code(404).send({ ok: false, error: "NOT_FOUND" });
    listing.status = "REJECTED";
    listing.rejectedAt = nowIso();
    listing.updatedAt = nowIso();
    listing.rejectionReason = normalizeText(body.reason || "يرجى تعديل الإعلان وإعادة إرساله للمراجعة.");
    listing.adminNote = normalizeText(body.note || "");
    appendOutboxEvent(store, "market_listing", listing.id, "listing.rejected", { ownerId: listing.ownerId, reason: listing.rejectionReason });
    await writeStore(store);
    return { ok: true, listing };
  });

  app.post("/market/admin/listings/:id/remove", async (request, reply) => {
    if (!isAdmin(request)) return reply.code(403).send({ ok: false, error: "ADMIN_REQUIRED" });
    const params = request.params as { id: string };
    const body = (request.body ?? {}) as RejectBody;
    const store = await readStore();
    const listing = store.listings.find((item) => item.id === params.id);
    if (!listing) return reply.code(404).send({ ok: false, error: "NOT_FOUND" });
    listing.status = "REMOVED";
    listing.lifecycleStatus = "hidden";
    listing.removedAt = nowIso();
    listing.updatedAt = nowIso();
    listing.adminNote = normalizeText(body.note || listing.adminNote || "removed by admin");
    for (const report of store.reports.filter((r) => r.listingId === listing.id)) report.status = "REVIEWED";
    appendOutboxEvent(store, "market_listing", listing.id, "listing.removed", { ownerId: listing.ownerId, note: listing.adminNote });
    await writeStore(store);
    return { ok: true, listing };
  });

  app.post("/market/admin/listings/:id/trust", async (request, reply) => {
    if (!isAdmin(request)) return reply.code(403).send({ ok: false, error: "ADMIN_REQUIRED" });
    const params = request.params as { id: string };
    const body = (request.body ?? {}) as TrustBody;
    const store = await readStore();
    const listing = store.listings.find((item) => item.id === params.id);
    if (!listing) return reply.code(404).send({ ok: false, error: "NOT_FOUND" });
    listing.trust = {
      verifiedByWatany: Boolean(body.verifiedByWatany ?? listing.trust.verifiedByWatany),
      featuredVeteranSeller: Boolean(body.featuredVeteranSeller ?? listing.trust.featuredVeteranSeller),
      sellerTrustLevel: body.sellerTrustLevel || listing.trust.sellerTrustLevel || "NEW",
      note: normalizeText(body.note || listing.trust.note || ""),
    };
    listing.updatedAt = nowIso();
    appendOutboxEvent(store, "market_listing", listing.id, "listing.trust_updated", { ownerId: listing.ownerId, trust: listing.trust });
    await writeStore(store);
    return { ok: true, listing };
  });

  app.post("/market/admin/reports/:id/dismiss", async (request, reply) => {
    if (!isAdmin(request)) return reply.code(403).send({ ok: false, error: "ADMIN_REQUIRED" });
    const params = request.params as { id: string };
    const store = await readStore();
    const report = store.reports.find((item) => item.id === params.id);
    if (!report) return reply.code(404).send({ ok: false, error: "NOT_FOUND" });
    report.status = "DISMISSED";
    appendOutboxEvent(store, "market_report", report.id, "report.dismissed", { listingId: report.listingId });
    await writeStore(store);
    return { ok: true, report };
  });

  app.post("/market/admin/maintenance/compact", async (request, reply) => {
    if (!isAdmin(request)) return reply.code(403).send({ ok: false, error: "ADMIN_REQUIRED" });
    const store = await readStore();
    const beforeListings = store.listings.length;
    const beforeReports = store.reports.length;
    const beforeFavorites = store.favorites.length;
    const beforeOutbox = store.outbox.length;
    store.listings = store.listings.slice(0, 500);
    store.reports = store.reports.slice(0, 1000);
    store.favorites = store.favorites.slice(0, 5000);
    store.outbox = store.outbox.slice(0, 2000);
    await writeStore(store);
    return {
      ok: true,
      beforeListings,
      afterListings: store.listings.length,
      beforeReports,
      afterReports: store.reports.length,
      beforeFavorites,
      afterFavorites: store.favorites.length,
      beforeOutbox,
      afterOutbox: store.outbox.length,
    };
  });
};

export default marketRoutes;