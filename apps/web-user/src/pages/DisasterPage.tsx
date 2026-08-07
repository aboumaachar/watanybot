import { AddressPicker, type AddressValue } from '../components/aided-input';

// ADDRESS_NETWORK_CANONICAL_ADDRESS_WIDGET_MIGRATION_REVIEWED
import { useState, type ComponentType, type SVGProps } from "react";
import {
  CheckmarkCircle24Regular,
  DataBarVertical24Regular,
  Drop24Regular,
  Flash24Regular,
  Food24Regular,
  HeartPulse24Regular,
  Home24Regular,
  Location24Regular,
  People24Regular,
  PersonAdd24Regular,
  PersonHeart24Regular,
  Phone24Regular,
  Search24Regular,
  Temperature24Regular,
  Warning24Regular,
} from "../theme/watany-v4/legacyIconBridge";
import { UtilityActionIcon } from "../components/UtilityActionIcon";
import UtilityHeaderTitleRow from "../components/UtilityHeaderTitleRow";
import {
  useDisasters,
  useShelters,
  useEmergencyContacts,
  useEmergencyAlerts,
  useDisasterStats,
  registerDisplaced,
  reportMissing,
  volunteerSignup,
} from "../lib/disaster-api";
// APEX_CSS_FREEZE_DISABLED_IMPORT import "../styles/disaster.css";

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

/* ── Severity helpers ────────────────────────────────── */

function severityLabel(s: string) {
  const m: Record<string, string> = { critical: "حرج", high: "عالٍ", medium: "متوسط", low: "منخفض" };
  return m[s] || s;
}

function severityClass(s: string) {
  return `dis-severity dis-severity--${s}`;
}

function disasterTypeLabel(t: string) {
  const m: Record<string, string> = { war: "حرب", earthquake: "زلزال", flood: "فيضان", fire: "حريق", explosion: "انفجار", other: "أخرى" };
  return m[t] || t;
}

function shelterTypeLabel(t: string) {
  const m: Record<string, string> = { government: "حكومي", military: "عسكري", school: "مدرسة", mosque: "جامع", church: "كنيسة", community_center: "مركز مجتمعي" };
  return m[t] || t;
}

/* ── Tab navigation ──────────────────────────────────── */

type Tab = "dashboard" | "shelters" | "contacts" | "register" | "missing" | "volunteer";

const TABS: { id: Tab; label: string; icon: ComponentType<SVGProps<SVGSVGElement>> }[] = [
  { id: "dashboard", label: "الوضع",         icon: DataBarVertical24Regular },
  { id: "contacts",  label: "طوارئ",         icon: Phone24Regular },
  { id: "shelters",  label: "مراكز إيواء", icon: Home24Regular },
  { id: "register",  label: "تسجيل نازح", icon: PersonAdd24Regular },
  { id: "missing",   label: "مفقودين",       icon: Search24Regular },
  { id: "volunteer", label: "تطوّع",         icon: PersonHeart24Regular },
];

const TAB_META: Record<Tab, { title: string; desc: string; color: string }> = {
  dashboard: {
    title: "متابعة الوضع الميداني",
    desc: "مراجعة الكوارث النشطة والتنبيهات الأخيرة والمؤشرات العامة للاستجابة.",
    color: "#b91c1c",
  },
  contacts: {
    title: "قنوات الطوارئ",
    desc: "الوصول السريع إلى الأرقام الساخنة وجهات  المباشر والمساندة.",
    color: "#0f766e",
  },
  shelters: {
    title: "إدارة الإيواء",
    desc: "استعراض المراكز المفتوحة وحالات السعة وتوافر الخدمات الأساسية.",
    color: "#2563eb",
  },
  register: {
    title: "تسجيل المتضررين",
    desc: "إدخال بيانات النازحين أو الأسر المتأثرة وتوثيق الاحتياجات العاجلة.",
    color: "#7c3aed",
  },
  missing: {
    title: "بلاغات المفقودين",
    desc: "تجهيز البلاغات الأساسية بسرعة مع آخر موقع معروف وبيانات المبلّغ.",
    color: "#ca8a04",
  },
  volunteer: {
    title: "تنسيق التطوع",
    desc: "تنظيم المتطوعين بحسب المدينة والقدرة على التنقل أو التدريب المتاح.",
    color: "#0f766e",
  },
};

/* ── Dashboard tab ───────────────────────────────────── */

function DashboardTab() {
  const { disasters, loading: disLoading } = useDisasters();
  const { stats, loading: stLoading } = useDisasterStats();
  const { alerts } = useEmergencyAlerts();

  if (disLoading || stLoading) return <div className="dis-loading">جارٍ التحميل…</div>;

  return (
    <div className="watany-approved-home-icons dis-dashboard">
      {/* Stats cards */}
      {stats && (
        <div className="watany-approved-home-icons dis-stats-grid">
          <div className="dis-stat-card dis-stat-card--alert">
            <div className="dis-stat-card__value">{stats.active_disasters}</div>
            <div className="dis-stat-card__label">كوارث نشطة</div>
          </div>
          <div className="dis-stat-card">
            <div className="dis-stat-card__value">{stats.open_shelters}</div>
            <div className="dis-stat-card__label">مراكز مفتوحة</div>
          </div>
          <div className="dis-stat-card">
            <div className="dis-stat-card__value">{stats.current_occupancy.toLocaleString()}</div>
            <div className="dis-stat-card__label">نازح في المراكز</div>
          </div>
          <div className="dis-stat-card">
            <div className="dis-stat-card__value">{stats.active_volunteers}</div>
            <div className="dis-stat-card__label">متطوّع</div>
          </div>
        </div>
      )}

      {/* Active disasters */}
      <h3 className="dis-section-title">الكوارث النشطة</h3>
      {disasters.map((d) => (
        <div key={d.id} className="dis-disaster-card">
          <div className="dis-disaster-card__header">
            <span className={severityClass(d.severity)}>{severityLabel(d.severity)}</span>
            <span className="dis-disaster-card__type">{disasterTypeLabel(d.disaster_type)}</span>
          </div>
          <h4>{d.name_ar}</h4>
          <p>{d.description_ar}</p>
          <div className="dis-disaster-card__meta">
            <span><People24Regular aria-hidden /> {d.displaced_count.toLocaleString()} نازح</span>
            <span><Home24Regular aria-hidden /> {d.shelters_opened} مركز</span>
            <span><Location24Regular aria-hidden /> {d.affected_areas.join("، ")}</span>
          </div>
        </div>
      ))}

      {/* Recent alerts */}
      {alerts.length > 0 && (
        <>
          <h3 className="dis-section-title">آخر التنبيهات</h3>
          {alerts.slice(0, 3).map((a) => (
            <div key={a.id} className={`dis-alert-card dis-alert-card--${a.severity}`}>
              <div className="dis-alert-card__header">
                <span className={severityClass(a.severity)}>{severityLabel(a.severity)}</span>
                <span className="dis-alert-card__date">{new Date(a.sent_at).toLocaleDateString("ar-LB")}</span>
              </div>
              <h4>{a.title_ar}</h4>
              <p>{a.message_ar}</p>
              <div className="dis-alert-card__areas">{a.affected_areas.join("، ")}</div>
            </div>
          ))}
        </>
      )}
    </div>
  );
}

/* ── Contacts tab ────────────────────────────────────── */

function ContactsTab() {
  const { contacts, loading } = useEmergencyContacts();

  if (loading) return <div className="dis-loading">جارٍ التحميل…</div>;

  const emergency = contacts.filter((c) => c.is_emergency);
  const other = contacts.filter((c) => !c.is_emergency);

  return (
    <div className="dis-contacts">
      <div className="dis-emergency-banner">
        <Warning24Regular aria-hidden />
        <span>في الحالات الطارئة، استخدم أرقام الاستجابة فوراً.</span>
      </div>

      <h3 className="dis-section-title">أرقام الطوارئ</h3>
      <div className="watany-approved-home-icons dis-contacts-grid">
        {emergency.map((c) => (
          <div key={c.id} className="dis-contact-card dis-contact-card--emergency">
            <div className="dis-contact-card__org">{c.organization_name_ar}</div>
            <div className="dis-contact-card__service">{c.service_provided_ar}</div>
            {c.emergency_hotline && (
              <a className="dis-contact-card__hotline" href={`tel:${c.emergency_hotline}`}>
                <Phone24Regular aria-hidden /> {c.emergency_hotline}
              </a>
            )}
            <a className="dis-contact-card__phone" href={`tel:${c.primary_phone}`}>
              <Phone24Regular aria-hidden /> {c.primary_phone}
            </a>
            {c.available_24_7 && <span className="dis-contact-card__badge">24/7</span>}
          </div>
        ))}
      </div>

      {other.length > 0 && (
        <>
          <h3 className="dis-section-title">جهات دعم أخرى</h3>
          <div className="watany-approved-home-icons dis-contacts-grid">
            {other.map((c) => (
              <div key={c.id} className="dis-contact-card">
                <div className="dis-contact-card__org">{c.organization_name_ar}</div>
                <div className="dis-contact-card__service">{c.service_provided_ar}</div>
                <a className="dis-contact-card__phone" href={`tel:${c.primary_phone}`}>
                  <Phone24Regular aria-hidden /> {c.primary_phone}
                </a>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function getShelterStatusLabel(status: string): string {
  if (status === "open") return "مفتوح";
  if (status === "full") return "ممتلئ";
  return "مغلق";
}

function getOccupancyColor(pct: number): string {
  if (pct > 90) return "#DC2626";
  if (pct > 70) return "#D97706";
  return "#059669";
}

/* ── Shelters tab ────────────────────────────────────── */

function SheltersTab() {
  const { shelters, loading } = useShelters();

  if (loading) return <div className="dis-loading">جارٍ التحميل…</div>;

  return (
    <div className="dis-shelters">
      <h3 className="dis-section-title">مراكز الإيواء المتاحة</h3>
      <div className="dis-shelters-list">
        {shelters.map((s) => (
          <div key={s.id} className={`dis-shelter-card dis-shelter-card--${s.status}`}>
            <div className="dis-shelter-card__header">
              <span className="dis-shelter-card__type">{shelterTypeLabel(s.shelter_type)}</span>
              <span className={`dis-shelter-card__status dis-shelter-card__status--${s.status}`}>
                {getShelterStatusLabel(s.status)}
              </span>
            </div>
            <h4>{s.name_ar}</h4>
            <div className="dis-shelter-card__location">
              <Location24Regular aria-hidden /> {s.city}{s.region ? ` — ${s.region}` : ""}
            </div>
            <div className="dis-shelter-card__address">{s.address_ar}</div>

            {/* Capacity bar */}
            <div className="dis-shelter-card__capacity">
              <div className="dis-capacity-bar">
                <div
                  className="dis-capacity-bar__fill"
                  style={{ width: `${s.occupancy_pct}%`, backgroundColor: getOccupancyColor(s.occupancy_pct) }}
                />
              </div>
              <span>{s.current_occupancy} / {s.total_capacity} ({s.occupancy_pct}%)</span>
            </div>

            {/* Facilities */}
            <div className="dis-shelter-card__facilities">
              {s.has_water && <span title="ماء"><Drop24Regular aria-hidden /></span>}
              {s.has_electricity && <span title="كهرباء"><Flash24Regular aria-hidden /></span>}
              {s.has_food && <span title="طعام"><Food24Regular aria-hidden /></span>}
              {s.has_medical && <span title="طبي"><HeartPulse24Regular aria-hidden /></span>}
              {s.has_heating && <span title="تدفئة"><Temperature24Regular aria-hidden /></span>}
            </div>

            {/* Contact */}
            {(s.manager_phone || s.emergency_contact) && (
              <div className="dis-shelter-card__contact">
                {s.manager_phone && (
                  <a href={`tel:${s.manager_phone}`} className="dis-shelter-card__call">
                    <Phone24Regular aria-hidden /> {s.manager_phone}
                  </a>
                )}
              </div>
            )}

            {s.accepting_new && (
              <div className="dis-shelter-card__accepting">يقبل نازحين جدد</div>
            )}
          </div>
        ))}
      </div>

      {shelters.length === 0 && (
        <div className="dis-empty">لا توجد مراكز إيواء مفتوحة حالياً.</div>
      )}
    </div>
  );
}

/* ── Register Displaced tab ──────────────────────────── */

function RegisterTab() {
  const { disasters } = useDisasters();
  const [form, setForm] = useState({
    full_name: "",
    phone: "",
    disaster_id: "",
    original_city: "",
    original_address: "",
    family_size: "1",
    has_children: false,
    children_count: "0",
    has_elderly: false,
    has_disabled: false,
    needs_shelter: false,
    needs_food: false,
    needs_medical: false,
    medical_conditions: "",
    urgent_needs: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState("");
  const [error, setError] = useState("");

  function set(key: string, value: string | boolean) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function submit() {
    if (!form.full_name || !form.phone || !form.disaster_id || !form.original_city) {
      setError("الاسم والهاتف والكارثة والمدينة الأصلية مطلوبة");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      const res = await registerDisplaced({
        ...form,
        family_size: Number(form.family_size),
        children_count: Number(form.children_count),
      });
      setResult(`تم التسجيل بنجاح — رقم التسجيل: ${res.registration.id}`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "";
      setError(msg.includes("409") ? "تم التسجيل سابقاً بهذا الرقم" : "تعذر التسجيل. حاول مجدداً.");
    } finally {
      setSubmitting(false);
    }
  }

  if (result) {
    return (
      <div className="dis-form-result">
        <CheckmarkCircle24Regular aria-hidden style={{ fontSize: 48, color: "#059669" }} />
        <p>{result}</p>
        <button className="dis-btn" onClick={() => { setResult(""); setForm({ full_name: "", phone: "", disaster_id: "", original_city: "", original_address: "", family_size: "1", has_children: false, children_count: "0", has_elderly: false, has_disabled: false, needs_shelter: false, needs_food: false, needs_medical: false, medical_conditions: "", urgent_needs: "" }); }}>
          تسجيل آخر
        </button>
      </div>
    );
  }

  return (
    <div className="dis-form">
      <h3 className="dis-section-title">تسجيل نازح / متضرر</h3>
      {error && <div className="dis-form__error">{error}</div>}

      <select className="dis-input" value={form.disaster_id} onChange={(e) => set("disaster_id", e.target.value)}>
        <option value="">اختر الكارثة *</option>
        {disasters.map((d) => <option key={d.id} value={d.id}>{d.name_ar}</option>)}
      </select>
      <input className="dis-input" placeholder="الاسم الكامل *" value={form.full_name} onChange={(e) => set("full_name", e.target.value)} />
      <input className="dis-input" placeholder="رقم الهاتف *" value={form.phone} onChange={(e) => set("phone", e.target.value)} />
      <input className="dis-input" placeholder="المدينة الأصلية *" value={form.original_city} onChange={(e) => set("original_city", e.target.value)} />
      <AddressPicker value={parseAidedAddressValue(form.original_address)} includeExactAddress required onChange={(next) => set("original_address", serializeAidedAddressValue(next))} />

      <div className="dis-form__row">
        <label htmlFor="family-size-input">عدد الأسرة</label>
        <input id="family-size-input" className="dis-input dis-input--short" type="number" min="1" value={form.family_size} onChange={(e) => set("family_size", e.target.value)} />
      </div>

      <div className="dis-form__checks">
        <label><input type="checkbox" checked={form.has_children} onChange={(e) => set("has_children", e.target.checked)} /> أطفال</label>
        <label><input type="checkbox" checked={form.has_elderly} onChange={(e) => set("has_elderly", e.target.checked)} /> مسنّون</label>
        <label><input type="checkbox" checked={form.has_disabled} onChange={(e) => set("has_disabled", e.target.checked)} /> ذوو إعاقة</label>
      </div>

      <h4 className="dis-form__subtitle">الاحتياجات العاجلة</h4>
      <div className="dis-form__checks">
        <label><input type="checkbox" checked={form.needs_shelter} onChange={(e) => set("needs_shelter", e.target.checked)} /> مأوى</label>
        <label><input type="checkbox" checked={form.needs_food} onChange={(e) => set("needs_food", e.target.checked)} /> طعام</label>
        <label><input type="checkbox" checked={form.needs_medical} onChange={(e) => set("needs_medical", e.target.checked)} /> طبي</label>
      </div>

      <textarea className="dis-textarea" placeholder="حالات طبية أو أدوية ضرورية (اختياري)" value={form.medical_conditions} onChange={(e) => set("medical_conditions", e.target.value)} rows={2} />
      <textarea className="dis-textarea" placeholder="احتياجات عاجلة إضافية" value={form.urgent_needs} onChange={(e) => set("urgent_needs", e.target.value)} rows={2} />

      <button className="dis-btn dis-btn--primary" onClick={submit} disabled={submitting}>
        {submitting ? "جارٍ التسجيل…" : "اعتماد التسجيل"}
      </button>
    </div>
  );
}

/* ── Missing Persons tab ─────────────────────────────── */

function MissingTab() {
  const { disasters } = useDisasters();
  const [form, setForm] = useState({
    full_name: "",
    disaster_id: "",
    reporter_name: "",
    reporter_phone: "",
    age: "",
    gender: "",
    last_seen_location: "",
    description_ar: "",
    distinguishing_features: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState("");
  const [error, setError] = useState("");

  function set(key: string, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function submit() {
    if (!form.full_name || !form.reporter_name || !form.reporter_phone || !form.disaster_id) {
      setError("اسم المفقود واسم المبلّغ ورقمه والكارثة مطلوبة");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      const res = await reportMissing({
        ...form,
        age: form.age ? Number(form.age) : undefined,
      });
      setResult(`تم تقديم البلاغ — رقم: ${res.report.id}`);
    } catch {
      setError("تعذر تقديم البلاغ. حاول مجدداً.");
    } finally {
      setSubmitting(false);
    }
  }

  if (result) {
    return (
      <div className="dis-form-result">
        <CheckmarkCircle24Regular aria-hidden style={{ fontSize: 48, color: "#059669" }} />
        <p>{result}</p>
        <button className="dis-btn" onClick={() => { setResult(""); setForm({ full_name: "", disaster_id: "", reporter_name: "", reporter_phone: "", age: "", gender: "", last_seen_location: "", description_ar: "", distinguishing_features: "" }); }}>
          بلاغ آخر
        </button>
      </div>
    );
  }

  return (
    <div className="dis-form">
      <h3 className="dis-section-title">الإبلاغ عن مفقود</h3>
      {error && <div className="dis-form__error">{error}</div>}

      <select className="dis-input" value={form.disaster_id} onChange={(e) => set("disaster_id", e.target.value)}>
        <option value="">اختر الكارثة *</option>
        {disasters.map((d) => <option key={d.id} value={d.id}>{d.name_ar}</option>)}
      </select>
      <input className="dis-input" placeholder="اسم المفقود *" value={form.full_name} onChange={(e) => set("full_name", e.target.value)} />
      <input className="dis-input" placeholder="العمر التقريبي" type="number" value={form.age} onChange={(e) => set("age", e.target.value)} />
      <select className="dis-input" value={form.gender} onChange={(e) => set("gender", e.target.value)}>
        <option value="">الجنس</option>
        <option value="male">ذكر</option>
        <option value="female">أنثى</option>
      </select>
      <input className="dis-input" placeholder="آخر مكان شوهد فيه" value={form.last_seen_location} onChange={(e) => set("last_seen_location", e.target.value)} />
      <textarea className="dis-textarea" placeholder="وصف مختصر للمفقود" value={form.description_ar} onChange={(e) => set("description_ar", e.target.value)} rows={3} />
      <textarea className="dis-textarea" placeholder="علامات مميِّزة أو ملاحظات" value={form.distinguishing_features} onChange={(e) => set("distinguishing_features", e.target.value)} rows={2} />

      <h4 className="dis-form__subtitle">بيانات المبلّغ</h4>
      <input className="dis-input" placeholder="اسم المبلّغ *" value={form.reporter_name} onChange={(e) => set("reporter_name", e.target.value)} />
      <input className="dis-input" placeholder="هاتف المبلّغ *" value={form.reporter_phone} onChange={(e) => set("reporter_phone", e.target.value)} />

      <button className="dis-btn dis-btn--primary" onClick={submit} disabled={submitting}>
        {submitting ? "جارٍ الإرسال…" : "اعتماد البلاغ"}
      </button>
    </div>
  );
}

/* ── Volunteer tab ───────────────────────────────────── */

function VolunteerTab() {
  const { disasters } = useDisasters();
  const [form, setForm] = useState({
    full_name: "",
    phone: "",
    disaster_id: "",
    available_in_city: "",
    can_travel: false,
    has_vehicle: false,
    medical_training: false,
    is_veteran: false,
  });
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState("");
  const [error, setError] = useState("");

  function setField(key: string, value: string | boolean) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function submit() {
    if (!form.full_name || !form.phone || !form.disaster_id || !form.available_in_city) {
      setError("الاسم والهاتف والكارثة والمدينة مطلوبة");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      const res = await volunteerSignup(form);
      setResult(`تم تسجيلك كمتطوّع — رقم: ${res.volunteer.id}`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "";
      setError(msg.includes("409") ? "تم التسجيل سابقاً كمتطوع" : "تعذر التسجيل. حاول مجدداً.");
    } finally {
      setSubmitting(false);
    }
  }

  if (result) {
    return (
      <div className="dis-form-result">
        <CheckmarkCircle24Regular aria-hidden style={{ fontSize: 48, color: "#059669" }} />
        <p>{result}</p>
      </div>
    );
  }

  return (
    <div className="dis-form">
      <h3 className="dis-section-title">تسجيل متطوّع</h3>
      {error && <div className="dis-form__error">{error}</div>}

      <select className="dis-input" value={form.disaster_id} onChange={(e) => setField("disaster_id", e.target.value)}>
        <option value="">اختر الكارثة *</option>
        {disasters.map((d) => <option key={d.id} value={d.id}>{d.name_ar}</option>)}
      </select>
      <input className="dis-input" placeholder="الاسم الكامل *" value={form.full_name} onChange={(e) => setField("full_name", e.target.value)} />
      <input className="dis-input" placeholder="رقم الهاتف *" value={form.phone} onChange={(e) => setField("phone", e.target.value)} />
      <input className="dis-input" placeholder="المدينة المتاح فيها *" value={form.available_in_city} onChange={(e) => setField("available_in_city", e.target.value)} />

      <div className="dis-form__checks">
        <label><input type="checkbox" checked={form.can_travel} onChange={(e) => setField("can_travel", e.target.checked)} /> يمكنني التنقل</label>
        <label><input type="checkbox" checked={form.has_vehicle} onChange={(e) => setField("has_vehicle", e.target.checked)} /> لديّ سيارة</label>
        <label><input type="checkbox" checked={form.medical_training} onChange={(e) => setField("medical_training", e.target.checked)} /> تدريب طبي</label>
        <label><input type="checkbox" checked={form.is_veteran} onChange={(e) => setField("is_veteran", e.target.checked)} /> عسكري متقاعد</label>
      </div>

      <button className="dis-btn dis-btn--primary" onClick={submit} disabled={submitting}>
        {submitting ? "جارٍ التسجيل…" : "اعتماد طلب التطوع"}
      </button>
    </div>
  );
}

/* ── Main Page ───────────────────────────────────────── */

export default function DisasterPage() {
  const [tab, setTab] = useState<Tab>("dashboard");
  const activeTabMeta = TAB_META[tab];

  return (
    <div className="dis-page">
      <div className="utility-header dis-page__header">
        <UtilityHeaderTitleRow
          titleClassName="utility-title"
          title="الاستجابة للكوارث والطوارئ"
          infoText={`${activeTabMeta.title}: ${activeTabMeta.desc} ويمكنك التنقل مباشرة بين الطوارئ، الإيواء، والتسجيلات من هذا الشريط.`}
          infoLabel="حول وحدة الكوارث والطوارئ"
        />
      </div>

      <div className="watany-approved-home-icons utility-action-grid dis-utility-grid">
        <div className="utility-action-card utility-action-card--static" style={{ "--utility-color": activeTabMeta.color } as unknown as React.CSSProperties}>
          <UtilityActionIcon icon={(() => { const activeTab = TABS.find((item) => item.id === tab); const TabIcon = activeTab ? activeTab.icon : Warning24Regular; return <TabIcon aria-hidden />; })()} />
          <span className="utility-action-card__label">الوحدة</span>
          <span className="utility-action-card__desc">{activeTabMeta.title}</span>
        </div>
        <div className="utility-action-card utility-action-card--static" style={{ "--utility-color": "#dc2626" } as unknown as React.CSSProperties}>
          <UtilityActionIcon icon={<Warning24Regular aria-hidden />} />
          <span className="utility-action-card__label">الأولوية</span>
          <span className="utility-action-card__desc">الانتقال من الوضع العام إلى أرقام الطوارئ أو البلاغات يجب أن يبقى سريعاً ومباشراً.</span>
        </div>
      </div>

      {/* Tab navigation */}
      <div className="dis-tabs">
        {TABS.map((t) => (
          <button
            key={t.id}
            data-feature-key={t.id}
            className={`dis-tab${tab === t.id ? " dis-tab--active" : ""}`}
            onClick={() => setTab(t.id)}
          >
            <t.icon aria-hidden />
            <span>{t.label}</span>
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="dis-content">
        {tab === "dashboard" && <DashboardTab />}
        {tab === "contacts" && <ContactsTab />}
        {tab === "shelters" && <SheltersTab />}
        {tab === "register" && <RegisterTab />}
        {tab === "missing" && <MissingTab />}
        {tab === "volunteer" && <VolunteerTab />}
      </div>
    </div>
  );
}


