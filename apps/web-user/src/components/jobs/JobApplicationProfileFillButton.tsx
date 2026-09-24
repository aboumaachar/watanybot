import { useApp } from "../../store/app";

type ApplicantDraft = {
  name?: string;
  phone?: string;
  email?: string;
};

type Props<T extends ApplicantDraft> = {
  value: T;
  onChange: (next: T) => void;
  className?: string;
};

export default function JobApplicationProfileFillButton<T extends ApplicantDraft>({
  value,
  onChange,
  className,
}: Props<T>) {
  const { profile } = useApp();
  if (!profile.isAuthed) return null;

  return (
    <button
      type="button"
      className={className}
      onClick={() => onChange({
        ...value,
        name: profile.name || value.name || "",
        phone: profile.phone || value.phone || "",
        email: profile.email || value.email || "",
      })}
    >
      تعبئة من الملف الشخصي
    </button>
  );
}
