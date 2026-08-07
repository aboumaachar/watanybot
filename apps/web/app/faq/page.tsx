"use client";
import { useEffect, useState } from "react";

type FAQ = {
  faq_id: number;
  question_ar: string;
  answer_ar: string;
  topic_code: string | null;
  hits_total: number;
  last_asked_at: string | null;
};

function card(){ return "rounded-2xl border bg-white p-5 shadow-sm"; }
function bigBtn(){ return "w-full rounded-2xl px-4 py-5 text-right text-xl border bg-white shadow-sm active:scale-[0.99] transition"; }

export default function FAQPage(){
  const [list, setList] = useState<FAQ[]>([]);
  const [q, setQ] = useState("");
  const [answer, setAnswer] = useState<{matched: boolean; question_ar?: string; answer_ar?: string} | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(()=>{
    (async()=>{
      const r = await fetch("/v1/faq/popular?limit=20");
      if(r.ok) setList(await r.json());
    })();
  },[]);

  async function askFAQ(){
    if(!q.trim()) return;
    setLoading(true);
    setAnswer(null);
    try {
      const r = await fetch("/v1/faq/ask", {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({text: q.trim()})
      });
      if(r.ok){
        const j = await r.json();
        setAnswer(j);
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div dir="rtl" className="min-h-screen bg-gray-100">
      <div className="max-w-3xl mx-auto p-4 pt-8">
        <div className={card()}>
          <div className="text-2xl font-extrabold">❓ الأسئلة الشائعة</div>
          <div className="opacity-90 mt-2">اكتب سؤالك أو تصفّح الأسئلة الأكثر شيوعاً.</div>

          <div className="mt-4 flex gap-2">
            <input
              className="flex-1 rounded-2xl border px-4 py-3 text-lg"
              placeholder="اكتب سؤالك…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && askFAQ()}
            />
            <button className="rounded-2xl border px-4 py-3 bg-white shadow-sm" onClick={askFAQ}>
              {loading ? "…" : "اسأل"}
            </button>
          </div>

          {answer && (
            <div className="mt-4 rounded-2xl border p-4">
              {answer.matched ? (
                <>
                  <div className="font-extrabold text-lg">✅ {answer.question_ar}</div>
                  <div className="mt-2 opacity-90 whitespace-pre-wrap">{answer.answer_ar}</div>
                </>
              ) : (
                <div className="opacity-90">
                  ما لقينا جواب جاهز. جرّب صياغة تانية أو <a href="/help" className="underline">ابعت طلب متابعة</a>.
                </div>
              )}
            </div>
          )}

          <div className="mt-6 font-extrabold text-lg">📊 الأكثر شيوعاً</div>
          <div className="mt-3 grid gap-3">
            {list.map((f) => (
              <details key={f.faq_id} className="rounded-2xl border p-4">
                <summary className="font-extrabold cursor-pointer">{f.question_ar}</summary>
                <div className="mt-3 opacity-90 whitespace-pre-wrap">{f.answer_ar}</div>
              </details>
            ))}
            {list.length === 0 && <div className="opacity-80">ما في أسئلة شائعة حالياً.</div>}
          </div>

          <a className={bigBtn() + " mt-5 block text-center"} href="/faq/suggested">
            💡 اقتراحات FAQ (للإدارة)
          </a>

          <a className={bigBtn() + " mt-3 block text-center"} href="/faq/drafts">
            🛠️ مسودات FAQ (تلقائية)
          </a>

          <a className={bigBtn() + " mt-3 block text-center"} href="/faq/priority">
            🧭 لوحة الأولويات
          </a>

          <a className={bigBtn() + " mt-3 block text-center"} href="/faq/review">
            📊 لوحة عمل المراجعين
          </a>

          <a className={bigBtn() + " mt-3 block text-center"} href="/">
            ⬅️ رجوع للرئيسية
          </a>
        </div>
      </div>
    </div>
  )
}
