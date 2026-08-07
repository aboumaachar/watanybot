import { useEffect, useState } from "react";
import {
  approveMarketListing,
  compactMarketStore,
  fetchAdminMarketCategories,
  fetchAdminMarketListings,
  fetchAdminMarketOutbox,
  fetchAdminMarketReports,
  rejectMarketListing,
  removeMarketListing,
  saveAdminMarketCategory,
  updateMarketTrust,
} from "./market-api";
import type { AdminMarketCategory, AdminMarketListing, AdminMarketOutboxEvent, AdminMarketReport } from "./market-api";

export default function AdminMarketModerationPanel() {
  const [listings, setListings] = useState<AdminMarketListing[]>([]);
  const [reports, setReports] = useState<AdminMarketReport[]>([]);
  const [categories, setCategories] = useState<AdminMarketCategory[]>([]);
  const [outbox, setOutbox] = useState<AdminMarketOutboxEvent[]>([]);
  const [status, setStatus] = useState("PENDING_REVIEW");
  const [message, setMessage] = useState("");
  const [categoryDraft, setCategoryDraft] = useState({ labelAr: "", labelEn: "", icon: "📦" });

  async function refresh(nextStatus = status) {
    const [nextListings, nextReports, nextCategories, nextOutbox] = await Promise.all([
      fetchAdminMarketListings(nextStatus),
      fetchAdminMarketReports().catch(() => []),
      fetchAdminMarketCategories().catch(() => []),
      fetchAdminMarketOutbox().catch(() => []),
    ]);
    setListings(nextListings);
    setReports(nextReports);
    setCategories(nextCategories);
    setOutbox(nextOutbox);
  }

  useEffect(() => { void refresh(); }, []);

  async function run(action: () => Promise<void>, ok: string) {
    try {
      await action();
      setMessage(ok);
      await refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "تعذّر تنفيذ العملية");
    }
  }

  return (
    <section dir="rtl" style={{ padding: 16, display: "grid", gap: 16 }}>
      <header>
        <p style={{ margin: 0, color: "#476" }}>إدارة سوق موطني</p>
        <h1 style={{ margin: 0 }}>مراجعة الإعلانات والبلاغات</h1>
      </header>
      {message && <div role="status" style={{ padding: 12, borderRadius: 12, background: "#eef8f0" }}>{message}</div>}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {[
          ["PENDING_REVIEW", "بانتظار المراجعة"], ["APPROVED", "منشور"], ["REJECTED", "مرفوض"], ["REPORTED", "عليه بلاغات"], ["REMOVED", "محذوف"]
        ].map(([value, label]) => <button key={value} onClick={() => { setStatus(value); void refresh(value); }}>{label}</button>)}
        <button onClick={() => void run(compactMarketStore, "تم ترتيب ملف السوق.")}>تنظيف ملف JSON</button>
      </div>
      <div style={{ display: "grid", gap: 12 }}>
        {listings.map((listing) => (
          <article key={listing.id} style={{ border: "1px solid #ddd", borderRadius: 16, padding: 14, background: "#fff" }}>
            <strong>{listing.title}</strong>
            <p>{listing.description}</p>
            <p>المراجعة: {listing.status} · التشغيل: {listing.lifecycleStatus || "active"} · بلاغات: {listing.reportCount}</p>
            {listing.rejectionReason && <p>سبب الرفض: {listing.rejectionReason}</p>}
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button onClick={() => void run(() => approveMarketListing(listing.id), "تمت الموافقة.")}>موافقة</button>
              <button onClick={() => void run(() => rejectMarketListing(listing.id, "يرجى توضيح السعر أو طريقة التواصل", "ملاحظة إدارية من لوحة السوق"), "تم رفض الإعلان مع السبب.")}>رفض مع سبب</button>
              <button onClick={() => void run(() => removeMarketListing(listing.id, "إزالة من لوحة سوق موطني"), "تمت الإزالة.")}>إزالة</button>
              <button onClick={() => void run(() => updateMarketTrust(listing.id, { verifiedByWatany: true, sellerTrustLevel: "TRUSTED", note: "موثّق من موطني" }), "تم تحديث الثقة.")}>موثّق من موطني</button>
              <button onClick={() => void run(() => updateMarketTrust(listing.id, { featuredVeteranSeller: true, sellerTrustLevel: "FEATURED" }), "تم تمييز البائع.")}>بائع مميّز</button>
            </div>
          </article>
        ))}
      </div>
      <section style={{ borderTop: "1px solid #eee", paddingTop: 12, display: "grid", gap: 12 }}>
        <h2>فئات السوق</h2>
        <div style={{ display: "grid", gap: 8, gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
          {categories.map((category) => (
            <article key={category.id} style={{ border: "1px solid #ddd", borderRadius: 12, padding: 12, background: "#fff" }}>
              <strong>{category.icon} {category.labelAr}</strong>
              <p style={{ margin: "8px 0 0" }}>المعرف: {category.id} · الترتيب: {category.sortOrder}</p>
              <p style={{ margin: "4px 0 0" }}>{category.enabled ? "مفعلة" : "معطلة"}</p>
            </article>
          ))}
        </div>
        <div style={{ display: "grid", gap: 8, maxWidth: 420 }}>
          <input value={categoryDraft.labelAr} placeholder="اسم الفئة بالعربية" onChange={(event) => setCategoryDraft((current) => ({ ...current, labelAr: event.target.value }))} />
          <input value={categoryDraft.labelEn} placeholder="Name in English" onChange={(event) => setCategoryDraft((current) => ({ ...current, labelEn: event.target.value }))} />
          <input value={categoryDraft.icon} placeholder="📦" onChange={(event) => setCategoryDraft((current) => ({ ...current, icon: event.target.value }))} />
          <button onClick={() => void run(async () => {
            await saveAdminMarketCategory({
              labelAr: categoryDraft.labelAr,
              labelEn: categoryDraft.labelEn,
              icon: categoryDraft.icon,
            });
            setCategoryDraft({ labelAr: "", labelEn: "", icon: "📦" });
          }, "تم حفظ فئة السوق.")}>إضافة فئة</button>
        </div>
      </section>
      <aside style={{ borderTop: "1px solid #eee", paddingTop: 12 }}>
        <h2>بلاغات السوق</h2>
        {reports.length === 0 && <p>لا توجد بلاغات مفتوحة حالياً.</p>}
        {reports.map((report) => <p key={report.id}>بلاغ: {report.reason} — إعلان: {report.listing?.title || report.listingId}</p>)}
      </aside>
      <aside style={{ borderTop: "1px solid #eee", paddingTop: 12 }}>
        <h2>سجل أحداث التكامل</h2>
        {outbox.length === 0 && <p>لا توجد أحداث بانتظار التصدير.</p>}
        {outbox.slice(0, 12).map((event) => <p key={event.id}>{event.eventType} — {event.aggregateType} — {event.mercurStatus}</p>)}
      </aside>
    </section>
  );
}