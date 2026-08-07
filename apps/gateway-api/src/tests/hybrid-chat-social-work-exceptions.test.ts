import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Mock } from "vitest";
import type { LiveSearchResponse } from "../services/kb/kb-search.service";

const { searchKbLiveMock } = vi.hoisted(() => ({
  searchKbLiveMock: vi.fn(),
}));

vi.mock("../services/kb/kb-search.service", () => ({
  searchKbLive: searchKbLiveMock,
}));

const { runHybridKbChat } = await import("../services/chat/hybrid-chat.service");
const { searchKbLive } = await import("../services/kb/kb-search.service");

function buildLiveSearchResponse(): LiveSearchResponse {
  return {
    query: "world cup fixtures",
    normalizedQuery: "world cup fixtures",
    expandedTerms: ["world cup fixtures"],
    tags: [],
    documents: [
      {
        id: "doc-world-cup-1",
        title: "World Cup fixture schedule",
        kbId: "wc-1",
        sourceUrl: "/kb/world-cup/schedule",
        tags: ["world-cup"],
        sourceType: "document",
        excerpt: "Upcoming World Cup match schedule.",
        score: 91,
        matchedFields: ["title"],
        matchedTerms: ["world cup"],
      },
    ],
    suggestedQuestions: ["What are today's matches?"],
    ambiguous: false,
    indexStats: {
      records: 1,
      sources: 1,
      generatedAt: new Date().toISOString(),
      sourceRoots: ["mock"],
    },
    generatedAt: new Date().toISOString(),
  };
}

describe("runHybridKbChat social/work contextual exceptions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (searchKbLive as Mock).mockResolvedValue(buildLiveSearchResponse());
  });

  it("bypasses KB retrieval for social chat context", async () => {
    const result = await runHybridKbChat({
      message: "chat with my group",
      conversationId: "conv-social-1",
      contextual: {
        chatMode: "social",
        pageContext: "community",
      },
    });

    expect(searchKbLive).not.toHaveBeenCalled();
    expect(result.mode).toBe("clarification-required");
    expect(result.sources).toEqual([]);
    expect(result.confidence).toBe(0);
    expect(result.conversationId).toBe("conv-social-1");
    expect(result.answer.toLowerCase()).toContain("social");
    expect(result.followUps).toContain("Continue in the social thread");
    expect(result.actions).toEqual([
      { kind: "clear_context", label: "Switch back to assistant context" },
    ]);
  });

  it("bypasses KB retrieval for work chat context", async () => {
    const result = await runHybridKbChat({
      message: "help with my tasks",
      contextual: {
        chatMode: "WORK",
        pageContext: "jobs",
      },
    });

    expect(searchKbLive).not.toHaveBeenCalled();
    expect(result.mode).toBe("clarification-required");
    expect(result.sources).toEqual([]);
    expect(result.confidence).toBe(0);
    expect(result.answer.toLowerCase()).toContain("work");
    expect(result.followUps).toContain("Continue in work chat");
  });

  it("keeps KB retrieval enabled for hybrid context", async () => {
    const result = await runHybridKbChat({
      message: "what are world cup matches today",
      contextual: {
        chatMode: "hybrid",
        pageContext: "world-cup",
        pageKeywords: ["world cup", "matches", "teams"],
      },
    });

    expect(searchKbLive).toHaveBeenCalledTimes(1);
    expect(searchKbLive).toHaveBeenCalledWith(
      expect.stringContaining("world cup"),
      expect.objectContaining({
        limit: 8,
        selectedTags: [],
      }),
    );
    expect(result.sources.length).toBeGreaterThan(0);
    expect(result.mode).toBe("retrieval-context-ready");
    expect(result.confidence).toBeGreaterThan(0);
  });
});
