import type { FastifyInstance } from "fastify";
import { ZodError } from "zod";
import { requireRole } from "../auth/rbac.js";
import {
  createAnnouncement,
  createAnswer,
  createQuestion,
  deleteAnswer,
  deleteQuestion,
  getDashboard,
  listAnnouncements,
  listAnswers,
  listQuestions,
  toggleAnnouncement,
  updateAnswer,
  updateQuestion,
} from "./service.js";
import {
  adminPaymentsEntityParamsSchema,
  createAnnouncementBodySchema,
  createAnswerBodySchema,
  createQuestionBodySchema,
  listAnnouncementsQuerySchema,
  listAnswersQuerySchema,
  toggleAnnouncementBodySchema,
  updateAnswerBodySchema,
  updateQuestionBodySchema,
} from "./schemas.js";

function validationError(reply: any, error: unknown) {
  if (error instanceof ZodError) {
    return reply.code(400).send({
      error: "invalid_payload",
      details: error.issues.map((issue) => ({
        path: issue.path,
        message: issue.message,
        code: issue.code,
      })),
    });
  }
  return null;
}

export async function adminPaymentsRoutes(app: FastifyInstance): Promise<void> {
  const superadminOnly = { preHandler: [requireRole("superadmin")] };

  app.get("/api/admin/payment-overrides", superadminOnly, async (_request, reply) => {
    const questionById = new Map(listQuestions().map((question) => [question.id, question]));
    const activeAnswers = listAnswers({ activeOnly: true });

    const overrides = activeAnswers
      .map((answer) => {
        const question = questionById.get(answer.questionId);
        if (!question) return null;

        return {
          id: answer.id,
          topic: question.text,
          status: "published",
          answer: answer.value,
          updatedAt: answer.createdAt,
        };
      })
      .filter((entry): entry is { id: string; topic: string; status: string; answer: string; updatedAt: string } => entry !== null);

    return reply.send({ ok: true, overrides });
  });

  app.get("/api/admin/payments/questions", superadminOnly, async (_request, reply) => {
    return reply.send({ questions: listQuestions() });
  });

  app.post("/api/admin/payments/questions", superadminOnly, async (request, reply) => {
    try {
      const body = createQuestionBodySchema.parse(request.body);
      const question = createQuestion(body.text, body.tags);
      return reply.code(201).send({ question });
    } catch (error) {
      return validationError(reply, error) ?? reply.code(500).send({ error: "create_question_failed" });
    }
  });

  app.patch("/api/admin/payments/questions/:id", superadminOnly, async (request, reply) => {
    try {
      const { id } = adminPaymentsEntityParamsSchema.parse(request.params ?? {});
      const body = updateQuestionBodySchema.parse(request.body);
      const question = updateQuestion(id, body);
      if (!question) {
        return reply.code(404).send({ error: "question_not_found" });
      }
      return reply.send({ question });
    } catch (error) {
      return validationError(reply, error) ?? reply.code(500).send({ error: "update_question_failed" });
    }
  });

  app.delete("/api/admin/payments/questions/:id", superadminOnly, async (request, reply) => {
    try {
      const { id } = adminPaymentsEntityParamsSchema.parse(request.params ?? {});
      const removed = deleteQuestion(id);
      if (!removed) {
        return reply.code(404).send({ error: "question_not_found" });
      }
      return reply.code(204).send();
    } catch (error) {
      return validationError(reply, error) ?? reply.code(500).send({ error: "delete_question_failed" });
    }
  });

  app.get("/api/admin/payments/answers", superadminOnly, async (request, reply) => {
    try {
      const query = listAnswersQuerySchema.parse(request.query ?? {});
      return reply.send({ answers: listAnswers(query) });
    } catch (error) {
      return validationError(reply, error) ?? reply.code(500).send({ error: "list_answers_failed" });
    }
  });

  app.post("/api/admin/payments/answers", superadminOnly, async (request, reply) => {
    try {
      const body = createAnswerBodySchema.parse(request.body);
      const actor = request.user?.id || "superadmin";
      const answer = createAnswer(body.questionId, body.value, actor, {
        activateAt: body.activateAt ?? null,
        expiresAt: body.expiresAt ?? null,
      });
      return reply.code(201).send({ answer });
    } catch (error) {
      if (error instanceof Error && error.message === "question_not_found") {
        return reply.code(404).send({ error: "question_not_found" });
      }
      if (error instanceof Error && ["invalid_activate_at", "invalid_expires_at", "invalid_schedule_window"].includes(error.message)) {
        return reply.code(400).send({ error: error.message });
      }
      return validationError(reply, error) ?? reply.code(500).send({ error: "create_answer_failed" });
    }
  });

  app.patch("/api/admin/payments/answers/:id", superadminOnly, async (request, reply) => {
    try {
      const { id } = adminPaymentsEntityParamsSchema.parse(request.params ?? {});
      const body = updateAnswerBodySchema.parse(request.body);
      const answer = updateAnswer(id, body);
      if (!answer) {
        return reply.code(404).send({ error: "answer_not_found" });
      }
      return reply.send({ answer });
    } catch (error) {
      if (error instanceof Error && error.message === "question_not_found") {
        return reply.code(404).send({ error: "question_not_found" });
      }
      if (error instanceof Error && ["invalid_activate_at", "invalid_expires_at", "invalid_schedule_window"].includes(error.message)) {
        return reply.code(400).send({ error: error.message });
      }
      return validationError(reply, error) ?? reply.code(500).send({ error: "update_answer_failed" });
    }
  });

  app.delete("/api/admin/payments/answers/:id", superadminOnly, async (request, reply) => {
    try {
      const { id } = adminPaymentsEntityParamsSchema.parse(request.params ?? {});
      const removed = deleteAnswer(id);
      if (!removed) {
        return reply.code(404).send({ error: "answer_not_found" });
      }
      return reply.code(204).send();
    } catch (error) {
      return validationError(reply, error) ?? reply.code(500).send({ error: "delete_answer_failed" });
    }
  });

  app.get("/api/admin/payments/announcements", superadminOnly, async (request, reply) => {
    try {
      const query = listAnnouncementsQuerySchema.parse(request.query ?? {});
      return reply.send({ announcements: listAnnouncements(query) });
    } catch (error) {
      return validationError(reply, error) ?? reply.code(500).send({ error: "list_announcements_failed" });
    }
  });

  app.post("/api/admin/payments/announcements", superadminOnly, async (request, reply) => {
    try {
      const body = createAnnouncementBodySchema.parse(request.body);
      const announcement = createAnnouncement(body.text);
      return reply.code(201).send({ announcement });
    } catch (error) {
      return validationError(reply, error) ?? reply.code(500).send({ error: "create_announcement_failed" });
    }
  });

  app.patch("/api/admin/payments/announcements/:id", superadminOnly, async (request, reply) => {
    try {
      const { id } = adminPaymentsEntityParamsSchema.parse(request.params ?? {});
      const body = toggleAnnouncementBodySchema.parse(request.body);
      const announcement = toggleAnnouncement(id, body.enabled);
      if (!announcement) {
        return reply.code(404).send({ error: "announcement_not_found" });
      }
      return reply.send({ announcement });
    } catch (error) {
      return validationError(reply, error) ?? reply.code(500).send({ error: "toggle_announcement_failed" });
    }
  });

  app.get("/api/admin/payments/dashboard", superadminOnly, async (_request, reply) => {
    return reply.send({ dashboard: getDashboard() });
  });
}