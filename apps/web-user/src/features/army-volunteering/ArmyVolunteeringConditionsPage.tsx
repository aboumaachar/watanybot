import React, { useMemo, useState } from "react";
import { armyVolunteeringCategories, armyVolunteeringSource, type ArmyVolunteeringCategory } from "./armyVolunteering.data";

function ListBlock({ title, items }: Readonly<{ title: string; items: string[] }>) {
  return (
    <section style={{ marginTop: 16 }}>
      <h3 style={{ margin: "0 0 8px", fontSize: 18 }}>{title}</h3>
      <ul style={{ margin: 0, paddingInlineStart: 22, lineHeight: 1.9 }}>
        {items.map((item) => <li key={item}>{item}</li>)}
      </ul>
    </section>
  );
}

function CategoryCard({ category }: Readonly<{ category: ArmyVolunteeringCategory }>) {
  return (
    <article style={{ border: "1px solid rgba(148,163,184,.35)", borderRadius: 24, padding: 20, background: "white", boxShadow: "0 16px 36px rgba(15,23,42,.10)" }}>
      <p style={{ color: "#64748b", fontWeight: 700, margin: 0 }}>صفة التطوع</p>
      <h2 style={{ margin: "6px 0 10px", fontSize: 26 }}>{category.titleAr}</h2>
      <p style={{ lineHeight: 1.8, color: "#334155" }}>{category.summaryAr}</p>
      <ListBlock title="الشروط" items={category.conditions} />
      <ListBlock title="العمر" items={category.age} />
      <ListBlock title="المستوى العلمي" items={category.education} />
      <ListBlock title="المستندات المطلوبة" items={category.documents} />
      <ListBlock title="ملاحظات" items={category.notes} />
    </article>
  );
}

export default function ArmyVolunteeringConditionsPage() {
  const [selectedId, setSelectedId] = useState(armyVolunteeringCategories[0].id);
  const [query] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return armyVolunteeringCategories;
    return armyVolunteeringCategories.filter((c) =>
      [c.titleAr, c.summaryAr, ...c.conditions, ...c.age, ...c.education, ...c.documents, ...c.notes].join(" ").toLowerCase().includes(q)
    );
  }, [query]);

  const selected = filtered.find((c) => c.id === selectedId) || filtered[0] || armyVolunteeringCategories[0];

  return (
    <main dir="rtl" style={{ maxWidth: 1040, margin: "0 auto", padding: 20, fontFamily: "system-ui, -apple-system, Segoe UI, sans-serif" }}>
      <section style={{ borderRadius: 28, padding: 24, background: "linear-gradient(135deg,#f8fafc,#e2e8f0)", border: "1px solid rgba(148,163,184,.35)", marginBottom: 18 }}>
        <h1 style={{ margin: 0, fontSize: 32 }}>{armyVolunteeringSource.titleAr}</h1>
      </section>

      <nav style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 18 }}>
        {armyVolunteeringCategories.map((c) => (
          <button key={c.id} type="button" data-feature-key={c.id} onClick={() => setSelectedId(c.id)} style={{ border: selected.id === c.id ? "1px solid #0f172a" : "1px solid #cbd5e1", background: selected.id === c.id ? "#0f172a" : "white", color: selected.id === c.id ? "white" : "#0f172a", borderRadius: 999, padding: "10px 14px", cursor: "pointer", fontWeight: 700 }}>
            {c.titleAr}
          </button>
        ))}
      </nav>

      {filtered.length ? <CategoryCard category={selected} /> : <section style={{ padding: 20, borderRadius: 20, background: "#f8fafc" }}>لا توجد نتيجة مطابقة للبحث الحالي.</section>}

      <section style={{ marginTop: 20, padding: 16, borderRadius: 20, background: "#f8fafc", color: "#334155", lineHeight: 1.8 }}>
        <strong>مصدر المعلومات:</strong> {armyVolunteeringSource.providerAr} — شروط التطوع.
        <br />
        هذه الصفحة لا تغني عن الإعلان الرسمي ولا تنشئ طلب تطوع أو تحفظ مستندات.
      </section>
    </main>
  );
}