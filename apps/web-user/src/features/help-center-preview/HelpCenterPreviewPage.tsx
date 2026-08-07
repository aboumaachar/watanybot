import { FormEvent, useMemo, useState } from "react";
import KoudamaFeatureIcon from "../../components/koudama-icons/KoudamaFeatureIcon";
import WatanySupportRoute from "../../components/layouts/WatanySupportRoute";
// APEX_CSS_FREEZE_DISABLED_IMPORT import "./help-center-preview.css";

type TabId = "help" | "veteran" | "ticket" | "complaint" | "requests";

type ServiceCard = Readonly<{
  id: Exclude<TabId, "help" | "requests">;
  label: string;
  description: string;
  featureId: string;
  tone: string;
}>;

const SERVICES: readonly ServiceCard[] = [
  {
    id: "veteran",
    label: "ملف متقاعد",
    description: "حقوق ومعاملات",
    featureId: "cases",
    tone: "#1d4ed8",
  },
  {
    id: "ticket",
    label: "دعم فني",
    description: "مشكلة في موطني",
    featureId: "support",
    tone: "#0f766e",
  },
  {
    id: "complaint",
    label: "شكوى رسمية",
    description: "مراجعة مستقلة",
    featureId: "fake_alerts",
    tone: "#dc2626",
  },
];

const REQUESTS = [
  {
    type: "ملف متقاعد",
    reference: "VC-2026-000184",
    title: "تأخر دفعة مساعدة مدرسية",
    detail: "صاحب الملف: العميد المتقاعد م. خ.",
    status: "بانتظار مستند",
    tone: "amber",
  },
  {
    type: "دعم فني",
    reference: "TKT-2026-000397",
    title: "رمز التحقق لا يصل",
    detail: "الحساب الحالي",
    status: "قيد المعالجة",
    tone: "blue",
  },
  {
    type: "شكوى رسمية",
    reference: "CMP-2026-000072",
    title: "شكوى على تأخر الرد",
    detail: "مرتبطة بـ VC-2026-000151",
    status: "تم الاستلام",
    tone: "green",
  },
] as const;

function DemoSuccess({ reference }: { reference: string }) {
  return (
    <div className="help-preview__success" role="status">
      تم الإرسال التجريبي. رقم المتابعة: <strong>{reference}</strong>
    </div>
  );
}

export default function HelpCenterPreviewPage() {
  const [tab, setTab] = useState<TabId>("help");
  const [query, setQuery] = useState("");
  const [success, setSuccess] = useState("");
  const suggestion = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return null;
    if (/رمز|otp|دخول|تطبيق|صفحة|إشعار/.test(normalized)) {
      return { tab: "ticket" as const, text: "هذه تبدو مشكلة دعم فني." };
    }
    if (/معاش|تقاعد|طبابة|دفعة|مساعدة|معاملة/.test(normalized)) {
      return { tab: "veteran" as const, text: "هذه تبدو متابعة تخص متقاعداً أو مستفيداً." };
    }
    if (/شكوى|اعتراض|موظف|خصوصية|تأخير/.test(normalized)) {
      return { tab: "complaint" as const, text: "هذه تبدو شكوى رسمية." };
    }
    return { tab: "help" as const, text: "يمكن متابعة الموضوع عبر المساعدة العامة و«او شي تاني»." };
  }, [query]);

  function changeTab(nextTab: TabId) {
    setSuccess("");
    setTab(nextTab);
  }

  function submitPreview(event: FormEvent<HTMLFormElement>, reference: string) {
    event.preventDefault();
    setSuccess(reference);
  }

  return (
    <WatanySupportRoute
      title="المساعدة والمتابعة"
      description="احصل على مساعدة، افتح ملفاً لموضوع متقاعد أو مستفيد، أبلغ عن مشكلة تقنية، أو قدّم شكوى رسمية."
      icon={<KoudamaFeatureIcon featureId="help" size="sm" />}
      className="help-preview"
    >
      <div className="help-preview__service-grid" aria-label="خدمات المساعدة">
        {SERVICES.map((service) => (
          <button
            key={service.id}
            type="button"
            className={`help-preview__service-card${tab === service.id ? " is-active" : ""}`}
            style={{ "--help-preview-tone": service.tone } as React.CSSProperties}
            onClick={() => changeTab(service.id)}
          >
            <span className="help-preview__service-icon">
              <KoudamaFeatureIcon featureId={service.featureId} size="md" />
            </span>
            <strong>{service.label}</strong>
            <small>{service.description}</small>
          </button>
        ))}
      </div>

      <section className="help-preview__surface">
        <nav className="help-preview__tabs" aria-label="أقسام المساعدة">
          {[
            ["help", "المساعدة"],
            ["veteran", "ملف متقاعد"],
            ["ticket", "الدعم الفني"],
            ["complaint", "الشكوى"],
            ["requests", "طلباتي"],
          ].map(([id, label]) => (
            <button
              key={id}
              type="button"
              className={`help-preview__tab${tab === id ? " is-active" : ""}`}
              onClick={() => changeTab(id as TabId)}
            >
              {label}
            </button>
          ))}
        </nav>

        {tab === "help" ? (
          <div className="help-preview__panel">
            <header className="help-preview__panel-head">
              <div>
                <h2>شو المشكلة اللي عم تواجهك؟</h2>
                <p>يقترح مركز المساعدة الخيار المناسب من دون أن يمنعك من فتح متابعة.</p>
              </div>
            </header>

            <div className="help-preview__search">
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="مثلاً: ما وصلني رمز الدخول" />
              <button type="button" aria-label="بحث">
                <KoudamaFeatureIcon featureId="search" size="sm" />
              </button>
            </div>

            {suggestion ? (
              <div className="help-preview__suggestion">
                {suggestion.text}
                {suggestion.tab !== "help" ? (
                  <button type="button" onClick={() => changeTab(suggestion.tab)}>
                    فتح الخيار المقترح
                  </button>
                ) : null}
              </div>
            ) : null}

            <div className="help-preview__route-list">
              <button type="button" onClick={() => changeTab("veteran")}>
                <KoudamaFeatureIcon featureId="cases" size="sm" />
                <span><strong>موضوع متقاعد أو مستفيد</strong><small>معاش، طبابة، مستند أو معاملة</small></span>
              </button>
              <button type="button" onClick={() => changeTab("ticket")}>
                <KoudamaFeatureIcon featureId="support" size="sm" />
                <span><strong>مشكلة باستخدام موطني</strong><small>دخول، OTP، إشعار أو خطأ تقني</small></span>
              </button>
              <button type="button" onClick={() => changeTab("complaint")}>
                <KoudamaFeatureIcon featureId="fake_alerts" size="sm" />
                <span><strong>تقديم شكوى رسمية</strong><small>تأخير، سوء معالجة، خصوصية أو اعتراض</small></span>
              </button>
              <button type="button">
                <KoudamaFeatureIcon featureId="help" size="sm" />
                <span><strong>او شي تاني</strong><small>اشرح المشكلة وسيتم توجيهها</small></span>
              </button>
            </div>
          </div>
        ) : null}

        {tab === "veteran" ? (
          <div className="help-preview__panel">
            <header className="help-preview__panel-head">
              <div><h2>فتح ملف متابعة</h2><p>صاحب الملف والمتقدّم بالطلب قد يكونان شخصين مختلفين.</p></div>
              <span>VC-2026</span>
            </header>
            <form onSubmit={(event) => submitPreview(event, "VC-2026-000184")} className="help-preview__form">
              <label>لمن هذا الطلب؟
                <select required defaultValue=""><option value="">اختر صاحب الملف</option><option>لي شخصياً — متقاعد</option><option>والدي — متقاعد</option><option>والدتي — مستفيدة</option></select>
              </label>
              <label>ما صلتك به؟
                <select required defaultValue=""><option value="">اختر الصلة</option><option>المتقاعد نفسه</option><option>الزوج أو الزوجة</option><option>الابن</option><option>الابنة</option><option>ممثل مفوّض</option></select>
              </label>
              <label>نوع الموضوع
                <select required defaultValue=""><option value="">اختر الموضوع</option><option>المعاش والتقاعد</option><option>الدفعات والمستحقات</option><option>الطبابة والاستشفاء</option><option>المساعدات المدرسية</option><option>المعاملات الإدارية</option><option>او شي تاني</option></select>
              </label>
              <label>اشرح المشكلة<textarea required placeholder="اكتب التفاصيل وما النتيجة التي تحتاجها..." /></label>
              <div className="help-preview__upload"><strong>أضف المستندات</strong><small>صور، PDF، أو مستندات مرتبطة بالموضوع</small></div>
              <button className="help-preview__primary" type="submit">إرسال ملف المتابعة</button>
              {success === "VC-2026-000184" ? <DemoSuccess reference={success} /> : null}
            </form>
          </div>
        ) : null}

        {tab === "ticket" ? (
          <div className="help-preview__panel">
            <header className="help-preview__panel-head">
              <div><h2>فتح تذكرة دعم فني</h2><p>تخص حساب المستخدم أو التطبيق، وليست ملف حقوق للمتقاعد.</p></div>
              <span>TKT-2026</span>
            </header>
            <form onSubmit={(event) => submitPreview(event, "TKT-2026-000397")} className="help-preview__form">
              <label>أين ظهرت المشكلة؟
                <select required defaultValue=""><option value="">اختر القسم</option><option>تسجيل الدخول</option><option>رمز التحقق OTP</option><option>الملف الشخصي</option><option>النماذج</option><option>الإشعارات</option><option>الدردشة أو الصوت</option><option>او شي تاني</option></select>
              </label>
              <label>ماذا كنت تحاول أن تفعل؟<textarea required placeholder="اشرح الخطوات وما الذي ظهر بدلاً منها..." /></label>
              <label>رسالة الخطأ<input placeholder="اختياري" /></label>
              <div className="help-preview__upload"><strong>أضف صورة للشاشة</strong><small>لا ترفق كلمة مرور أو رمز تحقق</small></div>
              <button className="help-preview__primary" type="submit">إرسال تذكرة الدعم</button>
              {success === "TKT-2026-000397" ? <DemoSuccess reference={success} /> : null}
            </form>
          </div>
        ) : null}

        {tab === "complaint" ? (
          <div className="help-preview__panel">
            <header className="help-preview__panel-head">
              <div><h2>تقديم شكوى رسمية</h2><p>لها رقم ومسار مراجعة مستقلان عن الملف أو التذكرة المرتبطة.</p></div>
              <span>CMP-2026</span>
            </header>
            <form onSubmit={(event) => submitPreview(event, "CMP-2026-000072")} className="help-preview__form">
              <label>موضوع الشكوى
                <select required defaultValue=""><option value="">اختر الموضوع</option><option>تأخر في الخدمة</option><option>عدم الرد</option><option>معلومات غير صحيحة</option><option>سوء معالجة الطلب</option><option>الخصوصية أو البيانات</option><option>اعتراض على قرار</option><option>او شي تاني</option></select>
              </label>
              <label>الشكوى بحق من أو ماذا؟
                <select required defaultValue=""><option value="">اختر الجهة</option><option>خدمة داخل موطني</option><option>موظف أو وكيل</option><option>جهة خارجية</option><option>ملف متابعة سابق</option><option>تذكرة دعم سابقة</option></select>
              </label>
              <label>الرقم المرتبط<input placeholder="VC أو TKT — اختياري" /></label>
              <label>ماذا حصل؟<textarea required placeholder="اشرح الوقائع بالتسلسل..." /></label>
              <div className="help-preview__upload"><strong>أضف الأدلة</strong><small>صور، رسائل، مستندات أو مراجع سابقة</small></div>
              <button className="help-preview__primary" type="submit">إرسال الشكوى</button>
              {success === "CMP-2026-000072" ? <DemoSuccess reference={success} /> : null}
            </form>
          </div>
        ) : null}

        {tab === "requests" ? (
          <div className="help-preview__panel">
            <header className="help-preview__panel-head">
              <div><h2>طلباتي ومتابعاتي</h2><p>تظهر الأنواع الثلاثة منفصلة مع الرقم والحالة والإجراء المطلوب.</p></div>
            </header>
            <div className="help-preview__requests">
              {REQUESTS.map((item) => (
                <article key={item.reference}>
                  <header>
                    <div><strong>{item.title}</strong><small>{item.reference} · {item.detail}</small></div>
                    <span data-tone={item.tone}>{item.status}</span>
                  </header>
                  <footer><span>{item.type}</span><span>آخر تحديث: اليوم</span></footer>
                </article>
              ))}
            </div>
          </div>
        ) : null}
      </section>
    </WatanySupportRoute>
  );
}
