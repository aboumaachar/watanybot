/* eslint-disable jsx-a11y/no-autofocus -- APEX scoped legacy lint closeout: pre-existing network page autofocus lint debt; outside compact procedures viewer patch */
import { useEffect, useMemo, useRef, useState } from "react";
import { useApp } from "../store/app";
import { api, type NetworkMembershipProfile } from "../lib/api";

// APEX_THE_NETWORK_USES_CANONICAL_ADDRESS_WIDGET
// The Network / Al Shabaka must use the shared AddressWidgetFieldAdapter contract.
// Keep this import path aligned with the project tsconfig/package alias if promoted to package import.
import { AddressWidgetFieldAdapter } from "../../../../packages/address-network/src/AddressWidgetFieldAdapter";

type NetworkVisibility = "VISIBLE_NETWORK_ONLY" | "VISIBLE_CAZA_ONLY" | "VISIBLE_VILLAGE_ONLY" | "HIDDEN";
type FamilyGroupTier = "BASIC_FAMILY_MEMBER" | "VERIFIED_FAMILY_MEMBER" | "CONTRIBUTOR" | "COMMUNITY_STEWARD";

type NetworkJoinState = {
  displayName: string;
  visibility: NetworkVisibility;
  familyTier: FamilyGroupTier;
  points: number;
  address: unknown;
};

type NetworkMembershipStatus = "not_joined" | "pending_verification" | "approved_member";

const visibilityOptions: Array<{ value: NetworkVisibility; label: string }> = [
  { value: "VISIBLE_NETWORK_ONLY", label: "مرئي لأعضاء الشبكة المعتمدين" },
  { value: "VISIBLE_CAZA_ONLY", label: "مرئي على مستوى القضاء فقط" },
  { value: "VISIBLE_VILLAGE_ONLY", label: "مرئي على مستوى البلدة فقط" },
  { value: "HIDDEN", label: "مخفي حتى أقرر ظهوره" },
];

const familyTierLabels: Record<FamilyGroupTier, string> = {
  BASIC_FAMILY_MEMBER: "عضو عائلي أساسي",
  VERIFIED_FAMILY_MEMBER: "عضو عائلي موثّق",
  CONTRIBUTOR: "مساهم",
  COMMUNITY_STEWARD: "راعٍ مجتمعي",
};

function buildIdentity(profile: { email?: string; phone?: string; name?: string }) {
  const token = (profile.email || profile.phone || profile.name || "anonymous").trim().toLowerCase();
  return token || "anonymous";
}

function getDefaultJoinState(name?: string): NetworkJoinState {
  return {
    displayName: (name || "").trim(),
    visibility: "VISIBLE_NETWORK_ONLY",
    familyTier: "BASIC_FAMILY_MEMBER",
    points: 0,
    address: null,
  };
}

function toApiVisibilityLevel(value: NetworkVisibility): "VISIBLE_NETWORK_ONLY" | "VISIBLE_CAZA_ONLY" | "VISIBLE_VILLAGE_ONLY" | "HIDDEN" {
  return value;
}

function fromApiMembershipStatus(profile: NetworkMembershipProfile | null): NetworkMembershipStatus {
  if (!profile) return "not_joined";
  if (profile.approvalStatus === "APPROVED") return "approved_member";
  if (profile.approvalStatus === "PENDING") return "pending_verification";
  return "not_joined";
}

function fromApiProfile(profile: NetworkMembershipProfile): NetworkJoinState {
  return {
    displayName: profile.displayName || "",
    visibility: (profile.visibilityLevel as NetworkVisibility) || "VISIBLE_NETWORK_ONLY",
    familyTier: (profile.familyTier as FamilyGroupTier) || "BASIC_FAMILY_MEMBER",
    points: Number(profile.points || 0),
    address: profile.address ?? null,
  };
}

export default function TheNetworkPage() {
  const { profile: userProfile, hasRole } = useApp();
  const formRef = useRef<HTMLElement | null>(null);
  const memberIdentity = useMemo(
    () => buildIdentity({ email: userProfile.email, phone: userProfile.phone, name: userProfile.name }),
    [userProfile.email, userProfile.name, userProfile.phone],
  );
  const [membership, setMembership] = useState<NetworkMembershipProfile | null>(null);
  const [profile, setProfile] = useState<NetworkJoinState>(() => getDefaultJoinState(userProfile.name));
  const [statusMessage, setStatusMessage] = useState("");
  const [loadingMembership, setLoadingMembership] = useState(false);
  const [savingMembership, setSavingMembership] = useState(false);

  const isVerifiedUser = useMemo(() => {
    if (userProfile.phoneVerified === true) return true;
    return hasRole(["accredited", "admin", "superadmin", "moderator"]);
  }, [hasRole, userProfile.phoneVerified]);

  const currentStatus: NetworkMembershipStatus = fromApiMembershipStatus(membership);
  const isMember = currentStatus === "approved_member";
  const isPendingVerification = currentStatus === "pending_verification";
  const canDiscoverMap = isMember && isVerifiedUser;

  useEffect(() => {
    let cancelled = false;

    async function loadMembership() {
      setLoadingMembership(true);
      try {
        const nextMembership = await api.getNetworkMembership(memberIdentity);
        if (cancelled) return;
        setMembership(nextMembership);
        if (nextMembership) {
          setProfile(fromApiProfile(nextMembership));
        } else {
          setProfile(getDefaultJoinState(userProfile.name));
        }
      } catch {
        if (!cancelled) {
          setMembership(null);
          setProfile(getDefaultJoinState(userProfile.name));
        }
      } finally {
        if (!cancelled) setLoadingMembership(false);
      }
    }

    void loadMembership();
    return () => {
      cancelled = true;
    };
  }, [memberIdentity, userProfile.name]);

  useEffect(() => {
    if (profile.displayName.trim()) return;
    if (!userProfile.name?.trim()) return;
    setProfile((current) => ({ ...current, displayName: userProfile.name?.trim() || "" }));
  }, [profile.displayName, userProfile.name]);

  const familyBenefits = useMemo(() => [
    "العضوية في المجموعة العائلية بعد الانضمام إلى الشبكة",
    "إمكانية الاستفادة من قواعد التعويض والمزايا المستقبلية التي يحددها المشرف العام",
    "نقاط مجتمعية مقابل المساهمة الموثقة، والإحالات، والدعم، والتبليغ",
    "ظهور الخريطة مضبوط بالخصوصية على مستوى المحافظة أو القضاء أو البلدية أو البلدة",
  ], []);

  const profileSummary = useMemo(() => [
    { label: "الاسم الظاهر", value: profile.displayName.trim() || "غير محدد" },
    { label: "خصوصية الظهور", value: visibilityOptions.find((item) => item.value === profile.visibility)?.label ?? profile.visibility },
    { label: "فئة العائلة", value: familyTierLabels[profile.familyTier] },
    { label: "نقاط المجتمع", value: `${profile.points.toLocaleString()} نقطة`, emphasis: true },
  ], [profile.displayName, profile.familyTier, profile.points, profile.visibility]);

  const statusDescription = useMemo(() => {
    if (isMember) {
      return "ملفك عضو فعّال في الشبكة. يمكنك التعديل والحفظ في أي وقت.";
    }
    if (isPendingVerification) {
      return "تم استلام الطلب وهو الآن بانتظار تحقق الإدارة.";
    }
    return "يمكنك إدارة النموذج كمسودة ثم إرسال الطلب للمراجعة والاعتماد.";
  }, [isMember, isPendingVerification]);

  const showClearButton = !isMember;
  const showVerifyOnlyHint = !isVerifiedUser;
  const heroTitle = isMember ? "ملفك في شبكة موطني" : "انضم إلى شبكة موطني العائلية الجغرافية";
  const heroCtaLabel = isMember ? "تعديل البيانات" : "ابدأ الآن";
  const showPendingChip = isPendingVerification;

  const canShowAdminApprove = hasRole(["admin", "superadmin"]) && isPendingVerification;

  const resolveTierPoints = (tier: FamilyGroupTier) => {
    switch (tier) {
      case "COMMUNITY_STEWARD":
        return 120;
      case "CONTRIBUTOR":
        return 80;
      case "VERIFIED_FAMILY_MEMBER":
        return 40;
      default:
        return 0;
    }
  };

  const saveDraft = async () => {
    setSavingMembership(true);
    try {
      const saved = await api.saveNetworkMembershipDraft({
        userId: memberIdentity,
        displayName: profile.displayName,
        visibilityLevel: toApiVisibilityLevel(profile.visibility),
        familyTier: profile.familyTier,
        points: profile.points,
        address: profile.address,
        isVerifiedUser,
      });
      setMembership(saved);
      setProfile(fromApiProfile(saved));
      setStatusMessage("تم حفظ بيانات النموذج في الشبكة.");
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "تعذر حفظ المسودة.");
    } finally {
      setSavingMembership(false);
    }
  };

  const submitJoinRequest = async () => {
    if (!profile.displayName.trim()) {
      setStatusMessage("الرجاء إدخال الاسم الظاهر قبل إرسال الطلب.");
      formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    setSavingMembership(true);
    try {
      await api.saveNetworkMembershipDraft({
        userId: memberIdentity,
        displayName: profile.displayName,
        visibilityLevel: toApiVisibilityLevel(profile.visibility),
        familyTier: profile.familyTier,
        points: profile.points,
        address: profile.address,
        isVerifiedUser,
      });
      const submitted = await api.submitNetworkMembership(memberIdentity);
      setMembership(submitted);
      setProfile(fromApiProfile(submitted));
      setStatusMessage("تم إرسال طلب الانضمام. بانتظار مراجعة الإدارة والتحقق.");
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "تعذر إرسال طلب الانضمام.");
    } finally {
      setSavingMembership(false);
    }
  };

  const saveMemberChanges = async () => {
    if (!isMember) return;
    await saveDraft();
    setStatusMessage("تم حفظ تعديلات الملف داخل الشبكة.");
  };

  const approvePendingMembership = async () => {
    if (!isPendingVerification) return;
    setSavingMembership(true);
    try {
      const approved = await api.approveNetworkMembership(memberIdentity);
      setMembership(approved);
      setProfile(fromApiProfile(approved));
      setStatusMessage("تم اعتماد العضوية وأصبح الملف جزءًا من الشبكة.");
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "تعذر اعتماد العضوية.");
    } finally {
      setSavingMembership(false);
    }
  };

  const resetToLastSaved = async () => {
    setLoadingMembership(true);
    try {
      const saved = await api.getNetworkMembership(memberIdentity);
      setMembership(saved);
      if (saved) {
        setProfile(fromApiProfile(saved));
        setStatusMessage("تمت إعادة تحميل آخر نسخة محفوظة.");
      } else {
        setProfile(getDefaultJoinState(userProfile.name));
        setStatusMessage("لا يوجد حفظ سابق. تم إعادة تعيين النموذج.");
      }
    } catch {
      setStatusMessage("تعذر استرجاع آخر حفظ الآن.");
    } finally {
      setLoadingMembership(false);
    }
  };

  const clearForm = () => {
    setProfile(getDefaultJoinState(userProfile.name));
    setStatusMessage("تم تنظيف الحقول ويمكنك البدء من جديد.");
  };

  const discoverNetworkMap = () => {
    if (!canDiscoverMap) return;
    const query = encodeURIComponent("خريطة شبكة موطني لبنان");
    globalThis.open(`https://www.openstreetmap.org/search?query=${query}`, "_blank", "noopener,noreferrer");
  };

  const primaryFormActionLabel = isMember ? "حفظ التعديلات" : "إرسال طلب الانضمام";
  const onPrimaryFormAction = isMember ? saveMemberChanges : submitJoinRequest;

  return (
    <main dir="rtl" className="wt-page-shell">
      <section className="wt-panel wt-panel--hero wt-page-grid">
        <div>
          <p className="wt-panel__eyebrow">الشبكة</p>
          <div className="wt-panel__title-row">
            <h1 className="wt-panel__title">{heroTitle}</h1>
            <button
              type="button"
              className="wt-btn wt-btn--inline-hero"
              disabled={loadingMembership}
              onClick={() => formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })}
            >
              {heroCtaLabel}
            </button>
          </div>
        </div>

        <div className="wt-breakdown">
          <section className="wt-breakdown__group wt-breakdown__group--core">
            <div className="wt-breakdown__group-title">ملخص الملف</div>
            <div className="wt-breakdown__rows">
              {profileSummary.map((item) => (
                <div
                  key={item.label}
                  className={`wt-breakdown__row${item.emphasis ? " wt-breakdown__row--strong" : ""}`}
                >
                  <span className="wt-breakdown__label">{item.label}</span>
                  <span className="wt-breakdown__value">{item.value}</span>
                </div>
              ))}
            </div>
            <div className="wt-sheet__row" style={{ marginTop: 10, flexWrap: "wrap" }}>
              <button type="button" className="wt-btn wt-cta-glow" onClick={discoverNetworkMap} disabled={!canDiscoverMap}>
                اكتشف خريطة الشبكة
              </button>
              {showVerifyOnlyHint ? <span className="wt-chip wt-chip--muted">الخريطة متاحة للمستخدم الموثق فقط</span> : null}
              {showPendingChip ? <span className="wt-chip wt-chip--muted">طلبك قيد المراجعة لدى الإدارة</span> : null}
            </div>
          </section>
        </div>
      </section>

      <section ref={formRef} className="wt-panel wt-page-grid">
        <div className="wt-page-grid">
          <label className="wt-field wt-field--start-here wt-attention-edge">
            <span className="wt-field__label">الاسم الظاهر</span>
            <input
              value={profile.displayName}
              onChange={(event) => setProfile((current) => ({ ...current, displayName: event.target.value }))}
              placeholder="الاسم الذي سيظهر داخل الشبكة"
              autoFocus={!isMember}
              className="wt-field__control"
            />
          </label>

          <section className="wt-panel wt-panel--subtle">
            <h2 className="wt-panel__subtitle">محدد العنوان</h2>
            <AddressWidgetFieldAdapter
              value={profile.address as never}
              onChange={(address: unknown) => setProfile((current) => ({ ...current, address }))}
            />
          </section>

          <label className="wt-field">
            <span className="wt-field__label">خصوصية الظهور</span>
            <select
              value={profile.visibility}
              onChange={(event) => setProfile((current) => ({ ...current, visibility: event.target.value as NetworkVisibility }))}
              className="wt-field__control"
            >
              {visibilityOptions.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
            </select>
          </label>

          <label className="wt-field">
            <span className="wt-field__label">الفئة داخل المجموعة</span>
            <select
              value={profile.familyTier}
              onChange={(event) => {
                const nextTier = event.target.value as FamilyGroupTier;
                const nextPoints = resolveTierPoints(nextTier);
                setProfile((current) => ({ ...current, familyTier: nextTier, points: nextPoints }));
              }}
              className="wt-field__control"
            >
              {Object.keys(familyTierLabels).map((tier) => (
                <option key={tier} value={tier}>{familyTierLabels[tier as FamilyGroupTier]}</option>
              ))}
            </select>
          </label>

          <section className="wt-sheet" aria-live="polite">
            <div className="wt-sheet__row" style={{ flexWrap: "wrap" }}>
              <button type="button" className="wt-btn wt-btn--ghost wt-cta-glow" onClick={saveDraft} aria-busy={savingMembership}>حفظ مسودة</button>
              <button type="button" className="wt-btn wt-btn--ghost wt-cta-glow" onClick={resetToLastSaved} aria-busy={loadingMembership}>استرجاع آخر حفظ</button>
              {showClearButton ? <button type="button" className="wt-btn wt-btn--ghost wt-cta-glow" onClick={clearForm}>تنظيف الحقول</button> : null}
            </div>
            <div className="wt-sheet__row" style={{ flexWrap: "wrap" }}>
              <button
                type="button"
                className="wt-btn wt-cta-glow wt-cta-processing"
                onClick={onPrimaryFormAction}
                disabled={savingMembership || loadingMembership}
                aria-busy={savingMembership || loadingMembership}
              >
                {primaryFormActionLabel}
              </button>
              {canShowAdminApprove ? (
                <button
                  type="button"
                  className="wt-btn wt-btn--ghost wt-cta-glow wt-cta-processing"
                  onClick={approvePendingMembership}
                  disabled={savingMembership || loadingMembership}
                  aria-busy={savingMembership || loadingMembership}
                >
                  اعتماد العضوية
                </button>
              ) : null}
            </div>
            <p className="wt-sheet__subtitle" style={{ marginTop: 6 }}>{statusDescription}</p>
            {loadingMembership ? <p className="wt-sheet__subtitle" style={{ marginTop: 2 }}>جارٍ تحميل حالة الشبكة...</p> : null}
            {statusMessage ? <p className="wt-sheet__subtitle" style={{ marginTop: 2 }}>{statusMessage}</p> : null}
          </section>
        </div>
      </section>

      <section className="wt-panel wt-page-grid">
        <h2 className="wt-panel__subtitle">مزايا المجموعة العائلية والنقاط</h2>
        <div className="wt-page-grid">
          {familyBenefits.map((benefit) => (
            <div key={benefit} className="wt-card wt-card--stacked">
              <p>{benefit}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="wt-panel wt-panel--notice">
        <h2 className="wt-panel__subtitle">قاعدة المشرف العام</h2>
        <p style={{ marginBottom: 0, lineHeight: 1.8 }}>
          التعويضات، والمزايا، والنقاط، والموافقات، وظهور الموقع على الخريطة، والعرض العام كلها قواعد معطلة افتراضيًا حتى يفعّلها المشرف العام.
        </p>
      </section>
    </main>
  );
}
