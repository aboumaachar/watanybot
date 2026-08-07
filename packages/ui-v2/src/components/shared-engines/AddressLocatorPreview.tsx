export interface AddressLocatorPreviewProps {
  label: string;
  mode?: "registration" | "display" | "search" | "map" | "analytics";
}

export function AddressLocatorPreview({ label, mode = "display" }: AddressLocatorPreviewProps) {
  return (
    <section className="watany-engine-preview" data-engine="address" data-mode={mode}>
      <h3>محدد العنوان</h3>
      <p>{label || "اختر المحافظة / القضاء / البلدة"}</p>
    </section>
  );
}
