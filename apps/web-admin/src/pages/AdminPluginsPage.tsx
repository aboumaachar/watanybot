import { useEffect, useState } from "react";
import { adminFetch } from "../lib/api";
import { AdminErrorState, AdminLoadingState, AdminPageSection } from "../components/admin/AdminPrimitives";
import FeatureControlsPage from "./FeatureControlsPage";

type PluginState = { jobApplicationCount: number; marketplaceCount: number; jobApplications: Array<Record<string, unknown>>; marketplaceListings: Array<Record<string, unknown>> };

export default function AdminPluginsPage() {
  const [state, setState] = useState<PluginState | null>(null);
  const [error, setError] = useState("");
  useEffect(() => { void adminFetch("/api/admin/plugins").then((response) => response.json()).then(setState).catch((reason) => setError(reason instanceof Error ? reason.message : "Plugin authority unavailable.")); }, []);
  if (error) return <AdminPageSection title="الإضافات" description="سجل إضافات Gateway وحالتها التشغيلية."><AdminErrorState message={error} /></AdminPageSection>;
  if (!state) return <AdminPageSection title="الإضافات" description="سجل إضافات Gateway وحالتها التشغيلية."><AdminLoadingState /></AdminPageSection>;
  return <><AdminPageSection title="الإضافات" description="سجل الإضافات المملوك لـ Gateway. لا يتوفر تثبيت أو تنفيذ تعليمات برمجية عشوائية."><div className="admin-queue-grid"><div className="admin-queue-item"><strong>إضافة الوظائف</strong><span>مفعّلة، {state.jobApplicationCount} طلبات</span></div><div className="admin-queue-item"><strong>إضافة السوق</strong><span>مفعّلة، {state.marketplaceCount} إعلانات</span></div><div className="admin-queue-item"><strong>ضوابط دورة الحياة</strong><span>غير مهيأة: لا يوجد مالك تفعيل حالي</span></div></div><div className="table-wrap"><table><thead><tr><th>الإضافة</th><th>الصحة</th><th>الإصدار</th><th>الإعدادات</th></tr></thead><tbody><tr><td>jobs</td><td>سليم</td><td>مملوك لـ Gateway</td><td>إعداد خارجي فقط</td></tr><tr><td>marketplace</td><td>سليم</td><td>مملوك لـ Gateway</td><td>إعداد خارجي فقط</td></tr></tbody></table></div></AdminPageSection><FeatureControlsPage /></>;
}
