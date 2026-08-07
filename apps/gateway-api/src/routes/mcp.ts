/**
 * MCP (Model Context Protocol) — Streamable HTTP Transport
 *
 * Implements the MCP JSON-RPC 2.0 protocol so AI tools (Claude Desktop,
 * VS Code Copilot, ChatGPT plugins, etc.) can discover and call Watany tools.
 *
 * Endpoint: POST /mcp  (JSON-RPC over HTTP)
 *
 * Supported methods:
 *   initialize          — handshake, returns server capabilities
 *   notifications/initialized — client ack (no response)
 *   tools/list          — enumerate available tools
 *   tools/call          — invoke a tool
 *   resources/list      — list resources (empty)
 *   prompts/list        — list prompts (empty)
 *   ping                — health check
 */
import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";

/* ── JSON-RPC types ── */
interface JsonRpcRequest {
  jsonrpc: "2.0";
  id?: string | number | null;
  method: string;
  params?: Record<string, unknown>;
}

interface JsonRpcResponse {
  jsonrpc: "2.0";
  id: string | number | null;
  result?: unknown;
  error?: { code: number; message: string; data?: unknown };
}

/* ── Tool definitions ── */
const TOOLS = [
  {
    name: "ask_watany",
    description:
      "Ask the Watany knowledge base a question about Lebanese military veterans — pensions, salaries, medical benefits, administrative procedures, legal articles, family allowances. Accepts questions in Arabic or English. Responds in Arabic by default. This tool queries a local knowledge base of 743 chunks and uses an LLM to generate answers. It is read-only and does not modify any data.",
    inputSchema: {
      type: "object" as const,
      properties: {
        message: {
          type: "string",
          description: "The question to ask, in Arabic or English",
        },
        lang: {
          type: "string",
          description: "Response language: ar (Arabic, default) or en",
          enum: ["ar", "en"],
          default: "ar",
        },
      },
      required: ["message"],
    },
    annotations: {
      title: "Ask Watany",
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true,
    },
  },
  {
    name: "calculate_salary",
    description:
      "Calculate a Lebanese military veteran's monthly pension salary for 2026. Provide rank in Arabic (e.g. عريف, رقيب, رائد, عقيد). Optionally specify degree (1-15), marital status, and number of children. Returns a detailed breakdown including base salary, aids, family allowance, and projected raises. This is a pure local computation — read-only, no external calls.",
    inputSchema: {
      type: "object" as const,
      properties: {
        rank: {
          type: "string",
          description: "Military rank in Arabic. Common ranks: جندي (Private), عريف (Corporal), رقيب (Sergeant), رقيب أول (Staff Sergeant), مساعد (Warrant Officer), ملازم (Lieutenant), نقيب (Captain), رائد (Major), مقدم (Lt. Colonel), عقيد (Colonel), عميد (Brigadier General), لواء (Major General)",
        },
        degree: {
          type: "number",
          description: "Salary degree/step within the rank (1-15, default: 1)",
          default: 1,
        },
        married: {
          type: "boolean",
          description: "Whether the veteran is married (affects spouse allowance)",
          default: false,
        },
        kidsCount: {
          type: "number",
          description: "Number of children (affects child allowance)",
          default: 0,
        },
      },
      required: ["rank"],
    },
    annotations: {
      title: "Calculate Salary",
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
  },
  {
    name: "search_knowledge_base",
    description:
      "Full-text search across the Watany knowledge base (laws, procedures, rules, FAQs) for Lebanese military veterans. The knowledge base is in Arabic, so Arabic queries yield the best results. English queries are automatically translated to Arabic keywords. Returns matching documents with titles, types, and content snippets. This is a read-only search — no data is modified.",
    inputSchema: {
      type: "object" as const,
      properties: {
        query: {
          type: "string",
          description: "Search query text (Arabic preferred for best results; English is auto-translated)",
        },
        limit: {
          type: "number",
          description: "Max results to return (default 10, max 30)",
          default: 10,
        },
      },
      required: ["query"],
    },
    annotations: {
      title: "Search Knowledge Base",
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
  },
];

/* ── Server info ── */
const SERVER_INFO = {
  name: "watany-mcp",
  version: "1.0.0",
};

const SERVER_CAPABILITIES = {
  tools: { listChanged: false },
  resources: { listChanged: false },
  prompts: { listChanged: false },
};

/* ── Session management ── */
const sessions = new Map<string, { initialized: boolean; ts: number }>();

function generateSessionId(): string {
  return `mcp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/* ── Route registration ── */
export default async function mcpRoutes(fastify: FastifyInstance) {
  /**
   * POST /mcp — MCP Streamable HTTP transport
   * Accepts JSON-RPC 2.0 requests, returns JSON-RPC 2.0 responses.
   */
  fastify.post("/mcp", async (req: FastifyRequest, reply: FastifyReply) => {
    const body = req.body as JsonRpcRequest | JsonRpcRequest[];

    // Handle batch requests
    if (Array.isArray(body)) {
      const results: JsonRpcResponse[] = [];
      for (const item of body) {
        const res = await handleRpc(fastify, item, req, reply);
        if (res) results.push(res);
      }
      if (results.length === 0) {
        reply.code(204);
        return;
      }
      return results;
    }

    // Single request
    const result = await handleRpc(fastify, body, req, reply);
    if (!result) {
      // Notification — no response
      reply.code(204);
      return;
    }

    // Set MCP session header
    const sessionId = (req.headers["mcp-session-id"] as string) || generateSessionId();
    reply.header("mcp-session-id", sessionId);

    return result;
  });

  /**
   * GET /mcp — SSE endpoint for server-initiated messages (optional)
   * Required by spec but we don't push server-initiated messages.
   */
  fastify.get("/mcp", async (req: FastifyRequest, reply: FastifyReply) => {
    const accept = (req.headers.accept || "").toLowerCase();

    // If requesting SSE, open a keep-alive stream
    if (accept.includes("text/event-stream")) {
      const sessionId = (req.headers["mcp-session-id"] as string) || generateSessionId();
      reply
        .header("Content-Type", "text/event-stream")
        .header("Cache-Control", "no-cache")
        .header("Connection", "keep-alive")
        .header("mcp-session-id", sessionId);

      // Send an initial endpoint event (legacy SSE transport compatibility)
      const raw = reply.raw;
      raw.write(`event: endpoint\ndata: /mcp\n\n`);

      // Keep alive with periodic pings
      const interval = setInterval(() => {
        try {
          raw.write(`: ping\n\n`);
        } catch {
          clearInterval(interval);
        }
      }, 30000);

      req.raw.on("close", () => {
        clearInterval(interval);
      });

      // Don't end the response — keep SSE stream open
      return reply;
    }

    // Non-SSE GET — return server info as JSON
    return {
      jsonrpc: "2.0",
      result: {
        name: SERVER_INFO.name,
        version: SERVER_INFO.version,
        protocolVersion: "2025-03-26",
      },
    };
  });

  /**
   * DELETE /mcp — Close session
   */
  fastify.delete("/mcp", async (req: FastifyRequest, reply: FastifyReply) => {
    const sessionId = req.headers["mcp-session-id"] as string;
    if (sessionId) {
      sessions.delete(sessionId);
    }
    reply.code(204);
    return;
  });

  /**
   * OPTIONS /mcp — CORS preflight
   */
  fastify.options("/mcp", async (_req: FastifyRequest, reply: FastifyReply) => {
    reply
      .header("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS")
      .header("Access-Control-Allow-Headers", "Content-Type, mcp-session-id, Accept")
      .code(204);
    return;
  });
}

/* ═══════════════════════════════════════════════════
   JSON-RPC dispatch
   ═══════════════════════════════════════════════════ */

async function handleRpc(
  fastify: FastifyInstance,
  rpc: JsonRpcRequest,
  req: FastifyRequest,
  _reply: FastifyReply,
): Promise<JsonRpcResponse | null> {
  const { method, id, params } = rpc;

  // Notifications (no id) — no response expected
  if (id === undefined || id === null) {
    // Handle known notifications silently
    if (method === "notifications/initialized" || method === "notifications/cancelled") {
      return null;
    }
    return null;
  }

  switch (method) {
    case "initialize":
      return rpcOk(id, {
        protocolVersion: "2025-03-26",
        capabilities: SERVER_CAPABILITIES,
        serverInfo: SERVER_INFO,
      });

    case "ping":
      return rpcOk(id, {});

    case "tools/list":
      return rpcOk(id, { tools: TOOLS });

    case "tools/call":
      return handleToolCall(fastify, id, params as any, req);

    case "resources/list":
      return rpcOk(id, { resources: [] });

    case "resources/templates/list":
      return rpcOk(id, { resourceTemplates: [] });

    case "prompts/list":
      return rpcOk(id, { prompts: [] });

    default:
      return rpcError(id, -32601, `Method not found: ${method}`);
  }
}

/* ═══════════════════════════════════════════════════
   Tool call dispatch
   ═══════════════════════════════════════════════════ */

async function handleToolCall(
  fastify: FastifyInstance,
  id: string | number,
  params: { name: string; arguments?: Record<string, unknown> },
  req: FastifyRequest,
): Promise<JsonRpcResponse> {
  const toolName = params?.name;
  const args = params?.arguments || {};

  if (!toolName) {
    return rpcError(id, -32602, "Missing tool name");
  }

  try {
    switch (toolName) {
      case "ask_watany":
        return await callAskWatany(fastify, id, args, req);
      case "calculate_salary":
        return await callCalculateSalary(fastify, id, args);
      case "search_knowledge_base":
        return await callSearchKB(fastify, id, args);
      default:
        return rpcError(id, -32602, `Unknown tool: ${toolName}`);
    }
  } catch (err: any) {
    fastify.log.error({ err, tool: toolName }, "MCP tool call failed");
    return rpcError(id, -32603, `Tool execution failed: ${err.message || "unknown error"}`);
  }
}

/* ── ask_watany ── */
async function callAskWatany(
  fastify: FastifyInstance,
  id: string | number,
  args: Record<string, unknown>,
  _req: FastifyRequest,
): Promise<JsonRpcResponse> {
  const message = String(args.message || "");
  const lang = String(args.lang || "ar");

  if (!message.trim()) {
    return rpcError(id, -32602, "message is required");
  }

  // Use Fastify inject to call the internal /api/chat route
  const res = await fastify.inject({
    method: "POST",
    url: "/api/chat",
    payload: { message, lang, channel: "mcp" },
    headers: { "content-type": "application/json" },
  });

  const body = JSON.parse(res.body);
  const reply = body.reply || body.answer || body.answer_lb || "لا إجابة متاحة حالياً.";

  return rpcOk(id, {
    content: [
      {
        type: "text",
        text: reply,
      },
    ],
  });
}

/* ── English rank → Arabic translation map ── */
const RANK_EN_TO_AR: Record<string, string> = {
  private: "جندي",
  corporal: "عريف",
  sergeant: "رقيب",
  "staff sergeant": "رقيب أول",
  "warrant officer": "مساعد",
  lieutenant: "ملازم",
  "first lieutenant": "ملازم أول",
  captain: "نقيب",
  major: "رائد",
  "lieutenant colonel": "مقدم",
  colonel: "عقيد",
  "brigadier general": "عميد",
  "brigadier": "عميد",
  "major general": "لواء",
  general: "لواء",
};

function translateRank(rank: string): string {
  const lower = rank.toLowerCase().trim();
  return RANK_EN_TO_AR[lower] || rank;
}

/* ── calculate_salary ── */
async function callCalculateSalary(
  fastify: FastifyInstance,
  id: string | number,
  args: Record<string, unknown>,
): Promise<JsonRpcResponse> {
  const rawRank = String(args.rank || "");
  const rank = translateRank(rawRank);
  const degree = args.degree != null ? Number(args.degree) : 1;
  const married = Boolean(args.married || args.hasFamily);
  const kidsCount = Number(args.kidsCount || 0);

  if (!rank) {
    return rpcError(id, -32602, "rank is required");
  }

  // Use inject to call internal salary calc
  const res = await fastify.inject({
    method: "POST",
    url: "/api/salary/calc",
    payload: { rank, degree, married, kidsCount },
    headers: { "content-type": "application/json" },
  });

  const body = JSON.parse(res.body);

  // If 404 (rank not found), provide a helpful error
  if (res.statusCode === 404) {
    return rpcOk(id, {
      content: [
        {
          type: "text",
          text: `الرتبة "${rawRank}" غير موجودة في قاعدة البيانات. الرتب المتاحة: جندي، عريف، رقيب، رقيب أول، مساعد، ملازم، ملازم أول، نقيب، رائد، مقدم، عقيد، عميد، لواء.\nThe rank "${rawRank}" was not found. Available ranks: Private, Corporal, Sergeant, Staff Sergeant, Warrant Officer, Lieutenant, First Lieutenant, Captain, Major, Lt. Colonel, Colonel, Brigadier General, Major General.`,
        },
      ],
    });
  }

  return rpcOk(id, {
    content: [
      {
        type: "text",
        text: JSON.stringify(body, null, 2),
      },
    ],
  });
}

/* ── English → Arabic keyword translation for search ── */
const SEARCH_EN_TO_AR: Record<string, string> = {
  pension: "معاش تقاعدي",
  salary: "راتب",
  retirement: "تقاعد",
  medical: "طبابة",
  health: "صحة",
  hospital: "مستشفى",
  family: "عائلة",
  allowance: "تعويض",
  "family allowance": "تعويض عائلي",
  children: "أولاد",
  wife: "زوجة",
  spouse: "زوجة",
  decree: "مرسوم",
  law: "قانون",
  procedure: "معاملة",
  documents: "وثائق",
  paperwork: "أوراق",
  rank: "رتبة",
  veteran: "متقاعد",
  military: "عسكري",
  soldier: "جندي",
  officer: "ضابط",
  benefits: "حقوق",
  rights: "حقوق",
  insurance: "تأمين",
  education: "تعليم",
  housing: "سكن",
  death: "وفاة",
  disability: "عجز",
  injury: "إصابة",
  medal: "وسام",
  decoration: "وسام",
  transfer: "نقل",
  complaint: "شكوى",
};

function translateSearchQuery(query: string): string {
  const trimmed = query.trim();
  // If query already contains Arabic characters, use as-is
  if (/[\u0600-\u06FF]/.test(trimmed)) return trimmed;

  // Try full phrase match first
  const lowerFull = trimmed.toLowerCase();
  if (SEARCH_EN_TO_AR[lowerFull]) return SEARCH_EN_TO_AR[lowerFull];

  // Translate individual words
  const words = trimmed.toLowerCase().split(/\s+/);
  const translated = words.map(w => SEARCH_EN_TO_AR[w] || w);
  // If at least one word was translated, use Arabic version
  const hasArabic = translated.some(w => /[\u0600-\u06FF]/.test(w));
  return hasArabic ? translated.filter(w => /[\u0600-\u06FF]/.test(w)).join(" ") : trimmed;
}

/* ── search_knowledge_base ── */
async function callSearchKB(
  fastify: FastifyInstance,
  id: string | number,
  args: Record<string, unknown>,
): Promise<JsonRpcResponse> {
  const rawQuery = String(args.query || "");
  const limit = Math.min(Number(args.limit || 10), 30);

  if (!rawQuery.trim()) {
    return rpcError(id, -32602, "query is required");
  }

  // Translate English queries to Arabic for better FTS5 matching
  const query = translateSearchQuery(rawQuery);

  const res = await fastify.inject({
    method: "GET",
    url: `/api/kb-nodes/search?q=${encodeURIComponent(query)}&limit=${limit}`,
  });

  const body = JSON.parse(res.body);

  // Format results as readable text
  const results = (body.results || body.nodes || []) as Array<{
    title?: string;
    type?: string;
    content?: string;
    snippet?: string;
    summary_lb?: string;
    score?: number;
  }>;

  if (results.length === 0) {
    // Bilingual empty-result message
    const msg = rawQuery !== query
      ? `No results found for "${rawQuery}" (searched as "${query}"). Try a more specific Arabic query.\nلم يتم العثور على نتائج للبحث "${query}". حاول استخدام كلمات بحث أكثر تحديداً.`
      : `لم يتم العثور على نتائج للبحث "${query}". حاول استخدام كلمات بحث مختلفة.\nNo results found for "${query}". Try different search terms.`;
    return rpcOk(id, {
      content: [{ type: "text", text: msg }],
    });
  }

  const text = results
    .map((r, i) => {
      const title = r.title || "(بدون عنوان)";
      const type = r.type || "unknown";
      const content = r.summary_lb || r.content || r.snippet || "";
      return `[${i + 1}] (${type}) ${title}\n${content.slice(0, 500)}`;
    })
    .join("\n\n---\n\n");

  return rpcOk(id, {
    content: [{ type: "text", text: text }],
  });
}

/* ── JSON-RPC helpers ── */
function rpcOk(id: string | number, result: unknown): JsonRpcResponse {
  return { jsonrpc: "2.0", id, result };
}

function rpcError(
  id: string | number,
  code: number,
  message: string,
  data?: unknown,
): JsonRpcResponse {
  return { jsonrpc: "2.0", id, error: { code, message, data } };
}
