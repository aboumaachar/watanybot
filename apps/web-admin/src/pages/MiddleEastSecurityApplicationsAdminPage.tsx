import { useEffect, useState } from "react";
import { adminFetch, getAdminErrorMessage } from "../lib/api";
import {
  AdminDataTable,
  AdminDetailDrawer,
  AdminErrorState,
  AdminPageSection,
  AdminPagination,
  AdminSearchInput,
  AdminStatCard,
  AdminStatusBadge,
  AdminTableToolbar,
} from "../components/admin/AdminPrimitives";

type Application = {
  id: string;
  full_name: string;
  birth_date: string;
  age_years?: number;
  birth_place: string;
  address: string;
  mohafaza?: string;
  caza?: string;
  village?: string;
  phone: string;
  preferred_location: string;
  arabic_read: string;
  arabic_write: string;
  english_read: string;
  english_write: string;
  security_training: boolean;
  security_training_details?: string;
  ngo_experience: boolean;
  ngo_details?: string;
  notes?: string;
  status: "pending" | "approved" | "rejected";
  followUpStatus: string;
  adminNotes: string;
  version: number;
  createdAt: string;
  updatedAt: string;
};

type ListResponse = {
  items: Application[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  summary: { total: number; pending: number; approved: number; rejected: number };
};

type HistoryEntry = {
  version: number;
  eventType: string;
  actorId: string;
  createdAt: string;
  snapshot: { status: string; followUpStatus: string; adminNotes: string; version: number };
};

const statuses = ["pending", "approved", "rejected"];
const followUps = ["not_contacted", "to_contact", "contacted", "confirmed", "no_response", "withdrawn"];
const dateLabel = (value: string) => new Date(value).toLocaleString("ar-LB");
const locationLabel = (item: Application) => [item.village, item.caza, item.mohafaza].filter(Boolean).join("، ") || item.address || "—";
const ageLabel = (value?: number) => value == null ? "غير مسجل" : String(value);

export default function MiddleEastSecurityApplicationsAdminPage() {
  const [items, setItems] = useState<Application[]>([]);
  const [summary, setSummary] = useState<ListResponse["summary"]>({ total: 0, pending: 0, approved: 0, rejected: 0 });
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [queryText, setQueryText] = useState("");
  const [status, setStatus] = useState("");
  const [followUpStatus, setFollowUpStatus] = useState("");
  const [selected, setSelected] = useState<Application | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function load(nextPage = page) {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({ page: String(nextPage), page_size: "25" });
      if (queryText) params.set("q", queryText);
      if (status) params.set("status", status);
      if (followUpStatus) params.set("follow_up_status", followUpStatus);
      const response = await adminFetch(`/api/superadmin/middle-east-security/applications?${params}`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json() as ListResponse;
      setItems(data.items ?? []);
      setSummary(data.summary);
      setTotal(data.total);
      setPage(data.page);
    } catch (reason) {
      setError(getAdminErrorMessage(reason, "تعذر تحميل طلبات ميدل إيست سيكوري."));
    } finally {
      setLoading(false);
    }
  }

  async function selectApplication(item: Application) {
    setSelected(item);
    try {
      const response = await adminFetch(`/api/superadmin/middle-east-security/applications/${encodeURIComponent(item.id)}/history`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      setHistory((await response.json() as { items: HistoryEntry[] }).items ?? []);
    } catch (reason) {
      setError(getAdminErrorMessage(reason, "تعذر تحميل سجل الطلب."));
    }
  }

  async function update(patch: Record<string, string>) {
    if (!selected) return;
    setSaving(true);
    setError("");
    try {
      const response = await adminFetch(`/api/superadmin/middle-east-security/applications/${encodeURIComponent(selected.id)}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...patch, expectedVersion: selected.version }),
      });
      if (response.status === 409) throw new Error("تغيّر الطلب. أعد فتحه قبل الحفظ.");
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const item = (await response.json() as { item: Application }).item;
      setSelected(item);
      setItems((current) => current.map((entry) => entry.id === item.id ? item : entry));
      await selectApplication(item);
    } catch (reason) {
      setError(getAdminErrorMessage(reason, "تعذر حفظ التعديل."));
    } finally {
      setSaving(false);
    }
  }

  useEffect(() => { void load(1); }, []);

  return <div className="admin-page" dir="rtl">
    <AdminPageSection title="طلبات ميدل إيست سيكوريتي لبنان" description="إدارة الطلبات وسجل التغييرات." action={<button className="ghost" type="button" onClick={() => void load()}>تحديث</button>}>
      <div className="admin-stats">
        <AdminStatCard label="كل الطلبات" value={summary.total} />
        <AdminStatCard label="قيد المراجعة" value={summary.pending} />
        <AdminStatCard label="مقبول" value={summary.approved} />
        <AdminStatCard label="مرفوض" value={summary.rejected} />
      </div>
      <AdminTableToolbar resultCount={total} onClear={() => { setQueryText(""); setStatus(""); setFollowUpStatus(""); void load(1); }}>
        <AdminSearchInput value={queryText} onChange={setQueryText} placeholder="الاسم أو الهاتف أو المرجع" />
        <select value={status} onChange={(event) => { setStatus(event.target.value); void load(1); }}><option value="">كل الحالات</option>{statuses.map((value) => <option key={value}>{value}</option>)}</select>
        <select value={followUpStatus} onChange={(event) => { setFollowUpStatus(event.target.value); void load(1); }}><option value="">كل المتابعة</option>{followUps.map((value) => <option key={value}>{value}</option>)}</select>
        <button className="accent" type="button" onClick={() => void load(1)}>بحث</button>
      </AdminTableToolbar>
      {error ? <AdminErrorState message={error} /> : null}
      <AdminDataTable
        rows={items}
        columns={["المرجع", "الاسم", "العنوان الإداري", "الهاتف", "الحالة", "المتابعة", ""]}
        loading={loading}
        empty="لم يتم العثور على طلبات."
        renderRow={(item) => <><td>{item.id}</td><td><strong>{item.full_name}</strong></td><td>{locationLabel(item)}</td><td dir="ltr">{item.phone}</td><td><AdminStatusBadge status={item.status} /></td><td>{item.followUpStatus}</td><td><button className="ghost sm" type="button" onClick={() => void selectApplication(item)}>عرض</button></td></>}
      />
      <AdminPagination page={page} pageSize={25} total={total} onPageChange={(nextPage) => void load(nextPage)} />
    </AdminPageSection>
    {selected ? <AdminDetailDrawer title={selected.full_name} onClose={() => setSelected(null)}>
      <p><strong>العنوان الإداري:</strong> {locationLabel(selected)}</p>
      <p><strong>تاريخ الميلاد:</strong> {selected.birth_date} · <strong>العمر بالسنوات:</strong> {ageLabel(selected.age_years)} · <strong>مكان الميلاد:</strong> {selected.birth_place}</p>
      <p><strong>الهاتف:</strong> {selected.phone} · <strong>الموقع المفضل:</strong> {selected.preferred_location}</p>
      <p><strong>العربية:</strong> {selected.arabic_read} / {selected.arabic_write} · <strong>الإنكليزية:</strong> {selected.english_read} / {selected.english_write}</p>
      <p><strong>تدريب أمني سابق:</strong> {selected.security_training ? "نعم" : "لا"} {selected.security_training_details || ""}</p>
      <p><strong>خبرة NGOs:</strong> {selected.ngo_experience ? "نعم" : "لا"} {selected.ngo_details || ""}</p>
      <p><strong>الملاحظات:</strong> {selected.notes || "—"}</p>
      <label>الحالة<select disabled={saving} value={selected.status} onChange={(event) => void update({ status: event.target.value })}>{statuses.map((value) => <option key={value}>{value}</option>)}</select></label>
      <label>المتابعة<select disabled={saving} value={selected.followUpStatus} onChange={(event) => void update({ followUpStatus: event.target.value })}>{followUps.map((value) => <option key={value}>{value}</option>)}</select></label>
      <p><strong>آخر تحديث:</strong> {dateLabel(selected.updatedAt)} · <strong>الإصدار:</strong> {selected.version}</p>
      <h3>السجل</h3>
      <ul>{history.map((entry) => <li key={`${entry.version}-${entry.createdAt}`}>{entry.eventType} · {entry.actorId} · {dateLabel(entry.createdAt)}</li>)}</ul>
    </AdminDetailDrawer> : null}
  </div>;
}
