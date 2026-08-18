/**
 * WatanyBot Gateway API â€” Thin bootstrap server.
 *
 * This file contains only:
 *   1. Fastify instantiation
 *   2. Ordered bootstrap calls
 *   3. Process lifecycle (migrations + listen)
 *
 * All business logic lives in bootstrap/, routes/, lib/, db/, and ai/.
 *
 * @see docs/architecture/ADR-001-gateway-bootstrap-thin.md
 */
import Fastify from "fastify";
import { LOG_LEVEL, port, host, isDev, usePython, useKbStub, useAi, getPythonBase } from "./lib/config";
import { getProcedureRuntimeInfo } from "./procedures/config.js";
import { runMigrations } from "./db/migrate.js";
import { debugConsole } from "./debug/console";
// â”€â”€ Bootstrap modules â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
import { registerSecurityHeaders } from "./bootstrap/security";
import { registerPlugins }         from "./bootstrap/plugins";
import { initAiState }             from "./bootstrap/ai-state";
import { bootstrapKb }             from "./bootstrap/kb-bootstrap";
import { createCircuitBreakers }   from "./bootstrap/circuit-breakers";
import { bootstrapServices }       from "./bootstrap/services";
import { registerRoutes }          from "./bootstrap/routes";
import { registerErrorHandler }    from "./bootstrap/error-handler";
import { shouldRunPgMigrations }   from "./bootstrap/helpers";
import { registerOfficialSourcesRoutes }   from "./routes/official-sources";
import { registerSchoolAidsRoutes }         from "./routes/school-aids";
import { registerHolidayGreetingsRoutes }   from "./routes/holiday-greetings";
import { registerSuperadminUsersRoutes }    from "./routes/superadmin-users";
import { isIgnorableGatewayDisconnectError } from "./lib/gateway-hardening";
import registerKbImportRoutes from "./routes/kb-import";
import multipart from "@fastify/multipart";
import { seasonalAppleJobRouter } from './koudama/surveys/seasonal-apple-job';
import { registerAinElHafehAdminRoutes } from "./routes/ainelhafeh-admin";
import { registerAinMreissehBuildingAssistantRoutes } from "./koudama/surveys/ain-mreisseh-building-assistant/ainMreissehBuildingAssistant.routes.js";
/* ================================================================
 *  Fastify instance
 * ================================================================ */
export const app = Fastify({
  logger:    { level: LOG_LEVEL },
  bodyLimit: 11 * 1024 * 1024,
  trustProxy: process.env.TRUST_PROXY === "true" ? ["127.0.0.1", "::1"] : false,
});

/* ================================================================
 *  Bootstrap sequence
 * ================================================================ */

// 1. Security headers (must be first hook)
registerSecurityHeaders(app);

// Optional boot trace markers (emitted only when APEX_GATEWAY_BOOT_TRACE=1)
const _apexBootTrace = process.env.APEX_GATEWAY_BOOT_TRACE === '1';
if (_apexBootTrace) console.log('APEX_BOOT_MARKER:BOOT_CONFIG_START');
// 2. Core plugins (cors, compress, rate-limit, websocket, debug)
if (_apexBootTrace) console.log('APEX_BOOT_MARKER:BOOT_PLUGINS_START');
await registerPlugins(app);
if (_apexBootTrace) console.log('APEX_BOOT_MARKER:BOOT_PLUGINS_DONE');

// 3. Path diagnostics
if (_apexBootTrace) console.log('APEX_BOOT_MARKER:BOOT_CONFIG_DONE');
if (_apexBootTrace) console.log('APEX_BOOT_MARKER:BOOT_PATH_DIAGNOSTICS_START');
const procedureRuntime = getProcedureRuntimeInfo();
debugConsole.info("Watany Gateway API starting", {
  port, host, isDev, usePython,
  pythonBase: getPythonBase(),
  useKbStub, useAi,
  procedureKbRoot:   procedureRuntime.kbRoot,
  procedureKbSource: procedureRuntime.source,
});

// 4. AI provider
if (_apexBootTrace) console.log('APEX_BOOT_MARKER:BOOT_AI_START');
await initAiState();
if (_apexBootTrace) console.log('APEX_BOOT_MARKER:BOOT_AI_DONE');

// 5. KB store, vNext nodes, RAG chunks, plugin DB
if (_apexBootTrace) console.log('APEX_BOOT_MARKER:BOOT_KB_START');
const kb = await bootstrapKb(app);
if (_apexBootTrace) console.log('APEX_BOOT_MARKER:BOOT_KB_DONE');

// 6. Circuit breakers
if (_apexBootTrace) console.log('APEX_BOOT_MARKER:BOOT_CIRCUIT_BREAKERS_START');
const cbs = createCircuitBreakers();
if (_apexBootTrace) console.log('APEX_BOOT_MARKER:BOOT_CIRCUIT_BREAKERS_DONE');

// 7. Application services (versioning, intents, voice E2E, chat)
if (_apexBootTrace) console.log('APEX_BOOT_MARKER:BOOT_SERVICES_START');
const services = await bootstrapServices(app, kb, cbs);
if (_apexBootTrace) console.log('APEX_BOOT_MARKER:BOOT_SERVICES_DONE');

// 8. Error handler (before routes so it catches route-registration errors)
if (_apexBootTrace) console.log('APEX_BOOT_MARKER:BOOT_ERROR_HANDLER_START');
registerErrorHandler(app);
if (_apexBootTrace) console.log('APEX_BOOT_MARKER:BOOT_ERROR_HANDLER_DONE');

// 9. Multipart parser must be available before multipart-backed routes are registered.
if (_apexBootTrace) console.log('APEX_BOOT_MARKER:BOOT_MULTIPART_START');
await app.register(multipart);
if (_apexBootTrace) console.log('APEX_BOOT_MARKER:BOOT_MULTIPART_DONE');

// 10. All route modules
if (_apexBootTrace) console.log('APEX_BOOT_MARKER:BOOT_ROUTES_START');
await registerRoutes(app, kb, services, cbs);
if (_apexBootTrace) console.log('APEX_BOOT_MARKER:BOOT_ROUTES_DONE');

/* ================================================================
 *  Fastify instance type augmentation
 * ================================================================ */
declare module "fastify" {
  interface FastifyInstance {
    pluginDb: import("./types/domain").PluginDb;
  }
}

/* ================================================================
 *  Process lifecycle
 * ================================================================ */
if (process.env.NODE_ENV !== "test") {
  process.on("uncaughtException",  (err)    => {
    if (isIgnorableGatewayDisconnectError(err)) {
      app.log.warn({ err }, "ignored_client_disconnect");
      return;
    }

    app.log.fatal({ err }, "uncaught_exception");
    process.exit(1);
  });
  process.on("unhandledRejection", (reason) => { app.log.error({ reason }, "unhandled_rejection"); });

  if (shouldRunPgMigrations()) {
    try {
      await runMigrations();
    } catch (err) {
      app.log.warn({ err }, "PostgreSQL migrations skipped (DB may not be running)");
    }
  } else {
    app.log.info("PostgreSQL migrations disabled via RUN_PG_MIGRATIONS=false");
  }

  try {
    registerOfficialSourcesRoutes(app);
    registerSchoolAidsRoutes(app);
    registerHolidayGreetingsRoutes(app);
    await registerSuperadminUsersRoutes(app);
    await app.register(seasonalAppleJobRouter);
    // APEX_FEATURE01_KB_IMPORT_ROUTE_REGISTERED
    await app.register(registerKbImportRoutes);
await registerAinElHafehAdminRoutes(app);
    await registerAinMreissehBuildingAssistantRoutes(app);
    await app.listen({ port, host, backlog: 2048 });
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

export default app;
