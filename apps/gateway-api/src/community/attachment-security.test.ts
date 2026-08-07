import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { COMMUNITY_ATTACHMENT_MAX_BYTES, scanCommunityAttachmentFile, storeCommunityAttachmentUpload } from "./attachment-security";

const ENV_KEYS = [
  "APP_ENV",
  "COMMUNITY_ATTACHMENT_SCAN_ALLOW_TEST_BYPASS",
  "COMMUNITY_ATTACHMENT_SCANNER_ARGS",
  "COMMUNITY_ATTACHMENT_SCANNER_BIN",
  "COMMUNITY_ATTACHMENT_SCANNER_KIND",
  "COMMUNITY_ATTACHMENT_SCAN_TIMEOUT_MS",
  "COMMUNITY_ATTACHMENT_STORAGE_ROOT",
  "ENVIRONMENT",
  "MPCMDRUN_PATH",
  "NODE_ENV",
  "PATH",
  "VERCEL_ENV",
] as const;

const originalEnv = Object.fromEntries(
  ENV_KEYS.map((key) => [key, process.env[key]]),
) as Record<(typeof ENV_KEYS)[number], string | undefined>;

const tempDirs = new Set<string>();

function createTempDir(prefix: string): string {
  const directory = mkdtempSync(path.join(os.tmpdir(), prefix));
  tempDirs.add(directory);
  return directory;
}

function createAttachmentFile(): string {
  const directory = createTempDir("watany-community-attachment-");
  const filePath = path.join(directory, "sample.pdf");
  writeFileSync(filePath, createMinimalPdfBuffer());
  return filePath;
}

function createSilentWavBuffer(durationMs: number): Buffer {
  const sampleRate = 8_000;
  const channels = 1;
  const bitsPerSample = 8;
  const bytesPerSample = bitsPerSample / 8;
  const sampleCount = Math.round((durationMs / 1000) * sampleRate);
  const dataSize = sampleCount * channels * bytesPerSample;
  const buffer = Buffer.alloc(44 + dataSize);

  buffer.write("RIFF", 0, "ascii");
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write("WAVE", 8, "ascii");
  buffer.write("fmt ", 12, "ascii");
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(channels, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * channels * bytesPerSample, 28);
  buffer.writeUInt16LE(channels * bytesPerSample, 32);
  buffer.writeUInt16LE(bitsPerSample, 34);
  buffer.write("data", 36, "ascii");
  buffer.writeUInt32LE(dataSize, 40);
  buffer.fill(128, 44);

  return buffer;
}

function createMinimalPdfBuffer(): Buffer {
  return Buffer.from("%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n2 0 obj\n<< /Type /Pages /Count 0 >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF", "ascii");
}

function createMinimalPngBuffer(): Buffer {
  return Buffer.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
    0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
    0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
    0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53,
    0xde, 0x00, 0x00, 0x00, 0x0c, 0x49, 0x44, 0x41,
    0x54, 0x08, 0x99, 0x63, 0xf8, 0xcf, 0xc0, 0x00,
    0x00, 0x03, 0x01, 0x01, 0x00, 0xc9, 0xfe, 0x92,
    0xef, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4e,
    0x44, 0xae, 0x42, 0x60, 0x82,
  ]);
}

function createMockScanner(mode: "infected" | "malformed" | "timeout") {
  const directory = createTempDir("watany-community-scanner-");
  const scriptPath = path.join(directory, "mock-scanner.cjs");
  writeFileSync(scriptPath, [
    "const args = process.argv.slice(2);",
    "if (args.includes('--version')) {",
    "  console.log('MockClam 1.4.3/27182');",
    "  process.exit(0);",
    "}",
    "const mode = args[0];",
    "const filePath = args[args.length - 1];",
    "if (mode === 'malformed') {",
    "  console.log('scanner output without a verdict');",
    "  process.exit(0);",
    "}",
    "if (mode === 'infected') {",
    "  console.log(`${filePath}: Eicar-Test-Signature FOUND`);",
    "  process.exit(1);",
    "}",
    "if (mode === 'timeout') {",
    "  setTimeout(() => {",
    "    console.log(`${filePath}: OK`);",
    "    process.exit(0);",
    "  }, 250);",
    "  return;",
    "}",
    "console.log(`${filePath}: OK`);",
    "process.exit(0);",
  ].join("\n"), "utf8");

  return {
    command: process.execPath,
    args: JSON.stringify([scriptPath, mode]),
  };
}

function createMockWindowsDefenderScanner() {
  const directory = createTempDir("watany-community-defender-");
  const scriptPath = path.join(directory, "mock-defender.cjs");
  writeFileSync(scriptPath, [
    "const args = process.argv.slice(2);",
    "if (args.includes('-?')) {",
    "  console.log('Microsoft Antimalware Service Command Line Utility (c) 2006-2022 Microsoft Corp');",
    "  process.exit(0);",
    "}",
    "const fileIndex = args.findIndex((arg) => arg === '-File');",
    "const filePath = fileIndex >= 0 ? args[fileIndex + 1] : 'unknown-file';",
    "if (args.includes('-Scan') && args.includes('-DisableRemediation')) {",
    "  console.log('Scan starting...');",
    "  console.log('Scan finished.');",
    "  console.log(`Scanning ${filePath} found no threats.`);",
    "  process.exit(0);",
    "}",
    "process.exit(1);",
  ].join("\n"), "utf8");

  return {
    command: process.execPath,
    args: JSON.stringify([scriptPath]),
  };
}

afterEach(() => {
  for (const key of ENV_KEYS) {
    const value = originalEnv[key];
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }

  for (const directory of tempDirs) {
    rmSync(directory, { recursive: true, force: true });
  }
  tempDirs.clear();
});

describe("attachment security scanner contract", () => {
  it("allows the explicit test-only bypass inside the test runtime", async () => {
    process.env.NODE_ENV = "test";
    process.env.PATH = "";
    process.env.COMMUNITY_ATTACHMENT_SCAN_ALLOW_TEST_BYPASS = "true";

    const result = await scanCommunityAttachmentFile(createAttachmentFile());

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.scan).toMatchObject({
      status: "clean",
      provider: "test-bypass",
      providerVersion: "explicit-test-only",
      durationMs: 0,
    });
  });

  it("returns unavailable when no scanner candidate can be executed", async () => {
    process.env.NODE_ENV = "development";
    process.env.PATH = "";

    const result = await scanCommunityAttachmentFile(createAttachmentFile());

    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }

    expect(result.statusCode).toBe(503);
    expect(result.error).toBe("community_attachment_scan_unavailable");
    expect(result.scan).toMatchObject({
      status: "unavailable",
      provider: "clamscan",
      errorCategory: "scanner_unavailable",
    });
  });

  it("rejects the bypass when a production indicator is present", async () => {
    process.env.NODE_ENV = "test";
    process.env.APP_ENV = "production";
    process.env.PATH = "";
    process.env.COMMUNITY_ATTACHMENT_SCAN_ALLOW_TEST_BYPASS = "true";

    const result = await scanCommunityAttachmentFile(createAttachmentFile());

    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }

    expect(result.statusCode).toBe(503);
    expect(result.error).toBe("community_attachment_scan_unavailable");
    expect(result.scan).toMatchObject({
      status: "unavailable",
      provider: "clamscan",
      errorCategory: "test_bypass_rejected_in_production",
    });
  });

  it("classifies malformed scanner output as a safe error", async () => {
    const scanner = createMockScanner("malformed");
    process.env.NODE_ENV = "development";
    process.env.PATH = "";
    process.env.COMMUNITY_ATTACHMENT_SCANNER_BIN = scanner.command;
    process.env.COMMUNITY_ATTACHMENT_SCANNER_ARGS = scanner.args;

    const result = await scanCommunityAttachmentFile(createAttachmentFile());

    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }

    expect(result.statusCode).toBe(503);
    expect(result.error).toBe("community_attachment_scan_failed");
    expect(result.scan).toMatchObject({
      status: "error",
      provider: "MockClam",
      providerVersion: "1.4.3",
      signatureVersion: "27182",
      errorCategory: "malformed_response",
    });
    expect(result.scan.durationMs).toBeGreaterThanOrEqual(0);
  });

  it("supports Windows Defender style clean scan output", async () => {
    const scanner = createMockWindowsDefenderScanner();
    process.env.NODE_ENV = "development";
    process.env.PATH = String.raw`C:\Windows\System32`;
    process.env.COMMUNITY_ATTACHMENT_SCANNER_BIN = scanner.command;
    process.env.COMMUNITY_ATTACHMENT_SCANNER_ARGS = scanner.args;
    process.env.COMMUNITY_ATTACHMENT_SCANNER_KIND = "windows-defender";

    const result = await scanCommunityAttachmentFile(createAttachmentFile());

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.scan).toMatchObject({
      status: "clean",
      provider: "Microsoft Defender",
    });
  });

  it("classifies scanner timeouts explicitly", async () => {
    const scanner = createMockScanner("timeout");
    process.env.NODE_ENV = "development";
    process.env.PATH = "";
    process.env.COMMUNITY_ATTACHMENT_SCANNER_BIN = scanner.command;
    process.env.COMMUNITY_ATTACHMENT_SCANNER_ARGS = scanner.args;
    process.env.COMMUNITY_ATTACHMENT_SCAN_TIMEOUT_MS = "25";

    const result = await scanCommunityAttachmentFile(createAttachmentFile());

    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }

    expect(result.statusCode).toBe(503);
    expect(result.error).toBe("community_attachment_scan_timeout");
    expect(result.scan).toMatchObject({
      status: "timeout",
      provider: "MockClam",
      providerVersion: "1.4.3",
      signatureVersion: "27182",
      errorCategory: "scanner_timeout",
    });
  });

  it("quarantines infected uploads and keeps them outside the clean store", async () => {
    const storageRoot = createTempDir("watany-community-storage-");
    const scanner = createMockScanner("infected");
    process.env.NODE_ENV = "development";
    process.env.PATH = "";
    process.env.COMMUNITY_ATTACHMENT_STORAGE_ROOT = storageRoot;
    process.env.COMMUNITY_ATTACHMENT_SCANNER_BIN = scanner.command;
    process.env.COMMUNITY_ATTACHMENT_SCANNER_ARGS = scanner.args;

    const result = await storeCommunityAttachmentUpload({
      attachmentId: "infected-upload-1",
      filename: "evidence.pdf",
      mimeType: "application/pdf",
      buffer: createMinimalPdfBuffer(),
    });

    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }

    expect(result.statusCode).toBe(422);
    expect(result.error).toBe("community_attachment_malware_detected");
    expect(result.scan).toMatchObject({
      status: "infected",
      provider: "MockClam",
      providerVersion: "1.4.3",
      signatureVersion: "27182",
      errorCategory: "malware_detected",
      threatName: "Eicar-Test-Signature",
    });
    expect(existsSync(path.join(storageRoot, "quarantine", "infected-upload-1.quarantine"))).toBe(true);
    expect(existsSync(path.join(storageRoot, "quarantine", "infected-upload-1.upload"))).toBe(false);
    expect(existsSync(path.join(storageRoot, "clean", "infected-upload-1.pdf"))).toBe(false);
  });

  it("extracts and persists exact five-minute voice durations", async () => {
    const storageRoot = createTempDir("watany-community-storage-");
    process.env.NODE_ENV = "test";
    process.env.COMMUNITY_ATTACHMENT_SCAN_ALLOW_TEST_BYPASS = "true";
    process.env.COMMUNITY_ATTACHMENT_STORAGE_ROOT = storageRoot;

    const result = await storeCommunityAttachmentUpload({
      attachmentId: "voice-exact-5m",
      filename: "voice.wav",
      mimeType: "audio/wav",
      buffer: createSilentWavBuffer(300_000),
      requestedType: "voice",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.value).toMatchObject({
      messageType: "voice",
      durationMs: 300_000,
    });
    expect(existsSync(path.join(storageRoot, "clean", "voice-exact-5m.wav"))).toBe(true);
  });

  it("rejects mismatched declared mime types when the uploaded bytes are actually another allowed type", async () => {
    const storageRoot = createTempDir("watany-community-storage-");
    process.env.NODE_ENV = "test";
    process.env.COMMUNITY_ATTACHMENT_SCAN_ALLOW_TEST_BYPASS = "true";
    process.env.COMMUNITY_ATTACHMENT_STORAGE_ROOT = storageRoot;

    const result = await storeCommunityAttachmentUpload({
      attachmentId: "pdf-declared-png",
      filename: "declared-png.png",
      mimeType: "image/png",
      buffer: createMinimalPdfBuffer(),
    });

    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }

    expect(result.statusCode).toBe(400);
    expect(result.error).toBe("community_attachment_type_mismatch");
  });

  it("rejects suspicious pdf payloads with trailing non-whitespace bytes after eof", async () => {
    const storageRoot = createTempDir("watany-community-storage-");
    process.env.NODE_ENV = "test";
    process.env.COMMUNITY_ATTACHMENT_SCAN_ALLOW_TEST_BYPASS = "true";
    process.env.COMMUNITY_ATTACHMENT_STORAGE_ROOT = storageRoot;

    const result = await storeCommunityAttachmentUpload({
      attachmentId: "pdf-polyglot-like",
      filename: "suspicious.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.concat([createMinimalPdfBuffer(), Buffer.from("<script>alert(1)</script>", "utf8")]),
    });

    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }

    expect(result.statusCode).toBe(400);
    expect(result.error).toBe("community_attachment_type_mismatch");
  });

  it("accepts exact ten megabyte png uploads at the policy boundary", async () => {
    const storageRoot = createTempDir("watany-community-storage-");
    process.env.NODE_ENV = "test";
    process.env.COMMUNITY_ATTACHMENT_SCAN_ALLOW_TEST_BYPASS = "true";
    process.env.COMMUNITY_ATTACHMENT_STORAGE_ROOT = storageRoot;

    const png = createMinimalPngBuffer();
    const paddingBytes = COMMUNITY_ATTACHMENT_MAX_BYTES - png.length;
    const result = await storeCommunityAttachmentUpload({
      attachmentId: "png-max-boundary",
      filename: "boundary.png",
      mimeType: "image/png",
      buffer: Buffer.concat([png, Buffer.alloc(paddingBytes, 0x20)]),
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.value.bytes).toBe(COMMUNITY_ATTACHMENT_MAX_BYTES);
  });

  it("rejects uploads that exceed the exact ten megabyte policy boundary", async () => {
    const storageRoot = createTempDir("watany-community-storage-");
    process.env.NODE_ENV = "test";
    process.env.COMMUNITY_ATTACHMENT_SCAN_ALLOW_TEST_BYPASS = "true";
    process.env.COMMUNITY_ATTACHMENT_STORAGE_ROOT = storageRoot;

    const png = createMinimalPngBuffer();
    const paddingBytes = COMMUNITY_ATTACHMENT_MAX_BYTES - png.length + 1;
    const result = await storeCommunityAttachmentUpload({
      attachmentId: "png-over-boundary",
      filename: "too-large.png",
      mimeType: "image/png",
      buffer: Buffer.concat([png, Buffer.alloc(paddingBytes, 0x20)]),
    });

    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }

    expect(result.statusCode).toBe(413);
    expect(result.error).toBe("community_attachment_too_large");
  });

  it("rejects voice uploads that exceed the five-minute cap", async () => {
    const storageRoot = createTempDir("watany-community-storage-");
    process.env.NODE_ENV = "test";
    process.env.COMMUNITY_ATTACHMENT_SCAN_ALLOW_TEST_BYPASS = "true";
    process.env.COMMUNITY_ATTACHMENT_STORAGE_ROOT = storageRoot;

    const result = await storeCommunityAttachmentUpload({
      attachmentId: "voice-over-limit",
      filename: "voice.wav",
      mimeType: "audio/wav",
      buffer: createSilentWavBuffer(301_000),
      requestedType: "voice",
    });

    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }

    expect(result.statusCode).toBe(422);
    expect(result.error).toBe("community_attachment_voice_too_long");
    expect(existsSync(path.join(storageRoot, "clean", "voice-over-limit.wav"))).toBe(false);
  });

  it("rejects malformed voice uploads even after a clean scan result", async () => {
    const storageRoot = createTempDir("watany-community-storage-");
    process.env.NODE_ENV = "test";
    process.env.COMMUNITY_ATTACHMENT_SCAN_ALLOW_TEST_BYPASS = "true";
    process.env.COMMUNITY_ATTACHMENT_STORAGE_ROOT = storageRoot;

    const result = await storeCommunityAttachmentUpload({
      attachmentId: "voice-malformed",
      filename: "voice.wav",
      mimeType: "audio/wav",
      buffer: Buffer.from("not-a-real-audio-file", "utf8"),
      requestedType: "voice",
    });

    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }

    expect(result.statusCode).toBe(400);
    expect(result.error).toBe("community_attachment_voice_invalid");
    expect(existsSync(path.join(storageRoot, "clean", "voice-malformed.wav"))).toBe(false);
  });
});