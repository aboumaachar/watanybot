import { beforeEach, describe, expect, it, vi } from "vitest";
import { searchKbLive } from "../kb/kb-search.service";
import { runHybridKbChat } from "./hybrid-chat.service";

vi.mock("../kb/kb-search.service", () => ({ searchKbLive: vi.fn() }));
beforeEach(() => vi.resetAllMocks());

const documents = [
  { id: "school-1", kbId: "school", title: "إجراءات مدرسية", tags: ["school-grants"], sourceType: "procedure", score: 80 },
  { id: "retirement-1", kbId: "pension", title: "إفادة معاش", tags: ["pension"], sourceType: "salary", score: 90 },
];

describe("WB-KB-003: strict selected search scope", () => {
  it("keeps the selected tag even when another unrelated document ranks higher", async () => {
    vi.mocked(searchKbLive).mockResolvedValue({ documents, suggestedQuestions: [] } as never);
    const response = await runHybridKbChat({ message: "ما هي المستندات؟", selectedTags: ["school-grants"] });
    expect(response.sources.map((source) => source.id)).toEqual(["school-1"]);
  });

  it("returns clarification without unrelated citations when a selected tag has no match", async () => {
    vi.mocked(searchKbLive).mockResolvedValue({ documents, suggestedQuestions: [] } as never);
    const response = await runHybridKbChat({ message: "المساعدات", selectedTags: ["legal-library"] });
    expect(response.mode).toBe("clarification-required");
    expect(response.sources).toEqual([]);
    expect(response.confidence).toBe(0);
  });

  it("does not replace a mismatched selected KB source with results from another source", async () => {
    vi.mocked(searchKbLive).mockResolvedValue({ documents, suggestedQuestions: [] } as never);
    const response = await runHybridKbChat({ message: "اشرح", selectedKbIds: ["unknown-kb"] });
    expect(response.sources).toEqual([]);
    expect(response.mode).toBe("clarification-required");
  });

  it("enforces selected tags and KB IDs simultaneously", async () => {
    vi.mocked(searchKbLive).mockResolvedValue({ documents, suggestedQuestions: [] } as never);
    const response = await runHybridKbChat({ message: "اشرح", selectedTags: ["school-grants"], selectedKbIds: ["pension"] });
    expect(response.sources).toEqual([]);
  });
});
