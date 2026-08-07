import { useEffect, useMemo, useRef, useState } from "react";
import {
  Chat24Regular,
  Clock24Regular,
  Navigation24Regular,
  Phone24Filled,
  ArrowClockwise24Regular,
  Star24Filled,
} from "../../theme/watany-v4/legacyIconBridge";
import {
  api,
  type TaxiDriverReview,
  type TaxiDriverRatingSummary,
  type TaxiDriverView,
} from "../../lib/api";
import { useApp } from "../../store/app";
import { useNavigate } from "react-router-dom";
import { LocationSelector } from "../watany-standard/LocationSelector";
import type { WatanyLocationValue } from "../watany-standard/types";
// APEX_CSS_FREEZE_DISABLED_IMPORT import "./taxi-mobile-commerce.css";
type RideMode = "now" | "later";
type ServiceFilter = "all" | "available" | "trusted" | "direct" | "family";
type AreaFilter = {
  muhafaza: string;
  caza: string;
  village: string;
};
type LocatorTarget = "origin" | "destination";
type ComplaintCategory = "driver" | "ride" | "service" | "other";
type DriverEnrollForm = {
  fullName: string;
  phone: string;
  whatsappPhone: string;
  profileImageUrl: string;
  vehicleCarType: string;
  vehicleColor: string;
  vehicleMake: string;
  vehicleModel: string;
  platePublicLastDigits: string;
  plateType: string;
  muhafaza: string;
  caza: string;
  village: string;
  notes: string;
};
type DriverRatingMap = Record<string, TaxiDriverRatingSummary>;
type DriverReviewsMap = Record<string, TaxiDriverReview[]>;
type TaxiMobileCommerceViewCtx = {
  rideMode: RideMode;
  setRideMode: React.Dispatch<React.SetStateAction<RideMode>>;
  setDriverEnrollOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setDriverEnrollNotice: React.Dispatch<React.SetStateAction<string>>;
  selectedDriverId: string;
  drivers: TaxiDriverView[];
  openLaterReservationCard: (driverId: string) => void;
  focusComplaints: () => void;
  navigate: ReturnType<typeof useNavigate>;
  setActiveLocator: React.Dispatch<React.SetStateAction<LocatorTarget | null>>;
  originLabel: string;
  destinationLabel: string;
  activeLocator: LocatorTarget | null;
  originFilter: AreaFilter;
  destinationFilter: AreaFilter;
  applyLocatorValue: (target: LocatorTarget, value: WatanyLocationValue) => void;
  setServiceFilter: React.Dispatch<React.SetStateAction<ServiceFilter>>;
  serviceFilter: ServiceFilter;
  searchBusy: boolean;
  filteredDrivers: TaxiDriverView[];
  searchError: string;
  setSelectedDriverId: React.Dispatch<React.SetStateAction<string>>;
  ratingMap: DriverRatingMap;
  apiBaseUrl: string;
  openDriverReview: (driverId: string) => Promise<void>;
  activeReviewDriverId: string | null;
  setActiveReviewDriverId: React.Dispatch<React.SetStateAction<string | null>>;
  reviewRating: number;
  setReviewRating: React.Dispatch<React.SetStateAction<number>>;
  reviewComment: string;
  setReviewComment: React.Dispatch<React.SetStateAction<string>>;
  activeDriverReviews: TaxiDriverReview[];
  reviewNotice: string;
  submitDriverReview: () => Promise<void>;
  reviewBusy: boolean;
  laterReservationDriverId: string | null;
  setLaterReservationDriverId: React.Dispatch<React.SetStateAction<string | null>>;
  laterReservationAt: string;
  setLaterReservationAt: React.Dispatch<React.SetStateAction<string>>;
  laterReservationNotes: string;
  setLaterReservationNotes: React.Dispatch<React.SetStateAction<string>>;
  laterReservationNotice: string;
  submitLaterReservation: () => Promise<void>;
  laterReservationBusy: boolean;
  driverEnrollOpen: boolean;
  driverEnrollUploadBusy: boolean;
  setDriverEnrollUploadBusy: React.Dispatch<React.SetStateAction<boolean>>;
  submitDriverEnrollment: () => Promise<void>;
  driverEnrollForm: DriverEnrollForm;
  setDriverEnrollForm: React.Dispatch<React.SetStateAction<DriverEnrollForm>>;
  driverEnrollNotice: string;
  driverEnrollBusy: boolean;
  complaintsRef: React.RefObject<HTMLElement>;
  complaintOpen: boolean;
  setComplaintOpen: React.Dispatch<React.SetStateAction<boolean>>;
  complaintCategory: ComplaintCategory;
  setComplaintCategory: React.Dispatch<React.SetStateAction<ComplaintCategory>>;
  complaintDriverId: string;
  setComplaintDriverId: React.Dispatch<React.SetStateAction<string>>;
  complaintMessage: string;
  setComplaintMessage: React.Dispatch<React.SetStateAction<string>>;
  complaintNotice: string;
  complaintBusy: boolean;
  submitComplaint: () => Promise<void>;
  reservationNotice: string;
};
const DEFAULT_FILTER: AreaFilter = {
  muhafaza: "",
  caza: "",
  village: "",
};
const FALLBACK_DRIVERS: TaxiDriverView[] = [
  {
    id: "taxi-driver-demo-1",
    fullName: "سائق مباشر - بيروت",
    phone: "+96100000111",
    whatsappPhone: "+96100000111",
    profileImageUrl: "https://ui-avatars.com/api/?name=Taxi+One&background=155eef&color=fff",
    status: "APPROVED",
    verificationLevel: "TRUSTED",
    vehicles: [{ make: "Toyota", model: "Corolla", color: "أبيض", platePublicLastDigits: "128", plateType: "RED_PUBLIC" }],
    currentAvailability: {
      status: "AVAILABLE",
      locationLabel: "الحمرا",
      lat: 33.897,
      lng: 35.478,
      lastSeenAt: new Date().toISOString(),
    },
    serviceAreas: [{ muhafaza: "بيروت", caza: "بيروت", village: "الحمرا" }],
  },
  {
    id: "taxi-driver-demo-2",
    fullName: "سائق عائلي - كسروان",
    phone: "+96100000222",
    whatsappPhone: "+96100000222",
    profileImageUrl: "https://ui-avatars.com/api/?name=Taxi+Two&background=047857&color=fff",
    status: "APPROVED",
    verificationLevel: "LICENSED",
    vehicles: [{ make: "Hyundai", model: "Elantra", color: "فضي", platePublicLastDigits: "774", plateType: "RED_PUBLIC" }],
    currentAvailability: {
      status: "AVAILABLE",
      locationLabel: "جونية",
      lat: 33.9808,
      lng: 35.6178,
      lastSeenAt: new Date().toISOString(),
    },
    serviceAreas: [{ muhafaza: "جبل لبنان", caza: "كسروان", village: "جونية" }],
  },
  {
    id: "taxi-driver-demo-3",
    fullName: "سائق سريع - الأشرفية",
    phone: "+96100000333",
    whatsappPhone: "+96100000333",
    profileImageUrl: "https://ui-avatars.com/api/?name=Taxi+Three&background=f59e0b&color=fff",
    status: "APPROVED",
    verificationLevel: "LICENSED",
    vehicles: [{ make: "Kia", model: "Cerato", color: "كحلي", platePublicLastDigits: "408", plateType: "RED_PUBLIC" }],
    currentAvailability: {
      status: "BUSY",
      locationLabel: "الأشرفية",
      lat: 33.8938,
      lng: 35.5312,
      lastSeenAt: new Date().toISOString(),
    },
    serviceAreas: [{ muhafaza: "بيروت", caza: "الأشرفية", village: "الأشرفية" }],
  },
];
function buildAreaLabel(driver: TaxiDriverView): string {
  const area = driver.serviceAreas?.[0];
  return driver.currentAvailability?.locationLabel || [area?.muhafaza, area?.caza, area?.village].filter(Boolean).join(" / ") || "منطقة غير محددة";
}
function buildVehicleLabel(driver: TaxiDriverView): string {
  const vehicle = driver.vehicles[0];
  return [vehicle?.make, vehicle?.model, vehicle?.color].filter(Boolean).join(" ") || "سيارة عمومية";
}
function buildTrustLabel(driver: TaxiDriverView): string {
  if (driver.verificationLevel === "TRUSTED") return "موثّق";
  if (driver.verificationLevel === "LICENSED") return "مرخّص";
  return "قيد المراجعة";
}
function buildAvailabilityLabel(driver: TaxiDriverView): string {
  if (driver.currentAvailability?.status === "AVAILABLE") return "متاح الآن";
  if (driver.currentAvailability?.status === "BUSY") return "مشغول";
  return "غير متصل";
}
function compactAddress(value: AreaFilter | null): string {
  if (!value) {
    return "";
  }
  return [value.muhafaza, value.caza, value.village].filter(Boolean).join(" / ");
}
function normalizeLookup(value: string): string {
  return value
    .trim()
    .replace(/[إأآا]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .toLowerCase();
}
function matchesAreaFilter(driver: TaxiDriverView, filter: AreaFilter): boolean {
  const area = driver.serviceAreas?.[0];
  if (filter.muhafaza && area?.muhafaza !== filter.muhafaza) {
    return false;
  }
  if (filter.caza && area?.caza !== filter.caza) {
    return false;
  }
  if (filter.village && area?.village !== filter.village) {
    return false;
  }
  return true;
}
function formatDriverRating(summary?: TaxiDriverRatingSummary): string {
  if (!summary || summary.totalReviews < 1) {
    return "بدون تقييم";
  }
  return `${summary.averageRating.toFixed(1)} / 5 (${summary.totalReviews})`;
}
function getDriverRatingNumber(summary?: TaxiDriverRatingSummary): string {
  if (!summary || summary.totalReviews < 1) {
    return "0.0";
  }
  return summary.averageRating.toFixed(1);
}
function getAvailabilityTone(driver: TaxiDriverView): "available" | "offline" {
  return driver.currentAvailability?.status === "AVAILABLE" ? "available" : "offline";
}
function matchesServiceFilter(driver: TaxiDriverView, serviceFilter: ServiceFilter): boolean {
  if (serviceFilter === "all") return true;
  if (serviceFilter === "available") return driver.currentAvailability?.status === "AVAILABLE";
  if (serviceFilter === "trusted") return driver.verificationLevel === "TRUSTED";
  if (serviceFilter === "direct") return Boolean(driver.phone);
  if (serviceFilter === "family") {
    return driver.vehicles.some((vehicle) => /suv|van|mini|grand/i.test(`${vehicle.make || ""} ${vehicle.model || ""}`)) || driver.verificationLevel !== "BASIC";
  }
  return true;
}
function buildLaterDateTimeValue(): string {
  const base = new Date(Date.now() + 60 * 60 * 1000);
  base.setSeconds(0, 0);
  const minutes = base.getMinutes();
  base.setMinutes(minutes + (15 - (minutes % 15 || 15)) % 15);
  const year = base.getFullYear();
  const month = `${base.getMonth() + 1}`.padStart(2, "0");
  const day = `${base.getDate()}`.padStart(2, "0");
  const hours = `${base.getHours()}`.padStart(2, "0");
  const mins = `${base.getMinutes()}`.padStart(2, "0");
  return `${year}-${month}-${day}T${hours}:${mins}`;
}
// Reservation helper is implemented in TaxiTrustedMobilityPage; remove duplicate implementation here.

async function submitDriverReviewRequest(params: {
  activeReviewDriverId: string | null;
  identity: string;
  reviewRating: number;
  reviewComment: string;
  apiBaseUrl: string;
  reviewsMap: DriverReviewsMap;
}): Promise<{
  notice: string;
  ratingUpdate?: { driverId: string; summary: TaxiDriverRatingSummary };
  reviewsUpdate?: { driverId: string; reviews: TaxiDriverReview[] };
}> {
  const { activeReviewDriverId, identity, reviewRating, reviewComment, apiBaseUrl, reviewsMap } = params;
  if (!activeReviewDriverId) {
    return { notice: "" };
  }
  try {
    const result = await api.createTaxiDriverReview(activeReviewDriverId, {
      userId: identity,
      rating: reviewRating,
      comment: reviewComment.trim() || undefined,
    }, apiBaseUrl);
    const nextReviews = await api.listTaxiDriverReviews(activeReviewDriverId, apiBaseUrl).catch(() => reviewsMap[activeReviewDriverId] || []);
    return {
      notice: "تم حفظ تقييمك بنجاح.",
      ratingUpdate: { driverId: activeReviewDriverId, summary: result.summary },
      reviewsUpdate: { driverId: activeReviewDriverId, reviews: nextReviews },
    };
  } catch (error) {
    return { notice: error instanceof Error ? error.message : "تعذر حفظ التقييم حالياً." };
  }
}

async function submitDriverEnrollmentRequest(params: {
  driverEnrollForm: DriverEnrollForm;
  apiBaseUrl: string;
}): Promise<string> {
  const { driverEnrollForm, apiBaseUrl } = params;
  try {
    await api.applyTaxiDriver({
      fullName: driverEnrollForm.fullName.trim(),
      phone: driverEnrollForm.phone.trim(),
      whatsappPhone: driverEnrollForm.whatsappPhone.trim() || undefined,
      profileImageUrl: driverEnrollForm.profileImageUrl.trim() || undefined,
      vehicleCarType: driverEnrollForm.vehicleCarType.trim() || undefined,
      vehicleColor: driverEnrollForm.vehicleColor.trim() || undefined,
      vehicleMake: driverEnrollForm.vehicleMake.trim() || undefined,
      vehicleModel: driverEnrollForm.vehicleModel.trim() || undefined,
      platePublicLastDigits: driverEnrollForm.platePublicLastDigits.trim() || undefined,
      plateType: driverEnrollForm.plateType.trim() || undefined,
      muhafaza: driverEnrollForm.muhafaza.trim() || undefined,
      caza: driverEnrollForm.caza.trim() || undefined,
      village: driverEnrollForm.village.trim() || undefined,
      notes: driverEnrollForm.notes.trim() || undefined,
    }, apiBaseUrl);
    return "تم إرسال طلب الانضمام بنجاح. سيتم مراجعته من الإدارة.";
  } catch (error) {
    return error instanceof Error ? error.message : "تعذر إرسال طلب الانضمام حالياً.";
  }
}

async function submitComplaintRequest(params: {
  complaintMessage: string;
  identity: string;
  complaintDriverId: string;
  complaintCategory: ComplaintCategory;
  apiBaseUrl: string;
}): Promise<{ notice: string; shouldClear: boolean }> {
  const { complaintMessage, identity, complaintDriverId, complaintCategory, apiBaseUrl } = params;
  const message = complaintMessage.trim();
  if (!message) {
    return { notice: "اكتب نص الشكوى قبل الإرسال.", shouldClear: false };
  }
  try {
    await api.createTaxiComplaint({
      userId: identity,
      driverId: complaintDriverId || undefined,
      category: complaintCategory,
      message,
    }, apiBaseUrl);
    return { notice: "تم إرسال الشكوى بنجاح. سيتم متابعتها من الفريق المختص.", shouldClear: true };
  } catch (error) {
    return { notice: error instanceof Error ? error.message : "تعذر إرسال الشكوى حالياً.", shouldClear: false };
  }
}

async function submitLaterReservationRequest(params: {
  laterReservationDriverId: string | null;
  originFilter: AreaFilter;
  destinationFilter: AreaFilter;
  laterReservationAt: string;
  laterReservationNotes: string;
  identity: string;
  apiBaseUrl: string;
}): Promise<string> {
  const {
    laterReservationDriverId,
    originFilter,
    destinationFilter,
    laterReservationAt,
    laterReservationNotes,
    identity,
    apiBaseUrl,
  } = params;
  if (!laterReservationDriverId) {
    return "";
  }
  const pickupText = compactAddress(originFilter);
  if (!pickupText) {
    return "أدخل الانطلاق قبل الحجز اللاحق.";
  }
  if (!laterReservationAt) {
    return "حدد موعد الحجز أولاً.";
  }
  try {
    await api.createTaxiReservation({
      driverId: laterReservationDriverId,
      riderUserId: identity,
      pickupText,
      destinationText: compactAddress(destinationFilter) || undefined,
      scheduledAt: new Date(laterReservationAt).toISOString(),
      notes: laterReservationNotes.trim() || undefined,
    }, apiBaseUrl);
    return "تم إرسال الحجز اللاحق بنجاح.";
  } catch (error) {
    return error instanceof Error ? error.message : "تعذر إرسال الحجز اللاحق حالياً.";
  }
}

function useSyncDriverEnrollForm(profile: ReturnType<typeof useApp>["profile"], setDriverEnrollForm: React.Dispatch<React.SetStateAction<DriverEnrollForm>>) {
  useEffect(() => {
    setDriverEnrollForm((current) => ({
      ...current,
      fullName: current.fullName || profile.name || "",
      phone: current.phone || profile.phone || "",
      whatsappPhone: current.whatsappPhone || profile.phone || "",
    }));
  }, [profile.name, profile.phone, setDriverEnrollForm]);
}

function useLoadTaxiDrivers(params: {
  apiBaseUrl: string;
  originFilter: AreaFilter;
  setSearchBusy: React.Dispatch<React.SetStateAction<boolean>>;
  setSearchError: React.Dispatch<React.SetStateAction<string>>;
  setDrivers: React.Dispatch<React.SetStateAction<TaxiDriverView[]>>;
}) {
  const { apiBaseUrl, originFilter, setSearchBusy, setSearchError, setDrivers } = params;
  useEffect(() => {
    let cancelled = false;
    async function loadDrivers() {
      setSearchBusy(true);
      setSearchError("");
      try {
        const areaLookup = compactAddress(originFilter);
        const liveDrivers = await api.searchTaxiDrivers({
          q: areaLookup || undefined,
          muhafaza: originFilter.muhafaza || undefined,
          caza: originFilter.caza || undefined,
          village: originFilter.village || undefined,
        }, apiBaseUrl);
        if (cancelled) {
          return;
        }
        setDrivers(liveDrivers.length ? liveDrivers : FALLBACK_DRIVERS);
      } catch {
        if (cancelled) {
          return;
        }
        const lookup = normalizeLookup(compactAddress(originFilter));
        const fallback = FALLBACK_DRIVERS.filter((driver) => {
          const haystack = normalizeLookup(`${driver.fullName} ${buildAreaLabel(driver)} ${buildVehicleLabel(driver)} ${buildTrustLabel(driver)}`);
          return !lookup || haystack.includes(lookup);
        });
        setDrivers(fallback.length ? fallback : FALLBACK_DRIVERS);
        setSearchError("تُعرض الآن قائمة تجريبية إلى حين تفعيل البحث المباشر الكامل.");
      } finally {
        if (!cancelled) {
          setSearchBusy(false);
        }
      }
    }
    void loadDrivers();
    return () => {
      cancelled = true;
    };
  }, [apiBaseUrl, originFilter, setDrivers, setSearchBusy, setSearchError]);
}

function useSyncSelectedDriver(drivers: TaxiDriverView[], selectedDriverId: string, setSelectedDriverId: React.Dispatch<React.SetStateAction<string>>) {
  useEffect(() => {
    if (!drivers.some((driver) => driver.id === selectedDriverId)) {
      setSelectedDriverId(drivers[0]?.id || "");
    }
  }, [drivers, selectedDriverId, setSelectedDriverId]);
}

function useSyncComplaintDriverId(
  drivers: TaxiDriverView[],
  selectedDriverId: string,
  setComplaintDriverId: React.Dispatch<React.SetStateAction<string>>,
) {
  useEffect(() => {
    setComplaintDriverId((current) => {
      if (current && drivers.some((driver) => driver.id === current)) {
        return current;
      }
      return selectedDriverId || drivers[0]?.id || "";
    });
  }, [drivers, selectedDriverId, setComplaintDriverId]);
}

function useLoadDriverRatings(
  apiBaseUrl: string,
  drivers: TaxiDriverView[],
  setRatingMap: React.Dispatch<React.SetStateAction<DriverRatingMap>>,
) {
  useEffect(() => {
    let cancelled = false;
    async function loadRatings() {
      if (!drivers.length) {
        if (!cancelled) setRatingMap({});
        return;
      }
      try {
        const summaries = await api.getTaxiDriverRatingSummaries(drivers.map((driver) => driver.id), apiBaseUrl);
        if (cancelled) return;
        const nextMap: DriverRatingMap = {};
        for (const summary of summaries) {
          nextMap[summary.driverId] = summary;
        }
        setRatingMap(nextMap);
      } catch {
        if (!cancelled) {
          setRatingMap({});
        }
      }
    }
    void loadRatings();
    return () => {
      cancelled = true;
    };
  }, [apiBaseUrl, drivers, setRatingMap]);
}

export function TaxiMobileCommerceLayout() {
  const { apiBaseUrl, profile } = useApp();
  const navigate = useNavigate();
  const complaintsRef = useRef<HTMLElement>(null!);
  const identity = (profile.email || profile.phone || profile.name || "guest").trim().toLowerCase();
  const [rideMode, setRideMode] = useState<RideMode>("now");
  const [serviceFilter, setServiceFilter] = useState<ServiceFilter>("all");
  const [drivers, setDrivers] = useState<TaxiDriverView[]>(FALLBACK_DRIVERS);
  const [selectedDriverId, setSelectedDriverId] = useState<string>(FALLBACK_DRIVERS[0]?.id || "");
  const [originFilter, setOriginFilter] = useState<AreaFilter>(DEFAULT_FILTER);
  const [destinationFilter, setDestinationFilter] = useState<AreaFilter>(DEFAULT_FILTER);
  const [activeLocator, setActiveLocator] = useState<LocatorTarget | null>(null);
  const [searchBusy, setSearchBusy] = useState(false);
  const [searchError, setSearchError] = useState("");
  
  const [ratingMap, setRatingMap] = useState<DriverRatingMap>({});
  const [reviewsMap, setReviewsMap] = useState<DriverReviewsMap>({});
  const [activeReviewDriverId, setActiveReviewDriverId] = useState<string | null>(null);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState("");
  const [reviewBusy, setReviewBusy] = useState(false);
  const [reviewNotice, setReviewNotice] = useState("");
  const [driverEnrollOpen, setDriverEnrollOpen] = useState(false);
  const [driverEnrollBusy, setDriverEnrollBusy] = useState(false);
  const [driverEnrollNotice, setDriverEnrollNotice] = useState("");
  const [driverEnrollUploadBusy, setDriverEnrollUploadBusy] = useState(false);
  const [laterReservationDriverId, setLaterReservationDriverId] = useState<string | null>(null);
  const [laterReservationAt, setLaterReservationAt] = useState(buildLaterDateTimeValue);
  const [laterReservationNotes, setLaterReservationNotes] = useState("");
  const [laterReservationBusy, setLaterReservationBusy] = useState(false);
  const [laterReservationNotice, setLaterReservationNotice] = useState("");
  const [complaintBusy, setComplaintBusy] = useState(false);
  const [complaintNotice, setComplaintNotice] = useState("");
  const [complaintOpen, setComplaintOpen] = useState(false);
  const [complaintCategory, setComplaintCategory] = useState<ComplaintCategory>("driver");
  const [complaintDriverId, setComplaintDriverId] = useState(selectedDriverId || "");
  const [complaintMessage, setComplaintMessage] = useState("");
  const [driverEnrollForm, setDriverEnrollForm] = useState<DriverEnrollForm>(() => ({
    fullName: profile.name || "",
    phone: profile.phone || "",
    whatsappPhone: profile.phone || "",
    profileImageUrl: "",
    vehicleCarType: "سيدان",
    vehicleColor: "",
    vehicleMake: "",
    vehicleModel: "",
    platePublicLastDigits: "",
    plateType: "RED_PUBLIC",
    muhafaza: "",
    caza: "",
    village: "",
    notes: "",
  }));
  useSyncDriverEnrollForm(profile, setDriverEnrollForm);
  useLoadTaxiDrivers({ apiBaseUrl, originFilter, setSearchBusy, setSearchError, setDrivers });
  useSyncSelectedDriver(drivers, selectedDriverId, setSelectedDriverId);
  useSyncComplaintDriverId(drivers, selectedDriverId, setComplaintDriverId);
  useLoadDriverRatings(apiBaseUrl, drivers, setRatingMap);
  
  const filteredDrivers = useMemo(() => {
    return drivers.filter((driver) => matchesServiceFilter(driver, serviceFilter) && matchesAreaFilter(driver, originFilter));
  }, [drivers, originFilter, serviceFilter]);
  const originLabel = compactAddress(originFilter) || "اضغط لتحديد الانطلاق";
  const destinationLabel = compactAddress(destinationFilter) || "اضغط لتحديد الوجهة";
  function applyLocatorValue(target: LocatorTarget, value: WatanyLocationValue) {
    const normalized: AreaFilter = {
      muhafaza: value.muhafaza || "",
      caza: value.caza || "",
      village: value.village || "",
    };
    if (target === "origin") {
      setOriginFilter(normalized);
      return;
    }
    setDestinationFilter(normalized);
  }
  // submitReservation is handled by TaxiTrustedMobilityPage; no local implementation needed here.
  function focusComplaints() {
    setComplaintOpen(true);
    complaintsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }
  async function openDriverReview(driverId: string) {
    setActiveReviewDriverId(driverId);
    setReviewRating(5);
    setReviewComment("");
    setReviewNotice("");
    try {
      const reviews = await api.listTaxiDriverReviews(driverId, apiBaseUrl);
      setReviewsMap((current) => ({ ...current, [driverId]: reviews }));
    } catch {
      setReviewsMap((current) => ({ ...current, [driverId]: [] }));
    }
  }
  async function submitDriverReview() {
    if (!activeReviewDriverId) return;
    setReviewBusy(true);
    setReviewNotice("");
    const result = await submitDriverReviewRequest({
      activeReviewDriverId,
      identity,
      reviewRating,
      reviewComment,
      apiBaseUrl,
      reviewsMap,
    });
    if (result.ratingUpdate) {
      setRatingMap((current) => ({ ...current, [result.ratingUpdate!.driverId]: result.ratingUpdate!.summary }));
    }
    if (result.reviewsUpdate) {
      setReviewsMap((current) => ({ ...current, [result.reviewsUpdate!.driverId]: result.reviewsUpdate!.reviews }));
    }
    setReviewNotice(result.notice);
    setReviewBusy(false);
  }
  const activeDriverReviews = activeReviewDriverId ? (reviewsMap[activeReviewDriverId] || []) : [];
  async function submitDriverEnrollment() {
    setDriverEnrollBusy(true);
    setDriverEnrollNotice("");
    const notice = await submitDriverEnrollmentRequest({ driverEnrollForm, apiBaseUrl });
    setDriverEnrollNotice(notice);
    setDriverEnrollBusy(false);
  }
  async function submitComplaint() {
    setComplaintBusy(true);
    setComplaintNotice("");
    const result = await submitComplaintRequest({
      complaintMessage,
      identity,
      complaintDriverId,
      complaintCategory,
      apiBaseUrl,
    });
    if (result.shouldClear) {
      setComplaintMessage("");
    }
    setComplaintNotice(result.notice);
    setComplaintBusy(false);
  }
  function openLaterReservationCard(driverId: string) {
    setLaterReservationDriverId(driverId);
    setLaterReservationAt(buildLaterDateTimeValue());
    setLaterReservationNotes("");
    setLaterReservationNotice("");
  }
  async function submitLaterReservation() {
    setLaterReservationBusy(true);
    setLaterReservationNotice("");
    const notice = await submitLaterReservationRequest({
      laterReservationDriverId,
      originFilter,
      destinationFilter,
      laterReservationAt,
      laterReservationNotes,
      identity,
      apiBaseUrl,
    });
    if (notice) {
      setLaterReservationNotice(notice);
    }
    setLaterReservationBusy(false);
  }
  const viewCtx: TaxiMobileCommerceViewCtx = {
    rideMode,
    setRideMode,
    setDriverEnrollOpen,
    setDriverEnrollNotice,
    selectedDriverId,
    drivers,
    openLaterReservationCard,
    focusComplaints,
    navigate,
    setActiveLocator,
    originLabel,
    destinationLabel,
    activeLocator,
    originFilter,
    destinationFilter,
    applyLocatorValue,
    setServiceFilter,
    serviceFilter,
    searchBusy,
    filteredDrivers,
    searchError,
    setSelectedDriverId,
    ratingMap,
    apiBaseUrl,
    openDriverReview,
    activeReviewDriverId,
    setActiveReviewDriverId,
    reviewRating,
    setReviewRating,
    reviewComment,
    setReviewComment,
    activeDriverReviews,
    reviewNotice,
    submitDriverReview,
    reviewBusy,
    laterReservationDriverId,
    setLaterReservationDriverId,
    laterReservationAt,
    setLaterReservationAt,
    laterReservationNotes,
    setLaterReservationNotes,
    laterReservationNotice,
    reservationNotice: laterReservationNotice,
    submitLaterReservation,
    laterReservationBusy,
    driverEnrollOpen,
    submitDriverEnrollment,
    driverEnrollForm,
    setDriverEnrollForm,
    driverEnrollNotice,
    driverEnrollBusy,
    driverEnrollUploadBusy,
    setDriverEnrollUploadBusy,
    complaintsRef,
    complaintOpen,
    setComplaintOpen,
    complaintCategory,
    setComplaintCategory,
    complaintDriverId,
    setComplaintDriverId,
    complaintMessage,
    setComplaintMessage,
    complaintNotice,
    complaintBusy,
    submitComplaint,
  };
  return renderTaxiMobileCommerceView(viewCtx);
}

function renderTaxiMobileCommerceView(ctx: TaxiMobileCommerceViewCtx) {
  return (
    <main className="taxi-commerce" dir="rtl" lang="ar" data-taxi-page="commerce">
      {renderTaxiStickyBar(ctx)}
      {renderTaxiRouteCard(ctx)}
      {renderTaxiLocatorDialog(ctx)}
      {renderTaxiFilterRow(ctx)}
      {renderTaxiDriverList(ctx)}
      {renderTaxiReviewDialog(ctx)}
      {renderTaxiLaterReservationDialog(ctx)}
      {renderTaxiDriverEnrollDialog(ctx)}
      {renderTaxiComplaintCard(ctx)}
      {ctx.laterReservationNotice ? <div className="taxi-banner">{ctx.laterReservationNotice}</div> : null}
    </main>
  );
}

function renderTaxiStickyBar(ctx: TaxiMobileCommerceViewCtx) {
  return (
    <header className="taxi-commerce__stickybar" aria-label="تنقل التاكسي المختصر">
      <button
        type="button"
        className="taxi-icon-button taxi-icon-button--plus"
        onClick={() => {
          ctx.setDriverEnrollOpen(true);
          ctx.setDriverEnrollNotice("");
        }}
        aria-label="انضم كسائق"
        title="انضم كسائق"
      >
        <span className="taxi-icon-button__icon" aria-hidden="true">+</span>
        <span className="taxi-icon-button__label">انضم</span>
      </button>
      <button
        type="button"
        className="taxi-icon-button"
        onClick={() => {
          ctx.setRideMode("later");
          const preferredDriverId = ctx.selectedDriverId || ctx.drivers[0]?.id;
          if (preferredDriverId) ctx.openLaterReservationCard(preferredDriverId);
        }}
        aria-label="مجدول"
        title="مجدول"
      >
        <Clock24Regular aria-hidden="true" />
        <span className="taxi-icon-button__label">مجدول</span>
      </button>
      <button type="button" className="taxi-icon-button" onClick={ctx.focusComplaints} aria-label="الشكاوى" title="الشكاوى">
        <Chat24Regular aria-hidden="true" />
        <span className="taxi-icon-button__label">شكاوى</span>
      </button>
      <button type="button" className="taxi-icon-button" onClick={() => ctx.navigate("/taxi/driver")} aria-label="لوحة السائق" title="لوحة السائق">
        <Navigation24Regular aria-hidden="true" />
        <span className="taxi-icon-button__label">السائق</span>
      </button>
      <button type="button" className="taxi-icon-button" onClick={() => globalThis.location.reload()} aria-label="تحديث النتائج" title="تحديث">
        <ArrowClockwise24Regular aria-hidden="true" />
        <span className="taxi-icon-button__label">تحديث</span>
      </button>
    </header>
  );
}

function renderTaxiRouteCard(ctx: TaxiMobileCommerceViewCtx) {
  return (
    <section className="taxi-route-card" aria-label="تحديد مسار الرحلة">
      <div className="taxi-route-card__mode-menu" role="tablist" aria-label="موعد الرحلة">
        <button type="button" role="tab" aria-selected={ctx.rideMode === "now"} className={ctx.rideMode === "now" ? "is-active" : ""} onClick={() => ctx.setRideMode("now")}>
          الآن
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={ctx.rideMode === "later"}
          className={ctx.rideMode === "later" ? "is-active" : ""}
          onClick={() => {
            ctx.setRideMode("later");
            const preferredDriverId = ctx.selectedDriverId || ctx.drivers[0]?.id;
            if (preferredDriverId) ctx.openLaterReservationCard(preferredDriverId);
          }}
        >
          لاحقاً
        </button>
      </div>
      <div className="taxi-route-card__locator-row" aria-label="الانطلاق والوجهة">
        <button type="button" className="taxi-route-card__locator-button" onClick={() => ctx.setActiveLocator("origin")}>
          <span className="taxi-route-card__locator-title taxi-route-card__locator-title--start">الانطلاق</span>
          <strong>{ctx.originLabel}</strong>
        </button>
          <span className="taxi-route-card__locator-separator" aria-hidden="true">↔</span>
        <button type="button" className="taxi-route-card__locator-button" onClick={() => ctx.setActiveLocator("destination")}>
          <span className="taxi-route-card__locator-title">الوجهة</span>
          <strong>{ctx.destinationLabel}</strong>
        </button>
      </div>
    </section>
  );
}

function renderTaxiLocatorDialog(ctx: TaxiMobileCommerceViewCtx) {
  if (!ctx.activeLocator) return null;
  return (
    <dialog open className="taxi-locator-overlay" aria-modal="true" aria-label={ctx.activeLocator === "origin" ? "تحديد الانطلاق" : "تحديد الوجهة"}>
      <div className="taxi-locator-sheet">
        <div className="taxi-locator-sheet__header">
          <strong>{ctx.activeLocator === "origin" ? "اختر الانطلاق" : "اختر الوجهة"}</strong>
          <button type="button" onClick={() => ctx.setActiveLocator(null)}>إغلاق</button>
        </div>
        <LocationSelector
          key={`${ctx.activeLocator}-${ctx.originLabel}-${ctx.destinationLabel}`}
          value={ctx.activeLocator === "origin"
            ? { muhafaza: ctx.originFilter.muhafaza, caza: ctx.originFilter.caza, village: ctx.originFilter.village }
            : { muhafaza: ctx.destinationFilter.muhafaza, caza: ctx.destinationFilter.caza, village: ctx.destinationFilter.village }}
          onChange={(value) => ctx.applyLocatorValue(ctx.activeLocator as LocatorTarget, value)}
          requireAddress={false}
        />
        <div className="taxi-locator-sheet__actions">
          <button type="button" onClick={() => ctx.setActiveLocator(null)}>تم</button>
        </div>
      </div>
    </dialog>
  );
}

function renderTaxiFilterRow(ctx: TaxiMobileCommerceViewCtx) {
  return (
    <section className="taxi-filter-row" aria-label="مرشحات الخدمة">
      {([
        ["all", "الكل"],
        ["available", "متاح الآن"],
        ["family", "عائلي"],
      ] as const).map(([value, label]) => (
        <button key={value} type="button" className={ctx.serviceFilter === value ? "is-active" : ""} onClick={() => ctx.setServiceFilter(value)}>
          {label}
        </button>
      ))}
    </section>
  );
}

function renderTaxiDriverList(ctx: TaxiMobileCommerceViewCtx) {
  return (
    <section className="taxi-driver-list" aria-label="السائقون المتاحون">
      <div className="taxi-section-heading">
        <h2>السائقون المتاحون</h2>
        <span>{ctx.searchBusy ? "جارٍ البحث..." : `${ctx.filteredDrivers.length} نتيجة`}</span>
      </div>
      {ctx.searchError ? <div className="taxi-banner taxi-banner--notice">{ctx.searchError}</div> : null}
      <div className="taxi-driver-list__grid">
        {ctx.filteredDrivers.map((driver) => (
          <article key={driver.id} className={`taxi-driver-card${ctx.selectedDriverId === driver.id ? " is-selected" : ""}`}>
            <button
              type="button"
              className="taxi-driver-card__surface"
              onClick={() => ctx.setSelectedDriverId(driver.id)}
            >
              <span className="taxi-driver-card__avatar" aria-hidden="true">
                {driver.profileImageUrl ? <img src={driver.profileImageUrl} alt="" /> : driver.fullName.slice(0, 1)}
              </span>
              <span className="taxi-driver-card__body">
                <span className="taxi-driver-card__topline">
                  <strong>{driver.fullName}</strong>
                  <span className="taxi-driver-card__signals taxi-driver-card__signals--status">
                    <span className={`taxi-status-bulb taxi-status-bulb--${getAvailabilityTone(driver)}`} title={buildAvailabilityLabel(driver)} aria-label={buildAvailabilityLabel(driver)} />
                    <span className="taxi-driver-card__rating-inline" title={formatDriverRating(ctx.ratingMap[driver.id])} aria-label={formatDriverRating(ctx.ratingMap[driver.id])}>
                      <Star24Filled aria-hidden="true" />
                      <strong>{getDriverRatingNumber(ctx.ratingMap[driver.id])}</strong>
                    </span>
                  </span>
                </span>
                <small>{buildVehicleLabel(driver)}</small>
              </span>
            </button>
            <div className="taxi-driver-card__actions">
              <a
                href={`tel:${driver.phone}`}
                aria-label="اتصال"
                title="اتصال"
                onClick={() => api.recordTaxiCallEvent(driver.id, undefined, "DIRECT_PHONE", ctx.apiBaseUrl).catch(() => undefined)}
              >
                <Phone24Filled aria-hidden="true" />
                <span className="taxi-driver-card__action-label">اتصال</span>
              </a>
              <a
                href={`https://wa.me/${(driver.whatsappPhone || driver.phone).replace(/\D/g, "")}`}
                target="_blank"
                rel="noreferrer"
                onClick={() => api.recordTaxiCallEvent(driver.id, undefined, "WHATSAPP", ctx.apiBaseUrl).catch(() => undefined)}
                aria-label="واتساب"
                title="واتساب"
              >
                <Chat24Regular aria-hidden="true" />
                <span className="taxi-driver-card__action-label">واتساب</span>
              </a>
              <button type="button" onClick={() => ctx.openLaterReservationCard(driver.id)} aria-label="حجز لاحق" title="حجز لاحق">
                <Clock24Regular aria-hidden="true" />
                <span className="taxi-driver-card__action-label">لاحق</span>
              </button>
              <button type="button" onClick={() => { ctx.openDriverReview(driver.id).catch(() => undefined); }} aria-label="قيّم السائق" title="قيّم السائق">
                <Star24Filled aria-hidden="true" />
                <span className="taxi-driver-card__action-label">تقييم</span>
              </button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function renderTaxiReviewDialog(ctx: TaxiMobileCommerceViewCtx) {
  if (!ctx.activeReviewDriverId) return null;
  return (
    <dialog open className="taxi-locator-overlay" aria-modal="true" aria-label="تقييم السائق">
      <div className="taxi-locator-sheet">
        <div className="taxi-locator-sheet__header">
          <strong>تقييم السائق</strong>
          <button type="button" onClick={() => ctx.setActiveReviewDriverId(null)}>إغلاق</button>
        </div>
        <label className="taxi-review-field">
          <span>عدد النجوم</span>
          <select value={ctx.reviewRating} onChange={(event) => ctx.setReviewRating(Number(event.target.value))}>
            {[5, 4, 3, 2, 1].map((score) => (
              <option key={score} value={score}>{score} / 5</option>
            ))}
          </select>
        </label>
        <label className="taxi-review-field">
          <span>مراجعتك</span>
          <textarea rows={3} value={ctx.reviewComment} onChange={(event) => ctx.setReviewComment(event.target.value)} placeholder="اكتب ملاحظتك عن السائق (اختياري)" />
        </label>
        <div className="taxi-review-list" aria-label="مراجعات المستخدمين">
          <strong>آخر المراجعات</strong>
          {ctx.activeDriverReviews.length ? ctx.activeDriverReviews.slice(0, 4).map((review) => (
            <article key={review.id}>
              <span>{review.rating} / 5</span>
              <p>{review.comment || "بدون تعليق"}</p>
            </article>
          )) : <p>لا توجد مراجعات بعد.</p>}
        </div>
        {ctx.reviewNotice ? <div className="taxi-banner taxi-banner--notice">{ctx.reviewNotice}</div> : null}
        <div className="taxi-locator-sheet__actions">
          <button type="button" onClick={() => { ctx.submitDriverReview().catch(() => undefined); }} disabled={ctx.reviewBusy}>
            {ctx.reviewBusy ? "جارٍ الحفظ..." : "حفظ التقييم"}
          </button>
        </div>
      </div>
    </dialog>
  );
}

function renderTaxiLaterReservationDialog(ctx: TaxiMobileCommerceViewCtx) {
  if (!ctx.laterReservationDriverId) return null;
  return (
    <dialog open className="taxi-locator-overlay" aria-modal="true" aria-label="الحجز اللاحق">
      <div className="taxi-locator-sheet">
        <div className="taxi-locator-sheet__header">
          <strong>بطاقة الحجز اللاحق</strong>
          <button type="button" onClick={() => ctx.setLaterReservationDriverId(null)}>إغلاق</button>
        </div>
        <div style={{ padding: '0 12px 12px' }}>
          <strong>موقع الانطلاق والوجهة</strong>
          <div style={{ marginTop: 8 }}>
            <label className="taxi-review-field" style={{ marginBottom: 8 }}>
              <span>مكان الانطلاق</span>
              <LocationSelector
                value={{ muhafaza: ctx.originFilter.muhafaza, caza: ctx.originFilter.caza, village: ctx.originFilter.village }}
                onChange={(value) => ctx.applyLocatorValue('origin', value)}
                requireAddress={true}
              />
            </label>
            <label className="taxi-review-field">
              <span>الوجهة (اختياري)</span>
              <LocationSelector
                value={{ muhafaza: ctx.destinationFilter.muhafaza, caza: ctx.destinationFilter.caza, village: ctx.destinationFilter.village }}
                onChange={(value) => ctx.applyLocatorValue('destination', value)}
                requireAddress={false}
              />
            </label>
          </div>
        </div>
        <label className="taxi-review-field">
          <span>موعد الرحلة</span>
          <input type="datetime-local" value={ctx.laterReservationAt} onChange={(event) => ctx.setLaterReservationAt(event.target.value)} />
        </label>
        <label className="taxi-review-field">
          <span>ملاحظة إضافية</span>
          <textarea rows={3} value={ctx.laterReservationNotes} onChange={(event) => ctx.setLaterReservationNotes(event.target.value)} placeholder="تفاصيل إضافية للحجز اللاحق (اختياري)" />
        </label>
        {ctx.laterReservationNotice ? <div className="taxi-banner taxi-banner--notice">{ctx.laterReservationNotice}</div> : null}
        <div className="taxi-locator-sheet__actions taxi-locator-sheet__actions--split">
          <button type="button" onClick={() => ctx.setLaterReservationDriverId(null)} disabled={ctx.laterReservationBusy}>إلغاء</button>
          <button type="button" onClick={() => { ctx.submitLaterReservation().catch(() => undefined); }} disabled={ctx.laterReservationBusy}>
            {ctx.laterReservationBusy ? "جارٍ الإرسال..." : "تأكيد الحجز اللاحق"}
          </button>
        </div>
      </div>
    </dialog>
  );
}

function renderTaxiDriverEnrollDialog(ctx: TaxiMobileCommerceViewCtx) {
  if (!ctx.driverEnrollOpen) return null;
  return (
    <dialog open className="taxi-locator-overlay" aria-modal="true" aria-label="الانضمام كسائق تاكسي">
      <div className="taxi-locator-sheet">
        <div className="taxi-locator-sheet__header">
          <strong>الانضمام كسائق تاكسي</strong>
          <button type="button" onClick={() => ctx.setDriverEnrollOpen(false)}>إغلاق</button>
        </div>
        <form
          className="taxi-enroll-form"
          onSubmit={(event) => {
            event.preventDefault();
            ctx.submitDriverEnrollment().catch(() => undefined);
          }}
        >
          <div className="taxi-enroll-grid">
            <label className="taxi-review-field"><span>الاسم الكامل</span><input type="text" value={ctx.driverEnrollForm.fullName} onChange={(event) => ctx.setDriverEnrollForm((current) => ({ ...current, fullName: event.target.value }))} required /></label>
            <label className="taxi-review-field"><span>رقم الهاتف</span><input type="tel" value={ctx.driverEnrollForm.phone} onChange={(event) => ctx.setDriverEnrollForm((current) => ({ ...current, phone: event.target.value }))} required /></label>
            <label className="taxi-review-field"><span>واتساب</span><input type="tel" value={ctx.driverEnrollForm.whatsappPhone} onChange={(event) => ctx.setDriverEnrollForm((current) => ({ ...current, whatsappPhone: event.target.value }))} /></label>
            <label className="taxi-review-field"><span>نوع السيارة</span>
              <select value={ctx.driverEnrollForm.vehicleCarType} onChange={(event) => ctx.setDriverEnrollForm((current) => ({ ...current, vehicleCarType: event.target.value }))}>
                <option value="سيدان">سيدان</option>
                <option value="فان">فان</option>
                <option value="SUV">SUV</option>
                <option value="ميني فان">ميني فان</option>
                <option value="دراجة">دراجة</option>
              </select>
            </label>
            <label className="taxi-review-field"><span>الماركة</span><input type="text" value={ctx.driverEnrollForm.vehicleMake} onChange={(event) => ctx.setDriverEnrollForm((current) => ({ ...current, vehicleMake: event.target.value }))} /></label>
            <label className="taxi-review-field"><span>الموديل</span><input type="text" value={ctx.driverEnrollForm.vehicleModel} onChange={(event) => ctx.setDriverEnrollForm((current) => ({ ...current, vehicleModel: event.target.value }))} /></label>
            <label className="taxi-review-field"><span>اللون</span><input type="text" value={ctx.driverEnrollForm.vehicleColor} onChange={(event) => ctx.setDriverEnrollForm((current) => ({ ...current, vehicleColor: event.target.value }))} /></label>
            <label className="taxi-review-field"><span>آخر أرقام اللوحة</span><input type="text" value={ctx.driverEnrollForm.platePublicLastDigits} onChange={(event) => ctx.setDriverEnrollForm((current) => ({ ...current, platePublicLastDigits: event.target.value }))} /></label>
            <label className="taxi-review-field"><span>نوع اللوحة</span><select value={ctx.driverEnrollForm.plateType} onChange={(event) => ctx.setDriverEnrollForm((current) => ({ ...current, plateType: event.target.value }))}><option value="RED_PUBLIC">عمومية حمراء</option><option value="COMMERCIAL">تجارية</option><option value="PRIVATE">خاصة</option><option value="UNKNOWN">غير محدد</option></select></label>
            <div style={{ gridColumn: '1 / -1' }}>
              <strong>منطقة الخدمة</strong>
              <LocationSelector
                value={{ muhafaza: ctx.driverEnrollForm.muhafaza, caza: ctx.driverEnrollForm.caza, village: ctx.driverEnrollForm.village }}
                onChange={(value) => ctx.setDriverEnrollForm((current) => ({ ...current, muhafaza: value.muhafaza || '', caza: value.caza || '', village: value.village || '' }))}
                requireAddress={false}
              />
            </div>
            <label className="taxi-review-field" style={{ gridColumn: '1 / -1' }}>
              <span>صورة الملف (مطلوب)</span>
              <input
                type="file"
                accept="image/*"
                capture="environment"
                required
                onChange={(event) => handleDriverEnrollFileChange(ctx, event.target.files?.[0])}
              />
              {ctx.driverEnrollForm.profileImageUrl ? <div style={{ marginTop: 8 }}><img src={ctx.driverEnrollForm.profileImageUrl} alt="preview" style={{ maxWidth: '100%', height: 'auto', borderRadius: 6 }} /></div> : null}
            </label>
          </div>
          <label className="taxi-review-field"><span>معلومات إضافية عن الخدمة</span><textarea rows={3} value={ctx.driverEnrollForm.notes} onChange={(event) => ctx.setDriverEnrollForm((current) => ({ ...current, notes: event.target.value }))} placeholder="اكتب أي معلومات إضافية مثل مناطق الخدمة أو أوقات العمل" /></label>
          {ctx.driverEnrollNotice ? <div className="taxi-banner taxi-banner--notice">{ctx.driverEnrollNotice}</div> : null}
            <div className="taxi-locator-sheet__actions">
            <button type="submit" disabled={ctx.driverEnrollBusy || ctx.driverEnrollUploadBusy}>{ctx.driverEnrollBusy || ctx.driverEnrollUploadBusy ? "جارٍ الإرسال..." : "إرسال طلب الانضمام"}</button>
          </div>
        </form>
      </div>
    </dialog>
  );
}

async function uploadDriverEnrollImage(ctx: TaxiMobileCommerceViewCtx, dataUrl: string) {
  try {
    const resp = await fetch(`${ctx.apiBaseUrl || ''}/api/files/upload`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ dataUrl }),
    });
    const json = await resp.json();
    if (json?.ok && json?.url) {
      ctx.setDriverEnrollForm((current) => ({ ...current, profileImageUrl: json?.url }));
      ctx.setDriverEnrollNotice('تم رفع الصورة');
    } else if (json?.error) {
      ctx.setDriverEnrollNotice('تعذر رفع الصورة: ' + (json?.error || 'خطأ'));
    } else {
      ctx.setDriverEnrollNotice('تعذر رفع الصورة. حافظ على المعاينة وسيحاول النظام لاحقاً.');
    }
  } catch {
    ctx.setDriverEnrollNotice('تعذر رفع الصورة. تحقق من الاتصال.');
  } finally {
    ctx.setDriverEnrollUploadBusy(false);
  }
}

function handleDriverEnrollFileChange(ctx: TaxiMobileCommerceViewCtx, file?: File) {
  if (!file) return;
  const reader = new FileReader();
  ctx.setDriverEnrollUploadBusy(true);
  ctx.setDriverEnrollNotice('');
  reader.onload = () => {
    const result = reader.result;
    const dataUrl = typeof result === 'string' ? result : '';
    ctx.setDriverEnrollForm((current) => ({ ...current, profileImageUrl: dataUrl }));
    void uploadDriverEnrollImage(ctx, dataUrl);
  };
  reader.onerror = () => {
    ctx.setDriverEnrollUploadBusy(false);
    ctx.setDriverEnrollNotice('تعذر قراءة الصورة المحددة.');
  };
  reader.readAsDataURL(file);
}

function renderTaxiComplaintCard(ctx: TaxiMobileCommerceViewCtx) {
  return (
    <section ref={ctx.complaintsRef} className="taxi-support taxi-complaint-card" aria-label="تقديم شكوى">
      <div>
        <strong>بطاقة الشكاوى</strong>
        <p>يمكنك إرسال شكوى حول السائق أو الرحلة أو أي مشكلة مرتبطة بخدمة التاكسي.</p>
      </div>
      {ctx.complaintOpen ? (
        <div className="taxi-complaint-card__form">
          <label className="taxi-review-field">
            <span>نوع الشكوى</span>
            <select value={ctx.complaintCategory} onChange={(event) => ctx.setComplaintCategory(event.target.value as ComplaintCategory)}>
              <option value="driver">السائق</option>
              <option value="ride">الرحلة</option>
              <option value="service">الخدمة</option>
              <option value="other">أخرى</option>
            </select>
          </label>
          <label className="taxi-review-field">
            <span>السائق</span>
            <select value={ctx.complaintDriverId} onChange={(event) => ctx.setComplaintDriverId(event.target.value)}>
              <option value="">بدون تحديد</option>
              {ctx.drivers.map((driver) => (
                <option key={driver.id} value={driver.id}>{driver.fullName}</option>
              ))}
            </select>
          </label>
          <label className="taxi-review-field">
            <span>تفاصيل الشكوى</span>
            <textarea rows={3} value={ctx.complaintMessage} onChange={(event) => ctx.setComplaintMessage(event.target.value)} placeholder="اكتب تفاصيل الشكوى هنا" />
          </label>
          {ctx.complaintNotice ? <div className="taxi-banner taxi-banner--notice">{ctx.complaintNotice}</div> : null}
          <div className="taxi-complaint-card__actions">
            <button type="button" onClick={() => ctx.setComplaintOpen(false)} disabled={ctx.complaintBusy}>طي البطاقة</button>
            <button type="button" onClick={() => { ctx.submitComplaint().catch(() => undefined); }} disabled={ctx.complaintBusy}>
              {ctx.complaintBusy ? "جارٍ الإرسال..." : "إرسال الشكوى"}
            </button>
          </div>
        </div>
      ) : (
        <button type="button" className="taxi-complaint-card__toggle" onClick={() => ctx.setComplaintOpen(true)}>
          فتح بطاقة الشكوى
        </button>
      )}
    </section>
  );
}
export default TaxiMobileCommerceLayout;


