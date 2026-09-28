import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";

type SharedApplication = {
  id: string;
  full_name: string;
  birth_date: string;
  birth_place: string;
  address: string | null;
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
  status: string;
  followUpStatus: string;
  createdAt: string;
  updatedAt: string;
};

type ShareResponse = {
  items: SharedApplication[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  summary: { total: number; pending: number; approved: number; rejected: number };
};

const label = "ميدل إيست سيكوريتي لبنان";
const dateLabel = (value: string) => new Date(value).toLocaleString("ar-LB");

export default function MiddleEastSecuritySharePage() {
  const { shareToken = "" } = useParams<{ shareToken: string }>();
  const [data, setData] = useState<ShareResponse | null>(null);
  const [selected, setSelected] = useState<SharedApplication | null>(null);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [followUpStatus, setFollowUpStatus] = useState("");
  const [page, setPage] = useState(1);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const apiRoot = `/api/share/jobs/middle-east-security/${encodeURIComponent(shareToken)}`;
  const exportHref = useMemo(() => {
    const params = new URLSearchParams();
    if (query.trim()) params.set("q", query.trim());
    if (status) params.set("status", status);
    if (followUpStatus) params.set("follow_up_status", followUpStatus);
    const suffix = params.toString();
    return `${apiRoot}/export.xlsx${suffix ? `?${suffix}` : ""}`;
  }, [apiRoot, followUpStatus, query, status]);

  useEffect(() => {
    document.title = `${label} — الطلبات المشتركة`;
    const meta = document.querySelector('meta[name="robots"]') || document.createElement("meta");
    meta.setAttribute("name", "robots");
    meta.setAttribute("content", "noindex, nofollow");
    document.head.appendChild(meta);
    const referrer = document.querySelector('meta[name="referrer"]') || document.createElement("meta");
    referrer.setAttribute("name", "referrer");
    referrer.setAttribute("content", "no-referrer");
    document.head.appendChild(referrer);
    const cache = document.querySelector('meta[http-equiv="Cache-Control"]') || document.createElement("meta");
    cache.setAttribute("http-equiv", "Cache-Control");
    cache.setAttribute("content", "no-store");
    document.head.appendChild(cache);
    return () => {
      if (meta.parentElement) meta.parentElement.removeChild(meta);
      if (referrer.parentElement) referrer.parentElement.removeChild(referrer);
      if (cache.parentElement) cache.parentElement.removeChild(cache);
    };
  }, []);

  async function load(nextPage = 1) {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams();
      params.set("page", String(nextPage));
      params.set("page_size", "25");
      if (query.trim()) params.set("q", query.trim());
      if (status) params.set("status", status);
      if (followUpStatus) params.set("follow_up_status", followUpStatus);
      const response = await fetch(`${apiRoot}/applications${params.toString() ? `?${params}` : ""}`);
      if (!response.ok) throw new Error(response.status === 404 ? "رابط المشاركة غير صالح أو منتهي." : "تعذر تحميل الطلبات.");
      const next = await response.json() as ShareResponse;
      setData(next);
      setPage(next.page);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "تعذر تحميل الطلبات.");
      setData(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(1); }, [shareToken]);

  return (
    <main className="ainmreisseh-page" dir="rtl" data-mes-share-read-only="true">
      <section className="ainmreisseh-section">
        <header className="ainmreisseh-hero__content">
          <p className="ainmreisseh-kicker">{label}</p>
          <h1>الطلبات المشتركة — {label}</h1>
          <p className="ainmreisseh-lead">عرض قراءة فقط للطلبات المصرح بمشاركتها.</p>
        </header>
        {error ? <p className="ainmreisseh-message ainmreisseh-message--error" role="alert">{error}</p> : null}
        {data ? (
          <>
            <div className="ainmreisseh-admin__stats" aria-label="ملخص الطلبات">
              <div className="ainmreisseh-admin__stat"><strong>{data.summary.total}</strong><span>الإجمالي</span></div>
              <div className="ainmreisseh-admin__stat"><strong>{data.summary.pending}</strong><span>قيد المراجعة</span></div>
              <div className="ainmreisseh-admin__stat"><strong>{data.summary.approved}</strong><span>مقبول</span></div>
              <div className="ainmreisseh-admin__stat"><strong>{data.summary.rejected}</strong><span>مرفوض</span></div>
            </div>
            <div className="ainmreisseh-admin__filters">
              <label><span>بحث</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="الاسم أو الهاتف أو المرجع" /></label>
              <label><span>الحالة</span><select value={status} onChange={(event) => setStatus(event.target.value)}><option value="">كل الحالات</option><option value="pending">pending</option><option value="approved">approved</option><option value="rejected">rejected</option></select></label>
              <label><span>المتابعة</span><select value={followUpStatus} onChange={(event) => setFollowUpStatus(event.target.value)}><option value="">كل المتابعة</option><option value="not_contacted">not_contacted</option><option value="to_contact">to_contact</option><option value="contacted">contacted</option></select></label>
              <button type="button" onClick={() => void load(1)}>تطبيق</button>
            </div>
            <p><a className="ainmreisseh-submit" href={exportHref} download>تصدير الطلبات / Export Applications</a></p>
            {loading ? <p aria-live="polite">جارٍ التحميل…</p> : null}
            <div className="ainmreisseh-admin__table-wrap">
              <table>
                <thead><tr><th>المرجع</th><th>الاسم</th><th>العنوان الإداري</th><th>الهاتف</th><th>الحالة</th><th>التقديم</th><th>عرض</th></tr></thead>
                <tbody>{data.items.map((item) => <tr key={item.id}><td>{item.id}</td><td>{item.full_name}</td><td>{[item.village, item.caza, item.mohafaza].filter(Boolean).join("، ") || item.address || "—"}</td><td>{item.phone}</td><td>{item.status}</td><td>{dateLabel(item.createdAt)}</td><td><button type="button" onClick={() => setSelected(item)}>عرض</button></td></tr>)}</tbody>
              </table>
            </div>
            <nav aria-label="صفحات الطلبات" className="ainmreisseh-admin__detail-controls">
              <button type="button" disabled={page <= 1 || loading} onClick={() => void load(page - 1)}>السابق</button>
              <span>صفحة {data.page} من {Math.max(data.totalPages, 1)} · {data.total} طلب</span>
              <button type="button" disabled={page >= data.totalPages || loading} onClick={() => void load(page + 1)}>التالي</button>
            </nav>
          </>
        ) : null}
        {selected ? <article className="ainmreisseh-admin__detail" aria-label="تفاصيل الطلب المشتركة">
          <h2>{selected.full_name}</h2>
          <dl>
            <dt>المرجع</dt><dd>{selected.id}</dd>
            <dt>الاسم الكامل</dt><dd>{selected.full_name}</dd>
            <dt>تاريخ الميلاد</dt><dd>{selected.birth_date}</dd>
            <dt>مكان الميلاد</dt><dd>{selected.birth_place}</dd>
            <dt>المحافظة</dt><dd>{selected.mohafaza || "—"}</dd>
            <dt>القضاء</dt><dd>{selected.caza || "—"}</dd>
            <dt>القرية</dt><dd>{selected.village || "—"}</dd>
            {!selected.mohafaza && !selected.caza && !selected.village ? <><dt>العنوان التاريخي</dt><dd>{selected.address || "—"}</dd></> : null}
            <dt>الهاتف</dt><dd>{selected.phone}</dd>
            <dt>الموقع المفضل</dt><dd>{selected.preferred_location}</dd>
            <dt>العربية قراءة</dt><dd>{selected.arabic_read}</dd>
            <dt>العربية كتابة</dt><dd>{selected.arabic_write}</dd>
            <dt>الإنكليزية قراءة</dt><dd>{selected.english_read}</dd>
            <dt>الإنكليزية كتابة</dt><dd>{selected.english_write}</dd>
            <dt>تدريب أمني سابق</dt><dd>{selected.security_training ? "نعم" : "لا"}</dd>
            {selected.security_training_details ? <><dt>تفاصيل التدريب الأمني</dt><dd>{selected.security_training_details}</dd></> : null}
            <dt>خبرة مع منظمات غير حكومية</dt><dd>{selected.ngo_experience ? "نعم" : "لا"}</dd>
            {selected.ngo_details ? <><dt>تفاصيل خبرة NGOs</dt><dd>{selected.ngo_details}</dd></> : null}
            <dt>ملاحظات المتقدم</dt><dd>{selected.notes || "—"}</dd>
            <dt>الحالة</dt><dd>{selected.status}</dd>
            <dt>حالة المتابعة</dt><dd>{selected.followUpStatus}</dd>
            <dt>تاريخ التقديم</dt><dd>{dateLabel(selected.createdAt)}</dd>
            <dt>آخر تحديث</dt><dd>{dateLabel(selected.updatedAt)}</dd>
          </dl>
        </article> : null}
      </section>
    </main>
  );
}
