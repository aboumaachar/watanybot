import type { FastifyPluginAsync } from "fastify";
import { requireRole } from "../auth/rbac.js";

interface PluginDbStatement {
  all: (...args: any[]) => Array<Record<string, unknown>>;
  get: (...args: any[]) => Record<string, unknown> | undefined;
  run: (...args: any[]) => { changes: number } | Record<string, unknown>;
}

interface PluginDb {
  prepare: (sql: string) => PluginDbStatement;
}

interface CaseChecklistItem {
  label: string;
  done: boolean;
}

interface CaseItem {
  id: string;
  title: string;
  type: "benefits" | "legal" | "medical" | "other";
  status: "open" | "pending" | "closed";
  checklist: CaseChecklistItem[];
  createdAt: number;
  updatedAt: number;
}

export interface CasesRoutesOptions {
  pluginDb: PluginDb;
  makeId: (prefix: string) => string;
}

function parseChecklist(value: unknown): CaseChecklistItem[] {
  try {
    if (typeof value === "string") {
      return JSON.parse(value) as CaseChecklistItem[];
    }
    if (Array.isArray(value)) {
      return value as CaseChecklistItem[];
    }
  } catch {
    return [];
  }
  return [];
}

function mapCaseRow(row: Record<string, unknown>): CaseItem {
  return {
    id: String(row.id),
    title: String(row.title),
    type: String(row.type) as CaseItem["type"],
    status: String(row.status) as CaseItem["status"],
    checklist: parseChecklist(row.checklist),
    createdAt: Number(row.created_at),
    updatedAt: Number(row.updated_at),
  };
}

export const casesRoutes: FastifyPluginAsync<CasesRoutesOptions> = async (app, options) => {
  app.get("/api/cases", { preHandler: [requireRole("accredited")] }, async () => {
    const rows = options.pluginDb.prepare("SELECT * FROM cases ORDER BY created_at DESC").all();
    return { cases: rows.map(mapCaseRow) } as const;
  });

  app.post<{ Body: Omit<CaseItem, "id" | "createdAt" | "updatedAt"> }>("/api/cases", { preHandler: [requireRole("accredited")] }, async (req, reply) => {
    const body = req.body;
    if (!body || !body.title) {
      reply.code(400);
      return { error: "title required" } as const;
    }
    const now = Date.now();
    const item: CaseItem = {
      ...body,
      id: options.makeId("case"),
      createdAt: now,
      updatedAt: now,
    };
    options.pluginDb.prepare("INSERT INTO cases (id, title, type, status, checklist, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)").run(
      item.id,
      item.title,
      item.type,
      item.status,
      JSON.stringify(item.checklist || []),
      item.createdAt,
      item.updatedAt,
    );
    return item;
  });

  app.patch<{ Body: Partial<CaseItem>; Params: { id: string } }>("/api/cases/:id", { preHandler: [requireRole("accredited")] }, async (req, reply) => {
    const id = req.params.id;
    const patch = req.body || {};
    const row = options.pluginDb.prepare("SELECT * FROM cases WHERE id = ?").get(id);
    if (!row) {
      reply.code(404);
      return { error: "case not found" } as const;
    }

    const current = mapCaseRow(row);
    const updated: CaseItem = {
      ...current,
      ...patch,
      checklist: patch.checklist ?? current.checklist,
      updatedAt: Date.now(),
    };

    options.pluginDb.prepare("UPDATE cases SET title = ?, type = ?, status = ?, checklist = ?, updated_at = ? WHERE id = ?").run(
      updated.title,
      updated.type,
      updated.status,
      JSON.stringify(updated.checklist || []),
      updated.updatedAt,
      updated.id,
    );
    return updated;
  });
};