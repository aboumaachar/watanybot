import { useEffect, useState } from "react";
import { ManageableList, type ManageableListAdapter } from "../components/ManageableList";
import { getAdminErrorMessage, listCommunityGroups, type CommunityGroup } from "../lib/api";

const communityAdapter: ManageableListAdapter<CommunityGroup> = {
  featureId: "cms.community",
  domain: "CMS",
  title: "إدارة المجتمع",
  loadRows: listCommunityGroups,
  getRowId: (group) => group.id,
  columns: ["المعرف", "الاسم", "الوصف", "الأعضاء"],
  renderRow: (group) => <><td className="mono" dir="ltr">{group.id}</td><td>{group.name}</td><td>{group.description || "-"}</td><td>{group.memberCount ?? 0}</td></>,
};

export default function CommunityPage() {
  const [groups, setGroups] = useState<CommunityGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void listCommunityGroups()
      .then((next) => { if (active) { setGroups(next); setError(null); } })
      .catch((reason: unknown) => { if (active) setError(getAdminErrorMessage(reason, "تعذر تحميل مجموعات المجتمع.")); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  if (loading) return <section className="superadmin-surface card"><p className="page-loading">جار تحميل مجموعات المجتمع...</p></section>;
  if (error) return <section className="superadmin-surface card"><p role="alert" className="error-text">{error}</p></section>;
  if (groups.length === 0) return <section className="superadmin-surface card"><h2>المجتمع</h2><p className="muted">لا توجد مجموعات.</p></section>;

  return <section className="superadmin-surface card">
    <div className="page-header"><span className="eyebrow">CMS Core / Community</span><h2>إدارة المجتمع</h2><p className="muted">قائمة مجموعات المجتمع مع تحديد متعدد للصفوف.</p></div>
    <div className="table-responsive"><ManageableList adapter={communityAdapter} rows={groups} /></div>
  </section>;
}