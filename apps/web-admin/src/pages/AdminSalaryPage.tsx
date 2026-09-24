import AdminModuleTablePage from "./AdminModuleTablePage";

export default function AdminSalaryPage() {
  return <AdminModuleTablePage title="الرواتب" description="بيانات جهة الرواتب وحالة مجموعة البيانات المنشورة مباشرة." endpoint="/api/salary/meta" rowKeys={["ranks", "items", "data"]} />;
}
