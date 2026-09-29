import AdminModuleTablePage from "./AdminModuleTablePage";

export default function AdminAnalyticsPage() {
  return <AdminModuleTablePage title="التحليلات" description="تحليلات جلسات Gateway مع دعم مضبوط للتاريخ وتقسيم الصفحات." endpoint="/api/admin/analytics/sessions" rowKeys={["sessions", "data"]} />;
}
