/**
 * bootstrap/plugins.ts
 * Registers all core Fastify plugins (cookie, cors, compress, rate-limit, debug).
 * Call registerPlugins(app) once, after Fastify instantiation and before routes.
 */
import type { FastifyInstance } from "fastify";
import cookie from "@fastify/cookie";
import cors from "@fastify/cors";
import compress from "@fastify/compress";
import rateLimit from "@fastify/rate-limit";
import websocket from "@fastify/websocket";
import { debugPlugin } from "../debug/plugin";
import { isDev, disableWebsockets } from "../lib/config";
import { isCorsOriginAllowed } from "../lib/gateway-hardening";

export async function registerPlugins(app: FastifyInstance): Promise<void> {
  await app.register(cookie);

  // Explicit CORS origin allowlist — never reflect arbitrary origins with credentials.
  // Add the production domain here when deploying.
  const corsAllowlist = new Set([
    "http://localhost:5174",
    "http://127.0.0.1:5174",
    "http://localhost:5175",
    "http://127.0.0.1:5175",
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    ...(process.env.CORS_ORIGINS ? process.env.CORS_ORIGINS.split(",").map(o => o.trim()) : []),
  ]);

  await app.register(cors, {
    origin: (origin, cb) => {
      // Allow server-to-server (no Origin header) and explicitly listed origins.
      if (isCorsOriginAllowed(origin, { allowlist: corsAllowlist, isDevelopment: isDev })) {
        cb(null, true);
      } else {
        cb(new Error(`CORS: origin '${origin}' not allowed`), false);
      }
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  });

  try {
    await app.register(compress, {
      global: true,
      encodings: ["br", "gzip", "deflate"],
      threshold: 1024,
    });
  } catch (compressErr: unknown) {
    app.log.warn(
      { err: compressErr instanceof Error ? compressErr.message : String(compressErr) },
      "@fastify/compress registration failed; continuing without compression",
    );
  }

  await app.register(rateLimit, {
    max: 100,
    timeWindow: "1 minute",
    allowList: ["127.0.0.1", "::1"],
    addHeadersOnExceeding: {
      "x-ratelimit-limit": true,
      "x-ratelimit-remaining": true,
      "x-ratelimit-reset": true,
    },
    addHeaders: {
      "x-ratelimit-limit": true,
      "x-ratelimit-remaining": true,
      "x-ratelimit-reset": true,
      "retry-after": true,
    },
  });

  await app.register(debugPlugin, {
    enabled: isDev,
    logRequests: true,
    logResponses: true,
    trackPerformance: true,
  });

  if (!disableWebsockets) {
    app.register(websocket);
    app.after(() => {
      const wsServer = (app as typeof app & {
        websocketServer?: { setMaxListeners?: (value: number) => void };
      }).websocketServer;
      wsServer?.setMaxListeners?.(30);
    });
  }

  // Note: runtime asset serving handled by dedicated route registration where needed.
}
