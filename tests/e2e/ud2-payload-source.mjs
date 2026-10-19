import { createHmac } from "node:crypto";
import { readFileSync } from "node:fs";
import { access, writeFile } from "node:fs/promises";
import { createServer } from "node:http";

const host = "127.0.0.1";
const port = Number(process.env.UD2_SOURCE_PORT || "4121");
const payloadUrl = String(process.env.UD2_PAYLOAD_URL || "http://127.0.0.1:4101").replace(/\/$/u, "");
const modeFile = process.env.UD2_SOURCE_MODE_FILE || "";
const configuredMode = process.env.UD2_SOURCE_MODE || "fixture";
const ssoSecret = process.env.PAYLOAD_SSO_SECRET || "";
const sourceApiToken = process.env.UD2_SOURCE_API_TOKEN || "";
const sourceSubject = process.env.UD2_SOURCE_SUBJECT || "ud2-source-service";
const payloadDownSignalFile = process.env.UD2_PAYLOAD_DOWN_SIGNAL_FILE || "";
const payloadDownAckFile = process.env.UD2_PAYLOAD_DOWN_ACK_FILE || "";
const payloadUpSignalFile = process.env.UD2_PAYLOAD_UP_SIGNAL_FILE || "";
const payloadUpAckFile = process.env.UD2_PAYLOAD_UP_ACK_FILE || "";

function base64Url(value) {
  return Buffer.from(value).toString("base64url");
}

function sourceAssertion() {
  const issuedAt = Math.floor(Date.now() / 1000);
  const header = base64Url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const claims = base64Url(JSON.stringify({
    issuer: "watany-gateway",
    subject: sourceSubject,
    audience: "watany-payload",
    jwtId: `ud2-source-${issuedAt}`,
    role: "superadmin",
    capabilities: ["superadmin.all"],
    iss: "watany-gateway",
    sub: sourceSubject,
    aud: "watany-payload",
    iat: issuedAt,
    exp: issuedAt + 300,
    jti: `ud2-source-${issuedAt}`,
  }));
  const unsigned = `${header}.${claims}`;
  const signature = createHmac("sha256", ssoSecret).update(unsigned).digest("base64url");
  return `${unsigned}.${signature}`;
}

function currentMode() {
  if (!modeFile) return configuredMode;
  try {
    const value = readFileSync(modeFile, "utf8").trim();
    return value || configuredMode;
  } catch {
    return configuredMode;
  }
}

function writeJson(response, status, body) {
  const serialized = JSON.stringify(body);
  response.statusCode = status;
  response.setHeader("Content-Type", "application/json");
  response.setHeader("Content-Length", Buffer.byteLength(serialized));
  response.end(serialized);
}

async function waitForFile(filePath, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      await access(filePath);
      return true;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
  }
  return false;
}

function fixturePage(pathname) {
  if (pathname === "/api/documents") {
    return {
      docs: [{
        id: "ud2-document-a",
        canonicalId: "ud2-document-a",
        titleAr: "UD2 Acceptance Document",
        _status: "published",
        publicationState: "published",
        workflowStatus: "PUBLISHED",
      }],
      totalPages: 1,
      hasNextPage: false,
    };
  }
  return {
    docs: [{
      id: "ud2-procedure-a",
      canonicalId: "ud2-procedure-a",
      titleAr: "UD2 Acceptance Procedure A",
      summaryAr: "UD2 browser acceptance",
      sourceSystem: "PAYLOAD_CMS",
      revisionNumber: "1",
      _status: "published",
      publicationState: "published",
      workflowStatus: "PUBLISHED",
    }],
    totalPages: 1,
    hasNextPage: false,
  };
}

async function proxyPayload(request, response, pathname, search) {
  try {
    const upstreamSearch = pathname === "/api/procedures"
      ? `${search}${search ? "&" : "?"}locale=all`
      : search;
    const upstream = await fetch(`${payloadUrl}${pathname}${upstreamSearch}`, {
      headers: { Accept: "application/json", Authorization: `Bearer ${sourceAssertion()}` },
    });
    if (pathname === "/api/documents" && upstream.status === 404) {
      writeJson(response, 200, { docs: [], totalPages: 1, hasNextPage: false });
      return;
    }
    response.statusCode = upstream.status;
    const contentType = upstream.headers.get("content-type");
    if (contentType) response.setHeader("Content-Type", contentType);
    const body = await upstream.text();
    if (upstream.ok && pathname === "/api/procedures") {
      try {
        const page = JSON.parse(body);
        if (Array.isArray(page.docs)) {
          page.docs = page.docs.map((record) => {
            if (!record || typeof record !== "object") return record;
            const normalized = { ...record };
            normalized.canonicalId = normalized.canonicalId || normalized.procedureCode;
            normalized.titleAr = normalized.titleAr || (typeof normalized.title === "object" ? normalized.title.ar || normalized.title.en : normalized.title);
            normalized.titleEn = normalized.titleEn || (typeof normalized.title === "object" ? normalized.title.en || normalized.title.ar : normalized.title);
            normalized.summaryAr = normalized.summaryAr || (typeof normalized.summary === "object" ? normalized.summary.ar || normalized.summary.en : normalized.summary);
            normalized.summaryEn = normalized.summaryEn || (typeof normalized.summary === "object" ? normalized.summary.en || normalized.summary.ar : normalized.summary);
            for (const field of ["eligibility", "requirements", "steps"]) {
              if (normalized[field] && typeof normalized[field] === "object" && !Array.isArray(normalized[field])) {
                normalized[field] = normalized[field].ar || normalized[field].en || [];
              }
            }
            return normalized;
          });
          response.end(JSON.stringify(page));
          return;
        }
      } catch {
        // Preserve the upstream body so the Gateway classifies malformed source data.
      }
    }
    response.end(body);
  } catch {
    writeJson(response, 503, { error: "SOURCE_UPSTREAM_UNAVAILABLE" });
  }
}

const server = createServer((request, response) => {
  const parsed = new URL(request.url || "/", `http://${host}:${port}`);
  const pathname = parsed.pathname;
  if (pathname === "/__ud2__/ready") {
    writeJson(response, 200, { ok: true, mode: currentMode() });
    return;
  }
  if (pathname.startsWith("/__ud2__/mode/")) {
    const requestedMode = pathname.slice("/__ud2__/mode/".length);
    const allowedModes = ["active", "fixture", "unreachable", "auth-failed", "schema-invalid"];
    if (request.method !== "POST" || !modeFile || !allowedModes.includes(requestedMode)) {
      writeJson(response, 400, { error: "SOURCE_MODE_CONTROL_INVALID" });
      return;
    }
    void writeFile(modeFile, `${requestedMode}\n`, "utf8")
      .then(() => writeJson(response, 202, { ok: true, mode: requestedMode }))
      .catch(() => writeJson(response, 500, { error: "SOURCE_MODE_CONTROL_FAILED" }));
    return;
  }
  if (pathname === "/__ud2__/payload-down") {
    if (request.method !== "POST" || !payloadDownSignalFile || !payloadDownAckFile) {
      writeJson(response, 400, { error: "PAYLOAD_DOWN_CONTROL_INVALID" });
      return;
    }
    void writeFile(payloadDownSignalFile, "PAYLOAD_DOWN_REQUESTED\n", "utf8")
      .then(async () => {
        const acknowledged = await waitForFile(payloadDownAckFile, 30_000);
        if (acknowledged) writeJson(response, 202, { ok: true, control: "PAYLOAD_DOWN_STOPPED" });
        else writeJson(response, 504, { error: "PAYLOAD_DOWN_CONTROL_TIMEOUT" });
      })
      .catch(() => writeJson(response, 500, { error: "PAYLOAD_DOWN_CONTROL_FAILED" }));
    return;
  }
  if (pathname === "/__ud2__/payload-up") {
    if (request.method !== "POST" || !payloadUpSignalFile || !payloadUpAckFile) {
      writeJson(response, 400, { error: "PAYLOAD_UP_CONTROL_INVALID" });
      return;
    }
    void writeFile(payloadUpSignalFile, "PAYLOAD_UP_REQUESTED\n", "utf8")
      .then(async () => {
        const acknowledged = await waitForFile(payloadUpAckFile, 30_000);
        if (acknowledged) writeJson(response, 202, { ok: true, control: "PAYLOAD_UP_READY" });
        else writeJson(response, 504, { error: "PAYLOAD_UP_CONTROL_TIMEOUT" });
      })
      .catch(() => writeJson(response, 500, { error: "PAYLOAD_UP_CONTROL_FAILED" }));
    return;
  }
  if (pathname !== "/api/procedures" && pathname !== "/api/documents") {
    writeJson(response, 404, { error: "SOURCE_ROUTE_NOT_FOUND" });
    return;
  }

  if (sourceApiToken && request.headers.authorization !== `Bearer ${sourceApiToken}`) {
    writeJson(response, 401, { error: "SOURCE_AUTHORITY_REQUIRED" });
    return;
  }

  const mode = currentMode();
  if (mode === "unreachable") {
    request.socket.destroy();
    return;
  }
  if (mode === "auth-failed") {
    writeJson(response, 401, { error: "SOURCE_AUTH_FAILED" });
    return;
  }
  if (mode === "schema-invalid") {
    writeJson(response, 200, { docs: [{ titleAr: "invalid" }], totalPages: 1, hasNextPage: false });
    return;
  }
  if (mode === "active") {
    void proxyPayload(request, response, pathname, parsed.search);
    return;
  }
  writeJson(response, 200, fixturePage(pathname));
});

server.listen(port, host, () => {
  console.log(`UD2_SOURCE_READY=YES`);
  console.log(`UD2_SOURCE_PORT=${port}`);
  console.log(`UD2_SOURCE_MODE=${configuredMode}`);
});

function close() {
  server.close(() => process.exit(0));
}

process.once("SIGTERM", close);
process.once("SIGINT", close);
