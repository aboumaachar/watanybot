import React from "react";
import UniversalListingCard from "./UniversalListingCard";

export type ProcedureLike = {
  id?: string | number;
  title?: string;
  name?: string;
  summary?: string;
  description?: string;
  tags?: string[];
};

export default function ProceduresCardAdapter({ procedure }: Readonly<{ procedure: ProcedureLike }>) {
  const id = procedure?.id ?? "";
  const title = procedure?.title ?? procedure?.name ?? "إجراء";
  const summary = procedure?.summary ?? procedure?.description ?? "";
  const badges = procedure?.tags ?? [];
  const detailHref = id ? `/procedures?procedure=${encodeURIComponent(String(id))}` : "/procedures";
  const formsHref = id ? `/procedures?procedure=${encodeURIComponent(String(id))}#forms` : "/procedures#forms";

  const openDetail = () => {
    globalThis.location.href = detailHref;
  };

  const openForms = () => {
    globalThis.location.href = formsHref;
  };

  return (
    <UniversalListingCard
      id={String(id)}
      title={title}
      badges={badges}
      summary={summary}
      actions={[
        { label: "عرض", onClick: openDetail },
        { label: "نماذج", onClick: openForms },
      ]}
      expanded={summary ? <p>{summary}</p> : undefined}
    />
  );
}
