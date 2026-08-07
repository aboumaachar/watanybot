export type ProceduresViewMode = "guided" | "catalog";

export const DEFAULT_PROCEDURES_VIEW_MODE: ProceduresViewMode = "guided";

export const PROCEDURES_VIEW_OPTIONS: ReadonlyArray<{
  mode: ProceduresViewMode;
  label: string;
}> = [
  { mode: "guided", label: "عرض موجّه للمتقاعد" },
  { mode: "catalog", label: "عرض كل الإجراءات" },
];

export function isGuidedProceduresViewMode(mode: ProceduresViewMode): boolean {
  return mode === "guided";
}