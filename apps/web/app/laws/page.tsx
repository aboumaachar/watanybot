"use client";
import { useState } from "react";

type Law = { law_code: string; article_no: string; title_ar?: string; text_ar: string; tags_json: string[] };

function card() { return "rounded-2xl border bg-white p-5 shadow-sm"; }

export default function Laws() {
  const [q, setQ] = useState("");
  const [res, setRes] = useState<Law[]>([]);
  const [loading, setLoading] = useState(false);

  async function search() {
    if (!q.trim()) return;
    setLoading(true);
    try {
      const r = await fetch(`/v1/kb/laws/search?q=${encodeURIComponent(q.trim())}`);
      if (r.ok) setRes(await r.json());
    } finally {
      setLoading(false);
    }
  }

  return (
    <div dir="rtl" className="min-h-screen bg-gray-100">
      <div className="max-w-3xl mx-auto p-4 pt-8">
        <div className={card()}>
          <div className="text-2xl font-extrabold">⚖️ القوانين والمواد</div>
          <div className="opacity-90 mt-2">اكتب كلمة بسيطة مثل: "طبابة" أو "معاش" أو "تعويض".</div>

          <div className="mt-4 flex gap-2">
            <input
              className="flex-1 rounded-2xl border px-4 py-3 text-lg"
              placeholder="ابحث…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
            <button className="rounded-2xl border px-4 py-3 bg-white shadow-sm" onClick={search}>
              {loading ? "…" : "بحث"}
            </button>
          </div>

          <div className="mt-5 grid gap-3">
            {res.map((x, i) => (
              <details key={i} className="rounded-2xl border p-4">
                <summary className="font-extrabold cursor-pointer">
                  {x.law_code} - المادة {x.article_no} {x.title_ar ? `— ${x.title_ar}` : ""}
                </summary>
                <div className="mt-3 opacity-90 whitespace-pre-wrap">{x.text_ar}</div>
              </details>
            ))}
            {res.length === 0 && <div className="opacity-80">ما في نتائج بعد.</div>}
          </div>
        </div>
      </div>
    </div>
  );
}
