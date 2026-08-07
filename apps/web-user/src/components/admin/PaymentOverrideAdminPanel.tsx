import React from 'react';

export function PaymentOverrideAdminPanel(): JSX.Element {
  return (
    <section data-payment-override-admin-panel="true" dir="rtl">
      <h2>إدارة تحديثات الدفع</h2>
      <p>
        هذه اللوحة مخصصة لربط إجابات حالة الدفع المتغيرة بتحديثات يتحكم بها المشرف العام.
      </p>
      <ul>
        <li>الحقائق القانونية الثابتة تبقى من قاعدة المعرفة.</li>
        <li>حالة الدفع المتغيرة يمكن تحديثها عبر سجل المشرف العام.</li>
        <li>يجب توثيق المصدر والتاريخ قبل اعتماد أي جواب متغير.</li>
      </ul>
    </section>
  );
}

export default PaymentOverrideAdminPanel;