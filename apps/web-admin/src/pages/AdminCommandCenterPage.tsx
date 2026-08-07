import DashboardPage from "./DashboardPage";

export default function AdminCommandCenterPage() {
  return (
    <div>
      <div className="page-header">
        <h2>Command Center</h2>
        <p className="muted">Admin Command Center</p>
        <p className="muted">Operational dashboard</p>
      </div>
      <DashboardPage />
    </div>
  );
}
