"use client";
import { useEffect, useState } from "react";

type Item = {
  question_norm: string;
  count: number;
  last_asked_at: string;
  examples: string[];
};

function card(){ return "rounded-2xl border bg-white p-5 shadow-sm"; }
function btn(){ return "rounded-2xl border px-4 py-2 bg-white shadow-sm active:scale-[0.99] transition"; }

export default function PriorityPage(){
  const [days, setDays] = useState<number>(7);
  const [tag, setTag] = useState<string>("ALL");
  const [list, setList] = useState<Item[]>([]);
  const [busy, setBusy] = useState<string>("");

  async function load(d:number){
    const q = tag !== "ALL" ? `&tag_filter=${encodeURIComponent(tag)}` : "";
    const r = await fetch(`/v1/faq/priority?window_days=${d}&limit=40&examples_per_item=2${q}`);
    if(r.ok) setList(await r.json());
  }

  useEffect(()=>{ load(days); },[days, tag]);

  async function createDraft(item: Item){
    setBusy(item.question_norm);
    const res = await fetch("/v1/faq/drafts/create_from_suggested", {
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body: JSON.stringify({
        question_norm: item.question_norm,
        question_ar: item.examples?.[0] || null,
        count: item.count,
        last_asked_at: item.last_asked_at
      })
    });
    setBusy("");
    if(res.ok) window.location.href = "/faq/drafts";
  }

  return (
    <div dir="rtl" className="min-h-screen bg-gray-100">
      <div className="max-w-4xl mx-auto p-4 pt-8">
        <div className={card()}>
          <div className="text-2xl font-extrabold">🧭 لوحة الأولويات</div>
          <div className="opacity-90 mt-2">أكثر الأسئلة غير المجابة تداولاً ضمن فترة زمنية.</div>

          <div className="mt-4 flex flex-wrap gap-2">
            <button className={btn()} onClick={()=>setDays(7)}  disabled={days===7}>آخر 7 أيام</button>
            <button className={btn()} onClick={()=>setDays(30)} disabled={days===30}>آخر 30 يوم</button>
            <a className={btn()} href="/faq/drafts">🛠️ المسودات</a>
            <a className={btn()} href="/faq">⬅️ FAQ</a>
          </div>

          <div className="mt-3 flex flex-wrap gap-2 items-center">
            <div className="opacity-80">فلتر:</div>
            <select
              className="rounded-2xl border px-3 py-2 bg-white shadow-sm"
              value={tag}
              onChange={(e)=>setTag(e.target.value)}
            >
              <option value="ALL">الكل</option>
              <option value="pensions">معاش/تقاعد (PENSIONS)</option>
              <option value="salary">رواتب/درجات</option>
              <option value="procedures">معاملات/إجراءات</option>
              <option value="medical">طبابة/استشفاء</option>
              <option value="rights">حقوق/مساعدات</option>
              <option value="education">منح/تعليم</option>
              <option value="allowances">بدلات/متممات</option>
            </select>
          </div>

          <div className="mt-5 grid gap-3">
            {list.map((x,i)=>(
              <div key={i} className="rounded-2xl border p-4">
                <div className="font-extrabold text-lg">({x.count}) — {x.question_norm}</div>
                <div className="opacity-80 mt-1">آخر مرة: {x.last_asked_at}</div>
                <div className="mt-2 opacity-90">
                  <b>أمثلة:</b>
                  <ul className="list-disc pr-6 mt-1">
                    {x.examples.map((e,idx)=><li key={idx}>{e}</li>)}
                  </ul>
                </div>
                <div className="mt-3">
                  <button className={btn()} disabled={busy===x.question_norm} onClick={()=>createDraft(x)}>
                    ➕ حوّل لمسودة واشتغل عليها
                  </button>
                </div>
              </div>
            ))}
            {list.length===0 && <div className="opacity-80">ما في بيانات ضمن هالفترة.</div>}
          </div>
        </div>
      </div>
    </div>
  )
}
