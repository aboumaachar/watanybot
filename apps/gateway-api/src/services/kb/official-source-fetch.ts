import { createHash } from "node:crypto";
import { REVIEWED_PROCEDURAL_CLAIMS } from "./official-claim-ledger";
import { reviewOfficialSources, type OfficialSourceReview, type SourceSnapshot } from "./official-source-lifecycle";

/**
 * WB-KB-005B, local/on-demand only. Not an HTTP route, scheduled job or approval.
 * Caller must be server-side and independently authorized; egress allowlist remains
 * necessary at deployment to guard against DNS rebinding/resolver compromise.
 */
export type OfficialFetchResult = {
  sourceId: string;
  sourceUrl: string;
  retrievedAt: string;
  status: "snapshot_ready" | "blocked" | "fetch_failed";
  reason: string;
  textSha256?: string;
  textLength?: number;
  /** Advisory only; does not extend reviewValidThrough or certify truth. */
  reviews: OfficialSourceReview[];
  snapshot?: SourceSnapshot;
};

export type OfficialFetch = (url: string, init: RequestInit) => Promise<Response>;
const BYTE_LIMIT = 128 * 1024;
const DEFAULT_TIMEOUT_MS = 5000;

function toPlainText(html: string): string {
  return html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style\s*>/gi, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/&(?:nbsp|amp|lt|gt|quot|#39);/gi, (s) =>
      ({ "&nbsp;": " ", "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&#39;": "'" })[s.toLowerCase()] || " ")
    .replace(/\s+/g, " ").trim();
}

function registeredSource(id: string): { sourceId: string; sourceUrl: string } | null {
  const matches = REVIEWED_PROCEDURAL_CLAIMS.filter((item) => item.sourceId === id);
  if (matches.length !== 1) return null;
  const sourceUrl = matches[0].sourceUrl;
  try {
    const u = new URL(sourceUrl);
    if (u.protocol !== "https:" || u.username || u.password || u.port || u.hash) return null;
    const permitted = new Set(["www.lebarmy.gov.lb", "eservices.finance.gov.lb"]);
    if (!permitted.has(u.hostname.toLowerCase())) return null;
    return { sourceId: id, sourceUrl };
  } catch { return null; }
}

async function boundedBody(response: Response): Promise<string> {
  const size = response.headers.get("content-length");
  if (size && (!/^\d+$/.test(size) || Number(size) > BYTE_LIMIT)) throw new Error("BODY_SIZE_DECLARED_INVALID");
  if (!response.body) throw new Error("NO_RESPONSE_BODY");
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let count = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) {
        count += value.byteLength;
        if (count > BYTE_LIMIT) throw new Error("BODY_LIMIT_EXCEEDED");
        chunks.push(value);
      }
    }
  } finally { await reader.cancel().catch(() => undefined); }
  const body = new Uint8Array(count);
  let offset = 0;
  for (const chunk of chunks) { body.set(chunk, offset); offset += chunk.byteLength; }
  return new TextDecoder("utf-8", { fatal: true }).decode(body);
}

/** Exactly one source identifier; all errors remain failed evidence, never a changed approval. */
export async function fetchOfficialSourceOnce(
  sourceId: string,
  opts: { fetcher?: OfficialFetch; now?: Date; timeoutMs?: number } = {},
): Promise<OfficialFetchResult> {
  const source = registeredSource(sourceId);
  const now = opts.now ?? new Date();
  const time = Number.isFinite(now.getTime()) ? now.toISOString() : "INVALID_TIME";
  if (!source) return { sourceId, sourceUrl: "", retrievedAt: time, status: "blocked", reason: "NOT_IN_EXACT_ALLOWLIST", reviews: [] };
  const reference = { sourceId: source.sourceId, sourceUrl: source.sourceUrl };
  const failed = (reason: string): OfficialFetchResult => {
    const snapshot: SourceSnapshot = { ...reference, retrievalSucceeded: false };
    return { ...reference, retrievedAt: time, status: "fetch_failed", reason,
      snapshot, reviews: reviewOfficialSources(now, [snapshot]).filter((r) => r.sourceId === sourceId) };
  };
  if (time === "INVALID_TIME") return failed("INVALID_TIME");
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  if (!Number.isInteger(timeoutMs) || timeoutMs < 100 || timeoutMs > 10000) return failed("INVALID_TIMEOUT");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await (opts.fetcher ?? fetch)(source.sourceUrl, {
      method: "GET", redirect: "manual", credentials: "omit", cache: "no-store",
      referrerPolicy: "no-referrer", headers: { Accept: "text/html, text/plain;q=0.7" },
      signal: controller.signal,
    });
    if (response.status >= 300 && response.status < 400) return failed("REDIRECT_REJECTED");
    if (response.status !== 200) return failed("NON_200_RESPONSE");
    if (response.url && response.url !== source.sourceUrl) return failed("RESPONSE_URL_CHANGED");
    const media = (response.headers.get("content-type") || "").toLowerCase();
    if (!/^(text\/html|text\/plain)(?:\s*;|$)/.test(media)) return failed("UNEXPECTED_CONTENT_TYPE");
    let raw: string;
    try { raw = await boundedBody(response); }
    catch (err) { return failed(err instanceof Error ? err.message : "BODY_READ_FAILED"); }
    const plainText = media.startsWith("text/html") ? toPlainText(raw) : raw.replace(/\s+/g, " ").trim();
    if (!plainText || plainText.length < 40) return failed("EMPTY_OR_TINY_TEXT");
    const snapshot: SourceSnapshot = { ...reference, retrievalSucceeded: true, plainText };
    return { ...reference, retrievedAt: time, status: "snapshot_ready", reason: "EVIDENCE_ONLY_REVIEW_REQUIRED",
      textLength: plainText.length,
      textSha256: createHash("sha256").update(plainText, "utf8").digest("hex"),
      snapshot, reviews: reviewOfficialSources(now, [snapshot]).filter((r) => r.sourceId === sourceId) };
  } catch (err) {
    return failed(err instanceof Error && err.name === "AbortError" ? "FETCH_TIMEOUT" : "FETCH_EXCEPTION");
  } finally { clearTimeout(timer); }
}
