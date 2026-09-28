import { useState } from "react";
import { NavLink } from "react-router-dom";
import { AdminErrorState, AdminLoadingState, AdminPageSection, AdminStatusBadge } from "../components/admin/AdminPrimitives";
import { openPayloadContentStudio } from "../lib/api";

export default function ContentStudioPage() {
  const [opening, setOpening] = useState(false);
  const [error, setError] = useState("");
  const openStudio = async () => {
    setOpening(true);
    setError("");
    try {
      await openPayloadContentStudio();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to open the canonical editorial workspace.");
      setOpening(false);
    }
  };
  return <div className="ops-page-stack">
    <AdminPageSection title="استوديو المحتوى" description="Payload هو مالك التحرير المعتمد. توفر Ops تسليماً آمناً وسياقاً تشغيلياً ولا تكرر التأليف التحريري.">
      <div className="ops-authority-panel"><div><span className="admin-eyebrow">المالك التحريري</span><h3>Payload CMS عبر الدخول الموحد لـ Gateway</h3><p className="muted">افتح مساحة المالك عبر تفويض Gateway قصير الأجل. لا يُنسخ المحتوى التحريري إلى مساحة التحكم هذه.</p></div><AdminStatusBadge status={opening ? "جارٍ الاتصال" : error ? "غير متاح" : "جاهز"} /></div>
      {opening && <AdminLoadingState message="جارٍ تجهيز تسليم استوديو المحتوى الآمن..." />}
      {error && <AdminErrorState message={error} />}
      <div className="ops-form-actions"><button className="accent" type="button" onClick={() => void openStudio()} disabled={opening}>{opening ? "جارٍ الفتح..." : "فتح استوديو المحتوى"}</button><NavLink className="ghost" to="/">العودة إلى لوحة التحكم</NavLink></div>
    </AdminPageSection>
  </div>;
}
