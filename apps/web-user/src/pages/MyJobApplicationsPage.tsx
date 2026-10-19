import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { authFetch } from "../lib/api";
import { useApp } from "../store/app";

type Item = { campaign_id:string; application_id:string; name:string; status:string; follow_up_status:string; created_at:string };
const campaignLabel = (id:string) => id === "seasonal-apple-job-2026-tannourine" ? "قطاف التفاح - تنورين" : id === "ain-mreisseh-building-assistant" ? "مساعد مدير مبنى - عين المريسة" : id;

export default function MyJobApplicationsPage() {
  const { apiBaseUrl } = useApp();
  const [items,setItems]=useState<Item[]>([]);
  const [loading,setLoading]=useState(true);
  useEffect(()=>{ let active=true; void authFetch(`${apiBaseUrl}/api/jobs/applications/mine`).then(async r=>{if(!active)return;if(r.ok){const d=await r.json();setItems(d.items??[]);}}).finally(()=>active&&setLoading(false)); return()=>{active=false}; },[apiBaseUrl]);
  return <main className="page-shell" dir="rtl">
    <section className="profile-section-card"><h1>طلبات الوظائف</h1><p>تابع كل طلباتك المرتبطة بحسابك من مكان واحد.</p></section>
    <section className="profile-section-card">
      {loading ? <p>جارٍ تحميل الطلبات…</p> : null}
      {!loading && items.length===0 ? <p>لا توجد طلبات مرتبطة بالحساب بعد.</p> : null}
      {items.map(item => <article key={`${item.campaign_id}:${item.application_id}`} className="utility-action-card utility-action-card--static" style={{marginBlock:8}}>
        <strong>{campaignLabel(item.campaign_id)}</strong><span>رقم الطلب: {item.application_id}</span>
        <span>الحالة: {item.status} · المتابعة: {item.follow_up_status}</span>
        <small>{new Date(item.created_at).toLocaleDateString("ar-LB")}</small>
      </article>)}
      <Link className="btn btn-secondary" to="/jobs">العودة إلى الوظائف</Link>
    </section>
  </main>;
}
