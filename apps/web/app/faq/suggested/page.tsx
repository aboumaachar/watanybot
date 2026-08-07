"use client";
import { useEffect, useState } from "react";

type Suggested = {
  question_norm: string;
  count: number;
  last_asked_at: string;
  examples: string[];
};

function card(){ return "rounded-2xl border bg-white p-5 shadow-sm"; }
function btn(){ return "rounded-2xl border px-4 py-2 bg-white shadow-sm active:scale-[0.99] transition"; }

export default function SuggestedPage(){
  const [list, setList] = useState<Suggested[]>([]);
  const [busy, setBusy] = useState<string>("");

  async function load(){
    const r = await fetch("/v1/faq/suggested?limit=50&examples_per_item=3");
    if(r.ok) setList(await r.json());
  }

  useEffect(()=>{ load(); },[]);

  async function createDraft(item: Suggested){
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
    if(res.ok){
      const j = await res.json();
      // روح مباشرة على drafts
      window.location.href = "/faq/drafts";
    }
  }

  return (
    <div dir="rtl" className="min-h-screen bg-gray-100">
      <div className="max-w-4xl mx-auto p-4 pt-8">
        <div className={card()}>
          <div className="text-2xl font-extrabold">💡 اقتراحات (أسئلة بلا جواب جاهز)</div>
          <div className="opacity-90 mt-2">حوّل السؤال لمسودة ثم كمّل: إحالات → جواب مبسّط → مراجعة → نشر.</div>

          <div className="mt-5 grid gap-3">
            {list.map((x, i)=>(
              <div key={i} className="rounded-2xl border p-4">
                <div className="font-extrabold text-lg">({x.count}) — {x.question_norm}</div>
                <div className="opacity-80 mt-1">آخر مرة: {x.last_asked_at}</div>

                <div className="mt-2 opacity-90">
                  <b>أمثلة:</b>
                  <ul className="list-disc pr-6 mt-1">
                    {x.examples.map((e, idx)=><li key={idx}>{e}</li>)}
                  </ul>
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  <button className={btn()} disabled={busy===x.question_norm} onClick={()=>createDraft(x)}>
                    ➕ حوّل لمسودة Draft
                  </button>
                  <a className={btn()} href="/faq/drafts">🛠️ افتح المسودات</a>
                </div>
              </div>
            ))}

            {list.length===0 && <div className="opacity-80">ما في اقتراحات حالياً.</div>}

            <div className="grid gap-2 mt-2">
              <a className="rounded-2xl border px-4 py-4 text-right text-xl bg-white shadow-sm" href="/faq">
                ⬅️ رجوع للأسئلة الشائعة
              </a>
              <a className="rounded-2xl border px-4 py-4 text-right text-xl bg-white shadow-sm" href="/faq/priority">
                🧭 لوحة الأولويات
              </a>
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}
