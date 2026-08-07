import { AddressPicker, type AddressValue } from '../components/aided-input';
import { useEffect, useState, type CSSProperties, type ComponentType, type SVGProps } from "react";
import {
  ArrowCounterclockwise24Regular,
  Briefcase24Regular,
  Chat24Regular,
  DocumentText24Regular,
  Mail24Regular,
  Phone24Regular,
  Save24Regular,
  Send24Regular,
  ShieldCheckmark24Regular,
  SignOut24Regular,
} from "../theme/watany-v4/legacyIconBridge";
import { UtilityActionIcon } from "../components/UtilityActionIcon";
import { MainHybridChatSurface } from "../components/chat/MainHybridChatSurface";
import { useLocation, useNavigate } from "react-router-dom";
import UtilityHeaderTitleRow from "../components/UtilityHeaderTitleRow";
import { AccountApplicationsPanel } from "../components/account/AccountApplicationsPanel";
import { useApp } from "../store/app";
import { useNavigateMode } from "../lib/routes";
// APEX_CSS_FREEZE_DISABLED_IMPORT import "../styles/profile-page.css";

function serializeAidedAddressValue(value: AddressValue): string {
  return [value.muhafaza, value.qaza, value.village, value.exactAddress]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(' - ');
}

function parseAidedAddressValue(text?: string): AddressValue {
  const parts = (text || '').split(' - ').map((part) => part.trim()).filter(Boolean);
  return {
    muhafaza: parts[0] || '',
    qaza: parts[1] || '',
    village: parts[2] || '',
    exactAddress: parts.slice(3).join(' - '),
  };
}

type UtilityColorStyle = CSSProperties & {
  "--utility-color": string;
};

function utilityColorStyle(color: string, extra?: CSSProperties): UtilityColorStyle {
  return {
    ...extra,
    "--utility-color": color,
  };
}

function formatVerificationTimestamp(value?: string): string | null {
  if (!value) return null;

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;

  return new Intl.DateTimeFormat("ar-LB", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(parsed);
}

function buildVerificationSummary(input: {
  currentPhone: string;
  storedPhone: string;
  phoneMatchesVerifiedProfile: boolean;
  verificationTimestamp: string | null;
}): string {
  if (input.phoneMatchesVerifiedProfile) {
    if (input.verificationTimestamp) {
      return `تم توثيق الرقم الحالي في ${input.verificationTimestamp}.`;
    }

    return "الرقم الحالي موثّق داخل موطني.";
  }

  if (input.currentPhone && input.currentPhone !== input.storedPhone) {
    return "بعد تغيير الرقم، أرسل رمزاً جديداً ثم أكّده ليصبح الرقم المعتمد داخل موطني.";
  }

  return "الرقم الحالي غير موثّق بعد. أرسل رمز التحقق لإكمال الربط داخل موطني.";
}

function buildVerificationLabel(phoneMatchesVerifiedProfile: boolean, verificationRequestId: string): string {
  if (phoneMatchesVerifiedProfile) {
    return "الرقم الحالي موثّق";
  }

  if (verificationRequestId) {
    return "الرمز بانتظار الإدخال";
  }

  return "توثيق الرقم";
}

export default function ProfilePage() {
  const { profile, logout, updateProfile, requestPhoneVerification, verifyPhoneVerification, hasRole } = useApp();
  const navigateMode = useNavigateMode();
  const navigate = useNavigate();
  const location = useLocation();
  const [phone, setPhone] = useState(profile.phone || "");
  const [email, setEmail] = useState(profile.email || "");
  const [region, setRegion] = useState(profile.region || "");
  const [note, setNote] = useState(profile.note || "");
  const [verificationCode, setVerificationCode] = useState("");
  const [verificationRequestId, setVerificationRequestId] = useState("");
  const [verificationStatus, setVerificationStatus] = useState("");
  const [verificationError, setVerificationError] = useState("");
  const [verificationBusy, setVerificationBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [logoutBusy, setLogoutBusy] = useState(false);

  useEffect(() => {
    setPhone(profile.phone || "");
    setEmail(profile.email || "");
    setRegion(profile.region || "");
    setNote(profile.note || "");
  }, [profile.phone, profile.email, profile.region, profile.note]);

  useEffect(() => {
    if (!location.hash) return;
    const targetId = location.hash.replace(/^#/, "");
    const target = globalThis.document.getElementById(targetId);
    if (!target) return;
    globalThis.requestAnimationFrame(() => {
      target.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }, [location.hash]);

  async function saveProfile() {
    setError("");
    setStatus("");
    try {
      await updateProfile({
        email: email || undefined,
        region: region || undefined,
        note: note || undefined,
      });
      setStatus("تم حفظ البيانات.");
    } catch {
      setError("تعذر حفظ البيانات.");
    }
  }

  async function handleLogout() {
    setLogoutBusy(true);
    try {
      await logout();
      navigate("/login");
    } finally {
      setLogoutBusy(false);
    }
  }

  async function sendPhoneVerification() {
    const nextPhone = phone.trim();

    setVerificationError("");
    setVerificationStatus("");
    setError("");
    setStatus("");

    if (!profile.isAuthed) {
      setVerificationError("يجب تسجيل الدخول قبل توثيق رقم الهاتف.");
      return;
    }

    if (!nextPhone) {
      setVerificationError("أدخل رقم الهاتف أولاً.");
      return;
    }

    setVerificationBusy(true);

    try {
      const result = await requestPhoneVerification(nextPhone);
      setVerificationRequestId(result.requestId);
      setVerificationStatus(result.message || "تم إرسال رمز التحقق.");
    } catch (requestError) {
      setVerificationError(requestError instanceof Error ? requestError.message : "تعذر إرسال رمز التحقق.");
    } finally {
      setVerificationBusy(false);
    }
  }

  async function confirmPhoneVerification() {
    const nextCode = verificationCode.trim();

    setVerificationError("");
    setVerificationStatus("");
    setError("");
    setStatus("");

    if (!verificationRequestId) {
      setVerificationError("أرسل رمز التحقق أولاً.");
      return;
    }

    if (!/^\d{6}$/.test(nextCode)) {
      setVerificationError("أدخل رمز التحقق من 6 أرقام.");
      return;
    }

    setVerificationBusy(true);

    try {
      const nextProfile = await verifyPhoneVerification(verificationRequestId, nextCode);
      setPhone(nextProfile.phone || phone.trim());
      setVerificationCode("");
      setVerificationRequestId("");
      setVerificationStatus("تم توثيق رقم الهاتف بنجاح.");
    } catch (verifyError) {
      setVerificationError(verifyError instanceof Error ? verifyError.message : "تعذر التحقق من الرمز.");
    } finally {
      setVerificationBusy(false);
    }
  }

  const currentPhone = phone.trim();
  const storedPhone = (profile.phone || "").trim();
  const phoneMatchesVerifiedProfile = Boolean(currentPhone) && currentPhone === storedPhone && Boolean(profile.phoneVerified);
  const verificationTimestamp = formatVerificationTimestamp(profile.phoneVerifiedAt);
  const verificationSummary = buildVerificationSummary({
    currentPhone,
    storedPhone,
    phoneMatchesVerifiedProfile,
    verificationTimestamp,
  });
  const verificationLabel = buildVerificationLabel(phoneMatchesVerifiedProfile, verificationRequestId);

  const profileStats: Array<{ key: string; icon: ComponentType<SVGProps<SVGSVGElement>>; label: string; desc: string; value: string; color: string }> = [
    { key: "cases", icon: Briefcase24Regular, label: "القضايا النشطة", desc: "متابعة القضايا المفتوحة حالياً.", value: "3", color: "#2563eb" },
    { key: "documents", icon: DocumentText24Regular, label: "وثائق بانتظار التحقق", desc: "المستندات التي ما زالت قيد المراجعة.", value: "2", color: "#7c3aed" },
    { key: "last-login", icon: ArrowCounterclockwise24Regular, label: "آخر تسجيل دخول", desc: "تاريخ آخر استخدام للحساب.", value: "اليوم", color: "#0f766e" },
  ];

  const displayName = profile.name || "مستخدم موطني";
  const displayRole = profile.role || "public";
  const profileInitial = displayName.trim().charAt(0) || "و";

  return (
    <div className="wmo-utility-route wmo-rebuilt-route wmo-core-route wmo-route-normalized panel utility-page profile-shell">
      <section className="profile-identity-card">
      <MainHybridChatSurface context="pages/ProfilePage.tsx" />
        <div className="profile-identity-card__main">
          <div className="profile-identity-card__avatar" aria-hidden="true">{profileInitial}</div>
          <div className="profile-identity-card__copy">
            <UtilityHeaderTitleRow
              titleClassName="utility-title"
              title="الملف الشخصي"
              infoText="حدّث الحساب وراجع التوثيق وافتح البريد الداخلي من صفحة واحدة."
              infoLabel="حول الملف الشخصي"
            />
            <strong>{displayName}</strong>
            <p>{`الدور الحالي: ${displayRole}`}</p>
            <div className="tag-row">
              <span className={`pill ${phoneMatchesVerifiedProfile ? "verified" : "pending"}`}>{verificationLabel}</span>
              <span className="pill">{email || "أضف البريد الإلكتروني"}</span>
            </div>
          </div>
        </div>

        <div className="watany-approved-home-icons profile-hero-actions">
          <button className="utility-action-card" onClick={saveProfile} style={utilityColorStyle("#0f766e")}>
            <UtilityActionIcon icon={<Save24Regular aria-hidden />} />
            <span className="utility-action-card__label">حفظ</span>
            <span className="utility-action-card__desc">حفظ بيانات الحساب الحالية.</span>
          </button>
          <button className="utility-action-card" onClick={() => navigate("/messages")} style={utilityColorStyle("#2563eb")}>
            <UtilityActionIcon icon={<Mail24Regular aria-hidden />} />
            <span className="utility-action-card__label">البريد الداخلي</span>
            <span className="utility-action-card__desc">الانتقال إلى رسائل المستخدمين والإدارة.</span>
          </button>
          {hasRole("moderator") ? (
            <button className="utility-action-card" onClick={() => navigateMode("chat-sessions")} style={utilityColorStyle("#7c3aed")}>
              <UtilityActionIcon icon={<Chat24Regular aria-hidden />} />
              <span className="utility-action-card__label">الجلسات</span>
              <span className="utility-action-card__desc">جلسات المحادثة للإشراف والمتابعة.</span>
            </button>
          ) : null}
          <button className="utility-action-card" onClick={() => void handleLogout()} disabled={logoutBusy} style={utilityColorStyle("#b91c1c")}>
            <UtilityActionIcon icon={<SignOut24Regular aria-hidden />} />
            <span className="utility-action-card__label">تسجيل الخروج</span>
            <span className="utility-action-card__desc">إنهاء الجلسة الحالية والعودة إلى صفحة الدخول.</span>
          </button>
        </div>
      </section>

      {error ? <div className="wmo-utility-route wmo-rebuilt-route wmo-core-route wmo-route-normalized panel-error">{error}</div> : null}
      {status ? <div className="wmo-utility-route wmo-rebuilt-route wmo-core-route wmo-route-normalized panel-success">{status}</div> : null}
      <div className="profile-sections">
        <section className="profile-section-card">
          <div className="section-title">بيانات الحساب</div>
          <div className="profile-fields-stack">
            <label className="profile-field">
              <span>الاسم</span>
              <input className="input" value={displayName} readOnly />
            </label>
            <label className="profile-field">
              <span>رقم الهاتف</span>
              <input className="input" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="الهاتف" />
            </label>
            <label className="profile-field">
              <span>البريد الإلكتروني</span>
              <input className="input" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="البريد الإلكتروني" dir="ltr" />
            </label>
            <label className="profile-field">
              <span>الدور</span>
              <input className="input" value={displayRole} readOnly />
            </label>
            <label className="profile-field">
              <span>المنطقة</span>
              <AddressPicker value={parseAidedAddressValue(region)} includeExactAddress onChange={(next) => setRegion(serializeAidedAddressValue(next))} />
            </label>
          </div>
        </section>

        <AccountApplicationsPanel />

        <section className="profile-section-card">
          <div className="section-title">توثيق الهاتف</div>
          <div className="utility-action-card utility-action-card--static profile-verification-card" style={utilityColorStyle(phoneMatchesVerifiedProfile ? "#0f766e" : "#d97706") }>
            <UtilityActionIcon icon={phoneMatchesVerifiedProfile ? <ShieldCheckmark24Regular aria-hidden /> : <Phone24Regular aria-hidden />} />
            <span className="utility-action-card__label">{verificationLabel}</span>
            <span className="utility-action-card__desc">{verificationSummary}</span>
          </div>

          <label className="profile-field">
            <span>رمز التحقق</span>
            <input
              className="input"
              value={verificationCode}
              onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              placeholder="رمز التحقق من 6 أرقام"
              inputMode="numeric"
              maxLength={6}
            />
          </label>

          <div className="watany-approved-home-icons profile-inline-actions">
            <button className="utility-action-card" onClick={sendPhoneVerification} disabled={verificationBusy || !currentPhone} style={utilityColorStyle("#2563eb")}>
              <UtilityActionIcon icon={<Send24Regular aria-hidden />} />
              <span className="utility-action-card__label">إرسال رمز</span>
              <span className="utility-action-card__desc">إرسال رمز جديد إلى الرقم الحالي.</span>
            </button>
            <button className="utility-action-card" onClick={confirmPhoneVerification} disabled={verificationBusy || !verificationRequestId || verificationCode.trim().length !== 6} style={utilityColorStyle("#0f766e")}>
              <UtilityActionIcon icon={<ShieldCheckmark24Regular aria-hidden />} />
              <span className="utility-action-card__label">تأكيد الرقم</span>
              <span className="utility-action-card__desc">اعتماد الرقم داخل الملف الشخصي.</span>
            </button>
          </div>

          {verificationError ? <div className="panel-error">{verificationError}</div> : null}
          {verificationStatus ? <div className="panel-success">{verificationStatus}</div> : null}
        </section>

        <section className="profile-section-card">
          <div className="section-title">ملاحظات وبريد داخلي</div>
          <p className="panel-hint">دوّن ملاحظاتك السريعة وافتح الرسائل الداخلية لمتابعة ما يصلك من الإدارة أو من المستخدمين.</p>
          <textarea className="textarea profile-note-field" value={note} onChange={(e) => setNote(e.target.value)} rows={5} />
          <div className="watany-approved-home-icons profile-inline-actions">
            <button className="utility-action-card" onClick={() => navigate("/messages")} style={utilityColorStyle("#2563eb")}>
              <UtilityActionIcon icon={<Mail24Regular aria-hidden />} />
              <span className="utility-action-card__label">فتح الرسائل</span>
              <span className="utility-action-card__desc">إدارة المراسلات الداخلية من مكان واحد.</span>
            </button>
            <button className="utility-action-card" onClick={saveProfile} style={utilityColorStyle("#0f766e")}>
              <UtilityActionIcon icon={<Save24Regular aria-hidden />} />
              <span className="utility-action-card__label">حفظ التعديلات</span>
              <span className="utility-action-card__desc">تطبيق التغييرات على الحساب الحالي.</span>
            </button>
          </div>
        </section>
      </div>

      <div className="wmo-utility-route wmo-rebuilt-route wmo-core-route wmo-route-normalized stats-grid">
        {profileStats.map((stat) => (
          <div key={stat.key} className="wmo-utility-route wmo-rebuilt-route wmo-core-route wmo-route-normalized utility-action-card utility-action-card--static" style={utilityColorStyle(stat.color)}>
            <UtilityActionIcon className="wmo-utility-route wmo-rebuilt-route wmo-core-route wmo-route-normalized" icon={(() => { const StatIcon = stat.icon; return <StatIcon aria-hidden />; })()} />
            <span className="wmo-utility-route wmo-rebuilt-route wmo-core-route wmo-route-normalized utility-action-card__label">{stat.label}</span>
            <span className="wmo-utility-route wmo-rebuilt-route wmo-core-route wmo-route-normalized utility-action-card__desc">{stat.desc}</span>
            <span className="wmo-utility-route wmo-rebuilt-route wmo-core-route wmo-route-normalized stat-value">{stat.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}




// APEX_PHASE3D_UTILITY_ROUTE_READY: next safe slice may wrap this route with WatanyUtilityRoute after component-specific review.



