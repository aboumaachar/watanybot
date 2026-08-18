import type { FastifyInstance } from "fastify";

type FastifyWithPg = FastifyInstance & {
  pg: {
    query: (text: string, values?: unknown[]) => Promise<{
      rows: any[];
      rowCount: number | null;
    }>;
  };
};
type AuthenticatedUser = {
  id?: string;
  role?: string;
};

function requireAdminOrSuperadmin(request: any, reply: any): AuthenticatedUser | null {
  const user = request.user as AuthenticatedUser | undefined;
  const role = String(user?.role ?? "").toUpperCase();
  if (role !== "ADMIN" && role !== "SUPERADMIN") {
    reply.code(403).send({ error: "forbidden" });
    return null;
  }
  return user ?? {};
}

export async function registerAinElHafehAdminRoutes(app: FastifyInstance) {
  const db = (app as FastifyWithPg).pg;
  app.get("/api/superadmin/ainelhafeh/applications", async (request: any, reply) => {
    if (!requireAdminOrSuperadmin(request, reply)) return;

    const q = String(request.query?.q ?? "").trim();
    const status = String(request.query?.status ?? "").trim().toUpperCase();
    const limit = Math.min(Math.max(Number(request.query?.limit ?? 200) || 200, 1), 500);

    const values: unknown[] = [];
    const where: string[] = [];

    if (q) {
      values.push(`%${q}%`);
      where.push(`(
        COALESCE(name,'') ILIKE $${values.length}
        OR COALESCE(phone,'') ILIKE $${values.length}
        OR COALESCE(email,'') ILIKE $${values.length}
      )`);
    }

    if (status) {
      values.push(status);
      where.push(`COALESCE(status,'PENDING') = $${values.length}`);
    }

    const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

    const countResult = await db.query(
      `SELECT COUNT(*)::int AS total
       FROM seasonal_apple_job_applications
       ${whereSql}`,
      values
    );

    values.push(limit);

    const listResult = await db.query(
      `SELECT
         id,name,phone,email,age,gender,
         governorate_ar,caza_ar,village_ar,
         availability,preferred_period,weekend_work,
         weighted_score,
         COALESCE(status,'PENDING') AS status,
         COALESCE(follow_up_status,'NOT_CONTACTED') AS follow_up_status,
         admin_notes,created_at,updated_at
       FROM seasonal_apple_job_applications
       ${whereSql}
       ORDER BY created_at DESC
       LIMIT $${values.length}`,
      values
    );

    return {
      items: listResult.rows,
      total: countResult.rows?.[0]?.total ?? 0
    };
  });

  app.patch("/api/superadmin/ainelhafeh/applications/:id", async (request: any, reply) => {
    const actor = requireAdminOrSuperadmin(request, reply);
    if (!actor) return;

    const id = String(request.params?.id ?? "");
    const body = request.body ?? {};

    const allowedStatus = new Set(["PENDING","APPROVED","REJECTED"]);
    const allowedFollowUp = new Set(["NOT_CONTACTED","TO_CONTACT","CONTACTED","CONFIRMED","NO_RESPONSE","WITHDRAWN"]);

    const updates: string[] = [];
    const values: unknown[] = [];

    if (body.status !== undefined) {
      const status = String(body.status).toUpperCase();
      if (!allowedStatus.has(status)) return reply.code(400).send({ error: "invalid_status" });
      values.push(status);
      updates.push(`status=$${values.length}`);
    }

    if (body.follow_up_status !== undefined) {
      const follow = String(body.follow_up_status).toUpperCase();
      if (!allowedFollowUp.has(follow)) return reply.code(400).send({ error: "invalid_follow_up_status" });
      values.push(follow);
      updates.push(`follow_up_status=$${values.length}`);
    }

    if (body.admin_notes !== undefined) {
      values.push(String(body.admin_notes ?? ""));
      updates.push(`admin_notes=$${values.length}`);
    }

    if (!updates.length) return reply.code(400).send({ error: "no_changes" });

    values.push(id);

    const result = await db.query(
      `UPDATE seasonal_apple_job_applications
       SET ${updates.join(", ")}, updated_at=NOW()
       WHERE id=$${values.length}
       RETURNING
         id,name,phone,email,age,gender,
         governorate_ar,caza_ar,village_ar,
         availability,preferred_period,weekend_work,
         weighted_score,
         COALESCE(status,'PENDING') AS status,
         COALESCE(follow_up_status,'NOT_CONTACTED') AS follow_up_status,
         admin_notes,created_at,updated_at`,
      values
    );

    if (!result.rowCount) return reply.code(404).send({ error: "not_found" });
    return { item: result.rows[0] };
  });
}
