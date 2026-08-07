import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import type { FastifyInstance, FastifyPluginAsync } from "fastify";

export type ReviewTargetType = "job_employer" | "market_listing";

export type ReviewRecord = {
  id: string;
  targetType: ReviewTargetType;
  targetId: string;
  userId?: string;
  score: number;
  note?: string;
  createdAt: string;
};

type ReviewStore = {
  reviews: ReviewRecord[];
};

function storePath(): string {
  const cwd = process.cwd();
  const base = path.basename(cwd).toLowerCase() === "gateway-api" ? cwd : path.join(cwd, "apps", "gateway-api");
  return path.join(base, "data", "reviews", "review-store.json");
}

async function readStore(): Promise<ReviewStore> {
  try {
    const raw = await fs.readFile(storePath(), "utf8");
    const parsed = JSON.parse(raw) as Partial<ReviewStore>;
    return { reviews: Array.isArray(parsed.reviews) ? parsed.reviews : [] };
  } catch {
    return { reviews: [] };
  }
}

async function writeStore(store: ReviewStore): Promise<void> {
  const file = storePath();
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, `${JSON.stringify(store, null, 2)}\n`, "utf8");
}

function normalizeText(value: unknown): string {
  return String(value ?? "").trim();
}

function normalizeTargetType(value: unknown): ReviewTargetType | null {
  const normalized = normalizeText(value).toLowerCase();
  if (normalized === "job_employer") return "job_employer";
  if (normalized === "market_listing") return "market_listing";
  return null;
}

export const reviewRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  app.get("/reviews", async (request, reply) => {
    const query = request.query as Record<string, string | undefined>;
    const targetType = normalizeTargetType(query.targetType);
    if (!targetType) return reply.code(400).send({ ok: false, error: "TARGET_TYPE_REQUIRED" });
    const targetId = normalizeText(query.targetId);
    const store = await readStore();
    const reviews = store.reviews.filter((item) => item.targetType === targetType && (!targetId || item.targetId === targetId));
    return { ok: true, reviews };
  });

  app.post("/reviews", async (request, reply) => {
    const body = (request.body ?? {}) as Record<string, unknown>;
    const targetType = normalizeTargetType(body.targetType);
    const targetId = normalizeText(body.targetId);
    const score = Number(body.score ?? 0);
    if (!targetType || !targetId) return reply.code(400).send({ ok: false, error: "TARGET_REQUIRED" });
    if (!Number.isFinite(score) || score < 1 || score > 5) return reply.code(400).send({ ok: false, error: "INVALID_SCORE" });

    const review: ReviewRecord = {
      id: randomUUID(),
      targetType,
      targetId,
      userId: normalizeText(body.userId) || undefined,
      score,
      note: normalizeText(body.note) || undefined,
      createdAt: new Date().toISOString(),
    };

    const store = await readStore();
    store.reviews.unshift(review);
    await writeStore(store);
    return reply.code(201).send({ ok: true, review });
  });
};

export default reviewRoutes;