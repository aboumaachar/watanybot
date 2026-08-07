import fs from "node:fs";
import path from "node:path";
import type { FastifyPluginAsync } from "fastify";
import { requireRole } from "../auth/rbac.js";
import {
  readChatInputs,
  clearChatInputs,
  readQuestionClusters,
  readAdminAnswerOverrides,
  createAdminAnswerOverride,
  updateAdminAnswerOverride,
  deleteAdminAnswerOverride,
  readAbusiveChatEvents,
} from "../lib/chat-logger.js";

interface TrainingExample {
  id: string;
  input: string;
  output: string;
  source: string;
  status: string;
  ts: string;
}

interface FeedbackItem {
  id: string;
  input: string;
  output: string;
  source: string;
  status: "pending" | "approved" | "rejected";
  ts: string;
}

interface SmallTalkIntent {
  name: string;
  patterns: string[];
  responses: string[];
}

export interface AdminAiRoutesOptions {
  dataDir: string;
  trainingDir: string;
  trainingFilePath: string;
  versionRootPath: string;
  addVersionEntry: (fileRelPath: string, note?: string) => Promise<unknown>;
  getSmallTalkIntents: () => SmallTalkIntent[];
  setSmallTalkIntents: (intents: SmallTalkIntent[]) => void;
}

const feedbackQueue: Map<string, FeedbackItem> = new Map();

function generateId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
}

function readTrainingExamples(trainingFilePath: string, warn: (payload: unknown, message: string) => void): TrainingExample[] {
  try {
    if (!fs.existsSync(trainingFilePath)) return [];
    const lines = fs.readFileSync(trainingFilePath, "utf8").split("\n").filter((line) => line.length > 0);
    const examples: TrainingExample[] = [];

    for (const line of lines) {
      try {
        const item = JSON.parse(line) as Partial<TrainingExample>;
        examples.push({
          id: item.id || generateId(),
          input: String(item.input || ""),
          output: String(item.output || ""),
          source: String(item.source || "manual"),
          status: String(item.status || "pending"),
          ts: String(item.ts || new Date().toISOString()),
        });
      } catch {
        continue;
      }
    }

    return examples;
  } catch (err) {
    warn({ err }, "read_training_failed");
    return [];
  }
}

function writeTrainingExamples(trainingFilePath: string, examples: TrainingExample[], error: (payload: unknown, message: string) => void) {
  try {
    const jsonl = `${examples.map((example) => JSON.stringify(example)).join("\n")}\n`;
    fs.writeFileSync(trainingFilePath, jsonl, "utf8");
    return true;
  } catch (err) {
    error({ err }, "write_training_failed");
    return false;
  }
}

export const adminAiRoutes: FastifyPluginAsync<AdminAiRoutesOptions> = async (app, options) => {
  // Guard every admin AI route — admin role required
  app.addHook("preHandler", requireRole("admin"));

  app.get("/api/admin/ai/training", async (req: any) => {
    const status = String(req.query?.status || "").trim();
    const examples = readTrainingExamples(options.trainingFilePath, app.log.warn.bind(app.log));
    const filtered = status ? examples.filter((example) => example.status === status) : examples;
    return { ok: true, examples: filtered, count: filtered.length };
  });

  app.post("/api/admin/ai/training", async (req: any, reply) => {
    const { input, output, source, status } = req.body || {};
    if (!input || !output) return reply.code(400).send({ ok: false, error: "input and output are required" });

    const item: TrainingExample = {
      id: generateId(),
      input: String(input),
      output: String(output),
      source: source || "manual",
      status: status || "pending",
      ts: new Date().toISOString(),
    };

    try {
      fs.appendFileSync(options.trainingFilePath, `${JSON.stringify(item)}\n`, "utf8");
      await options.addVersionEntry(path.relative(options.versionRootPath, options.trainingFilePath), "admin:training-add");
      return { ok: true, item };
    } catch (err: any) {
      app.log.error({ err }, "append_training_failed");
      return reply.code(500).send({ ok: false, error: String(err) });
    }
  });

  app.post("/api/admin/ai/training/:id/approve", async (req: any, reply) => {
    const id = String(req.params.id || "");
    const examples = readTrainingExamples(options.trainingFilePath, app.log.warn.bind(app.log));
    const index = examples.findIndex((example) => example.id === id);
    if (index === -1) return reply.code(404).send({ ok: false, error: "not found" });

    examples[index].status = "approved";
    writeTrainingExamples(options.trainingFilePath, examples, app.log.error.bind(app.log));
    await options.addVersionEntry(path.relative(options.versionRootPath, options.trainingFilePath), `admin:training-approve:${id}`);
    return { ok: true, item: examples[index] };
  });

  app.post("/api/admin/ai/training/:id/reject", async (req: any, reply) => {
    const id = String(req.params.id || "");
    const examples = readTrainingExamples(options.trainingFilePath, app.log.warn.bind(app.log));
    const index = examples.findIndex((example) => example.id === id);
    if (index === -1) return reply.code(404).send({ ok: false, error: "not found" });

    examples[index].status = "rejected";
    writeTrainingExamples(options.trainingFilePath, examples, app.log.error.bind(app.log));
    await options.addVersionEntry(path.relative(options.versionRootPath, options.trainingFilePath), `admin:training-reject:${id}`);
    return { ok: true, item: examples[index] };
  });

  app.delete("/api/admin/ai/training/:id", async (req: any, reply) => {
    const id = String(req.params.id || "");
    const examples = readTrainingExamples(options.trainingFilePath, app.log.warn.bind(app.log));
    const index = examples.findIndex((example) => example.id === id);
    if (index === -1) return reply.code(404).send({ ok: false, error: "not found" });

    const removed = examples.splice(index, 1)[0];
    writeTrainingExamples(options.trainingFilePath, examples, app.log.error.bind(app.log));
    await options.addVersionEntry(path.relative(options.versionRootPath, options.trainingFilePath), `admin:training-delete:${id}`);
    return { ok: true, removed };
  });

  app.post("/api/admin/ai/training/import-feedback", async (req: any, reply) => {
    const items = Array.isArray(req.body?.items) ? req.body.items : [];
    if (!items.length) return reply.code(400).send({ ok: false, error: "items array required" });

    const examples = readTrainingExamples(options.trainingFilePath, app.log.warn.bind(app.log));
    let added = 0;
    for (const item of items) {
      if (!item?.input || !item?.output) continue;
      examples.push({
        id: generateId(),
        input: String(item.input),
        output: String(item.output),
        source: item.source || "feedback",
        status: item.status || "pending",
        ts: new Date().toISOString(),
      });
      added++;
    }

    writeTrainingExamples(options.trainingFilePath, examples, app.log.error.bind(app.log));
    await options.addVersionEntry(path.relative(options.versionRootPath, options.trainingFilePath), "admin:training-import-feedback");
    return { ok: true, added };
  });

  app.get("/api/admin/ai/training/export", async (_req, reply) => {
    try {
      const content = fs.existsSync(options.trainingFilePath) ? fs.readFileSync(options.trainingFilePath, "utf8") : "";
      reply.header("Content-Type", "text/plain").send(content);
    } catch (err: any) {
      return reply.code(500).send({ ok: false, error: String(err) });
    }
  });

  app.post("/api/admin/ai/training/publish", async (_req, reply) => {
    try {
      const examples = readTrainingExamples(options.trainingFilePath, app.log.warn.bind(app.log));
      await options.addVersionEntry(path.relative(options.versionRootPath, options.trainingFilePath), "admin:training-publish");
      return { ok: true, exported: examples.length };
    } catch (err: any) {
      app.log.error({ err }, "publish_training_failed");
      return reply.code(500).send({ ok: false, error: String(err) });
    }
  });

  app.post("/api/admin/ai/fine-tune", async (_req, reply) => {
    try {
      const openaiKey = process.env.OPENAI_API_KEY || process.env.AI_API_KEY || "";
      const examples = readTrainingExamples(options.trainingFilePath, app.log.warn.bind(app.log)).filter((example) => example.status === "approved");
      if (examples.length === 0) return { ok: true, message: "No approved examples to train", examples: 0 };

      const payload = `${examples.map((example) => JSON.stringify({ prompt: example.input, completion: example.output })).join("\n")}\n`;
      const outPath = path.join(options.trainingDir, `training_export_${Date.now()}.jsonl`);
      fs.writeFileSync(outPath, payload, "utf8");
      await options.addVersionEntry(path.relative(options.versionRootPath, outPath), "admin:training-export");

      if (!openaiKey) {
        return { ok: true, message: "Training file prepared (no provider configured)", path: outPath, examples: examples.length };
      }

      return { ok: true, message: "Training file prepared; provider upload not performed (requires explicit opt-in)", path: outPath, examples: examples.length };
    } catch (err: any) {
      app.log.error({ err }, "fine_tune_prepare_failed");
      return reply.code(500).send({ ok: false, error: String(err) });
    }
  });

  app.get("/api/admin/ai/feedback-queue", async (req: any) => {
    const status = String(req.query?.status || "").trim();
    const items = Array.from(feedbackQueue.values());
    const filtered = status ? items.filter((item) => item.status === status) : items;
    const pending = items.filter((item) => item.status === "pending").length;
    return { ok: true, items: filtered, total: items.length, pending };
  });

  app.get("/api/admin/ai/feedback/:id", async (req: any, reply) => {
    const id = String(req.params.id || "");
    const item = feedbackQueue.get(id);
    if (!item) {
      return reply.code(404).send({ ok: false, error: "feedback not found" });
    }
    return { ok: true, item };
  });

  app.post("/api/admin/ai/feedback", async (req: any, reply) => {
    const { input, output, source } = req.body || {};
    if (!input || !output) {
      return reply.code(400).send({ ok: false, error: "input and output are required" });
    }

    const id = generateId();
    const item: FeedbackItem = {
      id,
      input: String(input),
      output: String(output),
      source: source || "manual",
      status: "pending",
      ts: new Date().toISOString(),
    };
    feedbackQueue.set(id, item);
    return { ok: true, item, id };
  });

  app.post("/api/admin/ai/feedback/:id/approve", async (req: any, reply) => {
    const id = String(req.params.id || "");
    const item = feedbackQueue.get(id);
    if (!item) {
      return reply.code(404).send({ ok: false, error: "feedback not found" });
    }
    item.status = "approved";
    feedbackQueue.set(id, item);
    return { ok: true, item, message: "approved" };
  });

  app.post("/api/admin/ai/feedback/:id/reject", async (req: any, reply) => {
    const id = String(req.params.id || "");
    const item = feedbackQueue.get(id);
    if (!item) {
      return reply.code(404).send({ ok: false, error: "feedback not found" });
    }
    item.status = "rejected";
    feedbackQueue.set(id, item);
    return { ok: true, item, message: "rejected" };
  });

  app.delete("/api/admin/ai/feedback/:id", async (req: any, reply) => {
    const id = String(req.params.id || "");
    if (!feedbackQueue.has(id)) {
      return reply.code(404).send({ ok: false, error: "feedback not found" });
    }
    const removed = feedbackQueue.get(id);
    feedbackQueue.delete(id);
    return { ok: true, removed, id };
  });

  app.get("/api/admin/ai/unrecognized", async (req: any) => {
    const limit = Math.min(Number(req.query?.limit) || 100, 500);
    const logPath = path.resolve(options.dataDir, "unrecognized_inputs.jsonl");
    try {
      if (!fs.existsSync(logPath)) return { ok: true, items: [], total: 0 };
      const lines = fs.readFileSync(logPath, "utf8").split("\n").filter((line) => line.length > 0);
      const items = lines
        .map((line) => {
          try {
            return JSON.parse(line);
          } catch {
            return null;
          }
        })
        .filter((item): item is Record<string, unknown> => item !== null);
      items.reverse();
      return { ok: true, items: items.slice(0, limit), total: items.length };
    } catch (err: any) {
      return { ok: false, error: err.message || String(err) };
    }
  });

  app.post("/api/admin/ai/intents/add-pattern", async (req: any, reply) => {
    const { intentName, pattern } = req.body || {};
    if (!intentName || !pattern) {
      return reply.code(400).send({ ok: false, error: "intentName and pattern are required" });
    }

    const intentsPath = path.resolve(options.dataDir, "intents.json");
    try {
      const raw = fs.readFileSync(intentsPath, "utf8").replace(/^\uFEFF/, "");
      const intentsData = JSON.parse(raw) as { intents: SmallTalkIntent[] };
      const intent = intentsData.intents.find((item) => item.name === intentName);
      if (!intent) {
        return reply.code(404).send({ ok: false, error: `Intent '${intentName}' not found` });
      }
      if (intent.patterns.includes(pattern)) {
        return { ok: true, message: "Pattern already exists", intent: intentName };
      }

      intent.patterns.push(pattern);
      fs.writeFileSync(intentsPath, JSON.stringify(intentsData, null, 2), "utf8");
      options.setSmallTalkIntents(intentsData.intents);
      return { ok: true, message: "Pattern added and intents reloaded", intent: intentName, newPattern: pattern, totalPatterns: intent.patterns.length };
    } catch (err: any) {
      return reply.code(500).send({ ok: false, error: err.message || String(err) });
    }
  });

  app.post("/api/admin/ai/intents/add", async (req: any, reply) => {
    const { name, patterns, responses } = req.body || {};
    if (!name || !Array.isArray(patterns) || !Array.isArray(responses)) {
      return reply.code(400).send({ ok: false, error: "name, patterns[], and responses[] are required" });
    }

    const intentsPath = path.resolve(options.dataDir, "intents.json");
    try {
      const raw = fs.readFileSync(intentsPath, "utf8").replace(/^\uFEFF/, "");
      const intentsData = JSON.parse(raw) as { intents: SmallTalkIntent[] };
      if (intentsData.intents.some((intent) => intent.name === name)) {
        return reply.code(409).send({ ok: false, error: `Intent '${name}' already exists` });
      }

      intentsData.intents.push({ name, patterns, responses });
      fs.writeFileSync(intentsPath, JSON.stringify(intentsData, null, 2), "utf8");
      options.setSmallTalkIntents(intentsData.intents);
      return { ok: true, message: "New intent created and loaded", intent: name };
    } catch (err: any) {
      return reply.code(500).send({ ok: false, error: err.message || String(err) });
    }
  });

  app.get("/api/admin/ai/intents", async () => {
    const intents = options.getSmallTalkIntents();
    return {
      ok: true,
      intents: intents.map((intent) => ({
        name: intent.name,
        patternCount: intent.patterns.length,
        responseCount: intent.responses.length,
        patterns: intent.patterns,
      })),
      total: intents.length,
    };
  });

  app.delete("/api/admin/ai/unrecognized", async () => {
    const logPath = path.resolve(options.dataDir, "unrecognized_inputs.jsonl");
    try {
      if (fs.existsSync(logPath)) fs.writeFileSync(logPath, "", "utf8");
      return { ok: true, message: "Unrecognized log cleared" };
    } catch (err: any) {
      return { ok: false, error: err.message || String(err) };
    }
  });

  // ── Chat inputs log ────────────────────────────────────────────────────────
  app.get("/api/admin/chat-inputs", async (req: any) => {
    const limit = Number((req.query as Record<string, string>).limit ?? 100);
    return { items: readChatInputs(Math.min(limit, 500)) };
  });

  app.delete("/api/admin/chat-inputs", async () => {
    clearChatInputs();
    return { ok: true, message: "Chat inputs log cleared" };
  });

  // ── Question clusters ──────────────────────────────────────────────────────
  app.get("/api/admin/question-clusters", async (req: any) => {
    const q = req.query as Record<string, string>;
    const sort = q.sort === "count" ? "count" : ("recent" as const);
    const unanswered = q.unanswered === "true";
    const limit = Number(q.limit ?? 100);
    return { clusters: readQuestionClusters({ sort, unanswered, limit: Math.min(limit, 500) }) };
  });

  // ── Admin answer overrides ─────────────────────────────────────────────────
  app.get("/api/admin/answer-overrides", async () => {
    return { overrides: readAdminAnswerOverrides() };
  });

  app.post("/api/admin/answer-overrides", async (req: any, reply: any) => {
    const body = req.body as { matchPattern?: string; answer?: string; sourceUrl?: string; clusterId?: string; active?: boolean };
    if (!body?.matchPattern || !body?.answer) {
      reply.code(400);
      return { error: "matchPattern and answer are required" };
    }
    const item = createAdminAnswerOverride({
      matchPattern: body.matchPattern,
      answer: body.answer,
      sourceUrl: body.sourceUrl,
      clusterId: body.clusterId,
      createdBy: req.user?.id ?? "admin",
      active: body.active ?? true,
    });
    return { ok: true, override: item };
  });

  app.patch("/api/admin/answer-overrides/:id", async (req: any, reply: any) => {
    const { id } = req.params as { id: string };
    const body = req.body as { answer?: string; sourceUrl?: string; active?: boolean };
    const updated = updateAdminAnswerOverride(id, body);
    if (!updated) { reply.code(404); return { error: "Not found" }; }
    return { ok: true, override: updated };
  });

  app.delete("/api/admin/answer-overrides/:id", async (req: any, reply: any) => {
    const { id } = req.params as { id: string };
    const deleted = deleteAdminAnswerOverride(id);
    if (!deleted) { reply.code(404); return { error: "Not found" }; }
    return { ok: true };
  });

  // ── Abusive chat events ────────────────────────────────────────────────────
  app.get("/api/admin/abusive-events", async (req: any) => {
    const limit = Number((req.query as Record<string, string>).limit ?? 100);
    return { events: readAbusiveChatEvents(Math.min(limit, 500)) };
  });
};