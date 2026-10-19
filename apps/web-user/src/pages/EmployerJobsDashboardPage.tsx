import { useEffect, useState } from "react";
import { authFetch } from "../lib/api";
import { useApp } from "../store/app";

type Job = { id:string; title:string; slug:string; organization_name:string; status:string; application_count:number; };
type Summary = { total_jobs:number; published_jobs:number; draft_jobs:number; total_applications:number };

export default function EmployerJobsDashboardPage() {
  const { apiBaseUrl, profile } = useApp();
  const [jobs,setJobs]=useState<Job[]>([]), [summary,setSummary]=useState<Summary|null>(null);
  const [access,setAccess]=useState<any>(undefined), [message,setMessage]=useState("");
  const isAdmin=profile.role==="admin"||profile.role==="superadmin";
  async function load(){
    if(!isAdmin){const r=await authFetch(`${apiBaseUrl}/api/jobs/employer-access/me`); setAccess(r.ok?(await r.json()).item??null:null);} else setAccess({status:"APPROVED"});
    const [jr,sr]=await Promise.all([authFetch(`${apiBaseUrl}/api/jobs/builder/jobs/mine`),authFetch(`${apiBaseUrl}/api/jobs/builder/summary`)]);
    if(jr.ok)setJobs((await jr.json()).items??[]); if(sr.ok)setSummary((await sr.json()).summary??null);
  }
  useEffect(()=>{void load();},[apiBaseUrl]);
  async function status(id:string,next:string){const r=await authFetch(`${apiBaseUrl}/api/jobs/builder/jobs/${id}/status`,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({status:next})});setMessage(r.ok?"تم تحديث حالة الوظيفة.":"تعذّر تحديث الحالة.");if(r.ok)await load();}
  async function duplicate(id:string){const r=await authFetch(`${apiBaseUrl}/api/jobs/builder/jobs/${id}/duplicate`,{method:"POST"});setMessage(r.ok?"تم إنشاء نسخة كمسودة.":"تعذّر إنشاء نسخة.");if(r.ok)await load();}
  if(access===undefined)return <main className="page-shell" dir="rtl">جارٍ التحميل…</main>;
  if(!isAdmin&&access?.status!=="APPROVED")return <main className="page-shell" dir="rtl"><section className="profile-section-card"><h1>لوحة وظائف صاحب العمل</h1><p>تحتاج إلى اعتماد حساب جهة العمل قبل إنشاء الوظائف.</p><a className="btn btn-primary" href="/jobs/candidates">طلب الاعتماد / عرض الحالة</a></section></main>;
  return <main className="page-shell" dir="rtl">
    <section className="profile-section-card"><div className="flex flex-wrap items-center justify-between gap-3"><div><h1>لوحة وظائف صاحب العمل</h1><p>أنشئ الوظيفة ونموذج التقديم وتابع المتقدمين من لوحة واحدة.</p></div><a className="btn btn-primary" href="/jobs/employer/builder/new">إنشاء وظيفة جديدة</a></div></section>
    <section className="grid gap-3 md:grid-cols-4"><article className="profile-section-card"><strong>{summary?.total_jobs??0}</strong><p>إجمالي الوظائف</p></article><article className="profile-section-card"><strong>{summary?.published_jobs??0}</strong><p>منشورة</p></article><article className="profile-section-card"><strong>{summary?.draft_jobs??0}</strong><p>مسودات</p></article><article className="profile-section-card"><strong>{summary?.total_applications??0}</strong><p>طلبات التقديم</p></article></section>
    {message?<p aria-live="polite">{message}</p>:null}
    <section className="profile-section-card space-y-3"><h2>الوظائف</h2>{jobs.length===0?<p>لا توجد وظائف بعد.</p>:null}{jobs.map(job=><article key={job.id} className="utility-action-card utility-action-card--static space-y-2"><div><strong>{job.title}</strong><p>{job.organization_name} · {job.status} · {job.application_count} طلب</p></div><div className="flex flex-wrap gap-2"><a className="btn" href={`/jobs/employer/builder/${job.id}`}>تعديل النموذج</a><a className="btn" href={`/jobs/employer/jobs/${job.id}/applications`}>طلبات التقديم</a>{job.status==="PUBLISHED"?<a className="btn" href={`/jobs/opportunities/${job.slug}`}>عرض الإعلان</a>:null}{job.status!=="PUBLISHED"?<button className="btn btn-primary" onClick={()=>void status(job.id,"PUBLISHED")}>نشر</button>:<button className="btn" onClick={()=>void status(job.id,"CLOSED")}>إغلاق</button>}<button className="btn" onClick={()=>void duplicate(job.id)}>نسخ كقالب جديد</button></div></article>)}</section>
  </main>;
}