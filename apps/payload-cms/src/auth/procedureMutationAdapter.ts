import type { Payload, PayloadRequest } from "payload";

export type ProcedureLocalizedDraftInput = {
  id: string | number;
  procedureCode: string;
  ar: { title: string; summary?: string; eligibility?: string[]; requirements?: string[]; steps: string[] };
  en: { title: string; summary?: string; eligibility?: string[]; requirements?: string[]; steps: string[] };
};

export async function updateProcedureDraft(payload: Payload, req: Partial<PayloadRequest>, input: ProcedureLocalizedDraftInput) {
  const existing = await payload.findByID({ collection: "procedures", id: input.id, depth: 0, overrideAccess: false, user: req.user });
  if (String(existing.procedureCode) !== input.procedureCode) throw new Error("PROCEDURE_CODE_IMMUTABLE");

  const results = [];
  for (const locale of ["ar", "en"] as const) {
    const localized = input[locale];
    results.push(await payload.update({
      collection: "procedures",
      id: input.id,
      locale,
      draft: true,
      overrideAccess: false,
      user: req.user,
      req,
      data: {
        procedureCode: input.procedureCode,
        title: localized.title,
        summary: localized.summary,
        eligibility: localized.eligibility?.map((item) => ({ item })),
        requirements: localized.requirements?.map((item) => ({ item })),
        steps: localized.steps.map((item) => ({ item })),
        _status: "draft",
        publicationState: "DRAFT",
        workflowStatus: "DRAFT",
      },
    }));
  }
  return results;
}
