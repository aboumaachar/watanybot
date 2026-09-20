import { describe, expect, it, vi } from "vitest";
import { updateProcedureDraft, type ProcedureLocalizedDraftInput } from "../auth/procedureMutationAdapter";

const input: ProcedureLocalizedDraftInput = {
  id: "payload-procedure-id",
  procedureCode: "proc-ud3reference",
  ar: { title: "عنوان جديد", summary: "ملخص جديد", steps: ["خطوة"] },
  en: { title: "New title", summary: "New summary", steps: ["Step"] },
};

const projectedUser = { collection: "gateway-admins", gatewayUserId: "gateway-user-1", capabilitySnapshot: ["cms.edit"] };

describe("Payload Procedure mutation adapter", () => {
  it("uses the projected Gateway user, access checks, and draft locale updates", async () => {
    const payload = {
      findByID: vi.fn().mockResolvedValue({ procedureCode: input.procedureCode }),
      update: vi.fn().mockResolvedValue({ _status: "draft", procedureCode: input.procedureCode }),
    } as any;
    await updateProcedureDraft(payload, { user: projectedUser } as any, input);
    expect(payload.findByID).toHaveBeenCalledWith(expect.objectContaining({ overrideAccess: false, user: projectedUser }));
    expect(payload.update).toHaveBeenCalledTimes(2);
    for (const [call] of payload.update.mock.calls) {
      expect(call).toEqual(expect.objectContaining({ draft: true, overrideAccess: false, user: projectedUser }));
      expect(call.data.procedureCode).toBe(input.procedureCode);
      expect(call.data._status).toBe("draft");
    }
    expect(payload.update.mock.calls.map(([call]: any) => call.locale)).toEqual(["ar", "en"]);
  });

  it("rejects a procedureCode mutation before Payload update", async () => {
    const payload = {
      findByID: vi.fn().mockResolvedValue({ procedureCode: "proc-original" }),
      update: vi.fn(),
    } as any;
    await expect(updateProcedureDraft(payload, { user: projectedUser } as any, input)).rejects.toThrow("PROCEDURE_CODE_IMMUTABLE");
    expect(payload.update).not.toHaveBeenCalled();
  });
});
