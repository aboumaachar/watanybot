import { useEffect, useMemo, useState } from "react";
import type { LebanonAddressValue } from "../address/addressTypes";
import { authFetch } from "../../lib/api";
import { useApp } from "../../store/app";

type Draft = Record<string, unknown> & { address?: Partial<LebanonAddressValue>; interests?: string[] };
type Template = { id: string; campaignId: string; label: string; draft: Draft };
type ApplicantDraft = { name?: string; phone?: string; email?: string };

type Props<T extends ApplicantDraft> = {
  value: T;
  onChange: (next: T) => void;
  onAddressChange?: (next: Partial<LebanonAddressValue>) => void;
  onInterestsChange?: (next: string[]) => void;
  buttonClassName?: string;
};

export default function JobApplicationPrefillControls<T extends ApplicantDraft>({
  value, onChange, onAddressChange, onInterestsChange, buttonClassName = "btn btn-secondary",
}: Props<T>) {
  const { profile, apiBaseUrl } = useApp();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selected, setSelected] = useState("");
  const selectedTemplate = useMemo(() => templates.find((item) => item.id === selected), [templates, selected]);

  useEffect(() => {
    if (!profile.isAuthed) { setTemplates([]); return; }
    let active = true;
    void authFetch(`${apiBaseUrl}/api/jobs/application-templates/mine`).then(async (response) => {
      if (!active || !response.ok) return;
      const data = await response.json() as { items?: Template[] };
      if (active) setTemplates(data.items ?? []);
    }).catch(() => undefined);
    return () => { active = false; };
  }, [apiBaseUrl, profile.isAuthed]);

  if (!profile.isAuthed) return null;

  function fillProfile() {
    onChange({ ...value, name: profile.name || value.name || "", phone: profile.phone || value.phone || "", email: profile.email || value.email || "" });
  }

  function applyPrevious() {
    if (!selectedTemplate) return;
    const draft = selectedTemplate.draft ?? {};
    const next: Record<string, unknown> = { ...value };
    for (const key of Object.keys(value)) {
      if (draft[key] !== undefined && draft[key] !== null) next[key] = String(draft[key]);
    }
    onChange(next as T);
    if (onAddressChange && draft.address) onAddressChange(draft.address);
    if (onInterestsChange && Array.isArray(draft.interests)) onInterestsChange(draft.interests.map(String));
  }

  return (
    <div data-feature-key="jobs.application-prefill" style={{ display: "grid", gap: 8, marginBlock: 8 }}>
      <button type="button" className={buttonClassName} onClick={fillProfile}>تعبئة من الملف الشخصي</button>
      {templates.length > 0 ? (
        <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) auto", gap: 8 }}>
          <select aria-label="اختيار طلب سابق" value={selected} onChange={(event) => setSelected(event.target.value)}>
            <option value="">اختر طلباً سابقاً</option>
            {templates.map((item) => <option key={`${item.campaignId}:${item.id}`} value={item.id}>{item.label}</option>)}
          </select>
          <button type="button" className={buttonClassName} disabled={!selectedTemplate} onClick={applyPrevious}>استخدام طلب سابق</button>
        </div>
      ) : null}
    </div>
  );
}
