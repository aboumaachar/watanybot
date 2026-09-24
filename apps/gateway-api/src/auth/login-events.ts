import type { FastifyRequest } from "fastify";
import { query } from "../lib/db.js";
import { getRequestNetworkContext } from "./request-network.js";

export async function recordSuccessfulLogin(
  request: FastifyRequest,
  userId: string,
  sessionId: string,
  authMethod: "password" | "google" | "registration",
): Promise<{ clientIp: string; peerIp: string }> {
  const network = getRequestNetworkContext(request);
  await query(
    `INSERT INTO user_login_events
       (user_id, session_id, client_ip, peer_ip, user_agent, auth_method, success)
     VALUES ($1, $2, $3, $4, $5, $6, true)`,
    [
      userId,
      sessionId,
      network.clientIp || null,
      network.peerIp || null,
      request.headers["user-agent"] || "",
      authMethod,
    ],
  );
  return { clientIp: network.clientIp, peerIp: network.peerIp };
}
