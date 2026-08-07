"use client";

import { useEffect, useMemo, useState } from "react";

type CaseRes = {
  case_code: string;
  status: "open" | "in_progress" | "answered" | "closed" | string;
  user_message: string;
  staff_reply?: string | null;
  created_at: string;
  updated_at: string;
};

function card() {
  return "rounded-2xl border bg-white p-5 shadow-sm";
}
function bigBtn() {
  return "w-full rounded-2xl px-4 py-5 text-right text-xl border bg-white shadow-sm active:scale-[0.99] transition";
}
function smallBtn() {
  return "rounded-2xl border px-4 py-3 bg-white shadow-sm active:scale-[0.99] transition";
}

function statusMeta(s: string) {
  switch (s) {
    case "open":
      return { label: "قيد التسجيل", icon: "🟦", hint: "تم استلام الطلب." };
    case "in_progress":
      return { label: "قيد المتابعة", icon: "🟨", hint: "يتم العمل على الطلب." };
    case "answered":
      return { label: "تم الرد", icon: "🟩", hint: "يوجد رد جاهز." };
    case "closed":
      return { label: "مغلق", icon: "⬛", hint: "تم إغلاق الطلب." };
    default:
      return { label: s, icon: "ℹ️", hint: "" };
  }
}

function speak(text: string) {
  if (typeof window === "undefined") return;
  if (!("speechSynthesis" in window)) return;

  const t = (text || "").trim();
  if (!t) return;

  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(t);
  u.lang = "ar-LB";
  u.rate = 0.95; // أبطأ قليلاً لكبار السن
  window.speechSynthesis.speak(u);
}

export default function CaseStatusPage() {
  // Senior UX controls
  const [fontSize, setFontSize] = useState<number>(22);
  const [highContrast, setHighContrast] = useState<boolean>(false);

  const [code, setCode] = useState("");
  const [data, setData] = useState<CaseRes | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    try {
      const last = localStorage.getItem("last_case_code");
      if (last) setCode(last);

      const fs = localStorage.getItem("senior_font_size");
      const hc = localStorage.getItem("senior_high_contrast");
      if (fs) setFontSize(parseInt(fs, 10));
      if (hc) setHighContrast(hc === "1");
    } catch {}
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem("senior_font_size", String(fontSize));
      localStorage.setItem("senior_high_contrast", highContrast ? "1" : "0");
    } catch {}
  }, [fontSize, highContrast]);

  const themeStyle: React.CSSProperties = useMemo(() => {
    return {
      direction: "rtl",
      fontSize,
      lineHeight: 1.75,
      background: highContrast ? "#000" : "#f3f4f6",
      color: highContrast ? "#fff" : "#111",
      minHeight: "100vh",
    };
  }, [fontSize, highContrast]);

  async function fetchCase(targetCode?: string) {
    const c = (targetCode ?? code).trim().toUpperCase();
    setErr(null);
    setData(null);

    if (!c) {
      setErr("حط رمز المتابعة لو سمحت (مثال: WAT-8F3K2Q).");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`/v1/cases/${encodeURIComponent(c)}`);
      if (!res.ok) {
        if (res.status === 404)
          throw new Error("الرمز غير موجود. تأكد منه وحاول مرة تانية.");
        throw new Error("صار خطأ. جرّب مرة تانية.");
      }
      const j = (await res.json()) as CaseRes;
      setData(j);
      try {
        localStorage.setItem("last_case_code", j.case_code);
      } catch {}
    } catch (e: any) {
      setErr(e?.message || "صار خطأ. جرّب مرة تانية.");
    } finally {
      setLoading(false);
    }
  }

  const speakSummary = useMemo(() => {
    if (!data) return "";
    const st = statusMeta(data.status);
    const reply =
      data.staff_reply && data.staff_reply.trim().length > 0
        ? `الرد: ${data.staff_reply}`
        : "لا يوجد رد بعد. الطلب قيد المتابعة.";
    return `رمز المتابعة ${data.case_code}. الحالة: ${st.label}. ${st.hint}. ${reply}`;
  }, [data]);

  async function copyCode() {
    if (!data?.case_code) return;
    try {
      await navigator.clipboard.writeText(data.case_code);
      speak("تم نسخ الرمز.");
    } catch {
      // ignore
    }
  }

  return (
    <div style={themeStyle}>
      <div className="max-w-3xl mx-auto p-4 pt-8">
        {/* Header with senior controls */}
        <div className={card()}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-2xl font-extrabold">📌 عرض حالة طلب المتابعة</div>
              <div className="opacity-90 mt-2">اكتب رمز المتابعة اللي أخدته لما سجّلت الطلب.</div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <label className="flex items-center gap-2">
                <span className="opacity-90">حجم الخط</span>
                <select
                  className="rounded-xl border px-3 py-2 text-lg"
                  value={fontSize}
                  onChange={(e) => setFontSize(parseInt(e.target.value, 10))}
                >
                  {[20, 22, 24, 26, 28].map((v) => (
                    <option key={v} value={v}>
                      {v}
                    </option>
                  ))}
                </select>
              </label>

              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={highContrast}
                  onChange={(e) => setHighContrast(e.target.checked)}
                />
                <span className="opacity-90">تباين عالي</span>
              </label>
            </div>
          </div>

          {/* Input */}
          <div className="mt-5 grid gap-3">
            <input
              className="rounded-2xl border px-4 py-4 text-lg"
              placeholder="مثال: WAT-8F3K2Q"
              value={code}
              onChange={(e) => setCode(e.target.value)}
            />

            <button className={bigBtn()} onClick={() => fetchCase()} disabled={loading}>
              {loading ? "…عم نفتّش" : "🔎 عرض الحالة"}
            </button>

            {err && (
              <div className="rounded-2xl border border-red-400 p-3">
                <div className="font-bold">ولا يهمك…</div>
                <div>{err}</div>
              </div>
            )}

            {data && (
              <div className="grid gap-3 mt-2">
                {/* Status Card */}
                <div className="rounded-2xl border p-4">
                  {(() => {
                    const st = statusMeta(data.status);
                    return (
                      <>
                        <div className="text-xl font-extrabold">
                          {st.icon} الرمز: {data.case_code}
                        </div>
                        <div className="mt-2">
                          الحالة: <b>{st.label}</b>
                        </div>
                        {st.hint && <div className="opacity-90 mt-2">{st.hint}</div>}
                        <div className="opacity-80 mt-2">آخر تحديث: {data.updated_at}</div>

                        <div className="mt-4 flex flex-wrap gap-2">
                          <button className={smallBtn()} onClick={() => speak(speakSummary)}>
                            🔊 سمّعني الحالة
                          </button>
                          <button className={smallBtn()} onClick={copyCode}>
                            📋 انسخ الرمز
                          </button>
                        </div>
                      </>
                    );
                  })()}
                </div>

                {/* User Message */}
                <div className="rounded-2xl border p-4">
                  <div className="font-extrabold text-lg">📝 رسالتك</div>
                  <div className="opacity-90 mt-2 whitespace-pre-wrap">{data.user_message}</div>
                </div>

                {/* Reply */}
                <div className="rounded-2xl border p-4">
                  <div className="font-extrabold text-lg">✅ الرد</div>
                  <div className="opacity-90 mt-2 whitespace-pre-wrap">
                    {data.staff_reply && data.staff_reply.trim().length > 0
                      ? data.staff_reply
                      : "ما في رد بعد. طلبك قيد المتابعة."}
                  </div>
                  <div className="mt-3">
                    <button
                      className={smallBtn()}
                      onClick={() =>
                        speak(
                          data.staff_reply && data.staff_reply.trim().length > 0
                            ? `الرد هو: ${data.staff_reply}`
                            : "لا يوجد رد بعد. طلبك قيد المتابعة."
                        )
                      }
                    >
                      🔊 سمّعني الرد
                    </button>
                  </div>
                </div>

                <button
                  className={bigBtn()}
                  onClick={() => {
                    setData(null);
                    setErr(null);
                    try {
                      const last = localStorage.getItem("last_case_code");
                      if (last) setCode(last);
                    } catch {}
                  }}
                >
                  ↩️ فتّش عن رمز آخر
                </button>

                <a
                  className={bigBtn()}
                  href="/"
                >
                  🏠 رجوع للرئيسية
                </a>
              </div>
            )}
          </div>
        </div>

        <div className="opacity-80 mt-6">
          ملاحظة: إذا ما بتعرف وين محطوط الرمز، فتّش برسالة “تم تسجيل طلبك” داخل صفحة المساعدة.
        </div>
      </div>
    </div>
  );
}