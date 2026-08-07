"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

function bigBtn() {
  return "w-full rounded-2xl px-4 py-5 text-right text-xl border bg-white shadow-sm active:scale-[0.99] transition";
}

export default function Home() {
  const r = useRouter();
  const [lastCase, setLastCase] = useState<string | null>(null);

  useEffect(() => {
    try {
      const x = localStorage.getItem("last_case_code");
      if (x) setLastCase(x);
    } catch {}
  }, []);

  return (
    <div dir="rtl" className="min-h-screen bg-gray-100">
      <div className="max-w-3xl mx-auto p-4 pt-8">
        <div className="rounded-2xl border bg-white p-5 shadow-sm">
          <div className="text-2xl font-extrabold">🎖️ مساعد العسكريين المتقاعدين</div>
          <div className="opacity-90 mt-2">
            أنا معك خطوة خطوة. اختار شو بدك تعمل اليوم.
          </div>

          <div className="grid gap-3 mt-5">
            <button className={bigBtn()} onClick={() => r.push("/wizard")}>🧙 ابدأ المساعد</button>
            <button className={bigBtn()} onClick={() => r.push("/military")}>✅ احسب معاشي</button>
            <button className={bigBtn()} onClick={() => r.push("/procedures")}>📄 معاملات وإجراءات</button>
            <button className={bigBtn()} onClick={() => r.push("/rights")}>🧾 حقوق ومساعدات</button>
            <button className={bigBtn()} onClick={() => r.push("/laws")}>⚖️ القوانين والمواد</button>
            <button className={bigBtn()} onClick={() => r.push("/faq")}>❓ الأسئلة الشائعة</button>
            <button className={bigBtn()} onClick={() => r.push("/case")}>📌 عرض حالة طلب متابعة</button>
            <button className={bigBtn()} onClick={() => r.push("/help")}>🤝 مساعدة فورية</button>
          </div>

          {lastCase && (
            <div className="mt-5 rounded-2xl border p-4">
              <div className="font-extrabold text-lg">📌 آخر طلب متابعة</div>
              <div className="opacity-90 mt-2">
                رمز المتابعة: <b>{lastCase}</b>
              </div>
              <button
                className="mt-3 w-full rounded-2xl px-4 py-4 text-right text-xl border bg-white shadow-sm active:scale-[0.99] transition"
                onClick={() => r.push("/case")}
              >
                🔎 عرض حالة الطلب
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
