"use client";

import { useMemo, useState } from "react";

type Flow = "home" | "pensions" | "procedures" | "rights" | "health" | "other";
type PensionsStep = 1 | 2 | 3 | 4 | 5;

type RankGroup = "OFFICERS" | "NCO";
type Marital = "SINGLE" | "MARRIED";

const OFFICERS = ["عماد", "لواء", "عميد", "عقيد", "مقدم", "رائد", "نقيب", "ملازم", "ملازم اول"];
const NCO = ["مؤهل اول", "مؤهل", "معاون اول", "معاون", "رقيب اول", "رقيب", "عريف اول", "عريف", "جندي اول", "جندي"];

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border bg-white p-5 shadow-sm">
      {children}
    </div>
  );
}

function BigButton({
  children,
  onClick,
  tone = "primary",
}: {
  children: React.ReactNode;
  onClick?: () => void;
  tone?: "primary" | "neutral";
}) {
  const base =
    "w-full rounded-2xl border px-5 py-5 text-right text-xl shadow-sm active:scale-[0.99] transition select-none";
  const cls =
    tone === "primary"
      ? `${base} bg-white`
      : `${base} bg-gray-50`;
  return (
    <button className={cls} onClick={onClick}>
      {children}
    </button>
  );
}

function SmallButton({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) {
  return (
    <button
      className="rounded-2xl border px-4 py-3 bg-white shadow-sm active:scale-[0.99] transition"
      onClick={onClick}
    >
      {children}
    </button>
  );
}

function OptionWithOther({
  label,
  onMain,
  onOther,
}: {
  label: string;
  onMain: () => void;
  onOther: () => void;
}) {
  return (
    <div className="grid gap-2">
      <BigButton onClick={onMain}>{label}</BigButton>
      <BigButton tone="neutral" onClick={onOther}>أو شي تاني</BigButton>
    </div>
  );
}

export default function WizardPage() {
  const [flow, setFlow] = useState<Flow>("home");

  // PENSIONS wizard state
  const [pStep, setPStep] = useState<PensionsStep>(1);
  const [rankGroup, setRankGroup] = useState<RankGroup | null>(null);
  const [rank, setRank] = useState<string | null>(null);
  const [degree, setDegree] = useState<number | null>(null);
  const [marital, setMarital] = useState<Marital | null>(null);
  const [childrenCount, setChildrenCount] = useState<number>(0);

  const rankList = useMemo(() => {
    if (rankGroup === "OFFICERS") return OFFICERS;
    if (rankGroup === "NCO") return NCO;
    return [];
  }, [rankGroup]);

  function resetToHome() {
    setFlow("home");
  }

  function startPensions() {
    setFlow("pensions");
    setPStep(1);
    setRankGroup(null);
    setRank(null);
    setDegree(null);
    setMarital(null);
    setChildrenCount(0);
  }

  function goOther() {
    setFlow("other");
  }

  // Placeholder: hook this to your API when ready
  function computePensionPreview() {
    // This is just a friendly preview message; your real calc will come from your salaries DB/API.
    return {
      ok: true,
      summary: `المعطيات: ${rank || "-"} / درجة ${degree ?? "-"} / ${
        marital === "MARRIED" ? `متأهل + ${childrenCount} أولاد` : "أعزب"
      }.`,
      next: "إذا بدّك، فيك تعمل «طلب متابعة» إذا الحالة خاصة أو ناقص شي.",
    };
  }

  function Home() {
    return (
      <Card>
        <div className="text-2xl font-extrabold">أهلاً فيك 👋</div>
        <div className="opacity-90 mt-2 text-lg">
          أنا مساعدك العسكري. خبرني شو بدك نعمل اليوم؟
        </div>

        <div className="mt-5 grid gap-3">
          <OptionWithOther
            label="احسب معاشي"
            onMain={startPensions}
            onOther={goOther}
          />
          <OptionWithOther
            label="تابع معاملة"
            onMain={() => setFlow("procedures")}
            onOther={goOther}
          />
          <OptionWithOther
            label="اسأل عن حق/مساعدة"
            onMain={() => setFlow("rights")}
            onOther={goOther}
          />
          <OptionWithOther
            label="طبابة/استشفاء"
            onMain={() => setFlow("health")}
            onOther={goOther}
          />
        </div>

        <div className="mt-5 opacity-80 text-sm">
          ملاحظة: إذا ما بتعرف شو تختار، اضغط <b>أو شي تاني</b> ومنمشيها سوا.
        </div>
      </Card>
    );
  }

  function Other() {
    return (
      <Card>
        <div className="text-2xl font-extrabold">ولا يهمك ✅</div>
        <div className="opacity-90 mt-2 text-lg">
          اكتبلي بجملة قصيرة شو بدك، أو اختار أقرب خيار:
        </div>

        <div className="mt-4 grid gap-3">
          <BigButton onClick={startPensions}>أقرب لِـ "معاش/تقاعد"</BigButton>
          <BigButton onClick={() => setFlow("procedures")}>أقرب لِـ "معاملة"</BigButton>
          <BigButton onClick={() => setFlow("rights")}>أقرب لِـ "حق/مساعدة"</BigButton>
          <BigButton onClick={() => setFlow("health")}>أقرب لِـ "طبابة"</BigButton>
        </div>

        <div className="mt-4">
          <label className="block font-bold mb-2">شو بدّك بالضبط؟</label>
          <textarea
            className="w-full rounded-2xl border p-4 text-lg min-h-[120px]"
            placeholder="مثلاً: بدي اعرف كيف قدّم طلب…"
          />
          <div className="mt-3 flex flex-wrap gap-2">
            <SmallButton onClick={resetToHome}>↩️ رجوع</SmallButton>
            <SmallButton onClick={resetToHome}>📌 اعمل طلب متابعة</SmallButton>
          </div>
          <div className="mt-2 opacity-80 text-sm">
            (طلب المتابعة رح يخلي فريقك يرجعلك بالجواب إذا الموضوع بده تدقيق.)
          </div>
        </div>
      </Card>
    );
  }

  function Pensions() {
    const preview = pStep === 5 ? computePensionPreview() : null;

    return (
      <Card>
        <div className="text-2xl font-extrabold">احسب معاشي</div>
        <div className="opacity-90 mt-2 text-lg">
          خطوة بخطوة… ولا تقلق، كل شاشة فيها سؤال واحد.
        </div>

        <div className="mt-5 grid gap-3">
          {pStep === 1 && (
            <>
              <div className="font-extrabold text-lg">1) اختر الفئة</div>
              <BigButton onClick={() => { setRankGroup("OFFICERS"); setPStep(2); }}>
                ضباط
              </BigButton>
              <BigButton onClick={() => { setRankGroup("NCO"); setPStep(2); }}>
                رتباء وأفراد
              </BigButton>
              <BigButton tone="neutral" onClick={goOther}>أو شي تاني</BigButton>
            </>
          )}

          {pStep === 2 && (
            <>
              <div className="font-extrabold text-lg">2) اختر الرتبة</div>
              <div className="grid gap-2">
                {rankList.map((r) => (
                  <BigButton key={r} onClick={() => { setRank(r); setPStep(3); }}>
                    {r}
                  </BigButton>
                ))}
              </div>
              <div className="flex flex-wrap gap-2 mt-2">
                <SmallButton onClick={() => setPStep(1)}>↩️ رجوع</SmallButton>
                <SmallButton onClick={goOther}>أو شي تاني</SmallButton>
              </div>
            </>
          )}

          {pStep === 3 && (
            <>
              <div className="font-extrabold text-lg">3) اختر الدرجة</div>
              <div className="grid grid-cols-3 gap-2">
                {Array.from({ length: 15 }).map((_, i) => {
                  const d = i + 1;
                  return (
                    <button
                      key={d}
                      className="rounded-2xl border py-4 text-lg bg-white shadow-sm active:scale-[0.99] transition"
                      onClick={() => { setDegree(d); setPStep(4); }}
                    >
                      {d}
                    </button>
                  );
                })}
              </div>
              <div className="flex flex-wrap gap-2 mt-2">
                <SmallButton onClick={() => setPStep(2)}>↩️ رجوع</SmallButton>
                <SmallButton onClick={goOther}>أو شي تاني</SmallButton>
              </div>
            </>
          )}

          {pStep === 4 && (
            <>
              <div className="font-extrabold text-lg">4) الوضع العائلي</div>
              <BigButton onClick={() => { setMarital("SINGLE"); setChildrenCount(0); setPStep(5); }}>
                أعزب
              </BigButton>
              <BigButton onClick={() => { setMarital("MARRIED"); setPStep(5); }}>
                متأهل
              </BigButton>

              {marital === "MARRIED" && (
                <div className="rounded-2xl border p-4 bg-gray-50">
                  <div className="font-bold mb-2">عدد الأولاد</div>
                  <div className="flex items-center gap-2">
                    <SmallButton onClick={() => setChildrenCount((c) => Math.max(0, c - 1))}>-</SmallButton>
                    <div className="text-xl font-extrabold px-3">{childrenCount}</div>
                    <SmallButton onClick={() => setChildrenCount((c) => c + 1)}>+</SmallButton>
                  </div>
                  <div className="mt-2 opacity-80 text-sm">
                    إذا مش متأكد، خليه 0 ومنرجع منعدّله.
                  </div>
                </div>
              )}

              <div className="flex flex-wrap gap-2 mt-2">
                <SmallButton onClick={() => setPStep(3)}>↩️ رجوع</SmallButton>
                <SmallButton onClick={goOther}>أو شي تاني</SmallButton>
              </div>
            </>
          )}

          {pStep === 5 && preview && (
            <>
              <div className="font-extrabold text-lg">✅ ملخّص قبل الحساب</div>
              <div className="rounded-2xl border p-4 bg-gray-50 text-lg">
                <div>{preview.summary}</div>
                <div className="mt-2 opacity-90">{preview.next}</div>
              </div>

              <BigButton onClick={() => alert("هنا تربط حساب المعاش الحقيقي عبر API/DB")}>
                احسب الآن
              </BigButton>

              <div className="grid gap-2">
                <BigButton tone="neutral" onClick={() => alert("هنا تعمل Case متابعة")}>
                  📌 اعمل طلب متابعة
                </BigButton>
                <BigButton tone="neutral" onClick={resetToHome}>🏠 رجوع للرئيسية</BigButton>
                <BigButton tone="neutral" onClick={goOther}>أو شي تاني</BigButton>
              </div>

              <div className="flex flex-wrap gap-2 mt-2">
                <SmallButton onClick={() => setPStep(4)}>↩️ تعديل الوضع العائلي</SmallButton>
                <SmallButton onClick={() => setPStep(3)}>↩️ تعديل الدرجة</SmallButton>
                <SmallButton onClick={() => setPStep(2)}>↩️ تعديل الرتبة</SmallButton>
              </div>
            </>
          )}
        </div>
      </Card>
    );
  }

  function Procedures() {
    return (
      <Card>
        <div className="text-2xl font-extrabold">تابع معاملة</div>
        <div className="opacity-90 mt-2 text-lg">
          اختر نوع المعاملة… وإذا مش موجودة اضغط "أو شي تاني".
        </div>

        <div className="mt-5 grid gap-3">
          <BigButton onClick={() => alert("مثال: افادة معاش")}>إفادة معاش</BigButton>
          <BigButton onClick={() => alert("مثال: تصحيح بيانات")}>تصحيح بيانات</BigButton>
          <BigButton onClick={() => alert("مثال: طلب مساعدة")}>طلب مساعدة</BigButton>
          <BigButton tone="neutral" onClick={goOther}>أو شي تاني</BigButton>

          <div className="flex flex-wrap gap-2 mt-2">
            <SmallButton onClick={resetToHome}>🏠 رجوع</SmallButton>
          </div>
        </div>
      </Card>
    );
  }

  function Rights() {
    return (
      <Card>
        <div className="text-2xl font-extrabold">حق / مساعدة</div>
        <div className="opacity-90 mt-2 text-lg">
          اختر الأقرب… أو اضغط "أو شي تاني".
        </div>

        <div className="mt-5 grid gap-3">
          <BigButton onClick={() => alert("مثال: مساعدة اجتماعية")}>مساعدة اجتماعية</BigButton>
          <BigButton onClick={() => alert("مثال: تعويض")}>تعويض</BigButton>
          <BigButton onClick={() => alert("مثال: منحة")}>منحة</BigButton>
          <BigButton tone="neutral" onClick={goOther}>أو شي تاني</BigButton>

          <div className="flex flex-wrap gap-2 mt-2">
            <SmallButton onClick={resetToHome}>🏠 رجوع</SmallButton>
          </div>
        </div>
      </Card>
    );
  }

  function Health() {
    return (
      <Card>
        <div className="text-2xl font-extrabold">طبابة / استشفاء</div>
        <div className="opacity-90 mt-2 text-lg">
          اختر نوع الطلب… وإذا مش واضح اضغط "أو شي تاني".
        </div>

        <div className="mt-5 grid gap-3">
          <BigButton onClick={() => alert("مثال: استشفاء")}>استشفاء</BigButton>
          <BigButton onClick={() => alert("مثال: دواء")}>دواء</BigButton>
          <BigButton onClick={() => alert("مثال: فحوصات")}>فحوصات</BigButton>
          <BigButton tone="neutral" onClick={goOther}>أو شي تاني</BigButton>

          <div className="flex flex-wrap gap-2 mt-2">
            <SmallButton onClick={resetToHome}>🏠 رجوع</SmallButton>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <div dir="rtl" className="min-h-screen bg-gray-100">
      <div className="max-w-3xl mx-auto p-4 pt-8 grid gap-4">
        {/* Top bar */}
        <div className="flex flex-wrap gap-2 items-center justify-between">
          <div className="font-extrabold text-xl">WatanBot • Wizard</div>
          <div className="flex flex-wrap gap-2">
            <SmallButton onClick={resetToHome}>🏠 الرئيسية</SmallButton>
            <SmallButton onClick={goOther}>أو شي تاني</SmallButton>
          </div>
        </div>

        {flow === "home" && <Home />}
        {flow === "other" && <Other />}
        {flow === "pensions" && <Pensions />}
        {flow === "procedures" && <Procedures />}
        {flow === "rights" && <Rights />}
        {flow === "health" && <Health />}

        {/* Footer hint */}
        <div className="opacity-80 text-sm text-center">
          إذا حسّيت حالك ضايع… اضغط "أو شي تاني" بأي وقت.
        </div>
      </div>
    </div>
  );
}
