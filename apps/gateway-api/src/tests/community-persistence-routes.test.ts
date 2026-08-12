import Fastify from "fastify";
import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { registerAuthHook, signAccessToken } from "../auth/auth-middleware";
import { resetCommunityStore } from "../community/service";
import { runMigrations } from "../db/migrate";
import { query } from "../lib/db";
import { communityRoutes } from "../routes/community";
import { acquireCommunityDbTestLock } from "./community-db-test-lock";

process.env.JWT_SECRET ||= "test-jwt-secret-for-community-routes-0123456789";

function accessToken(user: { sub: string; role: "accredited" | "moderator" | "admin" | "superadmin"; email: string }) {
  return signAccessToken({
    sub: user.sub,
    role: user.role,
    email: user.email,
  });
}

function buildApp(makeIdSuffix: string) {
  const app = Fastify({ logger: false });
  registerAuthHook(app);
  app.register(communityRoutes, { makeId: (prefix) => `${prefix}_${makeIdSuffix}` });
  return app;
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
});

describe("community persistence and authorization", () => {
  afterEach(async () => {
    if (releaseDbTestLock) {
      await releaseDbTestLock();
      releaseDbTestLock = null;
    }
  });

  it("supports private join requests, admin approval, member listing, and leave flow", async () => {
    const app = buildApp("membership_flow");
    await app.ready();

    const adminToken = accessToken({
      sub: "community-admin-1",
      role: "admin",
      email: "community.admin@watany.test",
    });
    const requesterToken = accessToken({
      sub: "community-member-join-1",
      role: "accredited",
      email: "joiner.one@watany.test",
    });

    const createResponse = await app.inject({
      method: "POST",
      url: "/api/community/groups",
      headers: {
        authorization: `Bearer ${adminToken}`,
      },
      payload: {
        name: "مجموعة طلبات الانضمام",
        description: "مجموعة خاصة لاختبار دورة العضوية",
        category: "support",
        visibility: "private",
      },
    });
    expect(createResponse.statusCode).toBe(200);
    const group = createResponse.json() as { id: string; visibility: string };
    expect(group.visibility).toBe("private");

    const requestResponse = await app.inject({
      method: "POST",
      url: `/api/community/groups/${group.id}/membership/request`,
      headers: {
        authorization: `Bearer ${requesterToken}`,
      },
    });
    expect(requestResponse.statusCode).toBe(200);
    expect(requestResponse.json()).toMatchObject({
      currentMembership: {
        status: "pending",
        role: "member",
        permissions: [],
      },
      actorPermissions: [],
    });

    const pendingDetail = await app.inject({
      method: "GET",
      url: `/api/community/groups/${group.id}`,
      headers: {
        authorization: `Bearer ${requesterToken}`,
      },
    });
    expect(pendingDetail.statusCode).toBe(403);
    expect(pendingDetail.json()).toEqual({ error: "community_group_forbidden" });

    const membersResponse = await app.inject({
      method: "GET",
      url: `/api/community/groups/${group.id}/members`,
      headers: {
        authorization: `Bearer ${adminToken}`,
      },
    });
    expect(membersResponse.statusCode).toBe(200);
    expect(membersResponse.json()).toMatchObject({
      memberCount: 1,
      memberLimit: 500,
      membersByStatus: {
        pending: expect.arrayContaining([
          expect.objectContaining({
            userId: "community-member-join-1",
            status: "pending",
          }),
        ]),
      },
    });

    const approveResponse = await app.inject({
      method: "POST",
      url: `/api/community/groups/${group.id}/members/community-member-join-1/approve`,
      headers: {
        authorization: `Bearer ${adminToken}`,
      },
      payload: { reason: "تمت المراجعة" },
    });
    expect(approveResponse.statusCode).toBe(200);
    expect(approveResponse.json()).toMatchObject({
      currentMembership: {
        status: "active",
        role: "member",
      },
    });

    const approvedDetail = await app.inject({
      method: "GET",
      url: `/api/community/groups/${group.id}`,
      headers: {
        authorization: `Bearer ${requesterToken}`,
      },
    });
    expect(approvedDetail.statusCode).toBe(200);
    expect(approvedDetail.json()).toMatchObject({
      currentMembership: {
        status: "active",
        role: "member",
      },
      actorPermissions: expect.arrayContaining(["community.group.read", "community.group.write"]),
    });

    const leaveResponse = await app.inject({
      method: "POST",
      url: `/api/community/groups/${group.id}/membership/leave`,
      headers: {
        authorization: `Bearer ${requesterToken}`,
      },
    });
    expect(leaveResponse.statusCode).toBe(200);
    expect(leaveResponse.json()).toMatchObject({
      currentMembership: {
        status: "left",
        role: "member",
        permissions: [],
      },
      actorPermissions: [],
    });

    const leftDetail = await app.inject({
      method: "GET",
      url: `/api/community/groups/${group.id}`,
      headers: {
        authorization: `Bearer ${requesterToken}`,
      },
    });
    expect(leftDetail.statusCode).toBe(403);
    expect(leftDetail.json()).toEqual({ error: "community_group_forbidden" });

    await app.close();
  });

  it("supports invitation create, accept, revoke, and immutable audit logging", async () => {
    const app = buildApp("invitation_flow");
    await app.ready();

    const adminToken = accessToken({
      sub: "community-admin-1",
      role: "admin",
      email: "community.admin@watany.test",
    });
    const invitedMemberToken = accessToken({
      sub: "community-invitee-1",
      role: "accredited",
      email: "invitee.one@watany.test",
    });

    const createResponse = await app.inject({
      method: "POST",
      url: "/api/community/groups",
      headers: {
        authorization: `Bearer ${adminToken}`,
      },
      payload: {
        name: "مجموعة الدعوات",
        description: "مجموعة لاختبار دورة الدعوات",
        category: "support",
        visibility: "invite_only",
      },
    });
    expect(createResponse.statusCode).toBe(200);
    const group = createResponse.json() as { id: string; visibility: string };
    expect(group.visibility).toBe("invite_only");

    const inviteResponse = await app.inject({
      method: "POST",
      url: `/api/community/groups/${group.id}/invitations`,
      headers: {
        authorization: `Bearer ${adminToken}`,
      },
      payload: {
        invitedUserId: "community-invitee-1",
        note: "دعوة أولى",
        expiresInDays: 5,
      },
    });
    expect(inviteResponse.statusCode).toBe(200);
    expect(inviteResponse.json()).toMatchObject({
      membersByStatus: {
        invited: expect.arrayContaining([
          expect.objectContaining({
            userId: "community-invitee-1",
            status: "invited",
            invitedByUserId: "community-admin-1",
          }),
        ]),
      },
    });

    const inviteeBeforeAccept = await app.inject({
      method: "GET",
      url: `/api/community/groups/${group.id}`,
      headers: {
        authorization: `Bearer ${invitedMemberToken}`,
      },
    });
    expect(inviteeBeforeAccept.statusCode).toBe(403);
    expect(inviteeBeforeAccept.json()).toEqual({ error: "community_group_forbidden" });

    const acceptResponse = await app.inject({
      method: "POST",
      url: `/api/community/groups/${group.id}/invitations/accept`,
      headers: {
        authorization: `Bearer ${invitedMemberToken}`,
      },
    });
    expect(acceptResponse.statusCode).toBe(200);
    expect(acceptResponse.json()).toMatchObject({
      currentMembership: {
        status: "active",
        role: "member",
      },
      actorPermissions: expect.arrayContaining(["community.group.read", "community.group.write"]),
    });

    const inviteeAfterAccept = await app.inject({
      method: "GET",
      url: `/api/community/groups/${group.id}`,
      headers: {
        authorization: `Bearer ${invitedMemberToken}`,
      },
    });
    expect(inviteeAfterAccept.statusCode).toBe(200);
    expect(inviteeAfterAccept.json()).toMatchObject({
      currentMembership: {
        status: "active",
      },
    });

    const secondInviteResponse = await app.inject({
      method: "POST",
      url: `/api/community/groups/${group.id}/invitations`,
      headers: {
        authorization: `Bearer ${adminToken}`,
      },
      payload: {
        invitedUserId: "community-invitee-2",
        note: "دعوة ثانية",
      },
    });
    expect(secondInviteResponse.statusCode).toBe(200);
    expect(secondInviteResponse.json()).toMatchObject({
      membersByStatus: {
        invited: expect.arrayContaining([
          expect.objectContaining({
            userId: "community-invitee-2",
            status: "invited",
          }),
        ]),
      },
    });

    const revokeResponse = await app.inject({
      method: "POST",
      url: `/api/community/groups/${group.id}/invitations/community-invitee-2/revoke`,
      headers: {
        authorization: `Bearer ${adminToken}`,
      },
      payload: {
        reason: "تم إلغاء الدعوة قبل القبول",
      },
    });
    expect(revokeResponse.statusCode).toBe(200);
    expect(revokeResponse.json()).toMatchObject({
      membersByStatus: {
        invited: expect.not.arrayContaining([
          expect.objectContaining({
            userId: "community-invitee-2",
          }),
        ]),
      },
    });

    const auditRows = await query<{ event_type: string; entity_type: string; entity_id: string | null }>(
      `SELECT event_type, entity_type, entity_id
         FROM admin_audit_events
        WHERE entity_type = 'community_group_invitation'
          AND entity_id LIKE $1
        ORDER BY created_at DESC, id DESC
        LIMIT 4`,
      [`${group.id}:%`],
    );
    const latestAuditRows = auditRows.rows.slice().reverse();
    expect(latestAuditRows.map((row) => row.event_type)).toEqual([
      "community.invitation_created",
      "community.invitation_accepted",
      "community.invitation_created",
      "community.invitation_revoked",
    ]);
    expect(latestAuditRows.map((row) => row.entity_id)).toEqual([
      `${group.id}:community-invitee-1`,
      `${group.id}:community-invitee-1`,
      `${group.id}:community-invitee-2`,
      `${group.id}:community-invitee-2`,
    ]);

    await app.close();
  });

  it("supports sanctions enforcement, expiry normalization, and superadmin-only bans", async () => {
    const app = buildApp("sanctions_flow");
    await app.ready();

    const adminToken = accessToken({
      sub: "community-admin-1",
      role: "admin",
      email: "community.admin@watany.test",
    });
    const superadminToken = accessToken({
      sub: "community-superadmin-1",
      role: "superadmin",
      email: "community.superadmin@watany.test",
    });
    const memberToken = accessToken({
      sub: "community-sanction-member-1",
      role: "accredited",
      email: "sanction.member@watany.test",
    });

    const createResponse = await app.inject({
      method: "POST",
      url: "/api/community/groups",
      headers: {
        authorization: `Bearer ${adminToken}`,
      },
      payload: {
        name: "مجموعة العقوبات",
        description: "مجموعة لاختبار دورة العقوبات",
        category: "support",
        visibility: "private",
        memberIds: ["community-sanction-member-1"],
      },
    });
    expect(createResponse.statusCode).toBe(200);
    const group = createResponse.json() as { id: string };

    const warnResponse = await app.inject({
      method: "POST",
      url: `/api/community/groups/${group.id}/members/community-sanction-member-1/warn`,
      headers: {
        authorization: `Bearer ${adminToken}`,
      },
      payload: {
        reason: "إنذار أول بسبب إساءة متكررة.",
      },
    });
    expect(warnResponse.statusCode).toBe(200);

    const muteResponse = await app.inject({
      method: "POST",
      url: `/api/community/groups/${group.id}/members/community-sanction-member-1/mute`,
      headers: {
        authorization: `Bearer ${adminToken}`,
      },
      payload: {
        reason: "تهدئة مؤقتة بعد مخالفة النقاش.",
        durationHours: 6,
      },
    });
    expect(muteResponse.statusCode).toBe(200);
    expect(muteResponse.json()).toMatchObject({
      membersByStatus: {
        muted: expect.arrayContaining([
          expect.objectContaining({
            userId: "community-sanction-member-1",
            status: "muted",
          }),
        ]),
      },
    });

    const mutedWrite = await app.inject({
      method: "POST",
      url: `/api/community/groups/${group.id}/messages`,
      headers: {
        authorization: `Bearer ${memberToken}`,
      },
      payload: {
        body: "يجب أن تُرفض هذه الرسالة أثناء الكتم",
      },
    });
    expect(mutedWrite.statusCode).toBe(403);
    expect(mutedWrite.json()).toEqual({ error: "community_group_forbidden" });

    const mutedDetail = await app.inject({
      method: "GET",
      url: `/api/community/groups/${group.id}`,
      headers: {
        authorization: `Bearer ${memberToken}`,
      },
    });
    expect(mutedDetail.statusCode).toBe(200);
    expect(mutedDetail.json()).toMatchObject({
      currentMembership: {
        status: "muted",
      },
    });

    const unmuteResponse = await app.inject({
      method: "POST",
      url: `/api/community/groups/${group.id}/members/community-sanction-member-1/unmute`,
      headers: {
        authorization: `Bearer ${adminToken}`,
      },
      payload: {
        reason: "انتهت مدة الكتم وعاد الالتزام.",
      },
    });
    expect(unmuteResponse.statusCode).toBe(200);
    expect(unmuteResponse.json()).toMatchObject({
      membersByStatus: {
        active: expect.arrayContaining([
          expect.objectContaining({
            userId: "community-sanction-member-1",
            status: "active",
          }),
        ]),
      },
    });

    const unmutedWrite = await app.inject({
      method: "POST",
      url: `/api/community/groups/${group.id}/messages`,
      headers: {
        authorization: `Bearer ${memberToken}`,
      },
      payload: {
        body: "هذه الرسالة يجب أن تمر بعد رفع الكتم",
        clientRequestId: "sanctions-unmuted-write-1",
      },
    });
    expect(unmutedWrite.statusCode).toBe(200);

    const suspendResponse = await app.inject({
      method: "POST",
      url: `/api/community/groups/${group.id}/members/community-sanction-member-1/suspend`,
      headers: {
        authorization: `Bearer ${adminToken}`,
      },
      payload: {
        reason: "تعليق مؤقت لمدة يوم.",
        duration: "24h",
      },
    });
    expect(suspendResponse.statusCode).toBe(200);
    expect(suspendResponse.json()).toMatchObject({
      memberCount: 1,
      membersByStatus: {
        suspended: expect.arrayContaining([
          expect.objectContaining({
            userId: "community-sanction-member-1",
            status: "suspended",
          }),
        ]),
      },
    });

    const suspendedDetail = await app.inject({
      method: "GET",
      url: `/api/community/groups/${group.id}`,
      headers: {
        authorization: `Bearer ${memberToken}`,
      },
    });
    expect(suspendedDetail.statusCode).toBe(403);
    expect(suspendedDetail.json()).toEqual({ error: "community_group_forbidden" });

    await query(
      `UPDATE community_group_members
          SET suspended_until = now() - interval '5 minutes'
        WHERE group_id = $1 AND user_id = $2`,
      [group.id, "community-sanction-member-1"],
    );

    const expiredSuspensionDetail = await app.inject({
      method: "GET",
      url: `/api/community/groups/${group.id}`,
      headers: {
        authorization: `Bearer ${memberToken}`,
      },
    });
    expect(expiredSuspensionDetail.statusCode).toBe(200);
    expect(expiredSuspensionDetail.json()).toMatchObject({
      currentMembership: {
        status: "active",
      },
    });

    const membersAfterExpiry = await app.inject({
      method: "GET",
      url: `/api/community/groups/${group.id}/members`,
      headers: {
        authorization: `Bearer ${adminToken}`,
      },
    });
    expect(membersAfterExpiry.statusCode).toBe(200);
    expect(membersAfterExpiry.json()).toMatchObject({
      memberCount: 2,
      membersByStatus: {
        active: expect.arrayContaining([
          expect.objectContaining({
            userId: "community-sanction-member-1",
            status: "active",
          }),
        ]),
      },
    });

    const resuspendResponse = await app.inject({
      method: "POST",
      url: `/api/community/groups/${group.id}/members/community-sanction-member-1/suspend`,
      headers: {
        authorization: `Bearer ${adminToken}`,
      },
      payload: {
        reason: "تعليق ثانٍ لمدة أسبوع.",
        duration: "7d",
      },
    });
    expect(resuspendResponse.statusCode).toBe(200);

    const reinstateResponse = await app.inject({
      method: "POST",
      url: `/api/community/groups/${group.id}/members/community-sanction-member-1/reinstate`,
      headers: {
        authorization: `Bearer ${adminToken}`,
      },
      payload: {
        reason: "رفع التعليق مبكراً بعد مراجعة الحالة.",
      },
    });
    expect(reinstateResponse.statusCode).toBe(200);
    expect(reinstateResponse.json()).toMatchObject({
      memberCount: 2,
      membersByStatus: {
        active: expect.arrayContaining([
          expect.objectContaining({
            userId: "community-sanction-member-1",
            status: "active",
          }),
        ]),
      },
    });

    const adminBanAttempt = await app.inject({
      method: "POST",
      url: `/api/community/groups/${group.id}/members/community-sanction-member-1/ban`,
      headers: {
        authorization: `Bearer ${adminToken}`,
      },
      payload: {
        reason: "محاولة حظر يجب أن تُرفض على مستوى الإدارة العادية.",
      },
    });
    expect(adminBanAttempt.statusCode).toBe(403);
    expect(adminBanAttempt.json()).toEqual({ error: "community_group_forbidden" });

    const superadminBanResponse = await app.inject({
      method: "POST",
      url: `/api/community/groups/${group.id}/members/community-sanction-member-1/ban`,
      headers: {
        authorization: `Bearer ${superadminToken}`,
      },
      payload: {
        reason: "حظر دائم بقرار من المشرف العام.",
      },
    });
    expect(superadminBanResponse.statusCode).toBe(200);
    expect(superadminBanResponse.json()).toMatchObject({
      membersByStatus: {
        banned: expect.arrayContaining([
          expect.objectContaining({
            userId: "community-sanction-member-1",
            status: "banned",
          }),
        ]),
      },
    });

    const bannedDetail = await app.inject({
      method: "GET",
      url: `/api/community/groups/${group.id}`,
      headers: {
        authorization: `Bearer ${memberToken}`,
      },
    });
    expect(bannedDetail.statusCode).toBe(403);
    expect(bannedDetail.json()).toEqual({ error: "community_group_forbidden" });

    const bannedRequest = await app.inject({
      method: "POST",
      url: `/api/community/groups/${group.id}/membership/request`,
      headers: {
        authorization: `Bearer ${memberToken}`,
      },
    });
    expect(bannedRequest.statusCode).toBe(403);
    expect(bannedRequest.json()).toEqual({ error: "community_group_forbidden" });

    const bannedInvite = await app.inject({
      method: "POST",
      url: `/api/community/groups/${group.id}/invitations`,
      headers: {
        authorization: `Bearer ${adminToken}`,
      },
      payload: {
        invitedUserId: "community-sanction-member-1",
        note: "يجب رفض دعوة المستخدم المحظور.",
      },
    });
    expect(bannedInvite.statusCode).toBe(403);
    expect(bannedInvite.json()).toEqual({ error: "community_group_forbidden" });

    const auditRows = await query<{ event_type: string; entity_id: string | null }>(
      `SELECT event_type, entity_id
         FROM admin_audit_events
        WHERE entity_id = $1
          AND event_type = ANY($2::text[])
        ORDER BY created_at DESC, id DESC
        LIMIT 7`,
      [
        `${group.id}:community-sanction-member-1`,
        [
          "community.member_warned",
          "community.member_muted",
          "community.member_unmuted",
          "community.member_suspended",
          "community.member_reinstated",
          "community.member_banned",
        ],
      ],
    );
    const latestAuditRows = auditRows.rows.slice().reverse();
    expect(latestAuditRows.map((row) => row.event_type)).toEqual([
      "community.member_warned",
      "community.member_muted",
      "community.member_unmuted",
      "community.member_suspended",
      "community.member_suspended",
      "community.member_reinstated",
      "community.member_banned",
    ]);
    expect(latestAuditRows.every((row) => row.entity_id === `${group.id}:community-sanction-member-1`)).toBe(true);

    await app.close();
  });

  it("supports report lifecycle, duplicate control, and appeal resolution for suspension and permanent bans", async () => {
    const app = buildApp("report_appeal_flow");
    await app.ready();

    const adminToken = accessToken({
      sub: "community-admin-1",
      role: "admin",
      email: "community.admin@watany.test",
    });
    const superadminToken = accessToken({
      sub: "community-superadmin-1",
      role: "superadmin",
      email: "community.superadmin@watany.test",
    });
    const memberToken = accessToken({
      sub: "community-report-member-1",
      role: "accredited",
      email: "report.member@watany.test",
    });

    const createResponse = await app.inject({
      method: "POST",
      url: "/api/community/groups",
      headers: {
        authorization: `Bearer ${adminToken}`,
      },
      payload: {
        name: "مجموعة البلاغات والاستئناف",
        description: "مجموعة لاختبار دورة البلاغات والاستئناف",
        category: "support",
        visibility: "private",
        memberIds: ["community-report-member-1"],
      },
    });
    expect(createResponse.statusCode).toBe(200);
    const group = createResponse.json() as { id: string };

    const memberReportResponse = await app.inject({
      method: "POST",
      url: `/api/community/groups/${group.id}/reports`,
      headers: {
        authorization: `Bearer ${memberToken}`,
      },
      payload: {
        targetType: "group",
        targetId: group.id,
        reasonCategory: "other",
        description: "بلاغ أولي حول تنظيم المجموعة.",
      },
    });
    expect(memberReportResponse.statusCode).toBe(200);
    const memberReport = memberReportResponse.json() as { id: string; reporterId: string; status: string };
    expect(memberReport).toMatchObject({
      reporterId: "community-report-member-1",
      status: "open",
    });

    const duplicateMemberReportResponse = await app.inject({
      method: "POST",
      url: `/api/community/groups/${group.id}/reports`,
      headers: {
        authorization: `Bearer ${memberToken}`,
      },
      payload: {
        targetType: "group",
        targetId: group.id,
        reasonCategory: "other",
        description: "إعادة إرسال البلاغ نفسه يجب أن تُرفض.",
      },
    });
    expect(duplicateMemberReportResponse.statusCode).toBe(409);
    expect(duplicateMemberReportResponse.json()).toEqual({ error: "community_report_duplicate" });

    const memberReportsResponse = await app.inject({
      method: "GET",
      url: `/api/community/groups/${group.id}/reports`,
      headers: {
        authorization: `Bearer ${memberToken}`,
      },
    });
    expect(memberReportsResponse.statusCode).toBe(200);
    expect(memberReportsResponse.json()).toMatchObject({
      reports: [
        expect.objectContaining({
          id: memberReport.id,
          reporterId: "community-report-member-1",
          status: "open",
        }),
      ],
    });

    const reviewReportResponse = await app.inject({
      method: "POST",
      url: `/api/community/groups/${group.id}/reports/${memberReport.id}/review`,
      headers: {
        authorization: `Bearer ${adminToken}`,
      },
      payload: {
        status: "under_review",
      },
    });
    expect(reviewReportResponse.statusCode).toBe(200);
    expect(reviewReportResponse.json()).toMatchObject({
      id: memberReport.id,
      status: "under_review",
      assignedReviewerId: "community-admin-1",
    });

    const dismissReportResponse = await app.inject({
      method: "POST",
      url: `/api/community/groups/${group.id}/reports/${memberReport.id}/review`,
      headers: {
        authorization: `Bearer ${adminToken}`,
      },
      payload: {
        status: "dismissed",
        resolution: "تمت المراجعة دون الحاجة إلى إجراء إضافي.",
      },
    });
    expect(dismissReportResponse.statusCode).toBe(200);
    expect(dismissReportResponse.json()).toMatchObject({
      id: memberReport.id,
      status: "dismissed",
      resolution: "تمت المراجعة دون الحاجة إلى إجراء إضافي.",
    });

    const suspendMemberResponse = await app.inject({
      method: "POST",
      url: `/api/community/groups/${group.id}/members/community-report-member-1/suspend`,
      headers: {
        authorization: `Bearer ${adminToken}`,
      },
      payload: {
        reason: "تعليق مؤقت لاختبار مسار الاستئناف.",
        duration: "24h",
      },
    });
    expect(suspendMemberResponse.statusCode).toBe(200);

    const suspensionActionRows = await query<{ id: string }>(
      `SELECT id
         FROM community_moderation_actions
        WHERE group_id = $1
          AND target_id = $2
          AND action_type = 'member_suspended'
        ORDER BY created_at DESC, id DESC
        LIMIT 1`,
      [group.id, "community-report-member-1"],
    );
    const suspensionActionId = suspensionActionRows.rows[0]?.id;
    expect(suspensionActionId).toBeTruthy();

    const actionedReportResponse = await app.inject({
      method: "POST",
      url: `/api/community/groups/${group.id}/reports`,
      headers: {
        authorization: `Bearer ${adminToken}`,
      },
      payload: {
        targetType: "member",
        targetId: "community-report-member-1",
        reasonCategory: "harassment",
        description: "ربط البلاغ بإجراء التعليق الحالي.",
      },
    });
    expect(actionedReportResponse.statusCode).toBe(200);
    const actionedReport = actionedReportResponse.json() as { id: string };

    const actionedReviewResponse = await app.inject({
      method: "POST",
      url: `/api/community/groups/${group.id}/reports/${actionedReport.id}/review`,
      headers: {
        authorization: `Bearer ${adminToken}`,
      },
      payload: {
        status: "actioned",
        resolution: "تم اتخاذ إجراء تعليق مرتبط بهذا البلاغ.",
        linkedModerationActionIds: [suspensionActionId],
      },
    });
    expect(actionedReviewResponse.statusCode).toBe(200);
    expect(actionedReviewResponse.json()).toMatchObject({
      id: actionedReport.id,
      status: "actioned",
      linkedModerationActionIds: [suspensionActionId],
    });

    const suspensionAppealResponse = await app.inject({
      method: "POST",
      url: `/api/community/groups/${group.id}/appeals`,
      headers: {
        authorization: `Bearer ${memberToken}`,
      },
      payload: {
        moderationActionId: suspensionActionId,
        reason: "أطلب مراجعة قرار التعليق المؤقت.",
      },
    });
    expect(suspensionAppealResponse.statusCode).toBe(200);
    const suspensionAppeal = suspensionAppealResponse.json() as { id: string; status: string };
    expect(suspensionAppeal.status).toBe("open");

    const duplicateSuspensionAppealResponse = await app.inject({
      method: "POST",
      url: `/api/community/groups/${group.id}/appeals`,
      headers: {
        authorization: `Bearer ${memberToken}`,
      },
      payload: {
        moderationActionId: suspensionActionId,
        reason: "إعادة إرسال الاستئناف نفسه يجب أن تُرفض.",
      },
    });
    expect(duplicateSuspensionAppealResponse.statusCode).toBe(409);
    expect(duplicateSuspensionAppealResponse.json()).toEqual({ error: "community_appeal_duplicate" });

    const superadminAppealsResponse = await app.inject({
      method: "GET",
      url: `/api/community/groups/${group.id}/appeals`,
      headers: {
        authorization: `Bearer ${superadminToken}`,
      },
    });
    expect(superadminAppealsResponse.statusCode).toBe(200);
    expect(superadminAppealsResponse.json()).toMatchObject({
      appeals: expect.arrayContaining([
        expect.objectContaining({
          id: suspensionAppeal.id,
          status: "open",
        }),
      ]),
    });

    const appealedReportResponse = await app.inject({
      method: "GET",
      url: `/api/community/groups/${group.id}/reports`,
      headers: {
        authorization: `Bearer ${adminToken}`,
      },
    });
    expect(appealedReportResponse.statusCode).toBe(200);
    expect(appealedReportResponse.json()).toMatchObject({
      reports: expect.arrayContaining([
        expect.objectContaining({
          id: actionedReport.id,
          status: "appealed",
          appealStatus: "open",
          linkedModerationActionIds: [suspensionActionId],
        }),
      ]),
    });

    const resolveSuspensionAppealResponse = await app.inject({
      method: "POST",
      url: `/api/community/groups/${group.id}/appeals/${suspensionAppeal.id}/resolve`,
      headers: {
        authorization: `Bearer ${superadminToken}`,
      },
      payload: {
        outcome: "reversed",
        resolutionReason: "ثبتت كفاية المراجعة وتم رفع التعليق.",
      },
    });
    expect(resolveSuspensionAppealResponse.statusCode).toBe(200);
    expect(resolveSuspensionAppealResponse.json()).toMatchObject({
      id: suspensionAppeal.id,
      status: "resolved",
      resolutionOutcome: "reversed",
      resolvedByUserId: "community-superadmin-1",
    });

    const memberDetailAfterSuspensionAppeal = await app.inject({
      method: "GET",
      url: `/api/community/groups/${group.id}`,
      headers: {
        authorization: `Bearer ${memberToken}`,
      },
    });
    expect(memberDetailAfterSuspensionAppeal.statusCode).toBe(200);
    expect(memberDetailAfterSuspensionAppeal.json()).toMatchObject({
      currentMembership: {
        status: "active",
      },
    });

    const resolvedReportResponse = await app.inject({
      method: "GET",
      url: `/api/community/groups/${group.id}/reports`,
      headers: {
        authorization: `Bearer ${adminToken}`,
      },
    });
    expect(resolvedReportResponse.statusCode).toBe(200);
    expect(resolvedReportResponse.json()).toMatchObject({
      reports: expect.arrayContaining([
        expect.objectContaining({
          id: actionedReport.id,
          status: "resolved",
          appealStatus: "resolved",
        }),
      ]),
    });

    const banMemberResponse = await app.inject({
      method: "POST",
      url: `/api/community/groups/${group.id}/members/community-report-member-1/ban`,
      headers: {
        authorization: `Bearer ${superadminToken}`,
      },
      payload: {
        reason: "حظر دائم لاختبار مسار الاستئناف بعد الحظر.",
      },
    });
    expect(banMemberResponse.statusCode).toBe(200);

    const banActionRows = await query<{ id: string }>(
      `SELECT id
         FROM community_moderation_actions
        WHERE group_id = $1
          AND target_id = $2
          AND action_type = 'member_banned'
        ORDER BY created_at DESC, id DESC
        LIMIT 1`,
      [group.id, "community-report-member-1"],
    );
    const banActionId = banActionRows.rows[0]?.id;
    expect(banActionId).toBeTruthy();

    const banAppealResponse = await app.inject({
      method: "POST",
      url: `/api/community/groups/${group.id}/appeals`,
      headers: {
        authorization: `Bearer ${memberToken}`,
      },
      payload: {
        moderationActionId: banActionId,
        reason: "أطلب مراجعة قرار الحظر الدائم.",
      },
    });
    expect(banAppealResponse.statusCode).toBe(200);
    const banAppeal = banAppealResponse.json() as { id: string };

    const resolveBanAppealResponse = await app.inject({
      method: "POST",
      url: `/api/community/groups/${group.id}/appeals/${banAppeal.id}/resolve`,
      headers: {
        authorization: `Bearer ${superadminToken}`,
      },
      payload: {
        outcome: "modified",
        resolutionReason: "تم تعديل قرار الحظر وإعادة العضوية النشطة.",
      },
    });
    expect(resolveBanAppealResponse.statusCode).toBe(200);
    expect(resolveBanAppealResponse.json()).toMatchObject({
      id: banAppeal.id,
      status: "resolved",
      resolutionOutcome: "modified",
    });

    const memberDetailAfterBanAppeal = await app.inject({
      method: "GET",
      url: `/api/community/groups/${group.id}`,
      headers: {
        authorization: `Bearer ${memberToken}`,
      },
    });
    expect(memberDetailAfterBanAppeal.statusCode).toBe(200);
    expect(memberDetailAfterBanAppeal.json()).toMatchObject({
      currentMembership: {
        status: "active",
      },
    });

    const reportAuditRows = await query<{ event_type: string }>(
      `SELECT event_type
         FROM admin_audit_events
        WHERE event_type = ANY($1::text[])
        ORDER BY created_at DESC, id DESC
        LIMIT 10`,
      [[
        "community.report_created",
        "community.report_updated",
        "community.appeal_created",
        "community.appeal_resolved",
      ]],
    );
    expect(reportAuditRows.rows.map((row) => row.event_type)).toEqual(expect.arrayContaining([
      "community.report_created",
      "community.report_updated",
      "community.appeal_created",
      "community.appeal_resolved",
    ]));

    const appealModerationRows = await query<{ action_type: string }>(
      `SELECT action_type
         FROM community_moderation_actions
        WHERE group_id = $1
          AND action_type = 'appeal_resolved'
        ORDER BY created_at DESC, id DESC
        LIMIT 2`,
      [group.id],
    );
    expect(appealModerationRows.rows).toHaveLength(2);
    expect(appealModerationRows.rows.every((row) => row.action_type === "appeal_resolved")).toBe(true);

    await app.close();
  });

  it("allows public group reads but rejects outsider writes, typing, and read-state updates", async () => {
    const app = buildApp("public_membership_required");
    await app.ready();

    const outsiderToken = accessToken({
      sub: "public-outsider-1",
      role: "accredited",
      email: "public.outsider@watany.test",
    });

    const publicDetail = await app.inject({
      method: "GET",
      url: "/api/community/groups/health-room",
      headers: {
        authorization: `Bearer ${outsiderToken}`,
      },
    });
    expect(publicDetail.statusCode).toBe(200);
    expect(publicDetail.json()).toMatchObject({
      group: {
        id: "health-room",
        visibility: "public",
      },
      currentMembership: null,
      actorPermissions: expect.arrayContaining(["community.group.read"]),
    });

    const publicWrite = await app.inject({
      method: "POST",
      url: "/api/community/groups/health-room/messages",
      headers: {
        authorization: `Bearer ${outsiderToken}`,
      },
      payload: {
        body: "لا يجب أن تُقبل هذه الرسالة",
      },
    });
    expect(publicWrite.statusCode).toBe(403);
    expect(publicWrite.json()).toEqual({ error: "community_group_forbidden" });

    const publicTyping = await app.inject({
      method: "POST",
      url: "/api/community/groups/health-room/typing",
      headers: {
        authorization: `Bearer ${outsiderToken}`,
      },
      payload: { isTyping: true },
    });
    expect(publicTyping.statusCode).toBe(403);
    expect(publicTyping.json()).toEqual({ error: "community_group_forbidden" });

    const publicRead = await app.inject({
      method: "POST",
      url: "/api/community/groups/health-room/read",
      headers: {
        authorization: `Bearer ${outsiderToken}`,
      },
    });
    expect(publicRead.statusCode).toBe(403);
    expect(publicRead.json()).toEqual({ error: "community_group_forbidden" });

    await app.close();
  });

  it("gates private community groups to authenticated members only", async () => {
    const app = buildApp("private_access");
    await app.ready();

    const adminToken = accessToken({
      sub: "community-admin-1",
      role: "admin",
      email: "community.admin@watany.test",
    });
    const memberToken = accessToken({
      sub: "community-member-1",
      role: "accredited",
      email: "member.one@watany.test",
    });
    const outsiderToken = accessToken({
      sub: "community-outsider-1",
      role: "accredited",
      email: "outsider.one@watany.test",
    });

    const createResponse = await app.inject({
      method: "POST",
      url: "/api/community/groups",
      headers: {
        authorization: `Bearer ${adminToken}`,
      },
      payload: {
        name: "مجموعة خاصة",
        description: "مجموعة تجريبية خاصة",
        category: "support",
        visibility: "private",
        memberIds: ["community-member-1"],
      },
    });

    expect(createResponse.statusCode).toBe(200);
    const privateGroup = createResponse.json() as { id: string; visibility: string };
    expect(privateGroup.visibility).toBe("private");

    const anonymousDetail = await app.inject({
      method: "GET",
      url: `/api/community/groups/${privateGroup.id}`,
    });
    expect(anonymousDetail.statusCode).toBe(401);
    expect(anonymousDetail.json()).toEqual({ error: "community_group_auth_required" });

    const outsiderDetail = await app.inject({
      method: "GET",
      url: `/api/community/groups/${privateGroup.id}`,
      headers: {
        authorization: `Bearer ${outsiderToken}`,
      },
    });
    expect(outsiderDetail.statusCode).toBe(403);
    expect(outsiderDetail.json()).toEqual({ error: "community_group_forbidden" });

    const outsiderMessage = await app.inject({
      method: "POST",
      url: `/api/community/groups/${privateGroup.id}/messages`,
      headers: {
        authorization: `Bearer ${outsiderToken}`,
      },
      payload: {
        body: "محاولة دخول من غير عضو",
      },
    });
    expect(outsiderMessage.statusCode).toBe(403);
    expect(outsiderMessage.json()).toEqual({ error: "community_group_forbidden" });

    const memberDetail = await app.inject({
      method: "GET",
      url: `/api/community/groups/${privateGroup.id}`,
      headers: {
        authorization: `Bearer ${memberToken}`,
      },
    });
    expect(memberDetail.statusCode).toBe(200);
    expect(memberDetail.json()).toMatchObject({
      group: {
        id: privateGroup.id,
        visibility: "private",
      },
    });

    const memberMessage = await app.inject({
      method: "POST",
      url: `/api/community/groups/${privateGroup.id}/messages`,
      headers: {
        authorization: `Bearer ${memberToken}`,
      },
      payload: {
        body: "أنا عضو ومعي حق الوصول",
        clientRequestId: "private-group-member-message-1",
      },
    });
    expect(memberMessage.statusCode).toBe(200);
    expect(memberMessage.json()).toMatchObject({
      groupId: privateGroup.id,
      senderId: "community-member-1",
      senderName: "member.one",
    });

    await app.close();
  });

  it("persists idempotent messages, read state, and message history across app restarts", async () => {
    const adminToken = accessToken({
      sub: "community-admin-1",
      role: "admin",
      email: "community.admin@watany.test",
    });
    const memberToken = accessToken({
      sub: "community-member-2",
      role: "accredited",
      email: "member.two@watany.test",
    });

    const app = buildApp("durable_flow");
    await app.ready();

    const privateGroupCreate = await app.inject({
      method: "POST",
      url: "/api/community/groups",
      headers: {
        authorization: `Bearer ${adminToken}`,
      },
      payload: {
        name: "مجموعة إثبات الاستمرارية",
        description: "نثبت فيها الاستمرارية والقراءة",
        category: "support",
        visibility: "private",
        memberIds: ["community-member-2"],
      },
    });
    expect(privateGroupCreate.statusCode).toBe(200);
    const privateGroup = privateGroupCreate.json() as { id: string };

    const firstSend = await app.inject({
      method: "POST",
      url: `/api/community/groups/${privateGroup.id}/messages`,
      headers: {
        authorization: `Bearer ${adminToken}`,
      },
      payload: {
        body: "رسالة ثابتة لا يجب أن تتكرر.",
        clientRequestId: "durable-message-1",
      },
    });
    expect(firstSend.statusCode).toBe(200);
    const firstMessage = firstSend.json() as { id: string };

    const duplicateSend = await app.inject({
      method: "POST",
      url: `/api/community/groups/${privateGroup.id}/messages`,
      headers: {
        authorization: `Bearer ${adminToken}`,
      },
      payload: {
        body: "رسالة ثابتة لا يجب أن تتكرر.",
        clientRequestId: "durable-message-1",
      },
    });
    expect(duplicateSend.statusCode).toBe(200);
    expect(duplicateSend.json()).toMatchObject({ id: firstMessage.id });

    const memberOverviewBeforeRead = await app.inject({
      method: "GET",
      url: "/api/community/groups",
      headers: {
        authorization: `Bearer ${memberToken}`,
      },
    });
    expect(memberOverviewBeforeRead.statusCode).toBe(200);
    const unreadGroupBeforeRead = (memberOverviewBeforeRead.json() as { groups: Array<{ id: string; unreadCount?: number }> }).groups.find((group) => group.id === privateGroup.id);
    expect(unreadGroupBeforeRead?.unreadCount).toBe(1);

    const editResponse = await app.inject({
      method: "PATCH",
      url: `/api/community/groups/${privateGroup.id}/messages/${firstMessage.id}`,
      headers: {
        authorization: `Bearer ${adminToken}`,
      },
      payload: {
        body: "تم تعديل الرسالة قبل الحذف.",
      },
    });
    expect(editResponse.statusCode).toBe(200);
    expect(editResponse.json()).toMatchObject({
      message: {
        id: firstMessage.id,
        body: "تم تعديل الرسالة قبل الحذف.",
      },
    });

    const readResponse = await app.inject({
      method: "POST",
      url: `/api/community/groups/${privateGroup.id}/read`,
      headers: {
        authorization: `Bearer ${memberToken}`,
      },
    });
    expect(readResponse.statusCode).toBe(200);
    expect(readResponse.json()).toEqual({
      ok: true,
      unreadCount: 0,
      lastReadMessageId: firstMessage.id,
      lastReadAt: expect.any(String),
    });

    const memberOverviewAfterRead = await app.inject({
      method: "GET",
      url: "/api/community/groups",
      headers: {
        authorization: `Bearer ${memberToken}`,
      },
    });
    expect(memberOverviewAfterRead.statusCode).toBe(200);
    const unreadGroupAfterRead = (memberOverviewAfterRead.json() as { groups: Array<{ id: string; unreadCount?: number }> }).groups.find((group) => group.id === privateGroup.id);
    expect(unreadGroupAfterRead?.unreadCount).toBe(0);

    const pagedMessagesAfterRead = await app.inject({
      method: "GET",
      url: `/api/community/groups/${privateGroup.id}/messages?limit=10`,
      headers: {
        authorization: `Bearer ${memberToken}`,
      },
    });
    expect(pagedMessagesAfterRead.statusCode).toBe(200);
    expect(pagedMessagesAfterRead.json().readState).toEqual({
      unreadCount: 0,
      lastReadMessageId: firstMessage.id,
      lastReadAt: expect.any(String),
    });

    const deleteResponse = await app.inject({
      method: "POST",
      url: `/api/community/groups/${privateGroup.id}/messages/${firstMessage.id}/delete-for-everyone`,
      headers: {
        authorization: `Bearer ${adminToken}`,
      },
    });
    expect(deleteResponse.statusCode).toBe(200);
    expect(deleteResponse.json()).toMatchObject({
      message: {
        id: firstMessage.id,
        deletedForEveryoneBy: "community.admin",
      },
      group: {
        id: privateGroup.id,
        lastMessagePreview: "تم حذف هذه الرسالة للجميع",
      },
    });

    const eventRows = await query<{ event_type: string }>(
      `SELECT event_type
         FROM community_message_events
        WHERE message_id = $1
        ORDER BY created_at ASC, id ASC`,
      [firstMessage.id],
    );
    expect(eventRows.rows.map((row) => row.event_type)).toEqual([
      "created",
      "edited",
      "deleted_for_everyone",
    ]);

    await app.close();

    const restartedApp = buildApp("durable_restart");
    await restartedApp.ready();

    const persistedDetail = await restartedApp.inject({
      method: "GET",
      url: `/api/community/groups/${privateGroup.id}`,
      headers: {
        authorization: `Bearer ${memberToken}`,
      },
    });
    expect(persistedDetail.statusCode).toBe(200);
    expect(persistedDetail.json()).toMatchObject({
      group: {
        id: privateGroup.id,
        lastMessagePreview: "تم حذف هذه الرسالة للجميع",
      },
      messages: expect.arrayContaining([
        expect.objectContaining({
          id: firstMessage.id,
          deletedForEveryoneBy: "community.admin",
        }),
      ]),
    });
    const persistedDeletedMessage = persistedDetail.json().messages.find((message: { id: string }) => message.id === firstMessage.id);
    expect(persistedDeletedMessage).not.toHaveProperty("body");

    const persistedPageAfterRestart = await restartedApp.inject({
      method: "GET",
      url: `/api/community/groups/${privateGroup.id}/messages?limit=10`,
      headers: {
        authorization: `Bearer ${memberToken}`,
      },
    });
    expect(persistedPageAfterRestart.statusCode).toBe(200);
    expect(persistedPageAfterRestart.json().readState).toEqual({
      unreadCount: 0,
      lastReadMessageId: firstMessage.id,
      lastReadAt: expect.any(String),
    });

    const memberOverviewAfterRestart = await restartedApp.inject({
      method: "GET",
      url: "/api/community/groups",
      headers: {
        authorization: `Bearer ${memberToken}`,
      },
    });
    expect(memberOverviewAfterRestart.statusCode).toBe(200);
    const unreadGroupAfterRestart = (memberOverviewAfterRestart.json() as { groups: Array<{ id: string; unreadCount?: number }> }).groups.find((group) => group.id === privateGroup.id);
    expect(unreadGroupAfterRestart?.unreadCount).toBe(0);

    const persistedCount = await query<{ total: string }>(
      `SELECT COUNT(*)::text AS total
         FROM community_messages
        WHERE group_id = $1
          AND client_request_id = 'durable-message-1'`,
      [privateGroup.id],
    );
    expect(Number(persistedCount.rows[0].total)).toBe(1);

    await restartedApp.close();
  });
});