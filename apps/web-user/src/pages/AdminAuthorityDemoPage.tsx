import { useMemo, useState } from 'react';
import { AdministrativeAuthorityProvider, UniversalLocator, createReferenceInteractionPlatform } from '../../../../packages/lebanese-administrative-authority/react';
import './AdminAuthorityDemoPage.css';

export default function AdminAuthorityDemoPage() {
  const [showReference, setShowReference] = useState(false);
  const referencePlatform = useMemo(() => createReferenceInteractionPlatform(), []);
  return <main className="authority-demo" dir="rtl">
    <header className="authority-demo__header">
      <div>
        <p className="authority-demo__kicker">UL2A · منتج بيانات مرجعي</p>
        <h1>السلطة الإدارية اللبنانية</h1>
        <p>نموذج متصفح مستقل لا يغيّر نماذج التطبيق الحالية ولا يحمّل بيانات مرشحة بصمت.</p>
      </div>
      <span className="authority-demo__status">الإنتاج محجوب</span>
    </header>
    <section className="authority-demo__notice" aria-live="polite">
      <strong>لا توجد نسخة approvedCanonical قابلة للتحميل.</strong>
      <span>الإصدار 1.0.0 متوقف تقنيًا حتى تكتمل أسماء المحليات العربية ومراجعة المالك.</span>
    </section>
    <section className="authority-demo__facts" aria-label="حالة الإصدار">
      <div><b>8</b><span>محافظات مرجعية</span></div>
      <div><b>25</b><span>أقضية مرصودة</span></div>
      <div><b>1,586</b><span>محلية مرشحة</span></div>
      <div><b>0</b><span>أسماء عربية مكتملة</span></div>
    </section>
    <section className="authority-demo__workbench">
      <div className="authority-demo__workbench-head">
        <div><h2>عقد الاختيار</h2><p>الحالة الافتراضية disabled لحماية الإنتاج من fallback غير موثوق.</p></div>
        <button type="button" onClick={() => setShowReference((value) => !value)} aria-pressed={showReference}>{showReference ? 'إخفاء نموذج التفاعل' : 'عرض نموذج التفاعل المرجعي'}</button>
      </div>
      {!showReference ? <div className="authority-demo__blocked" role="status"><span aria-hidden="true">!</span><div><strong>البيانات غير متاحة للتشغيل</strong><p>سيظهر هنا التحميل والحالة الفاشلة وchecksum failure بدل اختيار بيانات بديلة.</p></div></div> : <AdministrativeAuthorityProvider platform={referencePlatform}><div className="authority-demo__fixture"><p className="authority-demo__fixture-label">Reference fixture · غير صالح للإنتاج</p><UniversalLocator /></div></AdministrativeAuthorityProvider>}
    </section>
  </main>;
}
