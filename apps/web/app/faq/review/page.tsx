"use client";
import { useEffect, useState } from "react";

type Work = {
  reviewer_name: string;
  review_status: string;
  drafts_count: number;
  max_hits: number;
  last_activity?: string | null;
};

type QueueItem = {
  faq_id: number;
  question_ar: string;
  topic_code?: string | null;
  reviewer_name?: string | null;
  review_status: string;
  hits_total: number;
  last_asked_at?: string | null;
  has_refs: boolean;
  has_official: boolean;
  priority: "normal" | "urgent";
};

function card(){ return "rounded-2xl border bg-white p-5 shadow-sm"; }
function badge(txt:string){
  return "inline-block px-3 py-1 rounded-full border text-sm bg-white";
}
function btn(){ return "rounded-2xl border px-4 py-2 bg-white shadow-sm active:scale-[0.99] transition"; }

export default function ReviewDashboard(){
  const [work, setWork] = useState<Work[]>([]);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [urgentHits, setUrgentHits] = useState<number>(50);

  async function load(){
    const w = await fetch("/v1/faq/review/workload");
    if(w.ok) setWork(await w.json());

    const q = await fetch(`/v1/faq/review/queue?limit=40&urgent_hits=${urgentHits}&overdue_days=14`);
    if(q.ok) setQueue(await q.json());
  }

  useEffect(()=>{ load(); },[urgentHits]);

  return (
    <div dir="rtl" className="min-h-screen bg-gray-100">
      <div className="max-w-5xl mx-auto p-4 pt-8">
        <div className={card()}>
          <div className="text-2xl font-extrabold">📊 لوحة عمل المراجعين</div>
          <div className="opacity-90 mt-2">
            توزيع المسودات حسب المراجع والحالة + قائمة الأولويات.
          </div>

          <div className="mt-4 flex flex-wrap gap-2 items-center">
            <div className="opacity-80">أولوية قصوى عند تكرار ≥</div>
            <input
              className="rounded-2xl border px-3 py-2 w-24 bg-white"
              type="number"
              value={urgentHits}
              onChange={(e)=>setUrgentHits(parseInt(e.target.value || "50",10))}
            />
            <a className={btn()} href="/faq/drafts">🛠️ المسودات</a>
            <a className={btn()} href="/faq/priority">🧭 الأولويات</a>
            <a className={btn()} href="/faq">⬅️ FAQ</a>
          </div>

          <div className="mt-6">
            <div className="font-extrabold text-xl">👥 توزيع العمل</div>
            <div className="mt-3 overflow-x-auto">
              <table className="min-w-full border rounded-2xl overflow-hidden bg-white">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="p-3 text-right">المراجع</th>
                    <th className="p-3 text-right">الحالة</th>
                    <th className="p-3 text-right">عدد المسودات</th>
                    <th className="p-3 text-right">أعلى تكرار</th>
                    <th className="p-3 text-right">آخر نشاط</th>
                  </tr>
                </thead>
                <tbody>
                  {work.map((x,i)=>(
                    <tr key={i} className="border-t">
                      <td className="p-3">{x.reviewer_name}</td>
                      <td className="p-3">{x.review_status}</td>
                      <td className="p-3">{x.drafts_count}</td>
                      <td className="p-3">{x.max_hits}</td>
                      <td className="p-3">{x.last_activity || "-"}</td>
                    </tr>
                  ))}
                  {work.length===0 && (
                    <tr><td className="p-3 opacity-70" colSpan={5}>لا بيانات حالياً.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="mt-8">
            <div className="font-extrabold text-xl">🔥 قائمة الأولويات (Drafts)</div>
            <div className="opacity-80 mt-1">الأعلى تكراراً أولاً. "urgent" يعني لازم تنحسم بسرعة.</div>

            <div className="mt-3 grid gap-3">
              {queue.map((x,i)=>(
                <div key={i} className="rounded-2xl border p-4">
                  <div className="flex flex-wrap gap-2 items-center">
                    <span className={badge(x.priority==="urgent" ? "🔥 urgent" : "normal")}>{x.priority==="urgent" ? "🔥 urgent" : "normal"}</span>
                    <span className={badge(`تكرار: ${x.hits_total}`)}>تكرار: {x.hits_total}</span>
                    <span className={badge(x.topic_code ? `Topic: ${x.topic_code}` : "Topic: -")}>{x.topic_code ? `Topic: ${x.topic_code}` : "Topic: -"}</span>
                    <span className={badge(x.reviewer_name ? `مراجع: ${x.reviewer_name}` : "غير معيّن")}>{x.reviewer_name ? `مراجع: ${x.reviewer_name}` : "غير معيّن"}</span>
                    <span className={badge(`حالة: ${x.review_status}`)}>حالة: {x.review_status}</span>
                    <span className={badge(x.has_refs ? "Refs ✅" : "Refs ❌")}>{x.has_refs ? "Refs ✅" : "Refs ❌"}</span>
                    <span className={badge(x.has_official ? "Official ✅" : "Official ❌")}>{x.has_official ? "Official ✅" : "Official ❌"}</span>
                  </div>

                  <div className="mt-3 font-extrabold text-lg">{x.question_ar}</div>
                  <div className="opacity-80 mt-1">آخر مرة: {x.last_asked_at || "-"}</div>

                  <div className="mt-3 flex flex-wrap gap-2">
                    <a className={btn()} href="/faq/drafts">افتح في المسودات</a>
                  </div>
                </div>
              ))}
              {queue.length===0 && <div className="opacity-80">ما في عناصر حالياً.</div>}
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}
