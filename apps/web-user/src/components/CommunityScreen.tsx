import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import type { Mode } from "../store/app";
import { useApp } from "../store/app";
import type { CommunityGroup, LiveSession } from "../types/domain";

type Props = Readonly<{
  onNavigate: (mode: Mode) => void;
}>;

function formatGroupTime(value?: string): string {
  if (!value) return "الآن";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "الآن";

  const now = new Date();
  if (date.toDateString() === now.toDateString()) {
    return new Intl.DateTimeFormat("ar-LB", { hour: "numeric", minute: "2-digit" }).format(date);
  }

  return new Intl.DateTimeFormat("ar-LB", { month: "short", day: "numeric" }).format(date);
}

function formatGroupCategory(category?: CommunityGroup["category"]): string | null {
  if (!category) return null;

  const labels: Record<NonNullable<CommunityGroup["category"]>, string> = {
    general: "عام",
    salary: "رواتب وتعويضات",
    healthcare: "طبابة وتحويلات",
    grants: "المساعدات المدرسية",
    laws: "قوانين وحقوق",
    recruitment: "تطويع وإعلانات",
    support: "دعم فني",
  };

  return labels[category] || null;
}

export function CommunityScreen({ onNavigate }: Props) {
  const navigate = useNavigate();
  const { apiBaseUrl } = useApp();
  const [groups, setGroups] = useState<CommunityGroup[]>([]);
  const [liveSessions, setLiveSessions] = useState<LiveSession[]>([]);

  useEffect(() => {
    let active = true;

    api.getCommunityOverview(apiBaseUrl)
      .then((data) => {
        if (!active) return;
        setGroups(data.groups);
        setLiveSessions(data.liveSessions);
      })
      .catch(() => {
        if (!active) return;
        setGroups([]);
        setLiveSessions([]);
      });

    return () => {
      active = false;
    };
  }, [apiBaseUrl]);

  const previewGroups = useMemo(() => groups.slice(0, 6), [groups]);
  const currentSession = liveSessions[0] || null;

  return (
    <div className="hybrid-screen community-screen">
      <section className="hybrid-section community-quick-start">
        <div className="hybrid-section__header">
          <div>
            <span className="hybrid-section__eyebrow">ابدأ سريعاً</span>
            <h2 className="hybrid-section__title">اختر مسارك</h2>
          </div>
        </div>

        <div className="community-shortcuts community-shortcuts--dense">
            <button className="community-shortcut community-shortcut--primary" onClick={() => onNavigate("chat")}>
            <span className="community-shortcut__label">محادثة موطني</span>
            <span className="community-shortcut__hint">ابدأ هنا إذا لم تكن متأكداً من المجموعة أو الخدمة المناسبة.</span>
          </button>
            <button className="community-shortcut community-shortcut--secondary" onClick={() => navigate("/groups")}>
            <span className="community-shortcut__label">كل المجموعات</span>
            <span className="community-shortcut__hint">افتح القائمة الكاملة مع البحث والمرشحات للوصول بسرعة إلى الموضوع الصحيح.</span>
          </button>
            <button className="community-shortcut community-shortcut--secondary" onClick={() => navigate(currentSession?.groupId ? `/groups/${currentSession.groupId}` : "/groups") }>
            <span className="community-shortcut__label">{currentSession ? "الجلسة المباشرة" : "آخر المجموعات"}</span>
            <span className="community-shortcut__hint">{currentSession ? `هناك جلسة نشطة بعنوان ${currentSession.title}.` : "انتقل مباشرة إلى أحدث المحادثات بدون المرور على مقدمات إضافية."}</span>
          </button>
        </div>
      </section>

      {currentSession ? (
        <section className="community-focus-card community-focus-card--live">
          <div className="community-focus-card__copy">
            <span className="community-pinned-card__tag">مباشر الآن</span>
            <h2>{currentSession.title}</h2>
            <p>المضيف: {currentSession.hostName}. الدخول يتم من المجموعة نفسها حتى لا ينفصل البث عن الرسائل المرتبطة به.</p>
          </div>
          <button
            className="community-pinned-card__action"
            onClick={() => navigate(currentSession.groupId ? `/groups/${currentSession.groupId}` : "/groups")}
          >
            ادخل الجلسة
          </button>
        </section>
      ) : null}

      <section className="hybrid-section community-groups-section">
        <div className="hybrid-section__header">
          <div>
            <span className="hybrid-section__eyebrow">آخر النشاط</span>
            <h2 className="hybrid-section__title">آخر المجموعات</h2>
          </div>
          <button type="button" className="hybrid-inline-link" onClick={() => navigate("/groups")}>
            عرض الكل
          </button>
        </div>

        <ul className="community-group-list">
          {previewGroups.map((group) => (
            <li key={group.id} className="community-group-list__item">
              <button className="community-group-row" onClick={() => navigate(`/groups/${group.id}`) }>
                <span className="community-group-row__content">
                  <span className="community-group-row__topline">
                    <span className="community-group-row__name" dir="auto">{group.name}</span>
                    <span className="community-group-row__time" dir="auto">
                      <span aria-hidden="true">·</span>
                      <span>{formatGroupTime(group.lastMessageAt)}</span>
                    </span>
                  </span>
                  <span className="community-group-row__meta">
                    {group.isOfficial ? <span className="community-group-row__tag" dir="auto">رسمي</span> : null}
                    {formatGroupCategory(group.category) ? <span className="community-group-row__tag" dir="auto">{formatGroupCategory(group.category)}</span> : null}
                  </span>
                  <span className="community-group-row__snippet">{group.lastMessagePreview || group.description || "افتح المجموعة لمتابعة آخر الرسائل."}</span>
                </span>
                {group.unreadCount ? <span className="community-group-row__badge">{group.unreadCount}</span> : null}
              </button>
            </li>
          ))}
          {previewGroups.length === 0 ? (
            <div className="hybrid-empty-state">
              <h3>لا توجد مجموعات ظاهرة حالياً.</h3>
              <p>شغّل البوابة المحلية أو أعد تحميل الصفحة لعرض أحدث المحادثات.</p>
            </div>
          ) : null}
        </ul>
      </section>
    </div>
  );
}

