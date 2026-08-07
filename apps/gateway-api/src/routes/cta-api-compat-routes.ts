import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

type UnknownRecord = Record<string, unknown>;

function asRecord(value: unknown): UnknownRecord {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as UnknownRecord;
  }
  return {};
}

function textFrom(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

async function handleChatBehaviorPreview(request: FastifyRequest, reply: FastifyReply) {
  const body = asRecord(request.body);
  const message = textFrom(body.message) || textFrom(body.query) || textFrom(body.input);
  const surfaceId = textFrom(body.surfaceId) || "cta-api-route-repair-preview";

  return reply.code(200).send({
    ok: true,
    endpoint: "/api/chatbot/behavior/preview",
    surfaceId,
    preview: {
      mode: "watany_hybrid_default",
      language: "arabic_first",
      elderlyFriendly: true,
      groundedAnswerRequired: true,
      message,
      actions: [
        "confirm_intent",
        "answer_from_kb_when_available",
        "offer_human_follow_up_when_uncertain"
      ],
    },
  });
}

export default async function ctaApiCompatRoutes(app: FastifyInstance) {
  app.get("/api/chat/feedback", async (_request, reply) => {
    return reply.code(200).send({
      ok: true,
      endpoint: "/api/chat/feedback",
      methods: ["GET", "POST"],
      status: "ready",
    });
  });

  app.get("/api/chatbot/behavior/preview", async (_request, reply) => {
    return reply.code(200).send({
      ok: true,
      endpoint: "/api/chatbot/behavior/preview",
      methods: ["GET", "POST"],
      status: "ready",
    });
  });

  app.post("/api/chatbot/behavior/preview", handleChatBehaviorPreview);
}