const previewChecks = [
  "اعتماد السائقين والسيارات",
  "مراجعة مناطق التغطية",
  "إظهار حالة التوفر",
  "ربط لوحة Taxi بسطح SuperAdmin",
];

export function SuperAdminTaxiDashboardPreviewPanel() {
  return (
    <section className="superadmin-taxi-preview-panel" dir="rtl" data-superadmin-taxi-preview-panel>
      <div className="superadmin-taxi-preview-panel__header">
        <div>
          <p className="superadmin-critical-shell__eyebrow">Taxi dashboard preview</p>
          <h2>مرجع لوحة Taxi داخل SuperAdmin</h2>
          <p>
            ملف المعاينة المحلي تم قبوله كمرجع تصميمي. هذه اللوحة تربطه بسطح الإدارة بدون اعتباره دليلا كافيا أن التكامل اكتمل وحده.
          </p>
        </div>
        <a className="superadmin-critical-shell__action" href="/admin/watanybot_super_admin_taxi_dashboard_preview.html" target="_blank" rel="noreferrer">
          فتح المعاينة
        </a>
      </div>

      <div className="superadmin-taxi-preview-panel__body">
        <div className="superadmin-taxi-preview-panel__frame-wrap">
          <iframe
            title="SuperAdmin Taxi dashboard preview"
            src="/admin/watanybot_super_admin_taxi_dashboard_preview.html"
            loading="lazy"
            className="superadmin-taxi-preview-panel__frame"
          />
        </div>
        <aside className="superadmin-taxi-preview-panel__notes" aria-label="نقاط التكامل">
          <h3>ما يجب دمجه فعليا</h3>
          <ul>
            {previewChecks.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </aside>
      </div>
    </section>
  );
}