import { beforeEach, describe, expect, it, vi } from "vitest";

const { queryMock } = vi.hoisted(() => ({ queryMock: vi.fn() }));
vi.mock("../../lib/db.js", () => ({
  query: queryMock,
  getClient: vi.fn(),
}));

import { updateGenericCmsEntity } from "./genericCmsRepository.js";

describe("generic CMS optimistic revision guard", () => {
  beforeEach(() => queryMock.mockReset());

  it("fails closed when expected revision is stale", async () => {
    queryMock
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ revision: 9 }] });

    const result = updateGenericCmsEntity("articles", "article-1", {
      title: "Updated title",
      updatedBy: "editor-1",
      expectedRevision: 8,
    });

    await expect(result).rejects.toMatchObject({
      message: "CMS_REVISION_CONFLICT",
      code: "CMS_REVISION_CONFLICT",
      currentRevision: 9,
    });
    expect(queryMock).toHaveBeenCalledTimes(2);
    const [sql, params] = queryMock.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain("($18::int IS NULL OR revision = $18)");
    expect(params.at(-1)).toBe(8);
  });
});
