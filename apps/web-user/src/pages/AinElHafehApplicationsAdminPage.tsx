import { FormEvent, useEffect, useMemo, useState } from "react";
import { authFetch } from "../lib/api";

type ApplicationRow = {
  id: string;
  name?: string | null;
  phone?: string | null;
  email?: string | null;
  age?: string | null;
  gender?: string | null;
  governorate_ar?: string | null;
  caza_ar?: string | null;
  village_ar?: string | null;
  availability?: string | null;
  preferred_period?: string | null;
  weekend_work?: string | null;
  weighted_score?: number | null;
  status?: string | null;
  follow_up_status?: string | null;
  admin_notes?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

type ListResponse = {
  items: ApplicationRow[];
  total: number;
};

const STATUS_OPTIONS = ["PENDING","APPROVED","REJECTED"];
const FOLLOW_UP_OPTIONS = ["NOT_CONTACTED","TO_CONTACT","CONTACTED","CONFIRMED","NO_RESPONSE","WITHDRAWN"];

export default function AinElHafehApplicationsAdminPage() {
  const [items,setItems] = useState<ApplicationRow[]>([]);
  const [total,setTotal] = useState(0);
  const [q,setQ] = useState("");
  const [status,setStatus] = useState("");
  const [loading,setLoading] = useState(false);
  const [error,setError] = useState("");
  const [selected,setSelected] = useState<ApplicationRow | null>(null);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams();
      if (q) params.set("q",q);
      if (status) params.set("status",status);
      params.set("limit","200");
      const res = await authFetch(`/api/superadmin/ainelhafeh/applications?${params.toString()}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json() as ListResponse;
      setItems(data.items ?? []);
      setTotal(data.total ?? 0);
    } catch (e) {
      setError(e instanceof Error ? e.message : "تعذر تحميل الطلبات");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  const approved = useMemo(() => items.filter(x => x.status === "APPROVED").length,[items]);
  const pending = useMemo(() => items.filter(x => !x.status || x.status === "PENDING").length,[items]);
  const rejected = useMemo(() => items.filter(x => x.status === "REJECTED").length,[items]);

  async function updateApplication(id:string, patch:Record<string,unknown>) {
    const res = await authFetch(`/api/superadmin/ainelhafeh/applications/${encodeURIComponent(id)}`,{
      method:"PATCH",
      headers:{"content-type":"application/json"},
      body:JSON.stringify(patch)
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json() as { item: ApplicationRow };
    setItems(prev => prev.map(x => x.id === id ? data.item : x));
    setSelected(data.item);
  }

  async function onFilterSubmit(e:FormEvent) {
    e.preventDefault();
    await load();
  }

  return (
    <main dir="rtl" style={{padding:"24px",display:"grid",gap:"20px"}}>
      <header>
        <h1>إدارة طلبات قطاف التفاح – عين الحافة</h1>
        <p>مراجعة الطلبات، القبول أو الرفض، وإدارة المتابعة.</p>
      </header>

      <section style={{display:"grid",gridTemplateColumns:"repeat(4,minmax(0,1fr))",gap:"12px"}}>
        <div><strong>{total}</strong><div>جميع الطلبات</div></div>
        <div><strong>{pending}</strong><div>قيد المراجعة</div></div>
        <div><strong>{approved}</strong><div>مقبول</div></div>
        <div><strong>{rejected}</strong><div>مرفوض</div></div>
      </section>

      <form onSubmit={onFilterSubmit} style={{display:"flex",gap:"8px",flexWrap:"wrap"}}>
        <input value={q} onChange={e=>setQ(e.target.value)} placeholder="بحث بالاسم أو الهاتف أو البريد" />
        <select value={status} onChange={e=>setStatus(e.target.value)}>
          <option value="">كل الحالات</option>
          {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <button type="submit">بحث</button>
      </form>

      {loading ? <p>جارٍ تحميل الطلبات…</p> : null}
      {error ? <p role="alert">{error}</p> : null}

      <section style={{overflowX:"auto"}}>
        <table style={{width:"100%",borderCollapse:"collapse"}}>
          <thead>
            <tr>
              <th>الاسم</th><th>الهاتف</th><th>البلدة</th><th>التقييم</th><th>الحالة</th><th>المتابعة</th><th>إجراء</th>
            </tr>
          </thead>
          <tbody>
            {items.map(item => (
              <tr key={item.id}>
                <td>{item.name ?? ""}</td>
                <td>{item.phone ?? ""}</td>
                <td>{item.village_ar ?? ""}</td>
                <td>{item.weighted_score ?? ""}</td>
                <td>{item.status ?? "PENDING"}</td>
                <td>{item.follow_up_status ?? "NOT_CONTACTED"}</td>
                <td><button type="button" onClick={()=>setSelected(item)}>عرض</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {selected ? (
        <section style={{border:"1px solid #ccc",padding:"16px",display:"grid",gap:"12px"}}>
          <h2>{selected.name}</h2>
          <div>الهاتف: {selected.phone}</div>
          <div>البريد: {selected.email}</div>
          <div>العمر: {selected.age}</div>
          <div>الموقع: {[selected.governorate_ar,selected.caza_ar,selected.village_ar].filter(Boolean).join(" / ")}</div>
          <div>التوفر: {selected.availability}</div>
          <div>الفترة المفضلة: {selected.preferred_period}</div>
          <div>العمل في نهاية الأسبوع: {selected.weekend_work}</div>
          <div>التقييم: {selected.weighted_score}</div>

          <label>
            <span>حالة المتابعة</span>
            <select
              value={selected.follow_up_status ?? "NOT_CONTACTED"}
              onChange={e=>void updateApplication(selected.id,{follow_up_status:e.target.value})}
            >
              {FOLLOW_UP_OPTIONS.map(s=><option key={s} value={s}>{s}</option>)}
            </select>
          </label>

          <label>
            <span>ملاحظات الإدارة</span>
            <textarea
              value={selected.admin_notes ?? ""}
              onChange={e=>setSelected({...selected,admin_notes:e.target.value})}
            />
          </label>

          <div style={{display:"flex",gap:"8px",flexWrap:"wrap"}}>
            <button type="button" onClick={()=>void updateApplication(selected.id,{status:"APPROVED",admin_notes:selected.admin_notes ?? ""})}>قبول الطلب</button>
            <button type="button" onClick={()=>void updateApplication(selected.id,{status:"REJECTED",admin_notes:selected.admin_notes ?? ""})}>رفض الطلب</button>
            <button type="button" onClick={()=>void updateApplication(selected.id,{status:"PENDING",admin_notes:selected.admin_notes ?? ""})}>إعادة للمراجعة</button>
          </div>
        </section>
      ) : null}
    </main>
  );
}
