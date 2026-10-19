import { createHash, randomUUID } from "node:crypto";
import type { CommunityDirectContact, CommunityDirectThread } from "@watany/types";
import { getClient, query } from "../lib/db.js";
import { getCommunityGroupDetail, type CommunityViewer } from "./service.js";

type DirectUserRow = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: string;
};

type DirectGroupRow = DirectUserRow & { group_id: string };

export type DirectConversationResult =
  | { ok: true; value: CommunityDirectThread }
  | { ok: false; code: "direct_self_not_allowed" | "direct_recipient_not_found" | "direct_conversation_not_found" };

function directPairKey(left: string, right: string): string {
  return createHash("sha256").update([left, right].sort().join("\u0000")).digest("hex");
}
function mapContact(row: DirectUserRow): CommunityDirectContact {
  return {
    id: row.id,
    name: row.name || row.email.split("@")[0] || row.id,
    email: row.email,
    phone: row.phone || undefined,
    role: row.role,
  };
}

async function buildDirectThread(viewer: CommunityViewer, row: DirectGroupRow): Promise<CommunityDirectThread | null> {
  const detail = await getCommunityGroupDetail(row.group_id, viewer, { limit: 30 });
  if (!detail.ok) return null;
  const latest = detail.value.messages.at(-1);
  return {
    groupId: row.group_id,
    peer: mapContact(row),
    unreadCount: detail.value.readState.unreadCount,
    lastMessagePreview: latest?.body || (latest?.type === "voice" ? "رسالة صوتية" : latest ? "مرفق" : undefined),
    lastMessageAt: latest?.createdAt,
  };
}

export async function listDirectContacts(viewerId: string, search = ""): Promise<CommunityDirectContact[]> {
  const token = search.trim();
  const like = `%${token}%`;
  const result = await query<DirectUserRow>(
    `SELECT id::text AS id, name, email, phone, role
       FROM users
      WHERE status = 'active'
        AND id::text <> $1
        AND ($2 = '' OR name ILIKE $3 OR email ILIKE $3 OR COALESCE(phone, '') ILIKE $3)
      ORDER BY CASE WHEN $2 <> '' AND name ILIKE $3 THEN 0 ELSE 1 END, name ASC, email ASC
      LIMIT 50`,
    [viewerId, token, like],
  );
  return result.rows.map(mapContact);
}

export async function listDirectThreads(viewer: CommunityViewer): Promise<CommunityDirectThread[]> {
  if (!viewer.id) return [];
  const result = await query<DirectGroupRow>(
    `SELECT g.id AS group_id,
            COALESCE(u.id::text, CASE WHEN g.direct_user_a = $1 THEN g.direct_user_b ELSE g.direct_user_a END) AS id,
            COALESCE(u.name, '') AS name,
            COALESCE(u.email, '') AS email,
            u.phone,
            COALESCE(u.role, 'public') AS role
       FROM community_groups g
       JOIN community_group_members mine ON mine.group_id = g.id AND mine.user_id = $1
       LEFT JOIN users u ON u.id::text = CASE WHEN g.direct_user_a = $1 THEN g.direct_user_b ELSE g.direct_user_a END
      WHERE g.conversation_kind = 'direct'
        AND $1 IN (g.direct_user_a, g.direct_user_b)
        AND mine.status IN ('active','muted')
      ORDER BY COALESCE(g.last_message_at, g.created_at) DESC`,
    [viewer.id],
  );
  const threads = await Promise.all(result.rows.map((row) => buildDirectThread(viewer, row)));
  return threads.filter((thread): thread is CommunityDirectThread => Boolean(thread));
}

async function loadDirectThread(viewer: CommunityViewer, groupId: string): Promise<CommunityDirectThread | null> {
  if (!viewer.id) return null;
  const result = await query<DirectGroupRow>(
    `SELECT g.id AS group_id,
            COALESCE(u.id::text, CASE WHEN g.direct_user_a = $1 THEN g.direct_user_b ELSE g.direct_user_a END) AS id,
            COALESCE(u.name, '') AS name,
            COALESCE(u.email, '') AS email,
            u.phone,
            COALESCE(u.role, 'public') AS role
       FROM community_groups g
       LEFT JOIN users u ON u.id::text = CASE WHEN g.direct_user_a = $1 THEN g.direct_user_b ELSE g.direct_user_a END
      WHERE g.id = $2 AND g.conversation_kind = 'direct'
        AND $1 IN (g.direct_user_a, g.direct_user_b)
      LIMIT 1`,
    [viewer.id, groupId],
  );
  const row = result.rows[0];
  return row ? buildDirectThread(viewer, row) : null;
}

export async function getOrCreateDirectThread(viewer: CommunityViewer, recipientUserId: string): Promise<DirectConversationResult> {
  const actorId = viewer.id?.trim() || "";
  const recipientId = recipientUserId.trim();
  if (!actorId || actorId === recipientId) return { ok: false, code: "direct_self_not_allowed" };
  const pair = [actorId, recipientId].sort();
  const pairKey = directPairKey(pair[0], pair[1]);
  const client = await getClient();
  let groupId = "";
  try {
    await client.query("BEGIN");
    const recipient = await client.query<DirectUserRow>(
      `SELECT id::text AS id, name, email, phone, role FROM users WHERE id::text = $1 AND status = 'active' LIMIT 1`,
      [recipientId],
    );
    if (!recipient.rows[0]) {
      await client.query("ROLLBACK");
      return { ok: false, code: "direct_recipient_not_found" };
    }

    const existing = await client.query<{ id: string }>(
      `SELECT id FROM community_groups WHERE conversation_kind = 'direct' AND direct_pair_key = $1 LIMIT 1`,
      [pairKey],
    );
    groupId = existing.rows[0]?.id || `community_direct_${randomUUID()}`;
    if (!existing.rows[0]) {
      const inserted = await client.query<{ id: string }>(
        `INSERT INTO community_groups (
          id, community_id, name, description, category, member_count, is_official, visibility,
          created_by, created_at, updated_at, last_message_at, pinned_message_id,
          conversation_kind, direct_pair_key, direct_user_a, direct_user_b
        ) VALUES ($1, 'watany-community', 'محادثة خاصة', NULL, 'general', 2, FALSE, 'private',
          $2, now(), now(), NULL, NULL, 'direct', $3, $4, $5)
        ON CONFLICT (direct_pair_key) WHERE conversation_kind = 'direct' DO NOTHING RETURNING id`,
        [groupId, actorId, pairKey, pair[0], pair[1]],
      );
      if (!inserted.rows[0]) {
        const raced = await client.query<{ id: string }>(
          `SELECT id FROM community_groups WHERE conversation_kind = 'direct' AND direct_pair_key = $1 LIMIT 1`,
          [pairKey],
        );
        groupId = raced.rows[0]?.id || groupId;
      }
    }

    for (const userId of pair) {
      await client.query(
        `INSERT INTO community_group_members (group_id, user_id, role, status, joined_at, added_by)
         VALUES ($1, $2, 'member', 'active', now(), $3)
         ON CONFLICT (group_id, user_id) DO UPDATE SET status = 'active', role = 'member'`,
        [groupId, userId, actorId],
      );
    }
    await client.query(`UPDATE community_groups SET member_count = 2, updated_at = now() WHERE id = $1`, [groupId]);
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }

  const thread = await loadDirectThread(viewer, groupId);
  return thread ? { ok: true, value: thread } : { ok: false, code: "direct_conversation_not_found" };
}
