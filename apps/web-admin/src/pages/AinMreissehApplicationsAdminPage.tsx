import { useEffect, useState } from "react";
import { adminFetch, getAdminErrorMessage } from "../lib/api";
import { AdminDataTable, AdminDetailDrawer, AdminErrorState, AdminPageSection, AdminPagination, AdminSearchInput, AdminStatCard, AdminStatusBadge, AdminTableToolbar } from "../components/admin/AdminPrimitives";

type Application = { id: string; name: string; phone: string; age: string; email: string; governorateAr: string; cazaAr: string; villageAr: string; canWorkFullTime: boolean; acceptsSalary600: boolean; wantsHousing: boolean; availableStartDate: string; status: string; followUpStatus: string; adminNotes: string; createdAt: string; updatedAt: string };
type HistoryEntry = { version: number; eventType: string; actorId: string; createdAt: string; snapshot: Pick<Application, "status" | "followUpStatus" | "adminNotes" | "updatedAt"> };
type ListResponse = { items: Application[]; total: number; page: number; pageSize: number; totalPages: number; summary: { total: number; pending: number; approved: number; rejected: number } };
const statuses = ["pending", "approved", "rejected"];
const followUps = ["not_contacted", "to_contact", "contacted", "confirmed", "no_response", "withdrawn"];
const dateLabel = (value: string) => new Date(value).toLocaleString("en-GB");

export default function AinMreissehApplicationsAdminPage() {
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
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [draftStatus, setDraftStatus] = useState("");
  const [draftFollowUpStatus, setDraftFollowUpStatus] = useState("");
  const [draftNotes, setDraftNotes] = useState("");

  async function load(nextPage = page) {
    setLoading(true); setError("");
    try {
      const params = new URLSearchParams({ page: String(nextPage), page_size: "25" });
      if (queryText) params.set("q", queryText);
      if (status) params.set("status", status);
      if (followUpStatus) params.set("follow_up_status", followUpStatus);
      const response = await adminFetch(`/api/superadmin/ain-mreisseh-building-assistant/applications?${params}`);
      const data = await response.json() as ListResponse;
      setItems(data.items ?? []); setTotal(data.total ?? 0); setSummary(data.summary ?? summary); setPage(data.page ?? nextPage);
    } catch (reason) { setError(getAdminErrorMessage(reason, "Unable to load applications.")); } finally { setLoading(false); }
  }

  async function selectApplication(item: Application) {
    setSelected(item); setDraftStatus(item.status); setDraftFollowUpStatus(item.followUpStatus); setDraftNotes(item.adminNotes); setHistory([]);
    try {
      const response = await adminFetch(`/api/superadmin/ain-mreisseh-building-assistant/applications/${encodeURIComponent(item.id)}/history`);
      setHistory((await response.json() as { items?: HistoryEntry[] }).items ?? []);
    } catch (reason) { setError(getAdminErrorMessage(reason, "Unable to load application history.")); }
  }

  async function update(patch: Partial<Application>) {
    if (!selected) return;
    setSaving(true); setError("");
    try {
      const response = await adminFetch(`/api/superadmin/ain-mreisseh-building-assistant/applications/${encodeURIComponent(selected.id)}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...patch, expectedUpdatedAt: selected.updatedAt }) });
      const data = await response.json() as { item: Application };
      setSelected(data.item); setDraftStatus(data.item.status); setDraftFollowUpStatus(data.item.followUpStatus); setDraftNotes(data.item.adminNotes); setItems((current) => current.map((item) => item.id === data.item.id ? data.item : item));
      await selectApplication(data.item);
    } catch (reason) { setError(getAdminErrorMessage(reason, "Unable to save application.")); } finally { setSaving(false); }
  }

  useEffect(() => { void load(1); }, []);
  return <div className="admin-page" dir="rtl">
    <AdminPageSection title="طلبات مساعد مبنى عين المريسة" description="طلبات الحملة وسجل الإدارة غير القابل للتغيير." action={<button className="ghost" type="button" onClick={() => void load()}>تحديث</button>}>
      <div className="admin-stats"><AdminStatCard label="كل الطلبات" value={summary.total} /><AdminStatCard label="قيد المراجعة" value={summary.pending} /><AdminStatCard label="مقبول" value={summary.approved} /><AdminStatCard label="مرفوض" value={summary.rejected} /></div>
      <AdminTableToolbar resultCount={total} onClear={() => { setQueryText(""); setStatus(""); setFollowUpStatus(""); void load(1); }}><AdminSearchInput value={queryText} onChange={setQueryText} placeholder="ابحث بالاسم أو الهاتف أو البريد أو القرية" /><select value={status} onChange={(event) => { setStatus(event.target.value); void load(1); }}><option value="">كل الحالات</option>{statuses.map((value) => <option key={value}>{value}</option>)}</select><select value={followUpStatus} onChange={(event) => { setFollowUpStatus(event.target.value); void load(1); }}><option value="">كل حالات المتابعة</option>{followUps.map((value) => <option key={value}>{value}</option>)}</select><button className="accent" type="button" onClick={() => void load(1)}>بحث</button></AdminTableToolbar>
      {error ? <AdminErrorState message={error} /> : null}
      <AdminDataTable rows={items} columns={["المتقدم", "الهاتف", "الموقع", "الحالة", "المتابعة", "تاريخ التقديم", ""]} loading={loading} empty="لم يتم العثور على طلبات." renderRow={(item) => <><td><strong>{item.name}</strong><div className="muted">{item.email || "لا يوجد بريد"}</div></td><td dir="ltr">{item.phone}</td><td>{[item.governorateAr, item.cazaAr, item.villageAr].filter(Boolean).join(" / ")}</td><td><AdminStatusBadge status={item.status} /></td><td>{item.followUpStatus}</td><td className="muted">{dateLabel(item.createdAt)}</td><td><button className="ghost sm" type="button" onClick={() => void selectApplication(item)}>عرض</button></td></>} />
      <AdminPagination page={page} pageSize={25} total={total} onPageChange={(nextPage) => void load(nextPage)} />
    </AdminPageSection>
    {selected ? <AdminDetailDrawer title={selected.name} onClose={() => setSelected(null)}><p><strong>الهاتف:</strong> {selected.phone}</p><p><strong>البريد الإلكتروني:</strong> {selected.email || "غير متوفر"}</p><p><strong>العمر:</strong> {selected.age}</p><p><strong>الموقع:</strong> {[selected.governorateAr, selected.cazaAr, selected.villageAr].filter(Boolean).join(" / ")}</p><p><strong>دوام كامل:</strong> {selected.canWorkFullTime ? "نعم" : "لا"} | <strong>الراتب:</strong> {selected.acceptsSalary600 ? "نعم" : "لا"} | <strong>السكن:</strong> {selected.wantsHousing ? "نعم" : "لا"}</p><p><strong>تاريخ البدء:</strong> {selected.availableStartDate}</p><p><strong>التقديم:</strong> {dateLabel(selected.createdAt)}<br /><strong>التحديث:</strong> {dateLabel(selected.updatedAt)}</p><label>الحالة<select disabled={saving} value={draftStatus} onChange={(event) => setDraftStatus(event.target.value)}>{statuses.map((value) => <option key={value}>{value}</option>)}</select></label><label>المتابعة<select disabled={saving} value={draftFollowUpStatus} onChange={(event) => setDraftFollowUpStatus(event.target.value)}>{followUps.map((value) => <option key={value}>{value}</option>)}</select></label><label>ملاحظات الإدارة<textarea disabled={saving} value={draftNotes} onChange={(event) => setDraftNotes(event.target.value)} /></label><button className="accent" type="button" disabled={saving} onClick={() => void update({ status: draftStatus, followUpStatus: draftFollowUpStatus, adminNotes: draftNotes })}>حفظ التغييرات</button><h3>السجل غير القابل للتغيير</h3>{history.map((entry) => <div key={`${entry.eventType}-${entry.version}`} className="admin-history-entry"><AdminStatusBadge status={entry.eventType} /><strong>الإصدار {entry.version}</strong><span>{entry.actorId}</span><time>{dateLabel(entry.createdAt)}</time><small>{entry.snapshot.status} / {entry.snapshot.followUpStatus}</small></div>)}</AdminDetailDrawer> : null}
  </div>;
}
