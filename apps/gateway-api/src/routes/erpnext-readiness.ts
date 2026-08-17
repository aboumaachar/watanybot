import type { FastifyInstance, FastifyPluginAsync, FastifyRequest } from "fastify";

import { ErpNextClient, ErpNextRequestError } from "../integrations/erpnext/client";

function isLoopbackAddress(address: string | undefined): boolean {
  return address === "127.0.0.1" || address === "::1" || address === "::ffff:127.0.0.1";
}

function isLoopbackRequest(request: FastifyRequest): boolean {
  return isLoopbackAddress(request.raw.socket.remoteAddress);
}

export const erpNextReadinessRoutes: FastifyPluginAsync = async (app: FastifyInstance): Promise<void> => {
  const client = new ErpNextClient();

  app.get("/api/erpnext/readiness", async (request, reply) => {
    if (!isLoopbackRequest(request)) {
      return reply.code(404).send({ ok: false, error: "not_found" });
    }

    try {
      const identity = await client.readAuthenticatedIdentity();
      return reply.code(200).send({
        ok: true,
        site: identity.site,
        erpnextReachable: identity.reachable,
        authenticatedPrincipalPresent: identity.authenticatedPrincipalPresent,
        principal: identity.principal,
        httpStatus: identity.httpStatus,
      });
    } catch (error) {
      if (error instanceof ErpNextRequestError) {
        return reply.code(error.statusCode).send({ ok: false, error: error.safeCode });
      }
      return reply.code(502).send({ ok: false, error: "erpnext_request_failed" });
    }
  });
};