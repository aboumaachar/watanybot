import { useEffect, useState } from "react";
import { ArrowClockwise24Regular, ChatMultiple24Regular } from "../theme/watany-v4/legacyIconBridge";
import { UtilityActionIcon } from "../components/UtilityActionIcon";
import { MainHybridChatSurface } from "../components/chat/MainHybridChatSurface";
import type { ChatSession } from "../types/domain";
import { api } from "../lib/api";
import { useApp } from "../store/app";

type UtilityColorStyle = React.CSSProperties & { "--utility-color": string };

function utilityColorStyle(color: string): UtilityColorStyle {
  return { "--utility-color": color };
}

 function formatDateTime(value: number): string {
   return new Date(value).toLocaleString("ar-LB", {
     year: "numeric",
     month: "2-digit",
     day: "2-digit",
     hour: "2-digit",
     minute: "2-digit",
   });
 }

 function getStatusLabel(status: ChatSession["status"]): string {
   if (status === "in_progress") return "قيد المتابعة";
   if (status === "closed") return "مغلقة";
   return "مفتوحة";
 }

 function getSessionPreview(session: ChatSession): string {
  const lastMessage = [...session.messages].reverse().find((message) => typeof message.text === "string" && message.text.trim());
  return lastMessage?.text.trim() || session.note || "جلسة محادثة محفوظة بدون نص معاينة.";
 }

 export function ChatSessionsPage() {
   const { apiBaseUrl, profile } = useApp();
   const [sessions, setSessions] = useState<ChatSession[]>([]);
   const [loading, setLoading] = useState(true);
   const [error, setError] = useState("");

   async function loadChatSessions() {
     setError("");
     setLoading(true);
     try {
       setSessions(await api.getChatSessions(apiBaseUrl));
     } catch {
       setError("تعذّر تحميل جلسات المحادثة.");
     } finally {
       setLoading(false);
     }
   }

  useEffect(() => {
    void loadChatSessions();
  }, [apiBaseUrl, profile.isAuthed]); // eslint-disable-line react-hooks/exhaustive-deps

   return (
     <div className="wmo-utility-route wmo-rebuilt-route wmo-core-route wmo-route-normalized panel utility-page watany-utility-page" dir="rtl">
      <MainHybridChatSurface context="pages/ChatSessionsPage.tsx" />
       <div className="wmo-utility-route wmo-rebuilt-route wmo-core-route wmo-route-normalized utility-header watany-utility-page__header">
         <div>
           <h1 className="wmo-utility-route wmo-rebuilt-route wmo-core-route wmo-route-normalized utility-title">جلسات المحادثة</h1>
           <p className="wmo-utility-route wmo-rebuilt-route wmo-core-route wmo-route-normalized muted">تابع سجل الجلسات التي تم حفظها أو تحويلها للمراجعة.</p>
         </div>
       </div>

       <div className="watany-approved-home-icons wmo-utility-route wmo-rebuilt-route wmo-core-route wmo-route-normalized utility-action-grid utility-action-grid--compact">
         <button className="wmo-utility-route wmo-rebuilt-route wmo-core-route wmo-route-normalized utility-action-card watany-utility-action-card" type="button" onClick={() => void loadChatSessions()} style={utilityColorStyle("#0f766e")}>
           <UtilityActionIcon className="wmo-utility-route wmo-rebuilt-route wmo-core-route wmo-route-normalized" icon={<ArrowClockwise24Regular aria-hidden />} />
           <span className="wmo-utility-route wmo-rebuilt-route wmo-core-route wmo-route-normalized utility-action-card__label">تحديث</span>
           <span className="wmo-utility-route wmo-rebuilt-route wmo-core-route wmo-route-normalized utility-action-card__desc">إعادة تحميل سجل الجلسات.</span>
         </button>
         <div className="wmo-utility-route wmo-rebuilt-route wmo-core-route wmo-route-normalized utility-action-card utility-action-card--static watany-utility-action-card" style={utilityColorStyle("#475569")}>
           <UtilityActionIcon className="wmo-utility-route wmo-rebuilt-route wmo-core-route wmo-route-normalized" icon={<ChatMultiple24Regular aria-hidden />} />
           <span className="wmo-utility-route wmo-rebuilt-route wmo-core-route wmo-route-normalized utility-action-card__label">الإجمالي</span>
           <span className="wmo-utility-route wmo-rebuilt-route wmo-core-route wmo-route-normalized utility-action-card__desc">{`${sessions.length} جلسة مسجلة.`}</span>
         </div>
       </div>

       {error ? <div className="wmo-utility-route wmo-rebuilt-route wmo-core-route wmo-route-normalized panel-error">{error}</div> : null}
       {loading ? <div className="wmo-utility-route wmo-rebuilt-route wmo-core-route wmo-route-normalized muted">جارٍ تحميل الجلسات...</div> : null}

       {!loading && sessions.length === 0 ? (
         <div className="wmo-utility-route wmo-rebuilt-route wmo-core-route wmo-route-normalized muted">لا توجد جلسات محادثة محفوظة حالياً.</div>
       ) : null}

       <div className="wmo-utility-route wmo-rebuilt-route wmo-core-route wmo-route-normalized results watany-utility-page__results">
         {sessions.map((session) => (
           <article key={session.id} className="wmo-utility-route wmo-rebuilt-route wmo-core-route wmo-route-normalized card utility-list-card utility-list-card--compact watany-utility-list-card">
             <div className="wmo-utility-route wmo-rebuilt-route wmo-core-route wmo-route-normalized utility-list-card__title-row">
               <div className="wmo-utility-route wmo-rebuilt-route wmo-core-route wmo-route-normalized utility-list-card__title-copy">
                 <h2 className="wmo-utility-route wmo-rebuilt-route wmo-core-route wmo-route-normalized card-title">{getSessionPreview(session)}</h2>
                 <p className="wmo-utility-route wmo-rebuilt-route wmo-core-route wmo-route-normalized card-sub">{formatDateTime(session.updatedAt || session.createdAt)}</p>
               </div>
               <span className="pill watany-ui-pill pending">{getStatusLabel(session.status)}</span>
             </div>
           </article>
         ))}
       </div>
     </div>
   );
 }

 export default ChatSessionsPage;


