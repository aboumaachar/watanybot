"use client";
import { useState } from "react";

function card() { return "rounded-2xl border bg-white p-5 shadow-sm"; }
function bigBtn() { return "w-full rounded-2xl px-4 py-5 text-right text-xl border bg-white shadow-sm active:scale-[0.99] transition"; }

export default function Help() {
  const [msg, setMsg] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [caseCode, setCaseCode] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submitCase() {
    setErr(null);
    if (msg.trim().length < 5) { setErr("اكتب سطرين عن المشكلة لو سمحت."); return; }

    setLoading(true);
    try {
      const r = await fetch("/v1/cases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requester_name: name || null,
          requester_phone: phone || null,
          topic_code: null,
          category: "other",
          user_message: msg.trim()
        }),
      });
      if (!r.ok) throw new Error(await r.text());
      const j = await r.json();
      setCaseCode(j.case_code);
      try { localStorage.setItem("last_case_code", j.case_code); } catch {}
    } catch {
      setErr("صار في مشكلة بالإرسال. جرّب مرة تانية.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div dir="rtl" className="min-h-screen bg-gray-100">
      <div className="max-w-3xl mx-auto p-4 pt-8">
        <div className={card()}>
          <div className="text-2xl font-extrabold">🤝 مساعدة فورية</div>
          <div className="opacity-90 mt-2">
            إذا عندك سؤال أو مشكلة وما بدك تضل تفتّش، ابعتلنا طلب متابعة.
          </div>

          {err && <div className="mt-4 rounded-2xl border border-red-400 p-3">{err}</div>}

          {caseCode ? (
            <div className="mt-5 rounded-2xl border p-4">
              <div className="font-extrabold text-xl">✅ تم تسجيل طلبك</div>
              <div className="mt-2">رمز المتابعة:</div>
              <div className="mt-2 text-2xl font-extrabold">{caseCode}</div>
              <div className="opacity-90 mt-2">
                احتفظ بهالرمز. إذا رجعت لعنا، فينا نرجع نفتح نفس الطلب.
              </div>
            </div>
          ) : (
            <div className="mt-5 grid gap-3">
              <input className="rounded-2xl border px-4 py-3 text-lg" placeholder="اسمك (اختياري)" value={name} onChange={(e)=>setName(e.target.value)} />
              <input className="rounded-2xl border px-4 py-3 text-lg" placeholder="رقم تلفون (اختياري)" value={phone} onChange={(e)=>setPhone(e.target.value)} />
              <textarea className="rounded-2xl border px-4 py-3 text-lg min-h-[120px]" placeholder="اكتب مشكلتك أو سؤالك…" value={msg} onChange={(e)=>setMsg(e.target.value)} />

              <button className={bigBtn()} onClick={submitCase} disabled={loading}>
                {loading ? "…عم نرسل" : "📩 سجّل طلب متابعة"}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
