import type { FastifyInstance } from "fastify";
import { authorizePrincipal } from "../auth/rbac.js";
import { mintPayloadSsoAssertion } from "../cms/payloadSso.js";

export async function payloadSsoRoutes(app: FastifyInstance): Promise<void> {
  app.post("/api/admin/payload-sso", async (request, reply) => {
    const decision = authorizePrincipal(request, { capability: "cms.read" });
    if (!decision.allowed || !decision.principal) {
      return reply.code(decision.statusCode).send({ ok: false, error: decision.reason });
    }

    const sessionId = request.user?.sessionId;
    if (!sessionId) {
      return reply.code(401).send({ ok: false, error: "NO_SESSION_BOUND_PRINCIPAL" });
    }

    const assertion = mintPayloadSsoAssertion({
      userId: decision.principal.id,
      role: decision.principal.role,
      capabilities: decision.principal.capabilities,
    });

    return reply.send({ ok: true, assertion, expiresIn: 300 });
  });
}