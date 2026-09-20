import { postgresAdapter } from "@payloadcms/db-postgres";
import { buildConfig, headersWithCors } from "payload";
import { GatewayAdmins } from "./collections/GatewayAdmins";
import { Documents } from "./collections/Documents";
import { Procedures } from "./collections/Procedures";
import { gatewaySsoStrategy } from "./auth/gatewaySsoStrategy";
import { PAYLOAD_CMS_SESSION_COOKIE, PAYLOAD_CMS_SESSION_TTL_SECONDS, signPayloadCmsSession } from "./auth/payloadCmsSession";
import { updateProcedureDraft } from "./auth/procedureMutationAdapter";

const trustedOrigins = Array.from(new Set([
  "https://koudama.com",
  "https://payload.koudama.com",
  ...(process.env.PAYLOAD_TRUSTED_ORIGINS || "http://127.0.0.1:4100,http://localhost:4100,http://127.0.0.1:5175,http://localhost:5175")
    .split(",").map((origin) => origin.trim()).filter(Boolean),
]));

export default buildConfig({
  admin: {
    user: "gateway-admins",
    importMap: { baseDir: "." },
  },
  collections: [GatewayAdmins, Procedures, Documents],
  endpoints: [{
    path: "/gateway-procedures/draft-update",
    method: "post",
    handler: async (req) => {
      if (req.user?.collection !== "gateway-admins") {
        return Response.json({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });
      }
      const capabilities = (req.user as unknown as { capabilitySnapshot?: unknown }).capabilitySnapshot;
      if (!Array.isArray(capabilities)
        || (!capabilities.includes("cms.edit") && !capabilities.includes("superadmin.all"))) {
        return Response.json({ ok: false, error: "CMS_EDIT_CAPABILITY_REQUIRED" }, { status: 403 });
      }
      try {
        const input = await req.json?.();
        if (!input || typeof input !== "object") return Response.json({ ok: false, error: "INVALID_DRAFT_INPUT" }, { status: 422 });
        const result = await updateProcedureDraft(req.payload, req, input);
        return Response.json({ ok: true, state: "draft", result: result.map((document) => ({ id: document.id, procedureCode: document.procedureCode, _status: document._status })) });
      } catch (error) {
        const message = error instanceof Error ? error.message : "PAYLOAD_DRAFT_UPDATE_FAILED";
        const status = message === "PROCEDURE_CODE_IMMUTABLE" ? 409 : 422;
        return Response.json({ ok: false, error: message }, { status });
      }
    },
  }, {
    path: "/gateway-sso/exchange",
    method: "post",
    handler: async (req) => {
      const authentication = await gatewaySsoStrategy.authenticate({ headers: new Headers(req.headers as HeadersInit), payload: req.payload });
      const user = authentication.user;
      if (!user || user.collection !== "gateway-admins") {
        return Response.json({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });
      }
      const cmsSession = await signPayloadCmsSession({
        sub: String(user.gatewayUserId),
        projectionId: String(user.id),
      });
      const headers = headersWithCors({
        req,
        headers: new Headers({ Location: "/admin", "Cache-Control": "no-store" }),
      });
      headers.append("Set-Cookie", `${PAYLOAD_CMS_SESSION_COOKIE}=${cmsSession}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${PAYLOAD_CMS_SESSION_TTL_SECONDS}${process.env.NODE_ENV === "production" ? "; Secure" : ""}`);
      return new Response(null, { status: 303, headers });
    },
  }],
  secret: process.env.PAYLOAD_SECRET || "",
  localization: {
    locales: ["ar", "en"],
    defaultLocale: "ar",
    fallback: true,
  },
  db: postgresAdapter({
    pool: { connectionString: process.env.PAYLOAD_DATABASE_URL },
    push: false,
    migrationDir: "./src/migrations",
    schemaName: process.env.PAYLOAD_DB_SCHEMA || "payload_cms",
  }),
  cors: trustedOrigins,
  csrf: trustedOrigins,
});
