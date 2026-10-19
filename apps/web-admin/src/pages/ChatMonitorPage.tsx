"use client";

import { AppProvider } from "../../../web-user/src/store/app-provider";
import { FeatureFlagsProvider } from "../../../web-user/src/store/features-provider";
import WatanyHybridDefaultChat from "../../../web-user/src/features/hybrid-chat/WatanyHybridDefaultChat";
import { AdminNotice, AdminPageHeader } from "../components/admin/AdminPrimitives";

type WatanyLegacyChatProps = Record<string, unknown>;

function ChatMonitorPage(props: WatanyLegacyChatProps) {
  return <div className="ops-page-stack"><AdminPageHeader title="مراقبة المحادثات" description="عمليات محادثة هجينة مدعومة من Gateway. تعرض شاشة المراقبة البيانات التي يحتفظ بها مزود المحادثة المعتمد فقط." /><AdminNotice tone="info">يعتمد سجل المحادثة والثقة وتفاصيل الأخطاء على المزود. لا تنشئ هذه الصفحة صفوف مراقبة اصطناعية.</AdminNotice><FeatureFlagsProvider><AppProvider><WatanyHybridDefaultChat surfaceId="apps/web-admin/src/pages/ChatMonitorPage.tsx" legacyProps={props} /></AppProvider></FeatureFlagsProvider></div>;
}

export default ChatMonitorPage;
export { ChatMonitorPage };
