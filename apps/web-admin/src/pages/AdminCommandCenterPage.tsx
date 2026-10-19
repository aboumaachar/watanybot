import DashboardPage from "./DashboardPage";

export default function AdminCommandCenterPage() {
  return (
    <div>
      <div className="page-header">
        <h2>مركز القيادة</h2>
        <p className="muted">مركز قيادة الإدارة</p>
        <p className="muted">لوحة التشغيل</p>
      </div>
      <DashboardPage />
    </div>
  );
}
