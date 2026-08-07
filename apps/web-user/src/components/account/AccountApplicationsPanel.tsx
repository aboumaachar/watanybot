import { MetadataSelect } from '../aided-input';
import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { api, type TaxiDriverApplicationPayload } from "../../lib/api";
import { useApp } from "../../store/app";

type FreelanceApplicationForm = {
  applicantName: string;
  applicantPhone: string;
  applicantType: "PUBLIC" | "FAMILY_MEMBER";
  note: string;
};

type SellerRequestForm = {
  sellerName: string;
  contactPhone: string;
  location: string;
  storeName: string;
  category: string;
  description: string;
};

const sellerStorageKey = "watany_trusted_seller_request";

type UtilityColorStyle = CSSProperties & {
  "--utility-color": string;
};

function utilityColorStyle(color: string): UtilityColorStyle {
  return {
    "--utility-color": color,
  };
}

function loadSellerRequest(): SellerRequestForm | null {
  if (globalThis.window === undefined) {
    return null;
  }

  try {
    const raw = globalThis.window.localStorage.getItem(sellerStorageKey);
    return raw ? JSON.parse(raw) as SellerRequestForm : null;
  } catch {
    return null;
  }
}

function saveSellerRequest(request: SellerRequestForm) {
  if (globalThis.window === undefined) {
    return;
  }

  globalThis.window.localStorage.setItem(sellerStorageKey, JSON.stringify(request));
}

export function AccountApplicationsPanel() {
  const { profile, apiBaseUrl } = useApp();
  const accountName = profile.name || "";
  const accountPhone = profile.phone || "";
  const accountRegion = profile.region || "";
  const accountEmail = profile.email || "";

  const taxiDraft = useMemo<TaxiDriverApplicationPayload>(() => ({
    fullName: accountName,
    phone: accountPhone,
    whatsappPhone: accountPhone,
    profileImageUrl: "",
    vehicleCarType: "سيدان",
    vehicleColor: "",
    vehicleMake: "",
    vehicleModel: "",
    platePublicLastDigits: "",
    plateType: "RED_PUBLIC",
    muhafaza: accountRegion,
    caza: "",
    village: "",
  }), [accountName, accountPhone, accountRegion]);

  const [taxiForm, setTaxiForm] = useState<TaxiDriverApplicationPayload>(taxiDraft);
  const [freelanceForm, setFreelanceForm] = useState<FreelanceApplicationForm>({
    applicantName: accountName,
    applicantPhone: accountPhone,
    applicantType: "PUBLIC",
    note: "أرغب بتقديم طلب عمل حر عبر الحساب الحالي.",
  });
  const [sellerForm, setSellerForm] = useState<SellerRequestForm>(() => loadSellerRequest() || {
    sellerName: accountName,
    contactPhone: accountPhone,
    location: accountRegion,
    storeName: "",
    category: "trusted_seller",
    description: "طلب اعتماد بائع موثوق عبر الحساب الحالي.",
  });
  const [taxiStatus, setTaxiStatus] = useState("");
  const [freelanceStatus, setFreelanceStatus] = useState("");
  const [sellerStatus, setSellerStatus] = useState("");

  useEffect(() => {
    setTaxiForm((current) => ({
      ...current,
      fullName: current.fullName || accountName,
      phone: current.phone || accountPhone,
      whatsappPhone: current.whatsappPhone || accountPhone,
      muhafaza: current.muhafaza || accountRegion,
    }));
    setFreelanceForm((current) => ({
      ...current,
      applicantName: current.applicantName || accountName,
      applicantPhone: current.applicantPhone || accountPhone,
    }));
    setSellerForm((current) => ({
      ...current,
      sellerName: current.sellerName || accountName,
      contactPhone: current.contactPhone || accountPhone,
      location: current.location || accountRegion,
    }));
  }, [accountName, accountPhone, accountRegion]);

  async function submitTaxiApplication() {
    setTaxiStatus("");
    try {
      await api.applyTaxiDriver({
        ...taxiForm,
        fullName: taxiForm.fullName.trim(),
        phone: taxiForm.phone.trim(),
        whatsappPhone: taxiForm.whatsappPhone?.trim() || undefined,
        profileImageUrl: taxiForm.profileImageUrl?.trim() || undefined,
        vehicleCarType: taxiForm.vehicleCarType?.trim() || undefined,
        vehicleColor: taxiForm.vehicleColor?.trim() || undefined,
        vehicleMake: taxiForm.vehicleMake?.trim() || undefined,
        vehicleModel: taxiForm.vehicleModel?.trim() || undefined,
        platePublicLastDigits: taxiForm.platePublicLastDigits?.trim() || undefined,
        muhafaza: taxiForm.muhafaza?.trim() || undefined,
        caza: taxiForm.caza?.trim() || undefined,
        village: taxiForm.village?.trim() || undefined,
      }, apiBaseUrl);
      setTaxiStatus("تم إرسال طلب التاكسي للمراجعة الإدارية.");
    } catch (error) {
      setTaxiStatus(error instanceof Error ? error.message : "تعذر إرسال طلب التاكسي.");
    }
  }

  async function submitFreelanceApplication() {
    setFreelanceStatus("");
    try {
      const res = await fetch(`${apiBaseUrl}/api/opportunities/freelance/apply`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          opportunityId: "freelance",
          applicantName: freelanceForm.applicantName.trim(),
          applicantPhone: freelanceForm.applicantPhone.trim(),
          applicantType: freelanceForm.applicantType,
          note: freelanceForm.note.trim() || undefined,
        }),
      });
      if (!res.ok) {
        throw new Error("تعذر إرسال طلب العمل الحر.");
      }
      setFreelanceStatus("تم إرسال طلب العمل الحر للمراجعة.");
    } catch (error) {
      setFreelanceStatus(error instanceof Error ? error.message : "تعذر إرسال طلب العمل الحر.");
    }
  }

  function submitSellerRequest() {
    const nextRequest = {
      sellerName: sellerForm.sellerName.trim(),
      contactPhone: sellerForm.contactPhone.trim(),
      location: sellerForm.location.trim(),
      storeName: sellerForm.storeName.trim(),
      category: sellerForm.category.trim(),
      description: sellerForm.description.trim(),
    };
    saveSellerRequest(nextRequest);
    setSellerStatus("تم حفظ طلب البائع الموثوق داخل الحساب للمراجعة.");
  }

  return (
    <section className="profile-section-card profile-applications" id="account-applications">
      <div className="section-title">طلبات الحساب المعتمدة</div>
      <p className="panel-hint">هذه النماذج تظهر فقط داخل الحساب المسجّل، وتُملأ تلقائياً من بيانات الملف الشخصي.</p>

      <div className="profile-applications-grid">
        <article className="profile-application-card" id="taxi-application">
          <h3>طلب سائق تاكسي</h3>
          <div className="profile-fields-stack">
            <label className="profile-field"><span>الاسم</span><input data-aided-input-valid-free-text="taxi-full-name" className="input" value={taxiForm.fullName || ""} onChange={(event) => setTaxiForm((current) => ({ ...current, fullName: event.target.value }))} /></label>
            <label className="profile-field"><span>الهاتف</span><input data-aided-input-valid-free-text="taxi-phone" className="input" value={taxiForm.phone || ""} onChange={(event) => setTaxiForm((current) => ({ ...current, phone: event.target.value }))} /></label>
            <label className="profile-field"><span>واتساب</span><input data-aided-input-valid-free-text="taxi-whatsapp" className="input" value={taxiForm.whatsappPhone || ""} onChange={(event) => setTaxiForm((current) => ({ ...current, whatsappPhone: event.target.value }))} /></label>
            <label className="profile-field"><span>المنطقة</span><input className="input" value={taxiForm.muhafaza || ""} onChange={(event) => setTaxiForm((current) => ({ ...current, muhafaza: event.target.value }))} /></label>
            <MetadataSelect datasetId="vehicleTypes" label="نوع السيارة" value={taxiForm.vehicleCarType || ""} onChange={(next) => setTaxiForm((current) => ({ ...current, vehicleCarType: next }))} />
            <MetadataSelect datasetId="vehicleMakes" label="الشركة" value={taxiForm.vehicleMake || ""} onChange={(next) => setTaxiForm((current) => ({ ...current, vehicleMake: next }))} />
            <MetadataSelect datasetId="vehicleModels" label="الموديل" value={taxiForm.vehicleModel || ""} onChange={(next) => setTaxiForm((current) => ({ ...current, vehicleModel: next }))} />
            <label className="profile-field"><span>آخر أرقام اللوحة</span><input data-aided-input-valid-free-text="taxi-plate-last-digits" className="input" value={taxiForm.platePublicLastDigits || ""} onChange={(event) => setTaxiForm((current) => ({ ...current, platePublicLastDigits: event.target.value }))} /></label>
            <div className="profile-inline-actions profile-inline-actions--compact">
              <button type="button" className="utility-action-card" onClick={submitTaxiApplication} style={utilityColorStyle("#0f766e")}>
                <span className="utility-action-card__label">إرسال الطلب</span>
                <span className="utility-action-card__desc">يرسل للمراجعة الإدارية من داخل الحساب.</span>
              </button>
            </div>
            {taxiStatus ? <div className="panel-success">{taxiStatus}</div> : null}
          </div>
        </article>

        <article className="profile-application-card" id="freelance-application">
          <h3>طلب عمل حر</h3>
          <div className="profile-fields-stack">
            <label className="profile-field"><span>الاسم</span><input className="input" value={freelanceForm.applicantName} onChange={(event) => setFreelanceForm((current) => ({ ...current, applicantName: event.target.value }))} /></label>
            <label className="profile-field"><span>الهاتف</span><input className="input" value={freelanceForm.applicantPhone} onChange={(event) => setFreelanceForm((current) => ({ ...current, applicantPhone: event.target.value }))} /></label>
            <label className="profile-field"><span>نوع مقدم الطلب</span><select className="input" value={freelanceForm.applicantType} onChange={(event) => setFreelanceForm((current) => ({ ...current, applicantType: event.target.value as FreelanceApplicationForm["applicantType"] }))}><option value="PUBLIC">مستخدم عام</option><option value="FAMILY_MEMBER">فرد من العائلة</option></select></label>
            <label className="profile-field"><span>ملاحظات</span><textarea className="textarea profile-note-field" rows={4} value={freelanceForm.note} onChange={(event) => setFreelanceForm((current) => ({ ...current, note: event.target.value }))} /></label>
            <div className="profile-inline-actions profile-inline-actions--compact">
              <button type="button" className="utility-action-card" onClick={submitFreelanceApplication} style={utilityColorStyle("#2563eb")}>
                <span className="utility-action-card__label">إرسال الطلب</span>
                <span className="utility-action-card__desc">يرسل طلب العمل الحر إلى المراجعة.</span>
              </button>
            </div>
            {freelanceStatus ? <div className="panel-success">{freelanceStatus}</div> : null}
          </div>
        </article>

        <article className="profile-application-card" id="seller-application">
          <h3>طلب بائع موثوق</h3>
          <div className="profile-fields-stack">
            <label className="profile-field"><span>اسم البائع</span><input className="input" value={sellerForm.sellerName} onChange={(event) => setSellerForm((current) => ({ ...current, sellerName: event.target.value }))} /></label>
            <label className="profile-field"><span>الهاتف</span><input className="input" value={sellerForm.contactPhone} onChange={(event) => setSellerForm((current) => ({ ...current, contactPhone: event.target.value }))} /></label>
            <label className="profile-field"><span>المنطقة</span><input className="input" value={sellerForm.location} onChange={(event) => setSellerForm((current) => ({ ...current, location: event.target.value }))} /></label>
            <label className="profile-field"><span>اسم المتجر أو الخدمة</span><input className="input" value={sellerForm.storeName} onChange={(event) => setSellerForm((current) => ({ ...current, storeName: event.target.value }))} /></label>
            <label className="profile-field"><span>الوصف</span><textarea className="textarea profile-note-field" rows={4} value={sellerForm.description} onChange={(event) => setSellerForm((current) => ({ ...current, description: event.target.value }))} /></label>
            <div className="profile-inline-actions profile-inline-actions--compact">
              <button type="button" className="utility-action-card" onClick={submitSellerRequest} style={utilityColorStyle("#7c3aed")}>
                <span className="utility-action-card__label">حفظ الطلب</span>
                <span className="utility-action-card__desc">يُخزّن كطلب اعتماد بائع داخل الحساب.</span>
              </button>
            </div>
            {sellerStatus ? <div className="panel-success">{sellerStatus}</div> : null}
          </div>
        </article>
      </div>
      {accountEmail ? <div className="panel-hint">الحساب الحالي: {accountEmail}</div> : null}
    </section>
  );
}

export default AccountApplicationsPanel;