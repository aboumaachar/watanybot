import AdminModuleTablePage from "./AdminModuleTablePage";

export default function AdminSchoolGrantsPage() {
  return <AdminModuleTablePage title="المنح المدرسية" description="إرشادات المنح المدرسية ومراجع الطلبات من المصادر المعتمدة." endpoint="/api/school-aids/items" rowKeys={["items", "forms", "guides"]} />;
}
