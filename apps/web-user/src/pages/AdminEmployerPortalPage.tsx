import React from "react";

export default function AdminEmployerPortalPage() {
  return (
    <main dir="rtl" className="mx-auto max-w-6xl p-4 space-y-4">
      <h1 className="text-2xl font-bold">إدارة بوابة أصحاب العمل</h1>
      <p className="text-sm text-gray-600">مراجعة أصحاب العمل، الموافقة عليهم، وتتبع طلبات المرشحين والمستقلين.</p>
      <div className="grid gap-4 md:grid-cols-3">
        <section className="rounded-2xl border p-4 shadow-sm"><h2 className="font-semibold">بانتظار الموافقة</h2><p className="text-sm">جهات عمل جديدة.</p></section>
        <section className="rounded-2xl border p-4 shadow-sm"><h2 className="font-semibold">طلبات المرشحين</h2><p className="text-sm">احتياجات التوظيف والعمل الحر.</p></section>
        <section className="rounded-2xl border p-4 shadow-sm"><h2 className="font-semibold">المطابقة</h2><p className="text-sm">اقتراح مرشحين ومستقلين مناسبين.</p></section>
      </div>
    </main>
  );
}