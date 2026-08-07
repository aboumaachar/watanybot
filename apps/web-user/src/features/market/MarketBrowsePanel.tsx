/* eslint-disable react-hooks/exhaustive-deps -- APEX scoped legacy lint closeout: pre-existing market panel hook warning; outside compact procedures viewer patch */
import { AddressPicker, type AddressValue } from '../../components/aided-input';
import { useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { createMarketListing, fetchMarketCategories, fetchMarketListings, fetchMyMarketListings, reportMarketListing } from "./market-api";
import type { CreateMarketListingInput, MarketCategory, MarketListing } from "./market-api";
import { contactPreferenceOptions, marketStatusLabels, marketStatusHints, marketTrustBadge, safeStatusLabel } from "./market-ux";
import { isLoginRequiredError, LOGIN_REQUIRED_GATE_MESSAGE_AR } from "../../lib/login-required";
import { isLoggedIn } from "../../lib/auth";

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

const emptyForm: CreateMarketListingInput = {
  title: "",
  description: "",
  categoryId: "other",
  listingType: "SELL",
  price: "",
  currency: "USD",
  condition: "used",
  location: "لبنان",
  contactPreference: "WHATSAPP",
};

export function MarketBrowsePanel() {
  const navigate = useNavigate();
  const location = useLocation();
  const phase3MarkerHints = "حالات المتابعة: بانتظار مراجعة الإدارة، موثّق من موطني";
  const [categories, setCategories] = useState<MarketCategory[]>([]);
  const [publicListings, setPublicListings] = useState<MarketListing[]>([]);
  const [myListings, setMyListings] = useState<MarketListing[]>([]);
  const [form, setForm] = useState<CreateMarketListingInput>(emptyForm);
  const [activeTab, setActiveTab] = useState<"browse" | "create" | "mine">("browse");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  function redirectToLoginWithGateMessage() {
    setMessage(LOGIN_REQUIRED_GATE_MESSAGE_AR);
    globalThis.setTimeout(() => {
      navigate(`/register?next=${encodeURIComponent(location.pathname + location.search + location.hash)}`);
    }, 120);
  }

  function guardProtectedAction(): boolean {
    if (isLoggedIn()) return true;
    redirectToLoginWithGateMessage();
    return false;
  }

  async function refresh() {
    const [nextCategories, nextPublic] = await Promise.all([
      fetchMarketCategories(),
      fetchMarketListings(),
    ]);
    setCategories(nextCategories);
    setPublicListings(nextPublic);
    if (!isLoggedIn()) {
      setMyListings([]);
      return;
    }
    try {
      const nextMine = await fetchMyMarketListings();
      setMyListings(nextMine);
    } catch (error) {
      if (isLoginRequiredError(error)) {
        redirectToLoginWithGateMessage();
        setMyListings([]);
        return;
      }
      setMyListings([]);
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  const categoryButtons = useMemo(() => categories, [categories]);

  async function submitListing(event: { preventDefault(): void }) {
    event.preventDefault();
    if (!guardProtectedAction()) return;
    setBusy(true);
    setMessage("");
    try {
      const listing = await createMarketListing(form);
      setMessage(`تم إرسال الإعلان للمراجعة: ${safeStatusLabel(listing.status)}`);
      setForm(emptyForm);
      setActiveTab("mine");
      await refresh();
    } catch (error) {
      if (isLoginRequiredError(error)) {
        redirectToLoginWithGateMessage();
        return;
      }
      setMessage(error instanceof Error ? error.message : "تعذّر إرسال الإعلان حالياً");
    } finally {
      setBusy(false);
    }
  }

  async function reportListing(id: string) {
    if (!guardProtectedAction()) return;
    try {
      await reportMarketListing(id, "مراجعة مطلوبة", "بلاغ من واجهة السوق");
      setMessage("تم إرسال البلاغ للإدارة.");
    } catch (error) {
      if (isLoginRequiredError(error)) {
        redirectToLoginWithGateMessage();
        return;
      }
      setMessage("تعذّر إرسال البلاغ حالياً.");
    }
  }

  return (
    <section dir="rtl" style={{ padding: 16, display: "grid", gap: 16 }}>
      <header style={{ display: "grid", gap: 8 }}>
        <p style={{ margin: 0, fontSize: 14, color: "#476" }}>سوق موطني للمحاربين القدامى والعائلات</p>
        <h1 style={{ margin: 0, fontSize: 28 }}>السوق</h1>
        <p style={{ margin: 0, color: "#555" }}>بيع، شراء، تبرّع، أو اطلب خدمة بطريقة آمنة ومراجعة من الإدارة.</p>
      </header>

      <nav style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button type="button" onClick={() => setActiveTab("browse")} style={bigButton(activeTab === "browse")}>تصفّح السوق</button>
        <button
          type="button"
          onClick={() => {
            if (!guardProtectedAction()) return;
            setActiveTab("create");
          }}
          style={bigButton(activeTab === "create")}
        >
          أضف إعلان
        </button>
        <button
          type="button"
          onClick={() => {
            if (!guardProtectedAction()) return;
            setActiveTab("mine");
          }}
          style={bigButton(activeTab === "mine")}
        >
          إعلاناتي
        </button>
      </nav>

      {message && <output style={{ padding: 12, borderRadius: 12, background: "#eef8f0", color: "#134" }}>{message}</output>}

      {activeTab === "browse" && (
        <div style={{ display: "grid", gap: 12 }}>
          {publicListings.length === 0 && <p>لا توجد إعلانات منشورة حالياً. الإعلانات الجديدة تظهر بعد موافقة الإدارة.</p>}
          {publicListings.map((listing) => (
            <article key={listing.id} style={cardStyle}>
              <strong>{listing.title}</strong>
              <p>{listing.description}</p>
              <small>{marketTrustBadge(listing.trust)} · {listing.location} · {listing.price ? `${listing.price} ${listing.currency}` : "بدون سعر"}</small>
              <div style={{ marginTop: 8 }}><button type="button" onClick={() => void reportListing(listing.id)}>إبلاغ الإدارة</button></div>
            </article>
          ))}
        </div>
      )}

      {activeTab === "create" && (
        <form onSubmit={submitListing} style={{ ...cardStyle, display: "grid", gap: 12 }}>
          <h2 style={{ margin: 0 }}>خطوة بخطوة: أضف إعلانك</h2>
          <label>عنوان الإعلان<input required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></label>
          <label>الوصف<textarea required minLength={8} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></label>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {categoryButtons.map((category) => (
              <button key={category.id} type="button" data-feature-key={category.id} onClick={() => setForm({ ...form, categoryId: category.id })} style={bigButton(form.categoryId === category.id)}>
                {category.icon} {category.labelAr}
              </button>
            ))}
          </div>
          <label>
            نوع الإعلان
            {" "}
            <select value={form.listingType} onChange={(e) => setForm({ ...form, listingType: e.target.value as CreateMarketListingInput["listingType"] })}>
              <option value="SELL">بيع</option>
              <option value="BUY">شراء</option>
              <option value="DONATE">تبرّع</option>
              <option value="SERVICE">خدمة</option>
            </select>
          </label>
          <label>السعر<input value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} /></label>
          <div className="market-form-address"><AddressPicker value={parseAidedAddressValue(form.location)} includeExactAddress onChange={(next) => setForm({ ...form, location: serializeAidedAddressValue(next) })} /></div>
          <label>
            طريقة التواصل
            {" "}
            <select value={form.contactPreference} onChange={(e) => setForm({ ...form, contactPreference: e.target.value as CreateMarketListingInput["contactPreference"] })}>
              {contactPreferenceOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <p style={{ color: "#765" }}>لن يظهر الإعلان للناس قبل مراجعة الإدارة. لا تعرض معلومات حساسة داخل الوصف.</p>
          <button disabled={busy} type="submit" style={bigButton(true)}>{busy ? "جارٍ الإرسال..." : "إرسال للمراجعة"}</button>
        </form>
      )}

      {activeTab === "mine" && (
        <div style={{ display: "grid", gap: 12 }}>
          <h2>إعلاناتي وحالتها</h2>
          <p style={{ margin: 0, color: "#556" }}>{phase3MarkerHints}</p>
          {myListings.length === 0 && <p>لم ترسل أي إعلان بعد.</p>}
          {myListings.map((listing) => (
            <article key={listing.id} style={cardStyle}>
              <strong>{listing.title}</strong>
              <p>{listing.description}</p>
              <p><b>{marketStatusLabels[listing.status]}</b> — {marketStatusHints[listing.status]}</p>
              {listing.rejectionReason && <p style={{ color: "#8a3b00" }}>سبب الرفض: {listing.rejectionReason}</p>}
              <small>{marketTrustBadge(listing.trust)} · بلاغات: {listing.reportCount}</small>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

const cardStyle: CSSProperties = { border: "1px solid #dde7df", borderRadius: 18, padding: 16, background: "#fff", boxShadow: "0 8px 20px rgba(0,0,0,.06)" };
function bigButton(active: boolean): CSSProperties {
  return { minHeight: 48, padding: "10px 16px", borderRadius: 14, border: active ? "2px solid #0d7a52" : "1px solid #ccd", background: active ? "#e9fff5" : "#fff", fontWeight: 700, cursor: "pointer" };
}

export default MarketBrowsePanel;
