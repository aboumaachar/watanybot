import Fastify from "fastify";
import multipart from "@fastify/multipart";
import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { registerAuthHook, signAccessToken } from "../auth/auth-middleware";
import { addCommunityMessage, createCommunityGroup, resetCommunityStore } from "../community/service";
import { initPluginDb } from "../db/plugin-db";
import { runMigrations } from "../db/migrate";
import { query } from "../lib/db";
import { buildCommunityNotificationId, communityRoutes, type CommunityTelemetryRecord } from "../routes/community";
import { notificationRoutes } from "../routes/notifications";
import { acquireCommunityDbTestLock } from "./community-db-test-lock";
import { COMMUNITY_ATTACHMENT_MAX_BYTES } from "../community/attachment-security";

process.env.JWT_SECRET ||= "test-jwt-secret-for-community-routes-0123456789";

const originalNodeEnv = process.env.NODE_ENV;
const originalCommunityDebugResetEnabled = process.env.COMMUNITY_DEBUG_RESET_ENABLED;
const originalAppEnv = process.env.APP_ENV;
const originalCommunityAttachmentScanAllowTestBypass = process.env.COMMUNITY_ATTACHMENT_SCAN_ALLOW_TEST_BYPASS;
const originalPath = process.env.PATH;

function accessTokenFor(user: { sub: string; role: "accredited" | "moderator" | "admin" | "superadmin"; email: string }) {
  return signAccessToken({
    sub: user.sub,
    role: user.role,
    email: user.email,
  });
}

function adminAccessToken() {
  return accessTokenFor({
    sub: "community-admin-1",
    role: "admin",
    email: "community.admin@watany.test",
  });
}

function superadminAccessToken() {
  return accessTokenFor({
    sub: "community-superadmin-1",
    role: "superadmin",
    email: "community.superadmin@watany.test",
  });
}

function memberAccessToken() {
  return accessTokenFor({
    sub: "community-member-1",
    role: "accredited",
    email: "community.member@watany.test",
  });
}

function outsiderAccessToken() {
  return accessTokenFor({
    sub: "community-outsider-1",
    role: "accredited",
    email: "community.outsider@watany.test",
  });
}

function buildMultipartPayload(params: {
  fields?: Record<string, string>;
  file: {
    fieldName: string;
    filename: string;
    contentType: string;
    content: Buffer | string;
  };
}) {
  const boundary = `----watanybot-${Math.random().toString(16).slice(2)}`;
  const chunks: Buffer[] = [];

  for (const [fieldName, value] of Object.entries(params.fields || {})) {
    chunks.push(Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="${fieldName}"\r\n\r\n${value}\r\n`,
      "utf-8",
    ));
  }

  chunks.push(
    Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="${params.file.fieldName}"; filename="${params.file.filename}"\r\nContent-Type: ${params.file.contentType}\r\n\r\n`,
      "utf-8",
    ),
    Buffer.isBuffer(params.file.content) ? params.file.content : Buffer.from(params.file.content, "utf-8"),
    Buffer.from(`\r\n--${boundary}--\r\n`, "utf-8"),
  );

  return {
    body: Buffer.concat(chunks),
    contentType: `multipart/form-data; boundary=${boundary}`,
  };
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

function buildApp(
  makeIdSuffix: string,
  options?: {
    flags?: Record<string, boolean>;
    telemetry?: CommunityTelemetryRecord[];
  },
) {
  const app = Fastify({ logger: false, bodyLimit: 11 * 1024 * 1024 });
  registerAuthHook(app);
  app.register(multipart);
  const flags = options?.flags ?? {};
  app.register(communityRoutes, {
    makeId: (prefix) => `${prefix}_${makeIdSuffix}`,
    getFeatureFlag: async (flagId, defaultValue = true) => {
      return Object.hasOwn(flags, flagId)
        ? Boolean(flags[flagId])
        : defaultValue;
    },
    onTelemetry: options?.telemetry
      ? (record) => {
          options.telemetry?.push(record);
        }
      : undefined,
  });
  return app;
}

function expectPrivacySafeTelemetry(record: CommunityTelemetryRecord) {
  expect(record.data).not.toHaveProperty("body");
  expect(record.data).not.toHaveProperty("email");
  expect(record.data).not.toHaveProperty("senderName");
  expect(record.data).not.toHaveProperty("deletedByName");
  expect(record.data).not.toHaveProperty("userName");
}

let releaseDbTestLock: null | (() => Promise<void>) = null;

beforeAll(async () => {
  const release = await acquireCommunityDbTestLock();
  try {
    await runMigrations();
  } finally {
    await release();
  }
});

beforeEach(async () => {
  releaseDbTestLock = await acquireCommunityDbTestLock();
  await resetCommunityStore();
  await query("TRUNCATE admin_audit_events");
});

afterEach(async () => {
  if (releaseDbTestLock) {
    await releaseDbTestLock();
    releaseDbTestLock = null;
  }

  if (originalNodeEnv === undefined) {
    delete process.env.NODE_ENV;
  } else {
    process.env.NODE_ENV = originalNodeEnv;
  }

  if (originalCommunityDebugResetEnabled === undefined) {
    delete process.env.COMMUNITY_DEBUG_RESET_ENABLED;
  } else {
    process.env.COMMUNITY_DEBUG_RESET_ENABLED = originalCommunityDebugResetEnabled;
  }

  if (originalAppEnv === undefined) {
    delete process.env.APP_ENV;
  } else {
    process.env.APP_ENV = originalAppEnv;
  }

  if (originalCommunityAttachmentScanAllowTestBypass === undefined) {
    delete process.env.COMMUNITY_ATTACHMENT_SCAN_ALLOW_TEST_BYPASS;
  } else {
    process.env.COMMUNITY_ATTACHMENT_SCAN_ALLOW_TEST_BYPASS = originalCommunityAttachmentScanAllowTestBypass;
  }

  if (originalPath === undefined) {
    delete process.env.PATH;
  } else {
    process.env.PATH = originalPath;
  }
});

describe("community routes", () => {
  it("keeps notification IDs safe for URL parameters while preserving short IDs", () => {
    expect(buildCommunityNotificationId("notif_community_reply", "message-1", "member-1"))
      .toBe("notif_community_reply_message-1_member-1");

    const longId = buildCommunityNotificationId("notif_community_reply", "m".repeat(200), "u".repeat(200));
    expect(longId).toHaveLength("notif_community_reply_".length + 32);
    expect(longId).toMatch(/^notif_community_reply_[0-9a-f]{32}$/);
    expect(longId).toBe(buildCommunityNotificationId("notif_community_reply", "m".repeat(200), "u".repeat(200)));
  });

  it("forwards a server-resolved source once without reply metadata", async () => {
    const app = buildApp("forward_contract");
    await app.ready();

    const invalidRequest = await app.inject({
      method: "POST",
      url: "/api/community/groups/health-room/forward",
      headers: { authorization: `Bearer ${adminAccessToken()}` },
      payload: { body: "client forged body" },
    });
    expect(invalidRequest.statusCode).toBe(400);

    const payload = { sourceMessageId: "health-msg-1", clientRequestId: "forward-contract-once" };
    const first = await app.inject({
      method: "POST",
      url: "/api/community/groups/health-room/forward",
      headers: { authorization: `Bearer ${adminAccessToken()}` },
      payload,
    });
    expect(first.statusCode).toBe(200);
    expect(first.json()).toMatchObject({
      isForwarded: true,
      forwardSourceMessageId: "health-msg-1",
    });
    expect(first.json()).not.toHaveProperty("replyToMessageId");
    expect(first.json()).not.toHaveProperty("replyToPreview");

    const replay = await app.inject({
      method: "POST",
      url: "/api/community/groups/health-room/forward",
      headers: { authorization: `Bearer ${adminAccessToken()}` },
      payload,
    });
    expect(replay.statusCode).toBe(200);
    expect(replay.json().id).toBe(first.json().id);

    await app.close();
  });

  it("lists groups and live sessions for the hybrid community shell", async () => {
    const app = buildApp("test");
    await app.ready();

    const response = await app.inject({ method: "GET", url: "/api/community/groups" });
    expect(response.statusCode).toBe(200);

    const body = response.json();
    expect(body.community.name).toBe("مجتمع موطني");
    expect(body.groups.length).toBeGreaterThan(0);
    expect(body.liveSessions).toEqual(expect.arrayContaining([
      expect.objectContaining({ groupId: "recruitment-room", status: "live" }),
    ]));

    await app.close();
  });

  it("resets the local community store back to seeded thread data", async () => {
    process.env.NODE_ENV = "development";
    process.env.COMMUNITY_DEBUG_RESET_ENABLED = "true";

    const app = buildApp("reset_flow");
    await app.ready();

    const initialDetail = await app.inject({ method: "GET", url: "/api/community/groups/health-room" });
    expect(initialDetail.statusCode).toBe(200);
    const initialMessages = initialDetail.json().messages;

    const messageResponse = await app.inject({
      method: "POST",
      url: "/api/community/groups/health-room/messages",
      headers: {
        authorization: `Bearer ${adminAccessToken()}`,
      },
      payload: { body: "رسالة تنظيف تجريبية", senderName: "المختبر" },
    });

    expect(messageResponse.statusCode).toBe(200);
    expect(messageResponse.json()).toMatchObject({
      id: "community_message_reset_flow",
      body: "رسالة تنظيف تجريبية",
    });

    const resetResponse = await app.inject({
      method: "POST",
      url: "/api/community/debug/reset",
      headers: {
        authorization: `Bearer ${superadminAccessToken()}`,
      },
    });
    expect(resetResponse.statusCode).toBe(200);
    expect(resetResponse.json().groups).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: "health-room" }),
    ]));

    const detailResponse = await app.inject({ method: "GET", url: "/api/community/groups/health-room" });
    expect(detailResponse.statusCode).toBe(200);
    expect(detailResponse.json().messages).toEqual(initialMessages);
    expect(detailResponse.json().messages).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ id: "community_message_reset_flow" }),
    ]));

    await app.close();
  });

  it("gates entry, threads, writes, and announcements through backend feature flags", async () => {
    const flags: Record<string, boolean> = {};
    const telemetry: CommunityTelemetryRecord[] = [];
    const app = buildApp("feature_flags", { flags, telemetry });
    await app.ready();

    flags["community.entry.enabled"] = false;
    const listDisabled = await app.inject({ method: "GET", url: "/api/community/groups" });
    expect(listDisabled.statusCode).toBe(403);
    expect(listDisabled.json()).toEqual({ error: "community_feature_disabled", flag: "community.entry.enabled" });

    flags["community.entry.enabled"] = true;
    flags["community.threads.enabled"] = false;
    const detailDisabled = await app.inject({ method: "GET", url: "/api/community/groups/health-room" });
    expect(detailDisabled.statusCode).toBe(403);
    expect(detailDisabled.json()).toEqual({ error: "community_feature_disabled", flag: "community.threads.enabled" });

    flags["community.threads.enabled"] = true;
    flags["community.writes.enabled"] = false;
    const writeDisabled = await app.inject({
      method: "POST",
      url: "/api/community/groups/health-room/messages",
      headers: {
        authorization: `Bearer ${adminAccessToken()}`,
      },
      payload: { body: "هذه الرسالة يجب ألا تُسجل" },
    });
    expect(writeDisabled.statusCode).toBe(403);
    expect(writeDisabled.json()).toEqual({ error: "community_feature_disabled", flag: "community.writes.enabled" });

    flags["community.writes.enabled"] = true;
    flags["community.announcements.enabled"] = false;
    const announcementDisabled = await app.inject({
      method: "POST",
      url: "/api/community/groups/health-room/announcements",
      headers: {
        authorization: `Bearer ${adminAccessToken()}`,
      },
      payload: { body: "إعلان يجب أن يُرفض" },
    });
    expect(announcementDisabled.statusCode).toBe(403);
    expect(announcementDisabled.json()).toEqual({ error: "community_feature_disabled", flag: "community.announcements.enabled" });

    const attachmentPayload = buildMultipartPayload({
      fields: {
        body: "مرفق يجب أن يُرفض",
      },
      file: {
        fieldName: "file",
        filename: "evidence.pdf",
        contentType: "application/pdf",
        content: "PDF TEST CONTENT",
      },
    });
    const attachmentDisabled = await app.inject({
      method: "POST",
      url: "/api/community/groups/health-room/attachments",
      headers: {
        authorization: `Bearer ${adminAccessToken()}`,
        "content-type": attachmentPayload.contentType,
      },
      payload: attachmentPayload.body,
    });
    expect(attachmentDisabled.statusCode).toBe(403);
    expect(attachmentDisabled.json()).toEqual({ error: "community_feature_disabled", flag: "community.attachments.enabled" });

    expect(telemetry.filter((record) => record.event === "community.feature_flag_rejected")).toHaveLength(5);
    telemetry.forEach(expectPrivacySafeTelemetry);

    await app.close();
  });

  it("uploads a scanned attachment, creates a message, and restricts downloads to authorized viewers", async () => {
    process.env.COMMUNITY_ATTACHMENT_SCAN_ALLOW_TEST_BYPASS = "true";

    const app = buildApp("attachment_flow", {
      flags: {
        "community.attachments.enabled": true,
      },
    });
    await app.ready();

    const createResponse = await app.inject({
      method: "POST",
      url: "/api/community/groups",
      headers: {
        authorization: `Bearer ${adminAccessToken()}`,
      },
      payload: {
        name: "مجموعة مرفقات محمية",
        description: "نستخدمها لاختبار مرفقات البوابة",
        category: "support",
        visibility: "private",
        memberIds: ["community-member-1"],
      },
    });
    expect(createResponse.statusCode).toBe(200);
    const group = createResponse.json() as { id: string };

    const uploadPayload = buildMultipartPayload({
      fields: {
        body: "دليل مرفق",
      },
      file: {
        fieldName: "file",
        filename: "guide.pdf",
        contentType: "application/pdf",
        content: createMinimalPdfBuffer(),
      },
    });
    const uploadResponse = await app.inject({
      method: "POST",
      url: `/api/community/groups/${group.id}/attachments`,
      headers: {
        authorization: `Bearer ${adminAccessToken()}`,
        "content-type": uploadPayload.contentType,
      },
      payload: uploadPayload.body,
    });

    expect(uploadResponse.statusCode).toBe(200);
    expect(uploadResponse.json()).toMatchObject({
      ok: true,
      message: {
        id: "community_message_attachment_flow",
        type: "attachment",
        body: "دليل مرفق",
        attachmentUrl: "/api/community/attachments/community_attachment_attachment_flow/content",
      },
      attachment: {
        id: "community_attachment_attachment_flow",
        groupId: group.id,
        messageId: "community_message_attachment_flow",
        originalName: "guide.pdf",
        mimeType: "application/pdf",
        attachmentUrl: "/api/community/attachments/community_attachment_attachment_flow/content",
        scanProvider: "test-bypass",
      },
    });

    const memberDocumentFilter = await app.inject({
      method: "GET",
      url: `/api/community/groups/${group.id}/search?filter=documents`,
      headers: {
        authorization: `Bearer ${memberAccessToken()}`,
      },
    });
    expect(memberDocumentFilter.statusCode).toBe(200);
    expect(memberDocumentFilter.json().messages).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: "community_message_attachment_flow" }),
    ]));

    const outsiderDocumentFilter = await app.inject({
      method: "GET",
      url: `/api/community/groups/${group.id}/search?filter=documents`,
      headers: {
        authorization: `Bearer ${outsiderAccessToken()}`,
      },
    });
    expect(outsiderDocumentFilter.statusCode).toBe(403);

    const emptyAllFilter = await app.inject({
      method: "GET",
      url: `/api/community/groups/${group.id}/search?filter=all`,
      headers: {
        authorization: `Bearer ${memberAccessToken()}`,
      },
    });
    expect(emptyAllFilter.statusCode).toBe(400);
    expect(emptyAllFilter.json()).toEqual({ error: "community_search_query_required" });

    const memberDownload = await app.inject({
      method: "GET",
      url: "/api/community/attachments/community_attachment_attachment_flow/content",
      headers: {
        authorization: `Bearer ${memberAccessToken()}`,
      },
    });
    expect(memberDownload.statusCode).toBe(200);
    expect(memberDownload.headers["content-type"]).toContain("application/pdf");
    expect(memberDownload.body).toBe(createMinimalPdfBuffer().toString("utf8"));

    const outsiderDownload = await app.inject({
      method: "GET",
      url: "/api/community/attachments/community_attachment_attachment_flow/content",
      headers: {
        authorization: `Bearer ${outsiderAccessToken()}`,
      },
    });
    expect(outsiderDownload.statusCode).toBe(403);
    expect(outsiderDownload.json()).toEqual({ error: "community_group_forbidden" });

    const deleted = await app.inject({
      method: "POST",
      url: `/api/community/groups/${group.id}/messages/community_message_attachment_flow/delete-for-everyone`,
      headers: {
        authorization: `Bearer ${adminAccessToken()}`,
      },
      payload: {},
    });
    expect(deleted.statusCode).toBe(200);

    const deletedMemberDownload = await app.inject({
      method: "GET",
      url: "/api/community/attachments/community_attachment_attachment_flow/content",
      headers: {
        authorization: `Bearer ${memberAccessToken()}`,
      },
    });
    expect(deletedMemberDownload.statusCode).toBe(404);
    expect(deletedMemberDownload.json()).toEqual({ error: "community_attachment_not_found" });

    await app.close();
  });

  it("fails closed when attachment scanning is enforced without an available scanner", async () => {
    process.env.PATH = "";

    const app = buildApp("attachment_scan_required", {
      flags: {
        "community.attachments.enabled": true,
      },
    });
    await app.ready();

    const uploadPayload = buildMultipartPayload({
      fields: {
        body: "هذا المرفق يجب أن يتوقف عند الفحص",
      },
      file: {
        fieldName: "file",
        filename: "evidence.pdf",
        contentType: "application/pdf",
        content: createMinimalPdfBuffer(),
      },
    });
    const response = await app.inject({
      method: "POST",
      url: "/api/community/groups/health-room/attachments",
      headers: {
        authorization: `Bearer ${adminAccessToken()}`,
        "content-type": uploadPayload.contentType,
      },
      payload: uploadPayload.body,
    });

    expect(response.statusCode).toBe(503);
    expect(response.json()).toEqual({
      error: "community_attachment_scan_unavailable",
      category: "scanner_unavailable",
    });

    await app.close();
  });

  it("returns extracted duration metadata for exact five-minute voice uploads", async () => {
    process.env.COMMUNITY_ATTACHMENT_SCAN_ALLOW_TEST_BYPASS = "true";

    const app = buildApp("voice_duration_exact", {
      flags: {
        "community.attachments.enabled": true,
      },
    });
    await app.ready();

    const uploadPayload = buildMultipartPayload({
      fields: {
        type: "voice",
      },
      file: {
        fieldName: "file",
        filename: "voice.wav",
        contentType: "audio/wav",
        content: createSilentWavBuffer(300_000),
      },
    });
    const response = await app.inject({
      method: "POST",
      url: "/api/community/groups/health-room/attachments",
      headers: {
        authorization: `Bearer ${adminAccessToken()}`,
        "content-type": uploadPayload.contentType,
      },
      payload: uploadPayload.body,
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      ok: true,
      message: {
        id: "community_message_voice_duration_exact",
        type: "voice",
        attachmentUrl: "/api/community/attachments/community_attachment_voice_duration_exact/content",
      },
      attachment: {
        id: "community_attachment_voice_duration_exact",
        mimeType: "audio/wav",
        durationMs: 300000,
      },
    });

    await app.close();
  });

  it("rejects voice uploads that exceed the five-minute cap", async () => {
    process.env.COMMUNITY_ATTACHMENT_SCAN_ALLOW_TEST_BYPASS = "true";

    const app = buildApp("voice_duration_over_limit", {
      flags: {
        "community.attachments.enabled": true,
      },
    });
    await app.ready();

    const uploadPayload = buildMultipartPayload({
      fields: {
        type: "voice",
      },
      file: {
        fieldName: "file",
        filename: "voice.wav",
        contentType: "audio/wav",
        content: createSilentWavBuffer(301_000),
      },
    });
    const response = await app.inject({
      method: "POST",
      url: "/api/community/groups/health-room/attachments",
      headers: {
        authorization: `Bearer ${adminAccessToken()}`,
        "content-type": uploadPayload.contentType,
      },
      payload: uploadPayload.body,
    });

    expect(response.statusCode).toBe(422);
    expect(response.json()).toEqual({ error: "community_attachment_voice_too_long" });

    await app.close();
  });

  it("rejects declared png uploads when the uploaded bytes are actually pdf content", async () => {
    process.env.COMMUNITY_ATTACHMENT_SCAN_ALLOW_TEST_BYPASS = "true";

    const app = buildApp("attachment_mime_mismatch", {
      flags: {
        "community.attachments.enabled": true,
      },
    });
    await app.ready();

    const uploadPayload = buildMultipartPayload({
      file: {
        fieldName: "file",
        filename: "declared-image.png",
        contentType: "image/png",
        content: createMinimalPdfBuffer(),
      },
    });
    const response = await app.inject({
      method: "POST",
      url: "/api/community/groups/health-room/attachments",
      headers: {
        authorization: `Bearer ${adminAccessToken()}`,
        "content-type": uploadPayload.contentType,
      },
      payload: uploadPayload.body,
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({ error: "community_attachment_type_mismatch" });

    await app.close();
  });

  it("rejects suspicious pdf payloads with trailing bytes after eof", async () => {
    process.env.COMMUNITY_ATTACHMENT_SCAN_ALLOW_TEST_BYPASS = "true";

    const app = buildApp("attachment_pdf_polyglot_guard", {
      flags: {
        "community.attachments.enabled": true,
      },
    });
    await app.ready();

    const uploadPayload = buildMultipartPayload({
      file: {
        fieldName: "file",
        filename: "suspicious.pdf",
        contentType: "application/pdf",
        content: Buffer.concat([createMinimalPdfBuffer(), Buffer.from("<script>alert(1)</script>", "utf8")]),
      },
    });
    const response = await app.inject({
      method: "POST",
      url: "/api/community/groups/health-room/attachments",
      headers: {
        authorization: `Bearer ${adminAccessToken()}`,
        "content-type": uploadPayload.contentType,
      },
      payload: uploadPayload.body,
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({ error: "community_attachment_type_mismatch" });

    await app.close();
  });

  it("accepts exact ten megabyte png uploads through the canonical route", async () => {
    process.env.COMMUNITY_ATTACHMENT_SCAN_ALLOW_TEST_BYPASS = "true";

    const app = buildApp("attachment_exact_max_boundary", {
      flags: {
        "community.attachments.enabled": true,
      },
    });
    await app.ready();

    const png = createMinimalPngBuffer();
    const uploadPayload = buildMultipartPayload({
      file: {
        fieldName: "file",
        filename: "boundary.png",
        contentType: "image/png",
        content: Buffer.concat([png, Buffer.alloc(COMMUNITY_ATTACHMENT_MAX_BYTES - png.length, 0x20)]),
      },
    });
    const response = await app.inject({
      method: "POST",
      url: "/api/community/groups/health-room/attachments",
      headers: {
        authorization: `Bearer ${adminAccessToken()}`,
        "content-type": uploadPayload.contentType,
      },
      payload: uploadPayload.body,
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      ok: true,
      attachment: {
        mimeType: "image/png",
        size: COMMUNITY_ATTACHMENT_MAX_BYTES,
      },
    });

    await app.close();
  });

  it("rejects the test-only scanner bypass when a production indicator is present", async () => {
    process.env.NODE_ENV = "test";
    process.env.APP_ENV = "production";
    process.env.PATH = "";
    process.env.COMMUNITY_ATTACHMENT_SCAN_ALLOW_TEST_BYPASS = "true";

    const telemetry: CommunityTelemetryRecord[] = [];
    const app = buildApp("attachment_scan_bypass_rejected", {
      flags: {
        "community.attachments.enabled": true,
      },
      telemetry,
    });
    await app.ready();

    const uploadPayload = buildMultipartPayload({
      fields: {
        body: "هذا المرفق يجب ألا يتجاوز الفحص الحقيقي",
      },
      file: {
        fieldName: "file",
        filename: "evidence.pdf",
        contentType: "application/pdf",
        content: createMinimalPdfBuffer(),
      },
    });
    const response = await app.inject({
      method: "POST",
      url: "/api/community/groups/health-room/attachments",
      headers: {
        authorization: `Bearer ${adminAccessToken()}`,
        "content-type": uploadPayload.contentType,
      },
      payload: uploadPayload.body,
    });

    expect(response.statusCode).toBe(503);
    expect(response.json()).toEqual({
      error: "community_attachment_scan_unavailable",
      category: "test_bypass_rejected_in_production",
    });

    const rejectedEvent = telemetry.find((record) => record.event === "community.attachment_rejected");
    expect(rejectedEvent?.data).toMatchObject({
      errorCode: "community_attachment_scan_unavailable",
      statusCode: 503,
      scanStatus: "unavailable",
      errorCategory: "test_bypass_rejected_in_production",
      scanProvider: "clamscan",
    });
    telemetry.forEach(expectPrivacySafeTelemetry);

    await app.close();
  });

  it("emits privacy-safe auth and feature-flag telemetry", async () => {
    const flags: Record<string, boolean> = {};
    const telemetry: CommunityTelemetryRecord[] = [];
    const app = buildApp("telemetry", { flags, telemetry });
    await app.ready();

    const anonymousMutation = await app.inject({
      method: "POST",
      url: "/api/community/groups/health-room/messages",
      payload: { body: "نص يجب ألا يظهر في السجل" },
    });
    expect(anonymousMutation.statusCode).toBe(401);

    flags["community.writes.enabled"] = false;
    const disabledMutation = await app.inject({
      method: "POST",
      url: "/api/community/groups/health-room/messages",
      headers: {
        authorization: `Bearer ${adminAccessToken()}`,
      },
      payload: { body: "هذا النص أيضاً يجب ألا يظهر في السجل" },
    });
    expect(disabledMutation.statusCode).toBe(403);

    expect(telemetry.map((record) => record.event)).toEqual(expect.arrayContaining([
      "community.auth_failed",
      "community.feature_flag_rejected",
      "community.restart_persistence_verified",
    ]));
    telemetry.forEach(expectPrivacySafeTelemetry);

    await app.close();
  });

  it("requires explicit enablement and superadmin access for debug reset", async () => {
    process.env.NODE_ENV = "development";
    const telemetry: CommunityTelemetryRecord[] = [];
    const app = buildApp("reset_hardening", { telemetry });
    await app.ready();

    const disabledResponse = await app.inject({
      method: "POST",
      url: "/api/community/debug/reset",
      headers: {
        authorization: `Bearer ${superadminAccessToken()}`,
      },
    });
    expect(disabledResponse.statusCode).toBe(403);
    expect(disabledResponse.json()).toEqual({ error: "community_debug_reset_disabled" });

    process.env.COMMUNITY_DEBUG_RESET_ENABLED = "true";
    const adminDenied = await app.inject({
      method: "POST",
      url: "/api/community/debug/reset",
      headers: {
        authorization: `Bearer ${adminAccessToken()}`,
      },
    });
    expect(adminDenied.statusCode).toBe(403);
    expect(adminDenied.json()).toEqual({ error: "community_group_forbidden" });

    const superadminAllowed = await app.inject({
      method: "POST",
      url: "/api/community/debug/reset",
      headers: {
        authorization: `Bearer ${superadminAccessToken()}`,
      },
    });
    expect(superadminAllowed.statusCode).toBe(200);
    expect(superadminAllowed.json().groups).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: "health-room" }),
    ]));

    expect(telemetry.map((record) => record.event)).toEqual(expect.arrayContaining([
      "community.debug_reset_attempted",
      "community.debug_reset_completed",
      "community.authorization_denied",
    ]));
    telemetry.forEach(expectPrivacySafeTelemetry);

    await app.close();
  });

  it("refuses debug reset when a production indicator is present", async () => {
    process.env.NODE_ENV = "development";
    process.env.APP_ENV = "production";
    process.env.COMMUNITY_DEBUG_RESET_ENABLED = "true";

    const telemetry: CommunityTelemetryRecord[] = [];
    const app = buildApp("reset_production_refusal", { telemetry });
    await app.ready();

    const response = await app.inject({
      method: "POST",
      url: "/api/community/debug/reset",
      headers: {
        authorization: `Bearer ${superadminAccessToken()}`,
      },
    });

    expect(response.statusCode).toBe(403);
    expect(response.json()).toEqual({ error: "community_debug_reset_forbidden_in_production" });
    expect(telemetry.map((record) => record.event)).toEqual(expect.arrayContaining([
      "community.debug_reset_attempted",
      "community.authorization_denied",
    ]));
    telemetry.forEach(expectPrivacySafeTelemetry);

    await app.close();
  });

  it("rejects anonymous community mutations while keeping public reads available", async () => {
    const app = buildApp("auth_required");
    await app.ready();

    const messageResponse = await app.inject({
      method: "POST",
      url: "/api/community/groups/health-room/messages",
      payload: { body: "محاولة بدون تسجيل دخول" },
    });
    expect(messageResponse.statusCode).toBe(401);

    const typingResponse = await app.inject({
      method: "POST",
      url: "/api/community/groups/health-room/typing",
      payload: { isTyping: true },
    });
    expect(typingResponse.statusCode).toBe(401);

    const readResponse = await app.inject({ method: "POST", url: "/api/community/groups/health-room/read" });
    expect(readResponse.statusCode).toBe(401);

    const deleteResponse = await app.inject({
      method: "POST",
      url: "/api/community/groups/health-room/messages/health-msg-1/delete-for-everyone",
    });
    expect(deleteResponse.statusCode).toBe(401);

    const createResponse = await app.inject({
      method: "POST",
      url: "/api/community/groups",
      payload: { name: "مجموعة جديدة", category: "support" },
    });
    expect(createResponse.statusCode).toBe(401);

    const patchResponse = await app.inject({
      method: "PATCH",
      url: "/api/community/groups/health-room",
      payload: { name: "اسم جديد" },
    });
    expect(patchResponse.statusCode).toBe(401);

    const announcementResponse = await app.inject({
      method: "POST",
      url: "/api/community/groups/health-room/announcements",
      payload: { body: "إعلان بدون توثيق" },
    });
    expect(announcementResponse.statusCode).toBe(401);

    const listResponse = await app.inject({ method: "GET", url: "/api/community/groups" });
    expect(listResponse.statusCode).toBe(200);

    await app.close();
  });

  it("creates thread messages and marks the group as read for an authenticated actor", async () => {
    const app = buildApp("new_message");
    await app.ready();

    const token = adminAccessToken();
    const messageResponse = await app.inject({
      method: "POST",
      url: "/api/community/groups/health-room/messages",
      headers: {
        authorization: `Bearer ${token}`,
      },
      payload: { body: "تمت المتابعة معي اليوم.", senderName: "المختبر" },
    });

    expect(messageResponse.statusCode).toBe(200);
    expect(messageResponse.json()).toMatchObject({
      groupId: "health-room",
      body: "تمت المتابعة معي اليوم.",
    });

    const detailResponse = await app.inject({ method: "GET", url: "/api/community/groups/health-room" });
    expect(detailResponse.statusCode).toBe(200);
    expect(detailResponse.json().messages).toEqual(expect.arrayContaining([
      expect.objectContaining({ body: "تمت المتابعة معي اليوم." }),
    ]));

    const readResponse = await app.inject({
      method: "POST",
      url: "/api/community/groups/health-room/read",
      headers: {
        authorization: `Bearer ${token}`,
      },
    });
    expect(readResponse.statusCode).toBe(200);
    expect(readResponse.json()).toMatchObject({
      ok: true,
      unreadCount: 0,
      lastReadMessageId: expect.any(String),
      lastReadAt: expect.any(String),
    });

    await app.close();
  });

  it("accepts an explicit read boundary and rejects a message from another group", async () => {
    const app = buildApp("read_receipt_boundary");
    await app.ready();

    const author = { id: "community-admin-1", role: "admin" as const };
    const message = await addCommunityMessage("health-room", {
      id: "health-read-boundary-msg-1",
      groupId: "health-room",
      senderId: author.id,
      senderName: "المرسل",
      senderRole: "admin",
      type: "text",
      body: "رسالة حد القراءة",
      createdAt: "2026-06-24T06:20:00.000Z",
    }, { viewer: author });
    expect(message.ok).toBe(true);

    const otherGroup = await createCommunityGroup({
      id: "receipt-boundary-other-room",
      communityId: "watany-community",
      name: "غرفة أخرى لإيصال القراءة",
      description: "اختبار عزل إيصال القراءة",
      category: "support",
      memberCount: 1,
      visibility: "public",
    }, author);
    const otherGroupMessage = await addCommunityMessage(otherGroup.id, {
      id: "other-read-boundary-msg-1",
      groupId: otherGroup.id,
      senderId: author.id,
      senderName: "المرسل",
      senderRole: "admin",
      type: "text",
      body: "رسالة مجموعة أخرى",
      createdAt: "2026-06-24T06:21:00.000Z",
    }, { viewer: author });
    expect(otherGroupMessage.ok).toBe(true);

    const token = adminAccessToken();
    const readResponse = await app.inject({
      method: "POST",
      url: "/api/community/groups/health-room/read",
      headers: { authorization: `Bearer ${token}` },
      payload: { messageId: "health-read-boundary-msg-1" },
    });
    expect(readResponse.statusCode).toBe(200);
    expect(readResponse.json()).toMatchObject({ lastReadMessageId: "health-read-boundary-msg-1" });

    const crossThreadRead = await app.inject({
      method: "POST",
      url: "/api/community/groups/health-room/read",
      headers: { authorization: `Bearer ${token}` },
      payload: { messageId: "other-read-boundary-msg-1" },
    });
    expect(crossThreadRead.statusCode).toBe(404);
    expect(crossThreadRead.json()).toEqual({ error: "community_read_message_invalid" });

    await app.close();
  });

  it("returns the additive paged messages contract with opaque cursors and stable read state", async () => {
    const app = buildApp("paged_messages_contract");
    await app.ready();

    const author = { id: "community-admin-1", role: "admin" as const };
    const firstSeed = await addCommunityMessage("health-room", {
      id: "health-contract-msg-3",
      groupId: "health-room",
      senderId: author.id,
      senderName: "هدى",
      senderRole: "admin",
      type: "text",
      body: "رسالة أولى ضمن الصفحة الجديدة.",
      createdAt: "2026-05-12T19:20:00.000Z",
    }, { viewer: author });
    expect(firstSeed.ok).toBe(true);

    const secondSeed = await addCommunityMessage("health-room", {
      id: "health-contract-msg-4",
      groupId: "health-room",
      senderId: author.id,
      senderName: "هدى",
      senderRole: "admin",
      type: "text",
      body: "رسالة ثانية ضمن الصفحة الجديدة.",
      createdAt: "2026-05-12T19:30:00.000Z",
    }, { viewer: author });
    expect(secondSeed.ok).toBe(true);

    const thirdSeed = await addCommunityMessage("health-room", {
      id: "health-contract-msg-5",
      groupId: "health-room",
      senderId: author.id,
      senderName: "هدى",
      senderRole: "admin",
      type: "text",
      body: "رسالة ثالثة ضمن الصفحة الجديدة.",
      createdAt: "2026-05-12T19:40:00.000Z",
    }, { viewer: author });
    expect(thirdSeed.ok).toBe(true);

    const firstPageResponse = await app.inject({
      method: "GET",
      url: "/api/community/groups/health-room/messages?limit=3",
      headers: {
        authorization: `Bearer ${adminAccessToken()}`,
      },
    });
    expect(firstPageResponse.statusCode).toBe(200);

    const firstPage = firstPageResponse.json();
    expect(firstPage.groupId).toBe("health-room");
    expect(firstPage.messages.map((message: { id: string }) => message.id)).toEqual([
      "health-contract-msg-3",
      "health-contract-msg-4",
      "health-contract-msg-5",
    ]);
    expect(firstPage.pageInfo.hasMoreBefore).toBe(true);
    expect(typeof firstPage.pageInfo.startCursor).toBe("string");
    expect(typeof firstPage.pageInfo.endCursor).toBe("string");
    expect(firstPage.readState).toEqual({
      unreadCount: expect.any(Number),
      lastReadMessageId: null,
      lastReadAt: null,
    });

    const secondPageResponse = await app.inject({
      method: "GET",
      url: `/api/community/groups/health-room/messages?limit=3&before=${encodeURIComponent(firstPage.pageInfo.startCursor)}`,
      headers: {
        authorization: `Bearer ${adminAccessToken()}`,
      },
    });
    expect(secondPageResponse.statusCode).toBe(200);

    const secondPage = secondPageResponse.json();
    expect(secondPage.messages.map((message: { id: string }) => message.id)).toEqual([
      "health-msg-1",
      "health-msg-2",
    ]);
    expect(secondPage.pageInfo).toEqual({
      hasMoreBefore: false,
      startCursor: null,
      endCursor: expect.any(String),
    });

    const invalidCursorResponse = await app.inject({
      method: "GET",
      url: "/api/community/groups/health-room/messages?before=not-a-valid-cursor",
      headers: {
        authorization: `Bearer ${adminAccessToken()}`,
      },
    });
    expect(invalidCursorResponse.statusCode).toBe(400);
    expect(invalidCursorResponse.json()).toEqual({ error: "community_invalid_cursor" });

    const anonymousPageResponse = await app.inject({
      method: "GET",
      url: "/api/community/groups/health-room/messages?limit=2",
    });
    expect(anonymousPageResponse.statusCode).toBe(200);
    expect(anonymousPageResponse.json().readState).toEqual({
      unreadCount: 0,
      lastReadMessageId: null,
      lastReadAt: null,
    });

    await app.close();
  });

  it("paginates thread detail and exposes persisted read state", async () => {
    const app = buildApp("paged_detail");
    await app.ready();

    const author = { id: "community-admin-1", role: "admin" as const };
    const firstSeed = await addCommunityMessage("health-room", {
      id: "health-page-msg-3",
      groupId: "health-room",
      senderId: author.id,
      senderName: "ليلى",
      senderRole: "admin",
      type: "text",
      body: "تحديث أول على الحالة.",
      createdAt: "2026-05-12T19:20:00.000Z",
    }, { viewer: author });
    expect(firstSeed.ok).toBe(true);

    const secondSeed = await addCommunityMessage("health-room", {
      id: "health-page-msg-4",
      groupId: "health-room",
      senderId: author.id,
      senderName: "ليلى",
      senderRole: "admin",
      type: "text",
      body: "تحديث ثانٍ على الحالة.",
      createdAt: "2026-05-12T19:30:00.000Z",
    }, { viewer: author });
    expect(secondSeed.ok).toBe(true);

    const thirdSeed = await addCommunityMessage("health-room", {
      id: "health-page-msg-5",
      groupId: "health-room",
      senderId: author.id,
      senderName: "ليلى",
      senderRole: "admin",
      type: "text",
      body: "تحديث ثالث على الحالة.",
      createdAt: "2026-05-12T19:40:00.000Z",
    }, { viewer: author });
    expect(thirdSeed.ok).toBe(true);

    const token = adminAccessToken();
    const firstPageResponse = await app.inject({
      method: "GET",
      url: "/api/community/groups/health-room?limit=3",
      headers: {
        authorization: `Bearer ${token}`,
      },
    });
    expect(firstPageResponse.statusCode).toBe(200);

    const firstPage = firstPageResponse.json();
    expect(firstPage.messages.map((message: { id: string }) => message.id)).toEqual([
      "health-page-msg-3",
      "health-page-msg-4",
      "health-page-msg-5",
    ]);
    expect(firstPage.page).toEqual({
      requestedLimit: 3,
      oldestMessageId: "health-page-msg-3",
      newestMessageId: "health-page-msg-5",
      olderCursor: "health-page-msg-3",
      hasOlder: true,
    });
    expect(firstPage.readState.unreadCount).toBeGreaterThan(0);
    expect(firstPage.readState.lastReadMessageId).toBeUndefined();

    const secondPageResponse = await app.inject({
      method: "GET",
      url: "/api/community/groups/health-room?limit=3&before=health-page-msg-3",
      headers: {
        authorization: `Bearer ${token}`,
      },
    });
    expect(secondPageResponse.statusCode).toBe(200);

    const secondPage = secondPageResponse.json();
    expect(secondPage.messages.map((message: { id: string }) => message.id)).toEqual([
      "health-msg-1",
      "health-msg-2",
    ]);
    expect(secondPage.page).toEqual({
      requestedLimit: 3,
      oldestMessageId: "health-msg-1",
      newestMessageId: "health-msg-2",
      olderCursor: undefined,
      hasOlder: false,
    });

    const readResponse = await app.inject({
      method: "POST",
      url: "/api/community/groups/health-room/read",
      headers: {
        authorization: `Bearer ${token}`,
      },
    });
    expect(readResponse.statusCode).toBe(200);
    expect(readResponse.json()).toMatchObject({
      ok: true,
      unreadCount: 0,
      lastReadMessageId: "health-page-msg-5",
      lastReadAt: expect.any(String),
    });

    const afterReadResponse = await app.inject({
      method: "GET",
      url: "/api/community/groups/health-room?limit=3",
      headers: {
        authorization: `Bearer ${token}`,
      },
    });
    expect(afterReadResponse.statusCode).toBe(200);
    expect(afterReadResponse.json().readState).toEqual({
      unreadCount: 0,
      lastReadMessageId: "health-page-msg-5",
      lastReadAt: expect.any(String),
    });

    await app.close();
  });

  it("uses the authenticated actor identity instead of request-body sender fields", async () => {
    const app = buildApp("actor_identity");
    await app.ready();

    const messageResponse = await app.inject({
      method: "POST",
      url: "/api/community/groups/health-room/messages",
      headers: {
        authorization: `Bearer ${adminAccessToken()}`,
      },
      payload: {
        body: "رسالة يجب أن تحمل هوية الممثل الموثق.",
        senderId: "spoofed-user-id",
        senderName: "اسم مزور",
      },
    });

    expect(messageResponse.statusCode).toBe(200);
    expect(messageResponse.json()).toMatchObject({
      senderId: "community-admin-1",
      senderName: "community.admin",
    });
    expect(messageResponse.json().senderId).not.toBe("spoofed-user-id");
    expect(messageResponse.json().senderName).not.toBe("اسم مزور");

    await app.close();
  });

  it("supports reply previews, typing state, and delete-for-everyone in a live thread", async () => {
    const app = buildApp("reply_flow");
    await app.ready();

    const token = adminAccessToken();

    const messageResponse = await app.inject({
      method: "POST",
      url: "/api/community/groups/health-room/messages",
      headers: {
        authorization: `Bearer ${token}`,
      },
      payload: {
        body: "هيدا رد متابعة على الرسالة السابقة.",
        replyToMessageId: "health-msg-1",
        replyToPreview: {
          id: "health-msg-spoofed",
          senderName: "اسم مزور",
          body: "نص مزور لا يجب قبوله",
        },
      },
    });

    expect(messageResponse.statusCode).toBe(200);
    expect(messageResponse.json()).toMatchObject({
      body: "هيدا رد متابعة على الرسالة السابقة.",
      replyToMessageId: "health-msg-1",
      replyToPreview: {
        id: "health-msg-1",
        senderName: "مايا",
        body: "مين عنده تجربة حديثة مع تحويل المستشفى العسكري على بيروت؟",
      },
    });

    const typingResponse = await app.inject({
      method: "POST",
      url: "/api/community/groups/health-room/typing",
      headers: {
        authorization: `Bearer ${token}`,
      },
      payload: { userName: "المختبر", isTyping: true },
    });

    expect(typingResponse.statusCode).toBe(200);
    expect(typingResponse.json()).toEqual({ ok: true, typingUsers: ["community.admin"] });

    const deleteResponse = await app.inject({
      method: "POST",
      url: "/api/community/groups/health-room/messages/community_message_reply_flow/delete-for-everyone",
      headers: {
        authorization: `Bearer ${token}`,
      },
      payload: { deletedByName: "المختبر" },
    });

    expect(deleteResponse.statusCode).toBe(200);
    expect(deleteResponse.json()).toMatchObject({
      message: {
        id: "community_message_reply_flow",
        deletedForEveryoneBy: "community.admin",
      },
      group: {
        id: "health-room",
        lastMessagePreview: "تم حذف هذه الرسالة للجميع",
      },
    });
    expect(deleteResponse.json().message.deletedForEveryoneAt).toEqual(expect.any(String));

    const detailResponse = await app.inject({ method: "GET", url: "/api/community/groups/health-room" });
    expect(detailResponse.statusCode).toBe(200);
    expect(detailResponse.json().messages).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: "community_message_reply_flow",
        deletedForEveryoneBy: "community.admin",
        replyToPreview: expect.objectContaining({ id: "health-msg-1" }),
      }),
    ]));

    await app.close();
  });

  it("derives safe reply previews for voice-note targets and rejects cross-group reply targets", async () => {
    const app = buildApp("reply_target_validation");
    await app.ready();

    const voiceSeed = await addCommunityMessage("health-room", {
      id: "health-msg-voice-target",
      groupId: "health-room",
      senderId: "community-member-1",
      senderName: "community.member",
      senderRole: "user",
      type: "voice",
      body: "",
      attachmentUrl: "/api/community/attachments/voice-target/content",
      createdAt: "2026-05-12T19:12:00.000Z",
    }, {
      viewer: {
        id: "community-admin-1",
        role: "admin",
      },
    });
    expect(voiceSeed.ok).toBe(true);

    const voiceReplyResponse = await app.inject({
      method: "POST",
      url: "/api/community/groups/health-room/messages",
      headers: {
        authorization: `Bearer ${adminAccessToken()}`,
      },
      payload: {
        body: "رد على الرسالة الصوتية.",
        replyToMessageId: "health-msg-voice-target",
        replyToPreview: {
          id: "spoofed-voice-id",
          senderName: "اسم مزور",
          body: "محتوى مزور",
        },
      },
    });

    expect(voiceReplyResponse.statusCode).toBe(200);
    expect(voiceReplyResponse.json()).toMatchObject({
      replyToMessageId: "health-msg-voice-target",
      replyToPreview: {
        id: "health-msg-voice-target",
        senderName: "community.member",
        body: "رسالة صوتية محمية",
      },
    });

    const crossGroupReplyResponse = await app.inject({
      method: "POST",
      url: "/api/community/groups/health-room/messages",
      headers: {
        authorization: `Bearer ${adminAccessToken()}`,
      },
      payload: {
        body: "هذا الرد يجب رفضه لأن الهدف في مجموعة أخرى.",
        replyToMessageId: "salary-msg-1",
      },
    });

    expect(crossGroupReplyResponse.statusCode).toBe(404);
    expect(crossGroupReplyResponse.json()).toEqual({ error: "community_message_not_found" });

    await app.close();
  });

  it("creates user-scoped reply notifications with deep-link metadata", async () => {
    const app = buildApp("reply_notification");
    const pluginDb = await initPluginDb(":memory:", true, {
      info: () => undefined,
      warn: () => undefined,
    });
    app.decorate("pluginDb", pluginDb);
    app.register(notificationRoutes, { pluginDb });
    await app.ready();

    const seededMessage = await addCommunityMessage("health-room", {
      id: "health-msg-member-reply-target",
      groupId: "health-room",
      senderId: "community-member-1",
      senderName: "community.member",
      senderRole: "user",
      type: "text",
      body: "هذه رسالة أصلية من العضو لاختبار الردود.",
      createdAt: "2026-05-12T19:15:00.000Z",
    }, {
      viewer: {
        id: "community-admin-1",
        role: "admin",
      },
    });
    expect(seededMessage.ok).toBe(true);

    const replyResponse = await app.inject({
      method: "POST",
      url: "/api/community/groups/health-room/messages",
      headers: {
        authorization: `Bearer ${adminAccessToken()}`,
      },
      payload: {
        body: "هذا رد إداري يجب أن يولّد إشعاراً موجهاً.",
        replyToMessageId: "health-msg-member-reply-target",
        replyToPreview: {
          id: "health-msg-member-reply-target",
          senderName: "community.member",
          body: "هذه رسالة أصلية من العضو لاختبار الردود.",
        },
      },
    });

    expect(replyResponse.statusCode).toBe(200);
    expect(replyResponse.json()).toMatchObject({
      id: "community_message_reply_notification",
      replyToMessageId: "health-msg-member-reply-target",
    });

    const memberNotifications = await app.inject({
      method: "GET",
      url: "/api/notifications",
      headers: {
        authorization: `Bearer ${memberAccessToken()}`,
      },
    });
    expect(memberNotifications.statusCode).toBe(200);
    expect(memberNotifications.json().items).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: "notif_community_reply_community_message_reply_notification_community-member-1",
        title: "رد جديد في الطبابة والتحويلات",
        read: false,
        refType: "route",
        refId: "/groups/health-room?messageId=community_message_reply_notification",
        userId: "community-member-1",
      }),
    ]));

    const outsiderNotifications = await app.inject({
      method: "GET",
      url: "/api/notifications",
      headers: {
        authorization: `Bearer ${outsiderAccessToken()}`,
      },
    });
    expect(outsiderNotifications.statusCode).toBe(200);
    expect(outsiderNotifications.json().items).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ id: "notif_community_reply_community_message_reply_notification_community-member-1" }),
    ]));

    const markReadResponse = await app.inject({
      method: "PATCH",
      url: "/api/notifications/notif_community_reply_community_message_reply_notification_community-member-1",
      headers: {
        authorization: `Bearer ${memberAccessToken()}`,
      },
      payload: { read: true },
    });
    expect(markReadResponse.statusCode).toBe(200);
    expect(markReadResponse.json()).toMatchObject({
      id: "notif_community_reply_community_message_reply_notification_community-member-1",
      read: true,
    });

    const outsiderMarkReadResponse = await app.inject({
      method: "PATCH",
      url: "/api/notifications/notif_community_reply_community_message_reply_notification_community-member-1",
      headers: {
        authorization: `Bearer ${outsiderAccessToken()}`,
      },
      payload: { read: true },
    });
    expect(outsiderMarkReadResponse.statusCode).toBe(404);

    await app.close();
  });

  it("manages notification preferences, room mutes, and push devices through the singular authority", async () => {
    const app = buildApp("notification_settings");
    const pluginDb = await initPluginDb(":memory:", true, {
      info: () => undefined,
      warn: () => undefined,
    });
    app.decorate("pluginDb", pluginDb);
    app.register(notificationRoutes, { pluginDb });
    await app.ready();

    const defaultResponse = await app.inject({
      method: "GET",
      url: "/api/notifications/preferences",
      headers: {
        authorization: `Bearer ${memberAccessToken()}`,
      },
    });
    expect(defaultResponse.statusCode).toBe(200);
    expect(defaultResponse.json()).toMatchObject({
      preference: {
        userId: "community-member-1",
        previewMode: "safe",
        pushEnabled: false,
        quietHours: {
          enabled: false,
          start: "22:00",
          end: "07:00",
          timezone: "Asia/Beirut",
        },
      },
      roomMutes: [],
      devices: [],
    });

    const updatedPreferences = await app.inject({
      method: "PATCH",
      url: "/api/notifications/preferences",
      headers: {
        authorization: `Bearer ${memberAccessToken()}`,
      },
      payload: {
        previewMode: "rich",
        pushEnabled: true,
        quietHoursEnabled: true,
      },
    });
    expect(updatedPreferences.statusCode).toBe(200);
    expect(updatedPreferences.json()).toMatchObject({
      preference: {
        previewMode: "rich",
        pushEnabled: true,
        quietHours: {
          enabled: true,
        },
      },
    });

    const publicKeyResponse = await app.inject({
      method: "GET",
      url: "/api/notifications/push/public-key",
      headers: {
        authorization: `Bearer ${memberAccessToken()}`,
      },
    });
    expect(publicKeyResponse.statusCode).toBe(200);
    expect(publicKeyResponse.json()).toMatchObject({
      provider: "webpush",
      configured: true,
      publicKey: expect.any(String),
    });

    const deviceResponse = await app.inject({
      method: "POST",
      url: "/api/notifications/push/subscriptions",
      headers: {
        authorization: `Bearer ${memberAccessToken()}`,
      },
      payload: {
        label: "متصفح الاختبار",
        subscription: {
          endpoint: "https://push.example.test/subscriptions/member-browser",
          expirationTime: null,
          keys: {
            p256dh: "test-p256dh-key",
            auth: "test-auth-key",
          },
        },
      },
    });
    expect(deviceResponse.statusCode).toBe(200);
    const registeredDevice = deviceResponse.json().devices.find((device: { endpoint: string }) => device.endpoint === "https://push.example.test/subscriptions/member-browser");
    expect(registeredDevice).toMatchObject({
      provider: "webpush",
      label: "متصفح الاختبار",
      lastDeliveryStatus: "idle",
      retryCount: 0,
    });

    const muteResponse = await app.inject({
      method: "POST",
      url: "/api/notifications/rooms/health-room/mute",
      headers: {
        authorization: `Bearer ${memberAccessToken()}`,
      },
      payload: {
        duration: "indefinite",
      },
    });
    expect(muteResponse.statusCode).toBe(200);
    expect(muteResponse.json().roomMutes).toEqual(expect.arrayContaining([
      expect.objectContaining({
        roomId: "health-room",
        isIndefinite: true,
      }),
    ]));

    const unmuteResponse = await app.inject({
      method: "DELETE",
      url: "/api/notifications/rooms/health-room/mute",
      headers: {
        authorization: `Bearer ${memberAccessToken()}`,
      },
    });
    expect(unmuteResponse.statusCode).toBe(200);
    expect(unmuteResponse.json().roomMutes).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ roomId: "health-room" }),
    ]));

    const removeDeviceResponse = await app.inject({
      method: "DELETE",
      url: `/api/notifications/push/subscriptions/${registeredDevice.id}`,
      headers: {
        authorization: `Bearer ${memberAccessToken()}`,
      },
    });
    expect(removeDeviceResponse.statusCode).toBe(200);
    expect(removeDeviceResponse.json().devices).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ endpoint: "https://push.example.test/subscriptions/member-browser" }),
    ]));

    await app.close();
  });

  it("revalidates route notifications against explicitly removed memberships", async () => {
    const app = buildApp("notification_access_revalidation");
    const pluginDb = await initPluginDb(":memory:", true, {
      info: () => undefined,
      warn: () => undefined,
    });
    app.decorate("pluginDb", pluginDb);
    app.register(notificationRoutes, { pluginDb });
    await app.ready();

    pluginDb.prepare(
      "INSERT INTO notifications (id, title, body, kind, ts, read, user_id, ref_type, ref_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
    ).run(
      "notif_removed_membership",
      "تنبيه يجب حجبه",
      "هذا التنبيه لا يجب أن يظهر بعد إزالة العضوية.",
      "system",
      Date.now(),
      0,
      "community-member-1",
      "route",
      "/groups/health-room?messageId=community_message_hidden_after_removal",
    );
    await query(
      `INSERT INTO community_group_members (group_id, user_id, role, status, joined_at, added_by)
        VALUES ($1, $2, 'member', 'removed', now(), $3)
        ON CONFLICT (group_id, user_id)
        DO UPDATE SET status = 'removed'`,
      ["health-room", "community-member-1", "community-admin-1"],
    );

    const response = await app.inject({
      method: "GET",
      url: "/api/notifications",
      headers: {
        authorization: `Bearer ${memberAccessToken()}`,
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().items).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ id: "notif_removed_membership" }),
    ]));

    await app.close();
  });

  it("resolves mentions, creates mention notifications, and supports the dedicated in-thread search route", async () => {
    const app = buildApp("mention_search");
    const pluginDb = await initPluginDb(":memory:", true, {
      info: () => undefined,
      warn: () => undefined,
    });
    app.decorate("pluginDb", pluginDb);
    app.register(notificationRoutes, { pluginDb });
    await app.ready();

    const mentionGroupResponse = await app.inject({
      method: "POST",
      url: "/api/community/groups",
      headers: {
        authorization: `Bearer ${adminAccessToken()}`,
      },
      payload: {
        name: "مجموعة الإشارات",
        category: "support",
        memberIds: ["community-member-1"],
      },
    });
    expect(mentionGroupResponse.statusCode).toBe(200);
    const mentionGroupId = mentionGroupResponse.json().id as string;

    const mentionResponse = await app.inject({
      method: "POST",
      url: `/api/community/groups/${encodeURIComponent(mentionGroupId)}/messages`,
      headers: {
        authorization: `Bearer ${adminAccessToken()}`,
      },
      payload: {
        body: "مرحباً @community-member-1 نحتاج إلى مراجعة هذا الطلب اليوم.",
      },
    });

    expect(mentionResponse.statusCode).toBe(200);
    expect(mentionResponse.json()).toMatchObject({
      id: "community_message_mention_search",
      mentions: [
        {
          userId: "community-member-1",
          displayName: "community-member-1",
          token: "@community-member-1",
        },
      ],
    });

    const nonMatchingMessage = await addCommunityMessage(mentionGroupId, {
      id: "community-message-mention-search-non-match",
      groupId: mentionGroupId,
      senderId: "community-admin-1",
      senderName: "community.admin",
      senderRole: "admin",
      type: "text",
      body: "رسالة أخرى لا يجب أن تظهر ضمن نتائج البحث الموجهة.",
      createdAt: "2026-05-12T19:25:00.000Z",
    }, {
      viewer: {
        id: "community-admin-1",
        role: "admin",
      },
    });
    expect(nonMatchingMessage.ok).toBe(true);

    const memberNotifications = await app.inject({
      method: "GET",
      url: "/api/notifications",
      headers: {
        authorization: `Bearer ${memberAccessToken()}`,
      },
    });
    expect(memberNotifications.statusCode).toBe(200);
    expect(memberNotifications.json().items).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: "notif_community_mention_community_message_mention_search_community-member-1",
        title: "ذُكرت في مجموعة الإشارات",
        refType: "route",
        refId: `/groups/${encodeURIComponent(mentionGroupId)}?messageId=community_message_mention_search`,
        userId: "community-member-1",
      }),
    ]));

    const searchResponse = await app.inject({
      method: "GET",
      url: `/api/community/groups/${encodeURIComponent(mentionGroupId)}/search?q=%D9%85%D8%B1%D8%A7%D8%AC%D8%B9%D8%A9`,
      headers: {
        authorization: `Bearer ${adminAccessToken()}`,
      },
    });
    expect(searchResponse.statusCode).toBe(200);
    expect(searchResponse.json().messages).toEqual([
      expect.objectContaining({
        id: "community_message_mention_search",
      }),
    ]);

    const missingQueryResponse = await app.inject({
      method: "GET",
      url: `/api/community/groups/${encodeURIComponent(mentionGroupId)}/search`,
      headers: {
        authorization: `Bearer ${adminAccessToken()}`,
      },
    });
    expect(missingQueryResponse.statusCode).toBe(400);
    expect(missingQueryResponse.json()).toEqual({
      error: "community_search_query_required",
    });

    await app.close();
  });

  it("toggles reactions, hides delete-for-self messages per viewer, and enforces the edit window", async () => {
    const app = buildApp("advanced_message_controls");
    await app.ready();

    const created = await app.inject({
      method: "POST",
      url: "/api/community/groups/health-room/messages",
      headers: {
        authorization: `Bearer ${adminAccessToken()}`,
      },
      payload: {
        body: "رسالة قابلة للتفاعل والحذف لدي.",
      },
    });
    expect(created.statusCode).toBe(200);

    const reactionResponse = await app.inject({
      method: "POST",
      url: "/api/community/groups/health-room/messages/community_message_advanced_message_controls/reactions",
      headers: {
        authorization: `Bearer ${memberAccessToken()}`,
      },
      payload: {
        emoji: "👍",
      },
    });
    expect(reactionResponse.statusCode).toBe(200);
    expect(reactionResponse.json()).toMatchObject({
      message: {
        id: "community_message_advanced_message_controls",
        reactions: [
          {
            emoji: "👍",
            count: 1,
            reactedByMe: true,
          },
        ],
      },
    });

    const adminPage = await app.inject({
      method: "GET",
      url: "/api/community/groups/health-room/messages",
      headers: {
        authorization: `Bearer ${adminAccessToken()}`,
      },
    });
    expect(adminPage.statusCode).toBe(200);
    expect(adminPage.json().messages).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: "community_message_advanced_message_controls",
        reactions: [
          {
            emoji: "👍",
            count: 1,
          },
        ],
      }),
    ]));

    const deleteForSelfResponse = await app.inject({
      method: "POST",
      url: "/api/community/groups/health-room/messages/community_message_advanced_message_controls/delete-for-self",
      headers: {
        authorization: `Bearer ${memberAccessToken()}`,
      },
    });
    expect(deleteForSelfResponse.statusCode).toBe(200);
    expect(deleteForSelfResponse.json()).toMatchObject({
      messageId: "community_message_advanced_message_controls",
      deletedForMeAt: expect.any(String),
      group: {
        id: "health-room",
      },
    });

    const memberPageAfterDelete = await app.inject({
      method: "GET",
      url: "/api/community/groups/health-room/messages",
      headers: {
        authorization: `Bearer ${memberAccessToken()}`,
      },
    });
    expect(memberPageAfterDelete.statusCode).toBe(200);
    expect(memberPageAfterDelete.json().messages).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ id: "community_message_advanced_message_controls" }),
    ]));

    const memberSearchAfterDelete = await app.inject({
      method: "GET",
      url: "/api/community/groups/health-room/search?q=%D9%82%D8%A7%D8%A8%D9%84%D8%A9",
      headers: {
        authorization: `Bearer ${memberAccessToken()}`,
      },
    });
    expect(memberSearchAfterDelete.statusCode).toBe(200);
    expect(memberSearchAfterDelete.json().messages).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ id: "community_message_advanced_message_controls" }),
    ]));

    const adminSearchAfterMemberHide = await app.inject({
      method: "GET",
      url: "/api/community/groups/health-room/search?q=%D9%82%D8%A7%D8%A8%D9%84%D8%A9",
      headers: {
        authorization: `Bearer ${adminAccessToken()}`,
      },
    });
    expect(adminSearchAfterMemberHide.statusCode).toBe(200);
    expect(adminSearchAfterMemberHide.json().messages).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: "community_message_advanced_message_controls" }),
    ]));

    const deletedForEveryoneMessage = await addCommunityMessage("health-room", {
      id: "community-message-search-delete-everyone",
      groupId: "health-room",
      senderId: "community-admin-1",
      senderName: "community.admin",
      senderRole: "admin",
      type: "text",
      body: "رسالة مخصصة لاختبار استبعاد المحذوف للجميع من البحث.",
      createdAt: "2026-06-24T19:20:00.000Z",
    }, {
      viewer: {
        id: "community-admin-1",
        role: "admin",
      },
    });
    expect(deletedForEveryoneMessage.ok).toBe(true);
    const deletedForEveryoneMessageId = "community-message-search-delete-everyone";

    const deleteForEveryoneResponse = await app.inject({
      method: "POST",
      url: `/api/community/groups/health-room/messages/${encodeURIComponent(deletedForEveryoneMessageId)}/delete-for-everyone`,
      headers: {
        authorization: `Bearer ${adminAccessToken()}`,
      },
      payload: { deletedByName: "community.admin" },
    });
    expect(deleteForEveryoneResponse.statusCode).toBe(200);

    const adminSearchAfterDeleteForEveryone = await app.inject({
      method: "GET",
      url: "/api/community/groups/health-room/search?q=%D8%A7%D8%B3%D8%AA%D8%A8%D8%B9%D8%A7%D8%AF",
      headers: {
        authorization: `Bearer ${adminAccessToken()}`,
      },
    });
    expect(adminSearchAfterDeleteForEveryone.statusCode).toBe(200);
    expect(adminSearchAfterDeleteForEveryone.json().messages).toEqual([]);

    const memberGroupResponse = await app.inject({
      method: "POST",
      url: "/api/community/groups",
      headers: {
        authorization: `Bearer ${adminAccessToken()}`,
      },
      payload: {
        name: "مساحة تعديل الأعضاء",
        category: "support",
        memberIds: ["community-member-1"],
      },
    });
    expect(memberGroupResponse.statusCode).toBe(200);
    const memberGroupId = memberGroupResponse.json().id as string;

    const oldMessage = await addCommunityMessage(memberGroupId, {
      id: "health-msg-edit-expired",
      groupId: memberGroupId,
      senderId: "community-member-1",
      senderName: "community.member",
      senderRole: "user",
      type: "text",
      body: "رسالة قديمة يجب أن ترفض التعديل بعد انتهاء المهلة.",
      createdAt: "2025-05-12T19:15:00.000Z",
    }, {
      viewer: {
        id: "community-member-1",
        role: "accredited",
      },
    });
    expect(oldMessage.ok).toBe(true);

    const editExpiredResponse = await app.inject({
      method: "PATCH",
      url: `/api/community/groups/${encodeURIComponent(memberGroupId)}/messages/health-msg-edit-expired`,
      headers: {
        authorization: `Bearer ${memberAccessToken()}`,
      },
      payload: {
        body: "محاولة تعديل بعد انقضاء المهلة.",
      },
    });
    expect(editExpiredResponse.statusCode).toBe(409);
    expect(editExpiredResponse.json()).toEqual({ error: "community_message_edit_window_expired" });

    await app.close();
  });

  it("pins and unpins moderated messages idempotently while keeping a single active pin", async () => {
    const app = buildApp("pin_controls");
    await app.ready();

    const createGroupResponse = await app.inject({
      method: "POST",
      url: "/api/community/groups",
      headers: {
        authorization: `Bearer ${adminAccessToken()}`,
      },
      payload: {
        name: "مساحة التثبيت",
        description: "مجموعة لاختبار تثبيت الرسائل",
        category: "support",
        visibility: "private",
        memberIds: ["community-member-1"],
      },
    });
    expect(createGroupResponse.statusCode).toBe(200);
    const groupId = (createGroupResponse.json() as { id: string }).id;

    const firstMessage = await addCommunityMessage(groupId, {
      id: "community-pin-message-1",
      groupId,
      senderId: "community-admin-1",
      senderName: "community.admin",
      senderRole: "admin",
      type: "text",
      body: "الرسالة الأولى المرشحة للتثبيت.",
      createdAt: "2026-06-24T16:40:00.000Z",
    }, {
      viewer: {
        id: "community-admin-1",
        role: "admin",
      },
    });
    expect(firstMessage.ok).toBe(true);

    const secondMessage = await addCommunityMessage(groupId, {
      id: "community-pin-message-2",
      groupId,
      senderId: "community-admin-1",
      senderName: "community.admin",
      senderRole: "admin",
      type: "text",
      body: "الرسالة الثانية المرشحة للتثبيت.",
      createdAt: "2026-06-24T16:41:00.000Z",
    }, {
      viewer: {
        id: "community-admin-1",
        role: "admin",
      },
    });
    expect(secondMessage.ok).toBe(true);

    const memberPinAttempt = await app.inject({
      method: "POST",
      url: `/api/community/groups/${encodeURIComponent(groupId)}/messages/community-pin-message-1/pin`,
      headers: {
        authorization: `Bearer ${memberAccessToken()}`,
      },
    });
    expect(memberPinAttempt.statusCode).toBe(403);
    expect(memberPinAttempt.json()).toEqual({ error: "community_group_forbidden" });

    const firstPinResponse = await app.inject({
      method: "POST",
      url: `/api/community/groups/${encodeURIComponent(groupId)}/messages/community-pin-message-1/pin`,
      headers: {
        authorization: `Bearer ${adminAccessToken()}`,
      },
    });
    expect(firstPinResponse.statusCode).toBe(200);
    expect(firstPinResponse.json()).toMatchObject({
      message: {
        id: "community-pin-message-1",
        isPinned: true,
      },
      group: {
        id: groupId,
        pinnedMessageId: "community-pin-message-1",
      },
    });

    const repeatedFirstPinResponse = await app.inject({
      method: "POST",
      url: `/api/community/groups/${encodeURIComponent(groupId)}/messages/community-pin-message-1/pin`,
      headers: {
        authorization: `Bearer ${adminAccessToken()}`,
      },
    });
    expect(repeatedFirstPinResponse.statusCode).toBe(200);
    expect(repeatedFirstPinResponse.json()).toMatchObject({
      message: {
        id: "community-pin-message-1",
        isPinned: true,
      },
      group: {
        id: groupId,
        pinnedMessageId: "community-pin-message-1",
      },
    });

    const secondPinResponse = await app.inject({
      method: "POST",
      url: `/api/community/groups/${encodeURIComponent(groupId)}/messages/community-pin-message-2/pin`,
      headers: {
        authorization: `Bearer ${adminAccessToken()}`,
      },
    });
    expect(secondPinResponse.statusCode).toBe(200);
    expect(secondPinResponse.json()).toMatchObject({
      message: {
        id: "community-pin-message-2",
        isPinned: true,
      },
      group: {
        id: groupId,
        pinnedMessageId: "community-pin-message-2",
      },
    });

    const detailAfterSecondPin = await app.inject({
      method: "GET",
      url: `/api/community/groups/${encodeURIComponent(groupId)}`,
      headers: {
        authorization: `Bearer ${adminAccessToken()}`,
      },
    });
    expect(detailAfterSecondPin.statusCode).toBe(200);
    expect(detailAfterSecondPin.json()).toMatchObject({
      group: {
        id: groupId,
        pinnedMessageId: "community-pin-message-2",
      },
      messages: expect.arrayContaining([
        expect.objectContaining({ id: "community-pin-message-1", isPinned: false }),
        expect.objectContaining({ id: "community-pin-message-2", isPinned: true }),
      ]),
    });

    const unpinResponse = await app.inject({
      method: "POST",
      url: `/api/community/groups/${encodeURIComponent(groupId)}/messages/community-pin-message-2/unpin`,
      headers: {
        authorization: `Bearer ${adminAccessToken()}`,
      },
    });
    expect(unpinResponse.statusCode).toBe(200);
    expect(unpinResponse.json().message).toMatchObject({
      id: "community-pin-message-2",
      isPinned: false,
    });
    expect(unpinResponse.json().group).not.toHaveProperty("pinnedMessageId");

    const repeatedUnpinResponse = await app.inject({
      method: "POST",
      url: `/api/community/groups/${encodeURIComponent(groupId)}/messages/community-pin-message-2/unpin`,
      headers: {
        authorization: `Bearer ${adminAccessToken()}`,
      },
    });
    expect(repeatedUnpinResponse.statusCode).toBe(200);
    expect(repeatedUnpinResponse.json().group).not.toHaveProperty("pinnedMessageId");

    const detailAfterUnpin = await app.inject({
      method: "GET",
      url: `/api/community/groups/${encodeURIComponent(groupId)}`,
      headers: {
        authorization: `Bearer ${adminAccessToken()}`,
      },
    });
    expect(detailAfterUnpin.statusCode).toBe(200);
    expect(detailAfterUnpin.json().group).not.toHaveProperty("pinnedMessageId");
    expect(detailAfterUnpin.json().messages).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: "community-pin-message-1", isPinned: false }),
      expect.objectContaining({ id: "community-pin-message-2", isPinned: false }),
    ]));

    const auditRows = await query<{ event_type: string }>(
      `SELECT event_type
         FROM admin_audit_events
        WHERE entity_type = 'community_message'
          AND entity_id LIKE $1
          AND event_type = ANY($2::text[])
        ORDER BY created_at ASC, id ASC`,
      [
        `${groupId}:community-pin-message-%`,
        ["community.message_pinned", "community.message_unpinned"],
      ],
    );
    expect(auditRows.rows.map((row) => row.event_type)).toEqual([
      "community.message_pinned",
      "community.message_pinned",
      "community.message_unpinned",
    ]);

    await app.close();
  });
});