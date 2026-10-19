import { useEffect, useMemo, useState } from "react";
import { listSeasonalApplications, updateSeasonalApplication, type SeasonalApplication } from "../lib/api";
import { AdminDetailDrawer, AdminErrorState, AdminPageSection, AdminSearchInput, AdminStatCard, AdminStatusBadge, AdminTableToolbar } from "../components/admin/AdminPrimitives";

const STATUSES: SeasonalApplication["status"][] = ["pending_review", "accepted", "waitlist", "rejected", "withdrawn"];
const FOLLOW: SeasonalApplication["followUpStatus"][] = ["not_contacted", "called", "no_answer", "confirmed", "declined", "needs_follow_up"];
const locationOf = (item: SeasonalApplication) => [item.villageAr || item.village, item.cazaAr || item.caza, item.governorateAr || item.governorate].filter(Boolean).join("، ") || "—";
const dateOf = (value: string) => { const d = new Date(value); return Number.isNaN(d.valueOf()) ? value : d.toLocaleString("ar-LB"); };

export default function SeasonalAppleApplicationsAdminPage() {
  const [items, setItems] = useState<SeasonalApplication[]>([]);
  const [selected, setSelected] = useState<SeasonalApplication | null>(null);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true); setError("");
    try { setItems(await listSeasonalApplications()); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "تعذر تحميل طلبات قطاف التفاح."); }
    finally { setLoading(false); }
  }

  useEffect(() => { void load(); }, []);
  const filtered = useMemo(() => {
    const needle = q.trim().toLocaleLowerCase("ar-LB");
    return items.filter((item) => (!status || item.status === status) && (!needle || `${item.name} ${item.phone} ${locationOf(item)} ${item.email || ""}`.toLocaleLowerCase("ar-LB").includes(needle)));
  }, [items, q, status]);
  const summary = useMemo(() => ({
    total: items.length,
    pending: items.filter((item) => item.status === "pending_review").length,
    accepted: items.filter((item) => item.status === "accepted").length,
    waitlist: items.filter((item) => item.status === "waitlist").length,
  }), [items]);

  async function save(patch: Partial<Pick<SeasonalApplication, "status" | "followUpStatus" | "adminNotes">>) {
    if (!selected) return;
    setSaving(true); setError("");
    try {
      const updated = await updateSeasonalApplication(selected.id, patch);
      setSelected(updated);
      setItems((current) => current.map((item) => item.id === updated.id ? updated : item));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "تعذر تحديث الطلب.");
    } finally { setSaving(false); }
  }

  return <div className="admin-page" dir="rtl">
    <AdminPageSection title="طلبات قطاف التفاح – عين الحفة" description="إدارة الطلبات السابقة ومتابعة المرشحين." action={<button className="ghost" type="button" onClick={() => void load()}>تحديث</button>}>
      <div className="admin-stats">
        <AdminStatCard label="كل الطلبات" value={summary.total} />
        <AdminStatCard label="قيد المراجعة" value={summary.pending} />
        <AdminStatCard label="مقبول" value={summary.accepted} />
        <AdminStatCard label="لائحة الانتظار" value={summary.waitlist} />
      </div>
      <AdminTableToolbar resultCount={filtered.length} onClear={() => { setQ(""); setStatus(""); }}>
        <AdminSearchInput value={q} onChange={setQ} placeholder="الاسم أو الهاتف أو المنطقة" />
        <select value={status} onChange={(event) => setStatus(event.target.value)}>
          <option value="">كل الحالات</option>
          {STATUSES.map((value) => <option key={value} value={value}>{value}</option>)}
        </select>
      </AdminTableToolbar>
      {error ? <AdminErrorState message={error} /> : null}
      <div className="table-wrap"><table className="admin-table">
        <thead><tr><th>المتقدم</th><th>الهاتف</th><th>العمر</th><th>العنوان</th><th>النقاط</th><th>الحالة</th><th>المتابعة</th><th>التاريخ</th><th /></tr></thead>
        <tbody>{loading ? <tr><td colSpan={9}>جارٍ التحميل...</td></tr> : filtered.length === 0 ? <tr><td colSpan={9}>لا توجد طلبات مطابقة.</td></tr> : filtered.map((item) => <tr key={item.id}>
          <td><strong>{item.name}</strong><div className="muted" dir="ltr">{item.id}</div></td>
          <td dir="ltr">{item.phone}</td><td>{item.age || "—"}</td><td>{locationOf(item)}</td><td>{item.weightedScore}</td>
          <td><AdminStatusBadge status={item.status} /></td><td>{item.followUpStatus}</td><td>{dateOf(item.createdAt)}</td>
          <td><button className="ghost sm" type="button" onClick={() => setSelected(item)}>عرض</button></td>
        </tr>)}</tbody>
      </table></div>
    </AdminPageSection>
    {selected ? <AdminDetailDrawer title={selected.name} onClose={() => setSelected(null)}>
      <p><strong>الهاتف:</strong> <span dir="ltr">{selected.phone}</span></p>
      <p><strong>العنوان:</strong> {locationOf(selected)}</p>
      <p><strong>العمر:</strong> {selected.age} · <strong>العلاقة:</strong> {selected.relationType}</p>
      <p><strong>التوفر:</strong> {selected.availability} · <strong>الحضور 6 صباحاً:</strong> {selected.canArrive6am ? "نعم" : "لا"}</p>
      <p><strong>خبرة زراعية:</strong> {selected.hasAgriExperience ? "نعم" : "لا"} {selected.experienceText || ""}</p>
      <p><strong>ملاحظات صحية:</strong> {selected.healthNote || "—"}</p>
      <label>الحالة<select disabled={saving} value={selected.status} onChange={(event) => void save({ status: event.target.value as SeasonalApplication["status"] })}>{STATUSES.map((value) => <option key={value}>{value}</option>)}</select></label>
      <label>المتابعة<select disabled={saving} value={selected.followUpStatus} onChange={(event) => void save({ followUpStatus: event.target.value as SeasonalApplication["followUpStatus"] })}>{FOLLOW.map((value) => <option key={value}>{value}</option>)}</select></label>
      <label>ملاحظات الإدارة<textarea rows={4} value={selected.adminNotes || ""} onChange={(event) => setSelected((current) => current ? { ...current, adminNotes: event.target.value } : current)} onBlur={() => void save({ adminNotes: selected.adminNotes })} /></label>
      <p className="muted">آخر تحديث: {dateOf(selected.updatedAt)}</p>
    </AdminDetailDrawer> : null}
  </div>;
}
