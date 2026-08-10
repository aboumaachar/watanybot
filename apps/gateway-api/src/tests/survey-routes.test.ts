import Fastify from "fastify";
import { afterEach, describe, expect, it, vi } from "vitest";

import { initPluginDb } from "../db/plugin-db";
import { surveyRoutes } from "../routes/survey";
import type { PluginDb } from "../types/domain";

async function createVotingPluginDb(role: "public" | "accredited" | "moderator" | "admin" | "superadmin" = "accredited"): Promise<PluginDb> {
  const pluginDb = await initPluginDb(":memory:", false, {
    info: () => undefined,
    warn: () => undefined,
  });

  pluginDb.prepare("UPDATE profile SET name = ?, phone = ?, email = ?, region = ?, note = ?, role = ?, is_authed = ?, last_login = ? WHERE id = ?")
    .run("Voting Tester", "", "tester@watany.test", "", "", role, 1, Date.now(), "default");

  return pluginDb;
}

afterEach(() => {
  delete process.env.VOTING_SUPABASE_URL;
  delete process.env.VOTING_SUPABASE_SERVICE_ROLE_KEY;
  delete process.env.VOTING_SUPABASE_ANON_KEY;
  delete process.env.SUPABASE_URL;
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  delete process.env.SUPABASE_ANON_KEY;
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("survey routes", () => {
  it("replaces stale local voting items with the WatanyBot feedback surveys", async () => {
    const pluginDb = await createVotingPluginDb();
    pluginDb.prepare("INSERT INTO voting_elections (id, title, description, status, created_by, start_date, end_date, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)")
      .run("legacy-local-election", "استطلاع قديم", "يجب استبداله", "active", "legacy-user", null, null, Date.now() - 10_000, Date.now() - 10_000);
    pluginDb.prepare("INSERT INTO voting_candidates (id, election_id, name, description, image_url, created_at) VALUES (?, ?, ?, ?, ?, ?)")
      .run("legacy-local-option", "legacy-local-election", "خيار قديم", null, null, Date.now() - 9_000);
    const app = Fastify();
    app.register(surveyRoutes, { pluginDb });
    await app.ready();

    const statusResponse = await app.inject({ method: "GET", url: "/api/voting/status" });
    expect(statusResponse.statusCode).toBe(200);
    expect(statusResponse.json()).toEqual({
      ready: true,
      implemented: true,
      provider: "watany_plugin_db",
      scope: "watany_gateway",
      nextStep: expect.any(String),
    });

    const listResponse = await app.inject({ method: "GET", url: "/api/voting/elections" });
    expect(listResponse.statusCode).toBe(200);
    expect(listResponse.json()).toEqual({
      items: [
        {
          id: "watanybot-feature-usage-intent",
          title: "هل ترغب في استخدام ميزات موطني بوت؟",
          description: "ساعدنا في معرفة مدى استعدادك لاستخدام خدمات موطني بوت اليومية.",
          status: "active",
          startDate: "2026-08-01T00:00:00.000Z",
          endDate: "2026-12-31T23:59:59.000Z",
          createdBy: "system:watanybot-demo",
          optionCount: 3,
          hasVoted: false,
        },
        {
          id: "watanybot-user-satisfaction",
          title: "ما مدى رضاك عن تطبيق موطني بوت؟",
          description: "نستخدم رأيك لتحسين تجربة المساعد والخدمات الرقمية داخل التطبيق.",
          status: "active",
          startDate: "2026-08-01T00:00:00.000Z",
          endDate: "2026-12-31T23:59:59.000Z",
          createdBy: "system:watanybot-demo",
          optionCount: 4,
          hasVoted: false,
        },
      ],
    });

    await app.close();
  });

  it("lets public users browse polls while keeping voting gated", async () => {
    const pluginDb = await createVotingPluginDb("public");
    const app = Fastify();
    app.register(surveyRoutes, { pluginDb });
    await app.ready();

    const listResponse = await app.inject({ method: "GET", url: "/api/voting/elections" });
    expect(listResponse.statusCode).toBe(200);
    expect((listResponse.json() as { items: Array<{ id: string }> }).items).toHaveLength(2);

    const closedListResponse = await app.inject({ method: "GET", url: "/api/voting/elections?status=closed" });
    expect(closedListResponse.statusCode).toBe(200);
    expect(closedListResponse.json()).toMatchObject({
      items: [
        expect.objectContaining({
          id: "world-cup-2026-final-argentina-spain",
          status: "closed",
          optionCount: 2,
        }),
      ],
    });

    const detailResponse = await app.inject({ method: "GET", url: "/api/voting/elections/watanybot-feature-usage-intent" });
    expect(detailResponse.statusCode).toBe(200);
    expect(detailResponse.json()).toMatchObject({
      election: {
        id: "watanybot-feature-usage-intent",
        title: "هل ترغب في استخدام ميزات موطني بوت؟",
        optionCount: 3,
      },
      canVote: false,
      hasVoted: false,
      options: expect.arrayContaining([
        expect.objectContaining({ name: "نعم، بالتأكيد" }),
        expect.objectContaining({ name: "ربما بعد التعرف عليها" }),
      ]),
    });

    const resultsResponse = await app.inject({ method: "GET", url: "/api/voting/elections/world-cup-2026-final-argentina-spain/results" });
    expect(resultsResponse.statusCode).toBe(200);
    expect(resultsResponse.json()).toEqual({
      electionId: "world-cup-2026-final-argentina-spain",
      totalVotes: 10,
      items: [
        {
          optionId: "world-cup-2026-final-argentina-spain-spain",
          optionName: "إسبانيا",
          voteCount: 7,
        },
        {
          optionId: "world-cup-2026-final-argentina-spain-argentina",
          optionName: "الأرجنتين",
          voteCount: 3,
        },
      ],
    });

    await app.close();
  });

  it("bootstraps legacy elections into the Watany store and serves them natively", async () => {
    process.env.VOTING_SUPABASE_URL = "https://voting.example.supabase.co";
    process.env.VOTING_SUPABASE_ANON_KEY = "bridge-anon-key";

    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify([
        {
          id: "election-1",
          title: "مجلس المتقاعدين",
          description: "استطلاع الهيئة الإدارية",
          status: "active",
          start_date: "2026-05-23T08:00:00.000Z",
          end_date: "2026-05-24T20:00:00.000Z",
          created_by: "legacy-user-1",
          created_at: "2026-05-20T08:00:00.000Z",
          updated_at: "2026-05-20T08:10:00.000Z",
        },
        {
          id: "election-2",
          title: "لجنة الخدمات",
          description: null,
          status: "active",
          start_date: null,
          end_date: null,
          created_by: "legacy-user-2",
          created_at: "2026-05-22T10:00:00.000Z",
          updated_at: "2026-05-22T12:00:00.000Z",
        },
      ]), {
        status: 200,
        headers: { "content-type": "application/json" },
      }))
      .mockResolvedValueOnce(new Response(JSON.stringify([
        {
          id: "candidate-1",
          election_id: "election-1",
          name: "المرشح الأول",
          description: null,
          image_url: null,
          created_at: "2026-05-20T08:05:00.000Z",
        },
        {
          id: "candidate-2",
          election_id: "election-1",
          name: "المرشح الثاني",
          description: "برنامج خدمات",
          image_url: null,
          created_at: "2026-05-20T08:06:00.000Z",
        },
        {
          id: "candidate-3",
          election_id: "election-2",
          name: "مرشح الخدمات",
          description: null,
          image_url: null,
          created_at: "2026-05-22T10:05:00.000Z",
        },
      ]), {
        status: 200,
        headers: { "content-type": "application/json" },
      }))
      .mockResolvedValueOnce(new Response(JSON.stringify([]), {
        status: 200,
        headers: { "content-type": "application/json" },
      }))
      .mockResolvedValueOnce(new Response(JSON.stringify([
        {
          candidate_id: "candidate-2",
          candidate_name: "المرشح الثاني",
          vote_count: 7,
        },
        {
          candidate_id: "candidate-1",
          candidate_name: "المرشح الأول",
          vote_count: 5,
        },
      ]), {
        status: 200,
        headers: { "content-type": "application/json" },
      }))
      .mockResolvedValueOnce(new Response(JSON.stringify([
        {
          candidate_id: "candidate-3",
          candidate_name: "مرشح الخدمات",
          vote_count: 2,
        },
      ]), {
        status: 200,
        headers: { "content-type": "application/json" },
      }));
    vi.stubGlobal("fetch", fetchMock);

    const pluginDb = await createVotingPluginDb();
    const app = Fastify();
    app.register(surveyRoutes, { pluginDb });
    await app.ready();

    const statusResponse = await app.inject({ method: "GET", url: "/api/voting/status" });
    expect(statusResponse.statusCode).toBe(200);
    expect(statusResponse.json()).toEqual({
      ready: true,
      implemented: true,
      provider: "watany_plugin_db",
      scope: "watany_gateway",
      nextStep: expect.any(String),
    });

    const listResponse = await app.inject({ method: "GET", url: "/api/voting/elections" });
    expect(listResponse.statusCode).toBe(200);
    expect(listResponse.json()).toEqual({
      items: [
        {
          id: "election-2",
          title: "لجنة الخدمات",
          description: null,
          status: "active",
          startDate: null,
          endDate: null,
          createdBy: "legacy-user-2",
          optionCount: 1,
          hasVoted: false,
        },
        {
          id: "election-1",
          title: "مجلس المتقاعدين",
          description: "استطلاع الهيئة الإدارية",
          status: "active",
          startDate: "2026-05-23T08:00:00.000Z",
          endDate: "2026-05-24T20:00:00.000Z",
          createdBy: "legacy-user-1",
          optionCount: 2,
          hasVoted: false,
        },
      ],
    });

    const detailResponse = await app.inject({ method: "GET", url: "/api/voting/elections/election-1" });
    expect(detailResponse.statusCode).toBe(200);
    expect(detailResponse.json()).toEqual({
      election: {
        id: "election-1",
        title: "مجلس المتقاعدين",
        description: "استطلاع الهيئة الإدارية",
        status: "active",
        startDate: "2026-05-23T08:00:00.000Z",
        endDate: "2026-05-24T20:00:00.000Z",
        createdBy: "legacy-user-1",
        optionCount: 2,
        hasVoted: false,
      },
      options: [
        {
          id: "candidate-1",
          name: "المرشح الأول",
          description: null,
          imageUrl: null,
        },
        {
          id: "candidate-2",
          name: "المرشح الثاني",
          description: "برنامج خدمات",
          imageUrl: null,
        },
      ],
      canEdit: false,
      canVote: true,
      hasVoted: false,
    });

    const resultsResponse = await app.inject({ method: "GET", url: "/api/voting/elections/election-1/results" });
    expect(resultsResponse.statusCode).toBe(200);
    expect(resultsResponse.json()).toEqual({
      electionId: "election-1",
      totalVotes: 12,
      items: [
        {
          optionId: "candidate-2",
          optionName: "المرشح الثاني",
          voteCount: 7,
        },
        {
          optionId: "candidate-1",
          optionName: "المرشح الأول",
          voteCount: 5,
        },
      ],
    });

    expect(fetchMock).toHaveBeenCalledTimes(5);
    expect(fetchMock.mock.calls[0]?.[0]).toContain("/rest/v1/elections?");
    expect(fetchMock.mock.calls[1]?.[0]).toContain("/rest/v1/candidates?");
    expect(fetchMock.mock.calls[2]?.[0]).toContain("/rest/v1/votes?");
    expect(fetchMock.mock.calls[3]?.[0]).toContain("/rest/v1/rpc/get_election_results");

    await app.close();
  });

  it("creates elections and casts votes entirely inside the Watany store", async () => {
    const pluginDb = await createVotingPluginDb("moderator");
    const app = Fastify();
    app.register(surveyRoutes, { pluginDb });
    await app.ready();

    const createResponse = await app.inject({
      method: "POST",
      url: "/api/voting/elections",
      payload: {
        title: "استطلاع المجلس المحلي",
        description: "اختيار ممثلي المجلس",
        status: "active",
        options: [
          { name: "المرشح أ" },
          { name: "المرشح ب", description: "برنامج تحسين الخدمات" },
        ],
      },
    });

    expect(createResponse.statusCode).toBe(201);
    const created = createResponse.json() as {
      election: { id: string; title: string; optionCount: number };
      options: Array<{ id: string; name: string; description?: string | null }>;
      canVote: boolean;
    };
    expect(created.election.title).toBe("استطلاع المجلس المحلي");
    expect(created.election.optionCount).toBe(2);
    expect(created.canVote).toBe(true);

    const optionA = created.options.find((option) => option.name === "المرشح أ");
    const optionB = created.options.find((option) => option.name === "المرشح ب");
    expect(created.options).toHaveLength(2);
    expect(optionA?.id).toBeTruthy();
    expect(optionB?.id).toBeTruthy();

    const adminListResponse = await app.inject({ method: "GET", url: "/api/voting/admin/elections" });
    expect(adminListResponse.statusCode).toBe(200);
    expect((adminListResponse.json() as {
      items: Array<{ election: { id: string; title: string; optionCount: number }; canEdit: boolean }>;
    }).items).toEqual(expect.arrayContaining([
      expect.objectContaining({
        election: expect.objectContaining({
          id: created.election.id,
          title: "استطلاع المجلس المحلي",
          optionCount: 2,
        }),
        canEdit: true,
      }),
    ]));

    const updateElectionResponse = await app.inject({
      method: "PATCH",
      url: `/api/voting/elections/${created.election.id}`,
      payload: {
        title: "استطلاع المجلس المحلي 2026",
        description: "اختيار ممثلي المجلس المحلي",
        status: "active",
      },
    });
    expect(updateElectionResponse.statusCode).toBe(200);
    expect(updateElectionResponse.json()).toMatchObject({
      election: {
        id: created.election.id,
        title: "استطلاع المجلس المحلي 2026",
        description: "اختيار ممثلي المجلس المحلي",
        status: "active",
        optionCount: 2,
      },
    });

    const addOptionResponse = await app.inject({
      method: "POST",
      url: `/api/voting/elections/${created.election.id}/options`,
      payload: {
        name: "المرشح ج",
        description: "برنامج ميداني إضافي",
      },
    });
    expect(addOptionResponse.statusCode).toBe(200);
    expect(addOptionResponse.json()).toMatchObject({
      election: {
        id: created.election.id,
        title: "استطلاع المجلس المحلي 2026",
        optionCount: 3,
      },
      options: expect.arrayContaining([
        expect.objectContaining({ name: "المرشح ج", description: "برنامج ميداني إضافي" }),
      ]),
    });

    const optionC = (addOptionResponse.json() as {
      options: Array<{ id: string; name: string }>;
    }).options.find((option) => option.name === "المرشح ج");
    expect(optionC?.id).toBeTruthy();

    const removeOptionResponse = await app.inject({
      method: "DELETE",
      url: `/api/voting/elections/${created.election.id}/options/${optionC?.id}`,
    });
    expect(removeOptionResponse.statusCode).toBe(200);
    const afterOptionRemoval = removeOptionResponse.json() as {
      election: { title: string; optionCount: number };
      options: Array<{ id: string; name: string }>;
    };
    expect(afterOptionRemoval.election).toMatchObject({
      title: "استطلاع المجلس المحلي 2026",
      optionCount: 2,
    });
    expect(afterOptionRemoval.options.some((option) => option.name === "المرشح ج")).toBe(false);

    const addReplacementOptionResponse = await app.inject({
      method: "POST",
      url: `/api/voting/elections/${created.election.id}/options`,
      payload: {
        name: "المرشح د",
        description: "برنامج بديل بعد الحذف",
      },
    });
    expect(addReplacementOptionResponse.statusCode).toBe(200);
    expect(addReplacementOptionResponse.json()).toMatchObject({
      election: {
        id: created.election.id,
        title: "استطلاع المجلس المحلي 2026",
        optionCount: 3,
      },
      options: expect.arrayContaining([
        expect.objectContaining({ name: "المرشح د", description: "برنامج بديل بعد الحذف" }),
      ]),
    });

    const createTemporaryElectionResponse = await app.inject({
      method: "POST",
      url: "/api/voting/elections",
      payload: {
        title: "استطلاع مؤقت للحذف",
        description: "سجل اختبار للحذف الإداري",
        status: "draft",
        options: [
          { name: "مرشح مؤقت" },
        ],
      },
    });
    expect(createTemporaryElectionResponse.statusCode).toBe(201);
    const temporaryElectionId = (createTemporaryElectionResponse.json() as {
      election: { id: string };
    }).election.id;

    const deleteTemporaryElectionResponse = await app.inject({
      method: "DELETE",
      url: `/api/voting/elections/${temporaryElectionId}`,
    });
    expect(deleteTemporaryElectionResponse.statusCode).toBe(200);
    expect(deleteTemporaryElectionResponse.json()).toEqual({ ok: true });

    const adminListAfterDeleteResponse = await app.inject({ method: "GET", url: "/api/voting/admin/elections" });
    expect(adminListAfterDeleteResponse.statusCode).toBe(200);
    expect((adminListAfterDeleteResponse.json() as {
      items: Array<{ election: { id: string } }>;
    }).items.some((item) => item.election.id === temporaryElectionId)).toBe(false);

    pluginDb.prepare("UPDATE profile SET name = ?, phone = ?, email = ?, region = ?, note = ?, role = ?, is_authed = ?, last_login = ? WHERE id = ?")
      .run("Voting Tester", "", "tester@watany.test", "", "", "accredited", 1, Date.now(), "default");

    const detailBeforeVote = await app.inject({ method: "GET", url: `/api/voting/elections/${created.election.id}` });
    expect(detailBeforeVote.statusCode).toBe(200);
    expect(detailBeforeVote.json()).toMatchObject({
      canVote: true,
      hasVoted: false,
      election: {
        title: "استطلاع المجلس المحلي 2026",
        optionCount: 3,
      },
      options: expect.arrayContaining([
        expect.objectContaining({ name: "المرشح د" }),
      ]),
    });

    const voteResponse = await app.inject({
      method: "POST",
      url: `/api/voting/elections/${created.election.id}/vote`,
      payload: { optionId: optionA?.id },
    });
    expect(voteResponse.statusCode).toBe(200);
    expect(voteResponse.json()).toEqual({ ok: true });

    const duplicateVoteResponse = await app.inject({
      method: "POST",
      url: `/api/voting/elections/${created.election.id}/vote`,
      payload: { optionId: optionB?.id },
    });
    expect(duplicateVoteResponse.statusCode).toBe(409);
    expect(duplicateVoteResponse.json()).toEqual({ error: "you have already voted in this election" });

    const detailAfterVote = await app.inject({ method: "GET", url: `/api/voting/elections/${created.election.id}` });
    expect(detailAfterVote.statusCode).toBe(200);
    expect(detailAfterVote.json()).toMatchObject({
      canVote: false,
      hasVoted: true,
      election: {
        hasVoted: true,
        optionCount: 3,
      },
    });

    const resultsResponse = await app.inject({ method: "GET", url: `/api/voting/elections/${created.election.id}/results` });
    expect(resultsResponse.statusCode).toBe(200);
    expect(resultsResponse.json()).toEqual({
      electionId: created.election.id,
      totalVotes: 1,
      items: [
        {
          optionId: optionA?.id,
          optionName: "المرشح أ",
          voteCount: 1,
        },
        {
          optionId: optionB?.id,
          optionName: "المرشح ب",
          voteCount: 0,
        },
        {
          optionId: expect.any(String),
          optionName: "المرشح د",
          voteCount: 0,
        },
      ],
    });

    await app.close();
  });
});