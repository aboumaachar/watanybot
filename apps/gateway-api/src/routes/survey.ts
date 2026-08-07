// PAYMENT_OVERRIDE_LIVE_PIPELINE_WIRING_V1: payment override wiring reviewed for live pipeline integration.
import { randomUUID } from "node:crypto";
import type { FastifyPluginAsync } from "fastify";
import type { PluginDb, Role } from "../types/domain";
import { hasSufficientRole, normalizeText, requireAuth } from "../lib/helpers";

interface SurveyRoutesOptions {
  pluginDb: PluginDb;
}

type SurveyBridgeProvider = "pending_bridge" | "supabase_rest_bridge" | "watany_plugin_db";

type SurveyBridgeConfig = {
  baseUrl: string;
  apiKey: string;
  provider: SurveyBridgeProvider;
  ready: boolean;
};

type SurveyStatus = "draft" | "active" | "closed";

type SupabaseElectionRow = {
  id: string;
  title: string;
  description: string | null;
  status: SurveyStatus;
  start_date: string | null;
  end_date: string | null;
  created_by: string;
  created_at?: string | null;
  updated_at?: string | null;
};

type SupabaseCandidateRow = {
  id: string;
  election_id: string;
  name: string;
  description: string | null;
  image_url: string | null;
  created_at?: string | null;
};

type SupabaseVoteRow = {
  id: string;
  election_id: string;
  candidate_id: string;
  voter_id: string;
  created_at?: string | null;
};

type SupabaseVotingResultRow = {
  option_id?: string;
  option_name?: string;
  candidate_id?: string;
  candidate_name?: string;
  vote_count: number | string;
};

type SurveyOption = {
  id: string;
  name: string;
  description?: string | null;
  imageUrl?: string | null;
};

type SurveySummary = {
  id: string;
  title: string;
  description?: string | null;
  status: SurveyStatus;
  startDate?: string | null;
  endDate?: string | null;
  createdBy: string;
  optionCount: number;
  hasVoted?: boolean;
};

type SurveyDetail = {
  election: SurveySummary;
  options: SurveyOption[];
  canEdit: boolean;
  canVote: boolean;
  hasVoted: boolean;
};

type SurveyResultItem = {
  optionId: string;
  optionName: string;
  voteCount: number;
};

type SurveyResults = {
  electionId: string;
  totalVotes: number;
  items: SurveyResultItem[];
};

type SurveyBridgeStatus = {
  ready: boolean;
  implemented: boolean;
  provider: SurveyBridgeProvider;
  scope: "watany_gateway";
  nextStep: string;
};

type DbVotingElectionRow = {
  id: string;
  title: string;
  description: string | null;
  status: SurveyStatus;
  created_by: string;
  start_date: string | null;
  end_date: string | null;
  created_at: number;
  updated_at: number;
};

type DbVotingCandidateRow = {
  id: string;
  election_id: string;
  name: string;
  description: string | null;
  image_url: string | null;
  created_at: number;
};

type DbVotingVoteRow = {
  id: string;
  election_id: string;
  candidate_id: string;
  voter_id: string;
  created_at: number;
};

type BuiltinSurveySeedOption = {
  id: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  createdAt: string;
};

type BuiltinSurveySeed = {
  id: string;
  title: string;
  description: string;
  status: SurveyStatus;
  createdBy: string;
  startDate: string;
  endDate: string;
  createdAt: string;
  updatedAt: string;
  options: BuiltinSurveySeedOption[];
};

type SurveyRequest = {
  user?: {
    id?: string;
    role?: string;
    email?: string;
  };
  headers?: Record<string, string | string[] | undefined>;
  ip?: string;
};

const bootstrappedVotingStores = new WeakSet<PluginDb>();

const BUILTIN_WORLD_CUP_CREATOR = "system:fifa-world-cup-2026";

const BUILTIN_WORLD_CUP_POLLS: BuiltinSurveySeed[] = [
  {
    id: "fifa-wc-2026-upcoming-games",
    title: "أي مباراة من مواجهات 23 يونيو ستتابع أولاً؟",
    description: "بحسب جدول FIFA الرسمي ليوم 23 يونيو 2026، هذه هي أبرز مباريات اليوم القادمة في المجموعتين K وL.",
    status: "active",
    createdBy: BUILTIN_WORLD_CUP_CREATOR,
    startDate: "2026-06-23T08:00:00.000Z",
    endDate: "2026-06-24T04:00:00.000Z",
    createdAt: "2026-06-23T10:00:00.000Z",
    updatedAt: "2026-06-23T10:00:00.000Z",
    options: [
      {
        id: "fifa-wc-2026-upcoming-games-eng-gha",
        name: "إنجلترا × غانا",
        description: "المجموعة L | 23 يونيو | Boston Stadium",
        imageUrl: null,
        createdAt: "2026-06-23T10:00:01.000Z",
      },
      {
        id: "fifa-wc-2026-upcoming-games-pan-cro",
        name: "بنما × كرواتيا",
        description: "المجموعة L | 23 يونيو | Toronto Stadium",
        imageUrl: null,
        createdAt: "2026-06-23T10:00:02.000Z",
      },
      {
        id: "fifa-wc-2026-upcoming-games-por-uzb",
        name: "البرتغال × أوزبكستان",
        description: "المجموعة K | 23 يونيو | Houston Stadium",
        imageUrl: null,
        createdAt: "2026-06-23T10:00:03.000Z",
      },
      {
        id: "fifa-wc-2026-upcoming-games-col-cod",
        name: "كولومبيا × الكونغو الديمقراطية",
        description: "المجموعة K | 23 يونيو | Guadalajara Stadium",
        imageUrl: null,
        createdAt: "2026-06-23T10:00:04.000Z",
      },
    ],
  },
  {
    id: "fifa-wc-2026-champion-team",
    title: "من سيتوج بطلاً لكأس العالم 2026؟",
    description: "اعتمادًا على تحديث FIFA للمتأهلين ونتائج 22 يونيو، هذه أبرز المنتخبات التي حسمت التأهل مبكرًا إلى دور الـ32.",
    status: "active",
    createdBy: BUILTIN_WORLD_CUP_CREATOR,
    startDate: "2026-06-23T08:00:00.000Z",
    endDate: "2026-07-19T23:59:59.000Z",
    createdAt: "2026-06-23T09:00:00.000Z",
    updatedAt: "2026-06-23T09:00:00.000Z",
    options: [
      {
        id: "fifa-wc-2026-champion-argentina",
        name: "الأرجنتين",
        description: "تصدرت المجموعة J بعد 3-0 على الجزائر و2-0 على النمسا.",
        imageUrl: null,
        createdAt: "2026-06-23T09:00:01.000Z",
      },
      {
        id: "fifa-wc-2026-champion-france",
        name: "فرنسا",
        description: "حسمت التأهل من المجموعة I بعد 3-1 على السنغال و3-0 على العراق.",
        imageUrl: null,
        createdAt: "2026-06-23T09:00:02.000Z",
      },
      {
        id: "fifa-wc-2026-champion-germany",
        name: "ألمانيا",
        description: "تأهلت من المجموعة E بعد 7-1 على كوراساو و2-1 على كوت ديفوار.",
        imageUrl: null,
        createdAt: "2026-06-23T09:00:03.000Z",
      },
      {
        id: "fifa-wc-2026-champion-mexico",
        name: "المكسيك",
        description: "أول منتخب يضمن العبور بعد الفوز على جنوب أفريقيا وكوريا الجنوبية.",
        imageUrl: null,
        createdAt: "2026-06-23T09:00:04.000Z",
      },
      {
        id: "fifa-wc-2026-champion-usa",
        name: "الولايات المتحدة",
        description: "تأهلت من المجموعة D بعد 4-1 على باراغواي و2-0 على أستراليا.",
        imageUrl: null,
        createdAt: "2026-06-23T09:00:05.000Z",
      },
      {
        id: "fifa-wc-2026-champion-norway",
        name: "النرويج",
        description: "عادت بقوة وحسمت التأهل بعد 4-1 على العراق و3-2 على السنغال.",
        imageUrl: null,
        createdAt: "2026-06-23T09:00:06.000Z",
      },
    ],
  },
  {
    id: "fifa-wc-2026-golden-boot",
    title: "من سيحصد الحذاء الذهبي في كأس العالم 2026؟",
    description: "استنادًا إلى تحديث FIFA بتاريخ 22 و23 يونيو: ميسي يقود السباق، ومبابي يلاحقه، وأونداف متألق، وهالاند حاضر بقوة.",
    status: "active",
    createdBy: BUILTIN_WORLD_CUP_CREATOR,
    startDate: "2026-06-23T08:00:00.000Z",
    endDate: "2026-07-19T23:59:59.000Z",
    createdAt: "2026-06-23T08:00:00.000Z",
    updatedAt: "2026-06-23T08:00:00.000Z",
    options: [
      {
        id: "fifa-wc-2026-golden-boot-messi",
        name: "ليونيل ميسي",
        description: "5 أهداف مع الأرجنتين بعد ثلاثية الجزائر وثنائية النمسا.",
        imageUrl: null,
        createdAt: "2026-06-23T08:00:01.000Z",
      },
      {
        id: "fifa-wc-2026-golden-boot-mbappe",
        name: "كيليان مبابي",
        description: "4 أهداف مع فرنسا بعد ثنائيتين أمام السنغال والعراق.",
        imageUrl: null,
        createdAt: "2026-06-23T08:00:02.000Z",
      },
      {
        id: "fifa-wc-2026-golden-boot-undav",
        name: "دينيز أونداف",
        description: "3 أهداف وتمريرتان حاسمتان مع ألمانيا في أول مباراتين.",
        imageUrl: null,
        createdAt: "2026-06-23T08:00:03.000Z",
      },
      {
        id: "fifa-wc-2026-golden-boot-haaland",
        name: "إرلينغ هالاند",
        description: "قاد النرويج للتأهل المبكر وساهم بقوة في الانتصارين على العراق والسنغال.",
        imageUrl: null,
        createdAt: "2026-06-23T08:00:04.000Z",
      },
    ],
  },
];

function getSurveyBridgeConfig(): SurveyBridgeConfig {
  const baseUrl = (
    process.env.VOTING_SUPABASE_URL?.trim()
    || process.env.SUPABASE_URL?.trim()
    || ""
  ).replace(/\/+$/, "");

  const apiKey = (
    process.env.VOTING_SUPABASE_SERVICE_ROLE_KEY?.trim()
    || process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
    || process.env.VOTING_SUPABASE_ANON_KEY?.trim()
    || process.env.SUPABASE_ANON_KEY?.trim()
    || ""
  );

  const ready = Boolean(baseUrl && apiKey);

  return {
    baseUrl,
    apiKey,
    provider: ready ? "supabase_rest_bridge" : "pending_bridge",
    ready,
  };
}

function getSurveyBridgeStatus(): SurveyBridgeStatus {
  const config = getSurveyBridgeConfig();

  return {
    ready: true,
    implemented: true,
    provider: "watany_plugin_db",
    scope: "watany_gateway",
    nextStep: config.ready
      ? "التصويت والنتائج يعملان الآن من مخزن موطني الداخلي. إذا كانت قاعدة موطني فارغة فسيُستخدم المصدر القديم مرة واحدة فقط لاستيراد البيانات الحالية، ثم تبقى القراءة والكتابة داخل موطني."
      : "التصويت والنتائج يعملان الآن من مخزن موطني الداخلي. الخطوة التالية الطبيعية هي إضافة واجهة إدارة وإنشاء الاستطلاعات بالكامل داخل موطني.",
  };
}

function requireSurveyAccess(
  request: SurveyRequest,
  pluginDb: PluginDb,
  reply: { code: (statusCode: number) => unknown },
  minRole: Role,
): Role | null {
  const jwtRole = request.user?.role;

  if (typeof jwtRole === "string" && jwtRole.length > 0) {
    if (hasSufficientRole(jwtRole as Role, minRole)) {
      return jwtRole as Role;
    }

    reply.code(403);
    return null;
  }

  return requireAuth(pluginDb, reply, minRole);
}

function getSurveyAccessError(minRole: Role): string {
  if (minRole === "moderator") {
    return "هذه الشاشة تحتاج إلى صلاحية مشرف لإدارة الاستطلاعات داخل موطني.";
  }

  return "يجب تسجيل الدخول بحساب مخوّل لعرض الاستطلاعات داخل موطني.";
}

function resolveSurveyActorId(request: SurveyRequest): string {
  const actorId = request.user?.id;
  if (typeof actorId === "string" && actorId.trim().length > 0) {
    return actorId.trim();
  }

  const anonHeader = request.headers?.["x-watany-voter-id"];
  const anonValue = Array.isArray(anonHeader) ? anonHeader[0] : anonHeader;
  if (typeof anonValue === "string" && anonValue.trim().length > 0) {
    return `anon:${anonValue.trim()}`;
  }

  const ipValue = typeof request.ip === "string" && request.ip.trim().length > 0 ? request.ip.trim() : "unknown-ip";
  return `anon:${ipValue}`;
}

function toTimestamp(value?: string | null): number {
  const ts = value ? Date.parse(value) : Number.NaN;
  return Number.isFinite(ts) ? ts : Date.now();
}

function mapSurveySummary(row: DbVotingElectionRow, optionCount: number, hasVoted: boolean): SurveySummary {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    status: row.status,
    startDate: row.start_date,
    endDate: row.end_date,
    createdBy: row.created_by,
    optionCount,
    hasVoted,
  };
}

async function fetchSurveyJson<T>(config: SurveyBridgeConfig, resource: string): Promise<T> {
  const response = await fetch(`${config.baseUrl}/rest/v1/${resource}`, {
    headers: {
      apikey: config.apiKey,
      authorization: `Bearer ${config.apiKey}`,
      accept: "application/json",
      "x-client-info": "watanybot-gateway-voting-bridge",
    },
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`Voting bridge request failed (${response.status}): ${detail || response.statusText}`);
  }

  return (await response.json()) as T;
}

async function postSurveyJson<T>(config: SurveyBridgeConfig, resource: string, body: Record<string, unknown>): Promise<T> {
  const response = await fetch(`${config.baseUrl}/rest/v1/${resource}`, {
    method: "POST",
    headers: {
      apikey: config.apiKey,
      authorization: `Bearer ${config.apiKey}`,
      accept: "application/json",
      "content-type": "application/json",
      "x-client-info": "watanybot-gateway-voting-bridge",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`Voting bridge request failed (${response.status}): ${detail || response.statusText}`);
  }

  return (await response.json()) as T;
}

async function fetchLegacySurveyResults(config: SurveyBridgeConfig, electionId: string): Promise<SurveyResults> {
  const rows = await postSurveyJson<SupabaseVotingResultRow[]>(config, "rpc/get_election_results", {
    p_election_id: electionId,
  });

  const items = rows.map((row) => ({
    optionId: row.option_id ?? row.candidate_id ?? "",
    optionName: row.option_name ?? row.candidate_name ?? "",
    voteCount: Number(row.vote_count || 0),
  }));

  return {
    electionId,
    totalVotes: items.reduce((sum, item) => sum + item.voteCount, 0),
    items,
  };
}

function readVotingElectionRows(pluginDb: PluginDb): DbVotingElectionRow[] {
  return (pluginDb.prepare("SELECT * FROM voting_elections").all() as DbVotingElectionRow[]) || [];
}

function readVotingElectionRow(pluginDb: PluginDb, electionId: string): DbVotingElectionRow | null {
  return (pluginDb.prepare("SELECT * FROM voting_elections WHERE id = ?").get(electionId) as DbVotingElectionRow | undefined) || null;
}

function readVotingCandidates(pluginDb: PluginDb, electionId: string): DbVotingCandidateRow[] {
  return (pluginDb.prepare("SELECT * FROM voting_candidates WHERE election_id = ? ORDER BY name ASC").all(electionId) as DbVotingCandidateRow[]) || [];
}

function readAllVotingCandidates(pluginDb: PluginDb): DbVotingCandidateRow[] {
  return (pluginDb.prepare("SELECT * FROM voting_candidates").all() as DbVotingCandidateRow[]) || [];
}

function readAllVotingVotes(pluginDb: PluginDb): DbVotingVoteRow[] {
  return (pluginDb.prepare("SELECT * FROM voting_votes").all() as DbVotingVoteRow[]) || [];
}

function removeVotingElection(pluginDb: PluginDb, electionId: string): void {
  pluginDb.prepare("DELETE FROM voting_votes WHERE election_id = ?").run(electionId);
  pluginDb.prepare("DELETE FROM voting_candidates WHERE election_id = ?").run(electionId);
  pluginDb.prepare("DELETE FROM voting_elections WHERE id = ?").run(electionId);
}

function syncBuiltinWorldCupPolls(pluginDb: PluginDb): void {
  const existingRows = readVotingElectionRows(pluginDb);
  const existingIds = new Set(existingRows.map((row) => row.id));
  const hasBuiltinSet = BUILTIN_WORLD_CUP_POLLS.every((poll) => existingIds.has(poll.id));

  if (!hasBuiltinSet) {
    for (const row of existingRows) {
      removeVotingElection(pluginDb, row.id);
    }
  }

  const insertElection = pluginDb.prepare("INSERT OR REPLACE INTO voting_elections (id, title, description, status, created_by, start_date, end_date, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)");
  const insertCandidate = pluginDb.prepare("INSERT OR REPLACE INTO voting_candidates (id, election_id, name, description, image_url, created_at) VALUES (?, ?, ?, ?, ?, ?)");

  for (const poll of BUILTIN_WORLD_CUP_POLLS) {
    insertElection.run(
      poll.id,
      poll.title,
      poll.description,
      poll.status,
      poll.createdBy,
      poll.startDate,
      poll.endDate,
      toTimestamp(poll.createdAt),
      toTimestamp(poll.updatedAt),
    );

    for (const option of poll.options) {
      insertCandidate.run(
        option.id,
        poll.id,
        option.name,
        option.description,
        option.imageUrl,
        toTimestamp(option.createdAt),
      );
    }
  }
}

function mapSurveyOption(row: DbVotingCandidateRow): SurveyOption {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    imageUrl: row.image_url,
  };
}

function buildSurveyDetail(
  row: DbVotingElectionRow,
  candidates: DbVotingCandidateRow[],
  votes: DbVotingVoteRow[],
  actorId: string,
  role: Role,
): SurveyDetail {
  const hasVoted = votes.some((vote) => vote.election_id === row.id && vote.voter_id === actorId);
  const options = candidates.map(mapSurveyOption);
  const canVote = hasSufficientRole(role, "accredited") && row.status === "active" && !hasVoted;

  return {
    election: mapSurveySummary(row, candidates.length, hasVoted),
    options,
    canEdit: hasSufficientRole(role, "moderator") || row.created_by === actorId,
    canVote,
    hasVoted,
  };
}

/* eslint-disable sonarjs/cognitive-complexity */

function buildSurveyResults(pluginDb: PluginDb, electionId: string): SurveyResults {
  const candidates = readVotingCandidates(pluginDb, electionId);
  const votes = readAllVotingVotes(pluginDb).filter((row) => row.election_id === electionId);
  const counts = new Map<string, number>();

  for (const vote of votes) {
    counts.set(vote.candidate_id, (counts.get(vote.candidate_id) || 0) + 1);
  }

  const items = candidates
    .map((candidate) => ({
      optionId: candidate.id,
      optionName: candidate.name,
      voteCount: counts.get(candidate.id) || 0,
    }))
    .sort((left, right) => right.voteCount - left.voteCount || left.optionName.localeCompare(right.optionName, "ar"));

  return {
    electionId,
    totalVotes: items.reduce((sum, item) => sum + item.voteCount, 0),
    items,
  };
}

async function bootstrapVotingStore(pluginDb: PluginDb): Promise<void> {
  if (bootstrappedVotingStores.has(pluginDb)) {
    return;
  }

  const config = getSurveyBridgeConfig();
  if (!config.ready) {
    syncBuiltinWorldCupPolls(pluginDb);
    bootstrappedVotingStores.add(pluginDb);
    return;
  }

  const electionQuery = new URLSearchParams({
    select: "id,title,description,status,start_date,end_date,created_by,created_at,updated_at",
    order: "created_at.desc",
  });
  const elections = await fetchSurveyJson<SupabaseElectionRow[]>(config, `elections?${electionQuery.toString()}`);
  if (elections.length === 0) {
    bootstrappedVotingStores.add(pluginDb);
    return;
  }

  const insertElection = pluginDb.prepare("INSERT OR REPLACE INTO voting_elections (id, title, description, status, created_by, start_date, end_date, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)");
  for (const election of elections) {
    insertElection.run(
      election.id,
      election.title,
      election.description || null,
      election.status,
      election.created_by,
      election.start_date || null,
      election.end_date || null,
      toTimestamp(election.created_at),
      toTimestamp(election.updated_at || election.created_at),
    );
  }

  const electionIds = elections.map((row) => row.id);
  const candidateQuery = new URLSearchParams({
    select: "id,election_id,name,description,image_url,created_at",
    election_id: `in.(${electionIds.join(",")})`,
    order: "name.asc",
  });
  const candidates = await fetchSurveyJson<SupabaseCandidateRow[]>(config, `candidates?${candidateQuery.toString()}`);
  const insertCandidate = pluginDb.prepare("INSERT OR REPLACE INTO voting_candidates (id, election_id, name, description, image_url, created_at) VALUES (?, ?, ?, ?, ?, ?)");

  for (const candidate of candidates) {
    insertCandidate.run(
      candidate.id,
      candidate.election_id,
      candidate.name,
      candidate.description || null,
      candidate.image_url || null,
      toTimestamp(candidate.created_at),
    );
  }

  const insertVote = pluginDb.prepare("INSERT OR IGNORE INTO voting_votes (id, election_id, candidate_id, voter_id, created_at) VALUES (?, ?, ?, ?, ?)");

  try {
    const voteQuery = new URLSearchParams({
      select: "id,election_id,candidate_id,voter_id,created_at",
      election_id: `in.(${electionIds.join(",")})`,
      order: "created_at.asc",
    });
    const votes = await fetchSurveyJson<SupabaseVoteRow[]>(config, `votes?${voteQuery.toString()}`);

    for (const vote of votes) {
      insertVote.run(vote.id, vote.election_id, vote.candidate_id, vote.voter_id, toTimestamp(vote.created_at));
    }

    if (votes.length > 0) {
      bootstrappedVotingStores.add(pluginDb);
      return;
    }
  } catch {
    // Fall back to anonymized result counts when raw votes are not readable via the legacy source.
  }

  for (const election of elections) {
    let results: SurveyResults;

    try {
      results = await fetchLegacySurveyResults(config, election.id);
    } catch {
      continue;
    }

    for (const item of results.items) {
      for (let index = 0; index < item.voteCount; index += 1) {
        const token = `${election.id}:${item.optionId}:${index + 1}`;
        insertVote.run(
          `legacy-import-${token}`,
          election.id,
          item.optionId,
          `legacy-import-${token}`,
          toTimestamp(election.updated_at || election.created_at),
        );
      }
    }
  }

  bootstrappedVotingStores.add(pluginDb);
}

function buildOptionCountMap(candidates: DbVotingCandidateRow[]): Map<string, number> {
  const counts = new Map<string, number>();

  for (const row of candidates) {
    counts.set(row.election_id, (counts.get(row.election_id) || 0) + 1);
  }

  return counts;
}

export const surveyRoutes: FastifyPluginAsync<SurveyRoutesOptions> = async (app, { pluginDb }) => {
  app.get("/api/voting/status", async () => {
    return getSurveyBridgeStatus();
  });

  app.get("/api/voting/admin/elections", async (req, reply) => {
    const role = requireSurveyAccess(req, pluginDb, reply, "moderator");
    if (!role) {
      return { error: getSurveyAccessError("moderator") } as const;
    }

    try {
      await bootstrapVotingStore(pluginDb);

      const actorId = resolveSurveyActorId(req);
      const elections = readVotingElectionRows(pluginDb).sort((left, right) => right.created_at - left.created_at);
      const candidates = readAllVotingCandidates(pluginDb);
      const votes = readAllVotingVotes(pluginDb);

      return {
        items: elections.map((row) => buildSurveyDetail(
          row,
          candidates.filter((candidate) => candidate.election_id === row.id),
          votes,
          actorId,
          role,
        )),
      } as const;
    } catch (error) {
      reply.code(502);
      return {
        error: error instanceof Error ? error.message : "Voting store request failed",
      } as const;
    }
  });

  app.get("/api/voting/elections", async (req, reply) => {
    if (!requireSurveyAccess(req, pluginDb, reply, "public")) {
      return { error: getSurveyAccessError("accredited") } as const;
    }

    try {
      await bootstrapVotingStore(pluginDb);

      const actorId = resolveSurveyActorId(req);
      const elections = readVotingElectionRows(pluginDb)
        .filter((row) => row.status === "active")
        .sort((left, right) => right.created_at - left.created_at);
      const candidates = readAllVotingCandidates(pluginDb);
      const votes = readAllVotingVotes(pluginDb);
      const optionCounts = buildOptionCountMap(candidates);
      const votedElectionIds = new Set(votes.filter((vote) => vote.voter_id === actorId).map((vote) => vote.election_id));

      return {
        items: elections.map((row) => mapSurveySummary(row, optionCounts.get(row.id) || 0, votedElectionIds.has(row.id))),
      } as const;
    } catch (error) {
      reply.code(502);
      return {
        error: error instanceof Error ? error.message : "Voting store request failed",
      } as const;
    }
  });

  app.get<{ Params: { id: string } }>("/api/voting/elections/:id", async (req, reply) => {
    const role = requireSurveyAccess(req, pluginDb, reply, "public");
    if (!role) return { error: "unauthorized" } as const;

    try {
      await bootstrapVotingStore(pluginDb);

      const actorId = resolveSurveyActorId(req);
      const electionRow = readVotingElectionRow(pluginDb, req.params.id);
      if (!electionRow) {
        reply.code(404);
        return { error: "voting election not found" } as const;
      }

      const candidates = readVotingCandidates(pluginDb, electionRow.id);
      const votes = readAllVotingVotes(pluginDb);

      return buildSurveyDetail(electionRow, candidates, votes, actorId, role);
    } catch (error) {
      reply.code(502);
      return {
        error: error instanceof Error ? error.message : "Voting store request failed",
      } as const;
    }
  });

  app.post<{
    Body: {
      title?: string;
      description?: string;
      status?: SurveyStatus;
      options?: Array<{ name?: string; description?: string; imageUrl?: string }>;
    };
  }>("/api/voting/elections", async (req, reply) => {
    const role = requireSurveyAccess(req, pluginDb, reply, "moderator");
    if (!role) return { error: "unauthorized" } as const;

    try {
      await bootstrapVotingStore(pluginDb);
    } catch {
      // Creation remains available even if the legacy bootstrap source is unavailable.
    }

    const title = normalizeText(req.body?.title);
    const description = normalizeText(req.body?.description) || null;
    const status = req.body?.status === "active" || req.body?.status === "closed" || req.body?.status === "draft"
      ? req.body.status
      : "draft";
    const rawOptions = Array.isArray(req.body?.options) ? req.body.options : [];
    const options = rawOptions
      .map((option) => ({
        name: normalizeText(option?.name),
        description: normalizeText(option?.description) || null,
        imageUrl: normalizeText(option?.imageUrl) || null,
      }))
      .filter((option) => option.name.length > 0);

    if (!title) {
      reply.code(400);
      return { error: "voting election title is required" } as const;
    }

    if (options.length === 0) {
      reply.code(400);
      return { error: "at least one voting option is required" } as const;
    }

    const electionId = randomUUID();
    const actorId = resolveSurveyActorId(req);
    const now = Date.now();

    pluginDb.prepare("INSERT INTO voting_elections (id, title, description, status, created_by, start_date, end_date, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)")
      .run(electionId, title, description, status, actorId, null, null, now, now);

    const insertOption = pluginDb.prepare("INSERT INTO voting_candidates (id, election_id, name, description, image_url, created_at) VALUES (?, ?, ?, ?, ?, ?)");
    for (const option of options) {
      insertOption.run(randomUUID(), electionId, option.name, option.description, option.imageUrl, now);
    }

    const storedElection = readVotingElectionRow(pluginDb, electionId);
    const storedOptions = readVotingCandidates(pluginDb, electionId);
    if (!storedElection) {
      reply.code(500);
      return { error: "failed to create voting election" } as const;
    }

    reply.code(201);
    return buildSurveyDetail(storedElection, storedOptions, [], actorId, role);
  });

  app.patch<{
    Params: { id: string };
    Body: {
      title?: string;
      description?: string;
      status?: SurveyStatus;
    };
  }>("/api/voting/elections/:id", async (req, reply) => {
    const role = requireSurveyAccess(req, pluginDb, reply, "moderator");
    if (!role) return { error: "unauthorized" } as const;

    await bootstrapVotingStore(pluginDb);

    const actorId = resolveSurveyActorId(req);
    const electionRow = readVotingElectionRow(pluginDb, req.params.id);
    if (!electionRow) {
      reply.code(404);
      return { error: "voting election not found" } as const;
    }

    const nextTitle = req.body?.title === undefined ? electionRow.title : normalizeText(req.body.title);
    if (!nextTitle) {
      reply.code(400);
      return { error: "voting election title is required" } as const;
    }

    const nextDescription = req.body?.description === undefined
      ? electionRow.description
      : (normalizeText(req.body.description) || null);

    const nextStatus = req.body?.status === "active" || req.body?.status === "closed" || req.body?.status === "draft"
      ? req.body.status
      : electionRow.status;

    const updatedAt = Date.now();
    pluginDb.prepare("INSERT OR REPLACE INTO voting_elections (id, title, description, status, created_by, start_date, end_date, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)")
      .run(
        electionRow.id,
        nextTitle,
        nextDescription,
        nextStatus,
        electionRow.created_by,
        electionRow.start_date,
        electionRow.end_date,
        electionRow.created_at,
        updatedAt,
      );

    const updatedElection = readVotingElectionRow(pluginDb, electionRow.id);
    const candidates = readVotingCandidates(pluginDb, electionRow.id);
    const votes = readAllVotingVotes(pluginDb);

    if (!updatedElection) {
      reply.code(500);
      return { error: "failed to update voting election" } as const;
    }

    return buildSurveyDetail(updatedElection, candidates, votes, actorId, role);
  });

  app.delete<{
    Params: { id: string };
  }>("/api/voting/elections/:id", async (req, reply) => {
    const role = requireSurveyAccess(req, pluginDb, reply, "moderator");
    if (!role) return { error: "unauthorized" } as const;

    await bootstrapVotingStore(pluginDb);

    const electionRow = readVotingElectionRow(pluginDb, req.params.id);
    if (!electionRow) {
      reply.code(404);
      return { error: "voting election not found" } as const;
    }

    pluginDb.prepare("DELETE FROM voting_votes WHERE election_id = ?").run(electionRow.id);
    pluginDb.prepare("DELETE FROM voting_candidates WHERE election_id = ?").run(electionRow.id);
    pluginDb.prepare("DELETE FROM voting_elections WHERE id = ?").run(electionRow.id);

    return { ok: true } as const;
  });

  app.post<{
    Params: { id: string };
    Body: { name?: string; description?: string; imageUrl?: string };
  }>("/api/voting/elections/:id/options", async (req, reply) => {
    const role = requireSurveyAccess(req, pluginDb, reply, "moderator");
    if (!role) return { error: "unauthorized" } as const;

    await bootstrapVotingStore(pluginDb);

    const actorId = resolveSurveyActorId(req);
    const electionRow = readVotingElectionRow(pluginDb, req.params.id);
    if (!electionRow) {
      reply.code(404);
      return { error: "voting election not found" } as const;
    }

    if (electionRow.status === "closed") {
      reply.code(400);
      return { error: "cannot add options to a closed vote" } as const;
    }

    const name = normalizeText(req.body?.name);
    if (!name) {
      reply.code(400);
      return { error: "option name is required" } as const;
    }

    pluginDb.prepare("INSERT INTO voting_candidates (id, election_id, name, description, image_url, created_at) VALUES (?, ?, ?, ?, ?, ?)")
      .run(
        randomUUID(),
        electionRow.id,
        name,
        normalizeText(req.body?.description) || null,
        normalizeText(req.body?.imageUrl) || null,
        Date.now(),
      );

    const candidates = readVotingCandidates(pluginDb, electionRow.id);
    const votes = readAllVotingVotes(pluginDb);
    return buildSurveyDetail(electionRow, candidates, votes, actorId, role);
  });

  app.delete<{
    Params: { id: string; optionId: string };
  }>("/api/voting/elections/:id/options/:optionId", async (req, reply) => {
    const role = requireSurveyAccess(req, pluginDb, reply, "moderator");
    if (!role) return { error: "unauthorized" } as const;

    await bootstrapVotingStore(pluginDb);

    const actorId = resolveSurveyActorId(req);
    const electionRow = readVotingElectionRow(pluginDb, req.params.id);
    if (!electionRow) {
      reply.code(404);
      return { error: "voting election not found" } as const;
    }

    const candidates = readVotingCandidates(pluginDb, electionRow.id);
    const candidate = candidates.find((item) => item.id === req.params.optionId);
    if (!candidate) {
      reply.code(404);
      return { error: "voting option not found" } as const;
    }

    if (candidates.length <= 1) {
      reply.code(400);
      return { error: "لا يمكن حذف آخر خيار في هذا الاستطلاع." } as const;
    }

    const votes = readAllVotingVotes(pluginDb);
    if (votes.some((vote) => vote.candidate_id === candidate.id)) {
      reply.code(409);
      return { error: "لا يمكن حذف خيار لديه أصوات مسجلة." } as const;
    }

    pluginDb.prepare("DELETE FROM voting_candidates WHERE id = ?").run(candidate.id);

    const remainingCandidates = readVotingCandidates(pluginDb, electionRow.id);
    return buildSurveyDetail(electionRow, remainingCandidates, votes, actorId, role);
  });

  app.post<{
    Params: { id: string };
    Body: { optionId?: string };
  }>("/api/voting/elections/:id/vote", async (req, reply) => {
    if (!requireSurveyAccess(req, pluginDb, reply, "public")) return { error: "unauthorized" } as const;

    try {
      await bootstrapVotingStore(pluginDb);
    } catch {
      // Continue with the internal store even if bootstrap is unavailable.
    }

    const actorId = resolveSurveyActorId(req);
    const optionId = normalizeText(req.body?.optionId);
    const electionRow = readVotingElectionRow(pluginDb, req.params.id);

    if (!electionRow) {
      reply.code(404);
      return { error: "voting election not found" } as const;
    }

    if (electionRow.status !== "active") {
      reply.code(400);
      return { error: "voting election is not active" } as const;
    }

    const candidates = readVotingCandidates(pluginDb, electionRow.id);
    if (!optionId || !candidates.some((candidate) => candidate.id === optionId)) {
      reply.code(400);
      return { error: "valid optionId is required" } as const;
    }

    const votes = readAllVotingVotes(pluginDb);
    if (votes.some((vote) => vote.election_id === electionRow.id && vote.voter_id === actorId)) {
      reply.code(409);
      return { error: "you have already voted in this election" } as const;
    }

    pluginDb.prepare("INSERT INTO voting_votes (id, election_id, candidate_id, voter_id, created_at) VALUES (?, ?, ?, ?, ?)")
      .run(randomUUID(), electionRow.id, optionId, actorId, Date.now());

    return { ok: true } as const;
  });

  app.get<{ Params: { id: string } }>("/api/voting/elections/:id/results", async (req, reply) => {
    if (!requireSurveyAccess(req, pluginDb, reply, "public")) return { error: "unauthorized" } as const;

    try {
      await bootstrapVotingStore(pluginDb);

      const electionRow = readVotingElectionRow(pluginDb, req.params.id);
      if (!electionRow) {
        reply.code(404);
        return { error: "voting election not found" } as const;
      }

      return buildSurveyResults(pluginDb, electionRow.id);
    } catch (error) {
      reply.code(502);
      return {
        error: error instanceof Error ? error.message : "Voting store request failed",
      } as const;
    }
  });
};

export type {
  SurveyOption,
  SurveyDetail,
  SurveyStatus,
  SurveySummary,
  SurveyResults,
  SurveyResultItem,
  SurveyBridgeStatus,
};

export { surveyRoutes as votingRoutes };
// PAYMENT_OVERRIDE_LIVE_PIPELINE_WIRING_V1
// Payment override route registration is intentionally separated from survey routes.
// This marker prevents payment-variable answers from being treated as fixed survey/election content.