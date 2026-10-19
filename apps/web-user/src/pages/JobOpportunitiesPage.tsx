import { useEffect, useState } from "react";
import { useApp } from "../store/app";

export default function JobOpportunitiesPage(){
 const {apiBaseUrl}=useApp(); const [items,setItems]=useState<any[]>([]),[q,setQ]=useState('');
 useEffect(()=>{fetch(`${apiBaseUrl}/api/jobs/opportunities`,{credentials:'include'}).then(async r=>{if(r.ok)setItems((await r.json()).items??[]);}).catch(()=>undefined);},[apiBaseUrl]);
 const visible=items.filter(x=>!q.trim()||[x.title,x.organization_name,x.summary,x.governorate,x.caza,x.locality].some((v:any)=>String(v||'').toLowerCase().includes(q.trim().toLowerCase())));
 return <main className="page-shell" dir="rtl"><section className="profile-section-card"><h1>وظائف أصحاب العمل</h1><p>فرص منشورة من جهات عمل معتمدة ومن إدارة موطني.</p><input className="input" placeholder="ابحث عن وظيفة أو شركة أو منطقة" value={q} onChange={e=>setQ(e.target.value)}/></section><section className="grid gap-3 md:grid-cols-2">{visible.length===0?<article className="profile-section-card">لا توجد فرص مطابقة حالياً.</article>:null}{visible.map(item=><article key={item.id} className="profile-section-card space-y-2"><strong>{item.title}</strong><p>{item.organization_name}</p><p>{[item.locality,item.caza,item.governorate].filter(Boolean).join('، ')}</p>{item.summary?<p>{item.summary}</p>:null}<div className="flex flex-wrap gap-2"><span>{item.employment_type||''}</span><span>{item.work_mode||''}</span><span>{item.salary_text||''}</span></div><a className="btn btn-primary" href={`/jobs/opportunities/${item.slug}`}>عرض الوظيفة والتقديم</a></article>)}</section></main>;
}