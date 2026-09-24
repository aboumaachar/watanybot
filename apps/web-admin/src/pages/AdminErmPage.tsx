import AdminModuleTablePage from "./AdminModuleTablePage";
import { AdminNotice, AdminPageSection } from "../components/admin/AdminPrimitives";

export default function AdminErmPage() {
  return <><AdminModuleTablePage title="أصول ERM" description="سجل أصول المؤسسة المملوك لـ Gateway. لا مالك حالي للأقسام والموظفين والمشاريع والمورّدين بعد التسوية المحدودة." endpoint="/api/admin/erm/assets" rowKeys={["items", "data"]} /><AdminPageSection title="نطاقات الكيانات غير المدعومة" description="تبقى هذه النطاقات ظاهرة كفجوات في الصلاحية بدلاً من ادعاء قابليتها للتحرير."><AdminNotice tone="warning">لا يملك Gateway حالياً مالك حفظ أو تعديل للأقسام والموظفين والمشاريع والمورّدين. لا تظهر أدوات تعديل.</AdminNotice></AdminPageSection></>;
}
