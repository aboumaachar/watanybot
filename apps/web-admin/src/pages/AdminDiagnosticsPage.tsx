import AdminModuleTablePage from "./AdminModuleTablePage";

export default function AdminDiagnosticsPage() {
  return <AdminModuleTablePage title="التشخيص" description="فحوصات صحة Gateway والتشغيل من دون كشف الأسرار." endpoint="/api/health" rowKeys={["checks", "services", "data"]} />;
}
