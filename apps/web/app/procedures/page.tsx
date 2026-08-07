"use client";
import { useEffect, useState } from "react";

type Proc = {
  procedure_code: string;
  topic_code: string;
  title_ar: string;
  who_eligible_ar?: string;
  estimated_time_ar?: string;
  requirements_checklist_json: string[];
  steps_json: string[];
  common_mistakes_json: string[];
  legal_refs_json: string[];
};

function card() { return "rounded-2xl border bg-white p-5 shadow-sm"; }
function bigBtn() { return "w-full rounded-2xl px-4 py-5 text-right text-xl border bg-white shadow-sm active:scale-[0.99] transition"; }

export default function Procedures() {
  const [list, setList] = useState<Proc[]>([]);
  const [selected, setSelected] = useState<Proc | null>(null);

  useEffect(() => {
    (async () => {
      const res = await fetch("/v1/kb/procedures?topic=PROCEDURES");
      if (res.ok) setList(await res.json());
    })();
  }, []);

  return (
    <div dir="rtl" className="min-h-screen bg-gray-100">
      <div className="max-w-3xl mx-auto p-4 pt-8">
        <div className={card()}>
          <div className="text-2xl font-extrabold">📄 معاملات وإجراءات</div>
          <div className="opacity-90 mt-2">اختار نوع المعاملة، ومنعطيك الأوراق والخطوات.</div>

          {!selected ? (
            <div className="grid gap-3 mt-5">
              {list.map(p => (
                <button key={p.procedure_code} className={bigBtn()} onClick={() => setSelected(p)}>
                  {p.title_ar}
                </button>
              ))}
              {list.length === 0 && <div className="opacity-80 mt-4">ما في معاملات محمّلة حالياً.</div>}
            </div>
          ) : (
            <div className="mt-5 grid gap-3">
              <div className="rounded-2xl border p-4">
                <div className="text-xl font-extrabold">{selected.title_ar}</div>
                {selected.who_eligible_ar && <div className="opacity-90 mt-2"><b>مين بيستفيد؟</b> {selected.who_eligible_ar}</div>}
                {selected.estimated_time_ar && <div className="opacity-90 mt-2"><b>المدة المتوقعة:</b> {selected.estimated_time_ar}</div>}
              </div>

              <div className="rounded-2xl border p-4">
                <div className="font-extrabold text-lg">✅ الأوراق المطلوبة</div>
                <ul className="list-disc pr-6 mt-2">
                  {selected.requirements_checklist_json?.map((x,i)=><li key={i}>{x}</li>)}
                </ul>
              </div>

              <div className="rounded-2xl border p-4">
                <div className="font-extrabold text-lg">🪜 الخطوات</div>
                <ol className="list-decimal pr-6 mt-2">
                  {selected.steps_json?.map((x,i)=><li key={i}>{x}</li>)}
                </ol>
              </div>

              <div className="rounded-2xl border p-4">
                <div className="font-extrabold text-lg">⚠️ أخطاء شائعة</div>
                <ul className="list-disc pr-6 mt-2">
                  {selected.common_mistakes_json?.map((x,i)=><li key={i}>{x}</li>)}
                </ul>
              </div>

              <button className={bigBtn()} onClick={() => setSelected(null)}>⬅️ رجوع للقائمة</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
