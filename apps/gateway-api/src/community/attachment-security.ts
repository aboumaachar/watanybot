import { execFile } from "node:child_process";
import { promises as fs } from "node:fs";
import path from "node:path";
import { promisify } from "node:util";
import { fileTypeFromBuffer } from "file-type";
import { parseBuffer } from "music-metadata";
import { sanitizeOriginalName, sha256File } from "../kb-import/file-security.js";

const execFileAsync = promisify(execFile);
const DEFAULT_ATTACHMENT_MAX_BYTES = 10 * 1024 * 1024;
const DEFAULT_SCAN_TIMEOUT_MS = 30_000;
const DEFAULT_VOICE_ATTACHMENT_MAX_DURATION_MS = 5 * 60 * 1000;
const PRODUCTION_ENV_KEYS = ["NODE_ENV", "APP_ENV", "ENVIRONMENT", "VERCEL_ENV"] as const;
const scannerVersionCache = new Map<string, Promise<CommunityAttachmentScannerVersion | null>>();

type CommunityAttachmentMessageType = "attachment" | "voice";

type AttachmentMimeSpec = {
  extension: string;
  messageType: CommunityAttachmentMessageType;
  detectedMimeTypes: readonly string[];
};

const ATTACHMENT_MIME_SPECS = new Map<string, AttachmentMimeSpec>([
  ["image/jpeg", { extension: ".jpg", messageType: "attachment", detectedMimeTypes: ["image/jpeg"] }],
  ["image/png", { extension: ".png", messageType: "attachment", detectedMimeTypes: ["image/png"] }],
  ["image/webp", { extension: ".webp", messageType: "attachment", detectedMimeTypes: ["image/webp"] }],
  ["application/pdf", { extension: ".pdf", messageType: "attachment", detectedMimeTypes: ["application/pdf"] }],
  ["audio/ogg", { extension: ".ogg", messageType: "voice", detectedMimeTypes: ["audio/ogg"] }],
  ["audio/webm", { extension: ".webm", messageType: "voice", detectedMimeTypes: ["video/webm"] }],
  ["audio/mpeg", { extension: ".mp3", messageType: "voice", detectedMimeTypes: ["audio/mpeg"] }],
  ["audio/mp4", { extension: ".m4a", messageType: "voice", detectedMimeTypes: ["video/mp4"] }],
  ["audio/x-m4a", { extension: ".m4a", messageType: "voice", detectedMimeTypes: ["video/mp4"] }],
  ["audio/wav", { extension: ".wav", messageType: "voice", detectedMimeTypes: ["audio/wav", "audio/vnd.wave"] }],
  ["audio/x-wav", { extension: ".wav", messageType: "voice", detectedMimeTypes: ["audio/wav", "audio/vnd.wave"] }],
]);

const PDF_SIGNATURE = Buffer.from("%PDF-", "ascii");
const PDF_EOF_MARKERS = [Buffer.from("%%EOF", "ascii"), Buffer.from("%%EOF\r", "ascii"), Buffer.from("%%EOF\n", "ascii")];
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const JPEG_SIGNATURE = Buffer.from([0xff, 0xd8, 0xff]);
const WEBP_RIFF_SIGNATURE = Buffer.from("RIFF", "ascii");
const WEBP_WEBP_SIGNATURE = Buffer.from("WEBP", "ascii");

export const COMMUNITY_ATTACHMENT_MAX_BYTES = (() => {
  const configured = Number(process.env.COMMUNITY_ATTACHMENT_MAX_BYTES || DEFAULT_ATTACHMENT_MAX_BYTES);
  return Number.isFinite(configured) && configured > 0
    ? Math.floor(configured)
    : DEFAULT_ATTACHMENT_MAX_BYTES;
})();

export const COMMUNITY_ATTACHMENT_VOICE_MAX_DURATION_MS = (() => {
  const configured = Number(process.env.COMMUNITY_ATTACHMENT_VOICE_MAX_DURATION_MS || DEFAULT_VOICE_ATTACHMENT_MAX_DURATION_MS);
  return Number.isFinite(configured) && configured > 0
    ? Math.floor(configured)
    : DEFAULT_VOICE_ATTACHMENT_MAX_DURATION_MS;
})();

export type CommunityAttachmentStorage = {
  root: string;
  quarantineDir: string;
  cleanDir: string;
};

export type StoredCommunityAttachment = {
  originalName: string;
  storageKey: string;
  storedPath: string;
  contentUrl: string;
  mimeType: string;
  bytes: number;
  sha256: string;
  scanStatus: "clean";
  scanProvider: string;
  scanProviderVersion?: string;
  scanSignatureVersion?: string;
  scanDurationMs: number;
  scannedAt: string;
  messageType: CommunityAttachmentMessageType;
  durationMs?: number;
};

export type CommunityAttachmentScanStatus = "clean" | "infected" | "unavailable" | "timeout" | "error";

export type CommunityAttachmentScanErrorCategory =
  | "malware_detected"
  | "scanner_unavailable"
  | "scanner_timeout"
  | "scan_execution_failed"
  | "malformed_response"
  | "test_bypass_rejected_in_production";

export type CommunityAttachmentScan = {
  status: CommunityAttachmentScanStatus;
  provider: string;
  providerVersion?: string;
  signatureVersion?: string;
  durationMs: number;
  scannedAt: string;
  threatName?: string;
  errorCategory?: CommunityAttachmentScanErrorCategory;
};

export type StoreCommunityAttachmentResult =
  | { ok: true; value: StoredCommunityAttachment }
  | { ok: false; statusCode: number; error: string; detail?: string; scan?: CommunityAttachmentScan; detectedMimeType?: string };

type ScanCommunityAttachmentResult =
  | { ok: true; scan: CommunityAttachmentScan & { status: "clean" } }
  | { ok: false; statusCode: number; error: string; detail?: string; scan: CommunityAttachmentScan };

type CommunityAttachmentScannerVersion = {
  provider: string;
  providerVersion?: string;
  signatureVersion?: string;
};

type ScannerCandidateKind = "clamav" | "windows-defender";

type ScannerCandidate = {
  command: string;
  baseArgs: string[];
  kind: ScannerCandidateKind;
};

function normalizeMimeType(mimeType: string): string {
  return String(mimeType || "").trim().toLowerCase();
}

function bufferStartsWith(buffer: Buffer, signature: Buffer): boolean {
  return buffer.length >= signature.length && buffer.subarray(0, signature.length).equals(signature);
}

function bufferEndsWith(buffer: Buffer, signature: Buffer): boolean {
  return buffer.length >= signature.length && buffer.subarray(buffer.length - signature.length).equals(signature);
}

function isWhitespaceByte(value: number): boolean {
  return value === 0x09 || value === 0x0a || value === 0x0d || value === 0x20;
}

function hasTrailingBytesAfterPdfEof(buffer: Buffer): boolean {
  for (let index = buffer.length - 1; index >= 0; index -= 1) {
    const current = buffer[index];
    if (isWhitespaceByte(current)) {
      continue;
    }

    for (const marker of PDF_EOF_MARKERS) {
      const start = index - marker.length + 1;
      if (start >= 0 && buffer.subarray(start, index + 1).equals(marker)) {
        return buffer.subarray(index + 1).some((byte) => !isWhitespaceByte(byte));
      }
    }

    return true;
  }

  return true;
}

function validatePdfStructure(buffer: Buffer): boolean {
  if (!bufferStartsWith(buffer, PDF_SIGNATURE)) {
    return false;
  }

  if (!buffer.includes(Buffer.from("/Catalog", "ascii")) && !buffer.includes(Buffer.from("/Pages", "ascii"))) {
    return false;
  }

  return !hasTrailingBytesAfterPdfEof(buffer);
}

function validatePngStructure(buffer: Buffer): boolean {
  if (!bufferStartsWith(buffer, PNG_SIGNATURE)) {
    return false;
  }

  return buffer.includes(Buffer.from("IEND", "ascii"));
}

function validateJpegStructure(buffer: Buffer): boolean {
  if (!bufferStartsWith(buffer, JPEG_SIGNATURE)) {
    return false;
  }

  return buffer.length >= 2 && buffer[buffer.length - 2] === 0xff && buffer[buffer.length - 1] === 0xd9;
}

function validateWebpStructure(buffer: Buffer): boolean {
  if (!bufferStartsWith(buffer, WEBP_RIFF_SIGNATURE)) {
    return false;
  }

  return buffer.length >= 12 && buffer.subarray(8, 12).equals(WEBP_WEBP_SIGNATURE);
}

async function detectAttachmentMimeType(buffer: Buffer): Promise<string | null> {
  const detected = await fileTypeFromBuffer(buffer);
  return detected?.mime || null;
}

function validateAttachmentStructure(mimeType: string, buffer: Buffer): boolean {
  switch (mimeType) {
    case "application/pdf":
      return validatePdfStructure(buffer);
    case "image/png":
      return validatePngStructure(buffer);
    case "image/jpeg":
      return validateJpegStructure(buffer);
    case "image/webp":
      return validateWebpStructure(buffer);
    default:
      return true;
  }
}

function normalizeOriginalName(filename: string, extension: string): string {
  const clean = sanitizeOriginalName(filename || `attachment${extension}`);
  const parsed = path.parse(clean);
  const baseName = (parsed.name || "attachment").slice(0, 120) || "attachment";
  return `${baseName}${extension}`;
}

function uniqueNonEmptyStrings(values: Array<string | undefined | null>): string[] {
  const seen = new Set<string>();
  const output: string[] = [];

  for (const value of values) {
    const trimmed = typeof value === "string" ? value.trim() : "";
    if (!trimmed || seen.has(trimmed)) {
      continue;
    }

    seen.add(trimmed);
    output.push(trimmed);
  }

  return output;
}

function sanitizeScanOutput(parts: Array<unknown>): string | undefined {
  const normalizedParts = parts.map((part) => {
    if (typeof part === "string") {
      return part;
    }

    if (Buffer.isBuffer(part)) {
      return part.toString("utf-8");
    }

    return "";
  });

  const text = normalizedParts
    .join("\n")
    .replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g, " ")
    .trim();

  if (!text) {
    return undefined;
  }

  return text.slice(0, 500);
}

function resolveScanTimeoutMs(): number {
  const configured = Number(process.env.COMMUNITY_ATTACHMENT_SCAN_TIMEOUT_MS || DEFAULT_SCAN_TIMEOUT_MS);
  return Number.isFinite(configured) && configured > 0
    ? Math.floor(configured)
    : DEFAULT_SCAN_TIMEOUT_MS;
}

function resolveAttachmentStorageRoot(): string {
  const configured = String(process.env.COMMUNITY_ATTACHMENT_STORAGE_ROOT || "").trim();
  if (configured) {
    return path.resolve(configured);
  }

  return path.resolve(process.cwd(), "runtime", "community-attachments");
}

async function extractVoiceAttachmentDurationMs(buffer: Buffer, mimeType: string): Promise<number | null> {
  try {
    const metadata = await parseBuffer(new Uint8Array(buffer), {
      mimeType,
      size: buffer.length,
    });
    const durationSeconds = metadata.format.duration;
    if (typeof durationSeconds !== "number" || !Number.isFinite(durationSeconds) || durationSeconds <= 0) {
      return null;
    }

    return Math.max(0, Math.round(durationSeconds * 1000));
  } catch {
    return null;
  }
}

function hasProductionIndicators(): boolean {
  return PRODUCTION_ENV_KEYS.some((key) => {
    const raw = process.env[key];
    if (typeof raw !== "string") {
      return false;
    }

    const value = raw.trim().toLowerCase();
    return value === "production" || value === "prod";
  });
}

function isWindowsDefenderScannerCommand(command: string): boolean {
  const basename = path.basename(command).toLowerCase();
  return basename === "mpcmdrun" || basename === "mpcmdrun.exe";
}

function detectScannerCandidateKind(command: string): ScannerCandidateKind {
  return isWindowsDefenderScannerCommand(command) ? "windows-defender" : "clamav";
}

function parseScannerCandidateKind(rawValue: string | undefined): ScannerCandidateKind | null {
  const value = String(rawValue || "").trim().toLowerCase();
  if (value === "windows-defender" || value === "windows_defender" || value === "windowsdefender" || value === "defender") {
    return "windows-defender";
  }

  if (value === "clamav" || value === "clam") {
    return "clamav";
  }

  return null;
}

function scannerProviderFallback(command: string): string {
  if (isWindowsDefenderScannerCommand(command)) {
    return "Microsoft Defender";
  }

  const parsed = path.parse(command);
  const name = (parsed.name || parsed.base || "scanner").trim();
  return name || "scanner";
}

function parseScannerArgs(rawValue: string | undefined): string[] {
  const value = String(rawValue || "").trim();
  if (!value) {
    return [];
  }

  if (value.startsWith("[")) {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) {
        return parsed
          .filter((entry): entry is string => typeof entry === "string")
          .map((entry) => entry.trim())
          .filter(Boolean);
      }
    } catch {
      // Fall back to whitespace splitting for simple operator-provided strings.
    }
  }

  return value.split(/\s+/).filter(Boolean);
}

function buildScannerCandidates(): ScannerCandidate[] {
  const configuredScannerBin = String(process.env.COMMUNITY_ATTACHMENT_SCANNER_BIN || "").trim();
  const configuredScannerArgs = parseScannerArgs(process.env.COMMUNITY_ATTACHMENT_SCANNER_ARGS);
  const configuredScannerKind = parseScannerCandidateKind(process.env.COMMUNITY_ATTACHMENT_SCANNER_KIND);
  const rawCandidates: ScannerCandidate[] = [];
  const windowsPathSuppressed = String(process.env.PATH || "").trim().length === 0;

  if (configuredScannerBin) {
    rawCandidates.push({
      command: configuredScannerBin,
      baseArgs: configuredScannerArgs,
      kind: configuredScannerKind || detectScannerCandidateKind(configuredScannerBin),
    });
  }

  for (const command of uniqueNonEmptyStrings([
    process.env.CLAMSCAN_PATH,
    process.env.CLAMDSCAN_PATH,
    "clamscan",
    "clamdscan",
  ])) {
    rawCandidates.push({ command, baseArgs: [], kind: "clamav" });
  }

  if (process.platform === "win32" && !windowsPathSuppressed) {
    for (const command of uniqueNonEmptyStrings([
      process.env.MPCMDRUN_PATH,
      process.env.ProgramFiles ? path.join(process.env.ProgramFiles, "Windows Defender", "MpCmdRun.exe") : undefined,
      process.env["ProgramFiles(x86)"] ? path.join(process.env["ProgramFiles(x86)"], "Windows Defender", "MpCmdRun.exe") : undefined,
    ])) {
      rawCandidates.push({ command, baseArgs: [], kind: "windows-defender" });
    }
  }

  const seen = new Set<string>();
  const candidates: ScannerCandidate[] = [];
  for (const candidate of rawCandidates) {
    const key = JSON.stringify([candidate.command, candidate.baseArgs]);
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    candidates.push(candidate);
  }

  return candidates;
}

function buildScannerVersionCacheKey(candidate: ScannerCandidate): string {
  return JSON.stringify([candidate.command, candidate.baseArgs]);
}

function buildScannerVersionArgs(candidate: ScannerCandidate): string[] {
  if (candidate.kind === "windows-defender") {
    return [...candidate.baseArgs, "-?"];
  }

  return [...candidate.baseArgs, "--version"];
}

function buildScannerRunArgs(candidate: ScannerCandidate, filePath: string): string[] {
  if (candidate.kind === "windows-defender") {
    const windowsFilePath = path.win32.normalize(path.resolve(filePath));
    return [...candidate.baseArgs, "-Scan", "-ScanType", "3", "-File", windowsFilePath, "-DisableRemediation"];
  }

  const basename = path.basename(candidate.command).toLowerCase();
  return basename.includes("clamd")
    ? [...candidate.baseArgs, "--no-summary", filePath]
    : [...candidate.baseArgs, "--no-summary", "--stdout", filePath];
}

function parseScannerVersion(output: string | undefined, fallbackProvider: string): CommunityAttachmentScannerVersion {
  const firstLine = String(output || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find(Boolean);

  if (!firstLine) {
    return { provider: fallbackProvider };
  }

  if (/microsoft antimalware service command line utility/i.test(firstLine)) {
    return { provider: "Microsoft Defender" };
  }

  const tokens = firstLine.split(/\s+/).filter(Boolean);
  const versionIndex = tokens.findIndex((token) => /^\d/.test(token));
  if (versionIndex <= 0) {
    return { provider: firstLine || fallbackProvider };
  }

  const provider = tokens.slice(0, versionIndex).join(" ").trim() || fallbackProvider;
  const versionToken = tokens[versionIndex] || "";
  const versionParts = versionToken.split("/");
  const providerVersion = versionParts[0]?.trim() || undefined;
  const signatureVersion = versionParts[1]?.trim() || undefined;

  return {
    provider,
    providerVersion,
    signatureVersion,
  };
}

async function loadScannerVersion(candidate: ScannerCandidate): Promise<CommunityAttachmentScannerVersion | null> {
  const cacheKey = buildScannerVersionCacheKey(candidate);
  let cached = scannerVersionCache.get(cacheKey);
  if (!cached) {
    const pendingVersion = (async (): Promise<CommunityAttachmentScannerVersion | null> => {
      const fallbackProvider = scannerProviderFallback(candidate.command);

      try {
        const { stdout, stderr } = await execFileAsync(candidate.command, buildScannerVersionArgs(candidate), {
          timeout: 5_000,
          windowsHide: true,
          maxBuffer: 128 * 1024,
        });

        return parseScannerVersion(sanitizeScanOutput([stdout, stderr]), fallbackProvider);
      } catch (error) {
        const err = error as NodeJS.ErrnoException & { code?: string | number };
        if (err.code === "ENOENT") {
          return null;
        }

        return { provider: fallbackProvider };
      }
    })();
    scannerVersionCache.set(cacheKey, pendingVersion);
    cached = pendingVersion;
  }

  return cached ?? null;
}

function parseScannerOutput(output: string | undefined):
  | { status: "clean" }
  | { status: "infected"; threatName: string }
  | { status: "malformed" } {
  const threatPattern = /^threat(?:\s+name)?\s*[:=]\s*(.+)$/i;
  const infectedPattern = /:\s(.+)\sFOUND$/i;
  const lines = String(output || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  let threatNameFromLine: string | undefined;
  for (const line of lines) {
    const threatMatch = threatPattern.exec(line);
    if (threatMatch?.[1]) {
      threatNameFromLine = threatMatch[1].trim();
      break;
    }
  }

  const infectedLine = lines.find((line) => /:\s.+\sFOUND$/i.test(line) || /\bfound threats\.?$/i.test(line));
  if (infectedLine) {
    const infectedMatch = infectedPattern.exec(infectedLine);
    const threatText = infectedMatch?.[1]?.trim() || threatNameFromLine || "unknown-threat";
    return {
      status: "infected",
      threatName: threatText,
    };
  }

  const cleanLine = lines.find((line) => /:\sOK$/i.test(line) || /\bfound no threats\.?$/i.test(line));
  if (cleanLine) {
    return { status: "clean" };
  }

  return { status: "malformed" };
}

function buildScannerScan<TStatus extends CommunityAttachmentScanStatus>(
  version: CommunityAttachmentScannerVersion | null,
  command: string,
  input: Omit<CommunityAttachmentScan, "provider" | "providerVersion" | "signatureVersion" | "status"> & { status: TStatus },
): CommunityAttachmentScan & { status: TStatus } {
  const fallbackProvider = scannerProviderFallback(command);
  return {
    ...input,
    provider: version?.provider || fallbackProvider,
    providerVersion: version?.providerVersion,
    signatureVersion: version?.signatureVersion,
  };
}

async function runScannerCandidate(candidate: ScannerCandidate, filePath: string): Promise<ScanCommunityAttachmentResult | null> {
  const args = buildScannerRunArgs(candidate, filePath);
  const version = await loadScannerVersion(candidate);
  if (!version) {
    return null;
  }

  const startedAt = Date.now();

  try {
    const { stdout, stderr } = await execFileAsync(candidate.command, args, {
      timeout: resolveScanTimeoutMs(),
      windowsHide: true,
      maxBuffer: 256 * 1024,
    });
    const scannedAt = new Date().toISOString();
    const durationMs = Math.max(0, Date.now() - startedAt);
    const detail = sanitizeScanOutput([stdout, stderr]);
    const parsed = parseScannerOutput(detail);

    if (parsed.status !== "clean") {
      return {
        ok: false,
        statusCode: 503,
        error: "community_attachment_scan_failed",
        detail,
        scan: buildScannerScan(version, candidate.command, {
          status: "error",
          scannedAt,
          durationMs,
          errorCategory: "malformed_response",
        }),
      };
    }

    return {
      ok: true,
      scan: buildScannerScan(version, candidate.command, {
        status: "clean",
        scannedAt,
        durationMs,
      }),
    };
  } catch (error) {
    const err = error as NodeJS.ErrnoException & {
      code?: string | number;
      stdout?: string;
      stderr?: string;
      signal?: NodeJS.Signals | null;
      killed?: boolean;
    };

    if (err.code === "ENOENT") {
      return null;
    }

    const scannedAt = new Date().toISOString();
    const durationMs = Math.max(0, Date.now() - startedAt);
    const detail = sanitizeScanOutput([err.stdout, err.stderr, err.message]);
    const parsed = parseScannerOutput(detail);

    if (parsed.status === "infected") {
      return {
        ok: false,
        statusCode: 422,
        error: "community_attachment_malware_detected",
        detail,
        scan: buildScannerScan(version, candidate.command, {
          status: "infected",
          scannedAt,
          durationMs,
          threatName: parsed.threatName,
          errorCategory: "malware_detected",
        }),
      };
    }

    const timedOut = err.code === "ETIMEDOUT" || err.killed === true || err.signal === "SIGTERM";
    if (timedOut) {
      return {
        ok: false,
        statusCode: 503,
        error: "community_attachment_scan_timeout",
        detail,
        scan: buildScannerScan(version, candidate.command, {
          status: "timeout",
          scannedAt,
          durationMs,
          errorCategory: "scanner_timeout",
        }),
      };
    }

    const exitCode = typeof err.code === "number" ? err.code : undefined;
    if (exitCode === 1) {
      return {
        ok: false,
        statusCode: 503,
        error: "community_attachment_scan_failed",
        detail,
        scan: buildScannerScan(version, candidate.command, {
          status: "error",
          scannedAt,
          durationMs,
          errorCategory: "malformed_response",
        }),
      };
    }

    return {
      ok: false,
      statusCode: 503,
      error: "community_attachment_scan_failed",
      detail,
      scan: buildScannerScan(version, candidate.command, {
        status: "error",
        scannedAt,
        durationMs,
        errorCategory: "scan_execution_failed",
      }),
    };
  }
}

export async function scanCommunityAttachmentFile(filePath: string): Promise<ScanCommunityAttachmentResult> {
  const bypassRequested = String(process.env.COMMUNITY_ATTACHMENT_SCAN_ALLOW_TEST_BYPASS || "").trim().toLowerCase() === "true";
  const isTestRuntime = process.env.NODE_ENV === "test";
  const productionIndicators = hasProductionIndicators();

  if (bypassRequested && isTestRuntime && !productionIndicators) {
    return {
      ok: true,
      scan: {
        status: "clean",
        provider: "test-bypass",
        providerVersion: "explicit-test-only",
        durationMs: 0,
        scannedAt: new Date().toISOString(),
      },
    };
  }

  const candidates = buildScannerCandidates();

  for (const candidate of candidates) {
    const result = await runScannerCandidate(candidate, filePath);
    if (result) {
      return result;
    }
  }

  const scannedAt = new Date().toISOString();
  const provider = scannerProviderFallback(candidates[0]?.command || "clamscan");
  const errorCategory = bypassRequested && productionIndicators
    ? "test_bypass_rejected_in_production"
    : "scanner_unavailable";

  return {
    ok: false,
    statusCode: 503,
    error: "community_attachment_scan_unavailable",
    detail: errorCategory === "test_bypass_rejected_in_production"
      ? "test-only scanner bypass rejected because a production indicator is present"
      : undefined,
    scan: {
      status: "unavailable",
      provider,
      durationMs: 0,
      scannedAt,
      errorCategory,
    },
  };
}

export async function ensureCommunityAttachmentStorage(): Promise<CommunityAttachmentStorage> {
  const root = resolveAttachmentStorageRoot();
  const quarantineDir = path.join(root, "quarantine");
  const cleanDir = path.join(root, "clean");

  await Promise.all([
    fs.mkdir(quarantineDir, { recursive: true }),
    fs.mkdir(cleanDir, { recursive: true }),
  ]);

  return {
    root,
    quarantineDir,
    cleanDir,
  };
}

export function buildCommunityAttachmentContentUrl(attachmentId: string): string {
  return `/api/community/attachments/${encodeURIComponent(attachmentId)}/content`;
}

export async function storeCommunityAttachmentUpload(input: {
  attachmentId: string;
  filename: string;
  mimeType: string;
  buffer: Buffer;
  requestedType?: CommunityAttachmentMessageType;
}): Promise<StoreCommunityAttachmentResult> {
  const mimeType = normalizeMimeType(input.mimeType);
  const spec = ATTACHMENT_MIME_SPECS.get(mimeType);
  if (!spec) {
    return {
      ok: false,
      statusCode: 415,
      error: "community_attachment_type_not_allowed",
    };
  }

  if (input.requestedType && input.requestedType !== spec.messageType) {
    return {
      ok: false,
      statusCode: 400,
      error: "community_attachment_type_mismatch",
    };
  }

  if (!input.buffer.length) {
    return {
      ok: false,
      statusCode: 400,
      error: "community_attachment_empty",
    };
  }

  if (input.buffer.length > COMMUNITY_ATTACHMENT_MAX_BYTES) {
    return {
      ok: false,
      statusCode: 413,
      error: "community_attachment_too_large",
    };
  }

  const detectedMimeType = await detectAttachmentMimeType(input.buffer);
  if (spec.messageType === "attachment") {
    if (spec.detectedMimeTypes.length > 0) {
      const matchesDetectedMimeType = detectedMimeType != null && spec.detectedMimeTypes.includes(detectedMimeType);
      if (!matchesDetectedMimeType) {
        return {
          ok: false,
          statusCode: 400,
          error: "community_attachment_type_mismatch",
          detectedMimeType: detectedMimeType || undefined,
        };
      }
    }

    if (!validateAttachmentStructure(mimeType, input.buffer)) {
      return {
        ok: false,
        statusCode: 400,
        error: "community_attachment_type_mismatch",
        detectedMimeType: detectedMimeType || undefined,
      };
    }
  } else if (detectedMimeType != null && spec.detectedMimeTypes.length > 0 && !spec.detectedMimeTypes.includes(detectedMimeType)) {
    return {
      ok: false,
      statusCode: 400,
      error: "community_attachment_type_mismatch",
      detectedMimeType: detectedMimeType || undefined,
    };
  }

  const storage = await ensureCommunityAttachmentStorage();
  const originalName = normalizeOriginalName(input.filename, spec.extension);
  const storageKey = `${input.attachmentId}${spec.extension}`;
  const quarantinePath = path.join(storage.quarantineDir, `${input.attachmentId}.upload`);
  const quarantinedBlockedPath = path.join(storage.quarantineDir, `${input.attachmentId}.quarantine`);
  const cleanPath = path.join(storage.cleanDir, storageKey);

  try {
    await fs.writeFile(quarantinePath, input.buffer, { flag: "wx" });

    const scanResult = await scanCommunityAttachmentFile(quarantinePath);
    if (!scanResult.ok) {
      if (scanResult.scan.status === "infected") {
        await fs.rename(quarantinePath, quarantinedBlockedPath).catch(async () => {
          await fs.unlink(quarantinePath).catch(() => undefined);
        });
      } else {
        await fs.unlink(quarantinePath).catch(() => undefined);
      }

      return {
        ok: false,
        statusCode: scanResult.statusCode,
        error: scanResult.error,
        detail: scanResult.detail,
        scan: scanResult.scan,
      };
    }

    let voiceDurationMs: number | undefined;
    if (spec.messageType === "voice") {
      const durationMs = await extractVoiceAttachmentDurationMs(input.buffer, mimeType);
      if (durationMs == null) {
        await fs.unlink(quarantinePath).catch(() => undefined);
        return {
          ok: false,
          statusCode: 400,
          error: "community_attachment_voice_invalid",
        };
      }

      if (durationMs > COMMUNITY_ATTACHMENT_VOICE_MAX_DURATION_MS) {
        await fs.unlink(quarantinePath).catch(() => undefined);
        return {
          ok: false,
          statusCode: 422,
          error: "community_attachment_voice_too_long",
        };
      }

      voiceDurationMs = durationMs;
    }

    const sha256 = await sha256File(quarantinePath);
    await fs.rename(quarantinePath, cleanPath);

    return {
      ok: true,
      value: {
        originalName,
        storageKey,
        storedPath: cleanPath,
        contentUrl: buildCommunityAttachmentContentUrl(input.attachmentId),
        mimeType,
        bytes: input.buffer.length,
        sha256,
        scanStatus: scanResult.scan.status,
        scanProvider: scanResult.scan.provider,
        scanProviderVersion: scanResult.scan.providerVersion,
        scanSignatureVersion: scanResult.scan.signatureVersion,
        scanDurationMs: scanResult.scan.durationMs,
        scannedAt: scanResult.scan.scannedAt,
        messageType: spec.messageType,
        durationMs: voiceDurationMs,
      },
    };
  } catch {
    await fs.unlink(quarantinePath).catch(() => undefined);
    await fs.unlink(cleanPath).catch(() => undefined);

    return {
      ok: false,
      statusCode: 500,
      error: "community_attachment_store_failed",
    };
  }
}