export type ProcedureTitleLike = {
  titleAr?: string | null;
  title?: string | null;
  nameAr?: string | null;
  name?: string | null;
};

export function renderProcedureTitle(procedure: ProcedureTitleLike | null | undefined): string {
  if (!procedure) return "";
  return (
    procedure.titleAr?.trim() ||
    procedure.nameAr?.trim() ||
    procedure.title?.trim() ||
    procedure.name?.trim() ||
    ""
  );
}

export const PROCEDURES_FORCE_ARABIC_UI = true;