import { useState } from "react";
import { authFetch } from "../../lib/api";
import { useApp } from "../../store/app";

export type JobApplicationPrefillSnapshot = {
  applicationId: string;
  campaignId: string;
  label: string;
  name?: string;
  phone?: string;
  email?: string;
  age?: string;
  createdAt?: string;
  address?: {
    mohafaza?: string;
    qaza?: string;
    village?: string;
    localityId?: string;
    displayAddress?: string;
  };
};

type Props = {
  onFill: (snapshot: JobApplicationPrefillSnapshot) => void;
  className?: string;
};

export default function JobApplicationPreviousFillButton({ onFill, className }: Props) {
  const { apiBaseUrl, profile } = useApp();
  const [items, setItems] = useState<JobApplicationPrefillSnapshot[] | null>(null);
  const [selectedId, setSelectedId] = useState("");  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  if (!profile.isAuthed) return null;

  async function loadPrevious() {
    setLoading(true);
    setMessage("");
    try {
      const response = await authFetch(`${apiBaseUrl}/api/jobs/applications/mine/prefill`);
      if (!response.ok) {
        setMessage("تعذّر تحميل الطلبات السابقة.");
        return;
      }
      const data = await response.json() as { items?: JobApplicationPrefillSnapshot[] };
      const nextItems = Array.isArray(data.items) ? data.items : [];
      setItems(nextItems);
      if (nextItems.length === 0) {
        setMessage("لا يوجد طلب سابق مرتبط بهذا الحساب.");
        return;
      }
      if (nextItems.length === 1) {
        onFill(nextItems[0]);
        setSelectedId(nextItems[0].applicationId);
        setMessage("تمت تعبئة البيانات من طلبك السابق.");
        return;
      }
      setSelectedId(nextItems[0].applicationId);
      setMessage("اختر الطلب السابق الذي تريد استخدامه.");
    } finally {
      setLoading(false);
    }
  }

  function fillSelected() {
    const selected = items?.find((item) => item.applicationId === selectedId);
    if (!selected) return;
    onFill(selected);
    setMessage("تمت تعبئة البيانات من الطلب المحدد.");
  }
  return (
    <div className="profile-fields-stack" style={{ gap: 8 }}>
      <button type="button" className={className} onClick={() => { void loadPrevious(); }} disabled={loading}>
        {loading ? "جارٍ تحميل الطلبات السابقة…" : "تعبئة من طلب سابق"}
      </button>
      {items && items.length > 1 ? (
        <div className="profile-fields-stack" style={{ gap: 8 }}>
          <select className="input" value={selectedId} onChange={(event) => setSelectedId(event.target.value)}>
            {items.map((item) => (
              <option key={item.applicationId} value={item.applicationId}>
                {item.label}{item.createdAt ? ` · ${new Date(item.createdAt).toLocaleDateString("ar-LB")}` : ""}
              </option>
            ))}
          </select>
          <button type="button" className={className} onClick={fillSelected}>استخدام الطلب المحدد</button>
        </div>
      ) : null}
      {message ? <small aria-live="polite">{message}</small> : null}
    </div>
  );
}
