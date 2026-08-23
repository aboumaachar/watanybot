/**
 * Plugin DB initialization — better-sqlite3 with in-memory fallback.
 * Extracted from server.ts.
 */
import fs from "node:fs";
import path from "node:path";
import type { PluginDb, PluginDbStatement } from "../types/domain";
import { SEED_MARKETPLACE, SEED_DOCUMENTS, SEED_NOTIFICATIONS } from "../data/seed-data";

function createInitialPluginStore() {
  return {
    profile: {
      id: "default",
      name: "Veteran User",
      phone: "",
      email: "",
      region: "",
      note: "",
      role: "public",
      is_authed: 0,
      last_login: null as number | null,
    },
    cases: [] as Array<Record<string, unknown>>,
    history: [] as Array<Record<string, unknown>>,
    jobApplications: [] as Array<Record<string, unknown>>,
    votingElections: [] as Array<Record<string, unknown>>,
    votingCandidates: [] as Array<Record<string, unknown>>,
    votingVotes: [] as Array<Record<string, unknown>>,
    documents: SEED_DOCUMENTS.map((doc) => ({
      id: doc.id,
      name: doc.name,
      kind: doc.kind,
      status: doc.status,
      updated_at: doc.updatedAt,
      tags: JSON.stringify(doc.tags || []),
      meta: null,
    })),
    notifications: SEED_NOTIFICATIONS.map((item) => ({
      id: item.id,
      title: item.title,
      body: item.body,
      kind: item.kind,
      ts: item.ts,
      read: item.read ? 1 : 0,
      user_id: null,
      ref_type: item.refType ?? null,
      ref_id: item.refId ?? null,
    })) as Array<Record<string, unknown>>,
    notificationPreferences: [] as Array<Record<string, unknown>>,
    notificationRoomMutes: [] as Array<Record<string, unknown>>,
    notificationPushDevices: [] as Array<Record<string, unknown>>,
    saved: [] as Array<Record<string, unknown>>,
    marketplace: SEED_MARKETPLACE.map((item) => ({
      id: item.id,
      title: item.title,
      price: item.price,
      currency: item.currency,
      location: item.location,
      seller: item.seller,
      contact: item.contact,
      description: item.description,
      category: item.category,
      status: item.status,
      created_at: item.createdAt,
    })),
    news: [] as Array<Record<string, unknown>>,
  };
}

let pluginStore = createInitialPluginStore();

function resetInMemoryPluginStore(): void {
  pluginStore = createInitialPluginStore();
}

// ─── In-memory handler groups ────────────────────────────────────────────────

function prepareInMemoryCasesStmt(n: string): PluginDbStatement | null {
  if (n.startsWith("select * from cases where id")) {
    return { all: () => [], get: (id: string) => pluginStore.cases.find((r) => r.id === id), run: () => ({ changes: 0 }) };
  }
  if (n.startsWith("select * from cases")) {
    return {
      all: () => [...pluginStore.cases].sort((a, b) => Number(b.created_at) - Number(a.created_at)),
      get: (id: string) => pluginStore.cases.find((r) => r.id === id),
      run: () => ({ changes: 0 }),
    };
  }
  if (n.startsWith("insert into cases")) {
    return {
      all: () => [], get: () => undefined,
      run: (...args: any[]) => {
        const [id, title, type, status, checklist, createdAt, updatedAt] = args;
        pluginStore.cases.unshift({ id, title, type, status, checklist, created_at: createdAt, updated_at: updatedAt });
        return { changes: 1, lastInsertRowid: id };
      },
    };
  }
  if (n.startsWith("update cases set")) {
    return {
      all: () => [], get: () => undefined,
      run: (...args: any[]) => {
        const [title, type, status, checklist, updatedAt, id] = args;
        const row = pluginStore.cases.find((item) => item.id === id);
        if (!row) return { changes: 0 };
        row.title = title; row.type = type; row.status = status; row.checklist = checklist; row.updated_at = updatedAt;
        return { changes: 1 };
      },
    };
  }
  return null;
}

function prepareInMemoryNewsStmt(n: string): PluginDbStatement | null {
  if (n.startsWith("select * from news_items where is_published = 1 and category =") || n.startsWith("select id, title, body, category, image_url, source_url, is_published, published_at, created_at, updated_at, created_by from news_items where is_published = 1 and category =")) {
    return {
      all: (category: string, limit: number) => [...pluginStore.news]
        .filter((row) => row.is_published === 1 && row.category === category)
        .sort((left, right) => Number(right.published_at) - Number(left.published_at))
        .slice(0, limit),
      get: () => undefined,
      run: () => ({ changes: 0 }),
    };
  }
  if (n.startsWith("select * from news_items where is_published = 1 order by") || n.startsWith("select id, title, body, category, image_url, source_url, is_published, published_at, created_at, updated_at, created_by from news_items where is_published = 1 order by")) {
    return {
      all: (limit: number) => [...pluginStore.news]
        .filter((row) => row.is_published === 1)
        .sort((left, right) => Number(right.published_at) - Number(left.published_at))
        .slice(0, limit),
      get: () => undefined,
      run: () => ({ changes: 0 }),
    };
  }
  if (n.startsWith("select * from news_items where id")) {
    return { all: () => [], get: (id: string) => pluginStore.news.find((row) => row.id === id), run: () => ({ changes: 0 }) };
  }
  if (n.startsWith("select * from news_items order by")) {
    return {
      all: () => [...pluginStore.news].sort((left, right) => Number(right.published_at) - Number(left.published_at)),
      get: () => undefined,
      run: () => ({ changes: 0 }),
    };
  }
  if (n.startsWith("insert into news_items")) {
    return {
      all: () => [],
      get: () => undefined,
      run: (...args: any[]) => {
        const row = args.length === 1 && typeof args[0] === "object"
          ? { ...(args[0] as Record<string, unknown>) }
          : {
              id: args[0], title: args[1], body: args[2], category: args[3], image_url: args[4], source_url: args[5],
              is_published: args[6], published_at: args[7], created_at: args[8], updated_at: args[9], created_by: args[10],
              status: args[11], archived_at: args[12],
            };
        row.status = row.status || (row.is_published === 1 ? "PUBLISHED" : "DRAFT");
        const existing = pluginStore.news.find((candidate) => candidate.id === row.id);
        if (existing) Object.assign(existing, row); else pluginStore.news.unshift(row);
        return { changes: 1, lastInsertRowid: row.id };
      },
    };
  }
  if (n.startsWith("update news_items set")) {
    return {
      all: () => [],
      get: () => undefined,
      run: (...args: any[]) => {
        const [title, body, category, imageUrl, sourceUrl, isPublished, publishedAt, updatedAt, status, archivedAt, id] = args;
        const row = pluginStore.news.find((candidate) => candidate.id === id);
        if (!row) return { changes: 0 };
        Object.assign(row, { title, body, category, image_url: imageUrl, source_url: sourceUrl, is_published: isPublished, published_at: publishedAt, updated_at: updatedAt, status, archived_at: archivedAt });
        return { changes: 1 };
      },
    };
  }
  if (n.startsWith("delete from news_items where id")) {
    return {
      all: () => [],
      get: () => undefined,
      run: (id: string) => {
        const before = pluginStore.news.length;
        pluginStore.news = pluginStore.news.filter((row) => row.id !== id);
        return { changes: before - pluginStore.news.length };
      },
    };
  }
  return null;
}

function prepareInMemoryProfileStmt(n: string): PluginDbStatement | null {
  if (n.startsWith("select * from profile") || n.startsWith("select role, is_authed from profile")) {
    return {
      all: () => [pluginStore.profile],
      get: (id: string) => (pluginStore.profile.id === id ? pluginStore.profile : undefined),
      run: () => ({ changes: 0 }),
    };
  }
  if (n.startsWith("insert into profile")) {
    return {
      all: () => [], get: () => undefined,
      run: (...args: any[]) => {
        const [id, name, phone, email, region, note, role, isAuthed, lastLogin] = args;
        pluginStore.profile = { id, name, phone, email, region, note, role, is_authed: isAuthed, last_login: lastLogin };
        return { changes: 1, lastInsertRowid: id };
      },
    };
  }
  if (n.startsWith("update profile set")) {
    return {
      all: () => [], get: () => undefined,
      run: (...args: any[]) => {
        const [name, phone, email, region, note, role, isAuthed, lastLogin, id] = args;
        if (pluginStore.profile.id !== id) return { changes: 0 };
        pluginStore.profile.name = name; pluginStore.profile.phone = phone; pluginStore.profile.email = email;
        pluginStore.profile.region = region; pluginStore.profile.note = note; pluginStore.profile.role = role;
        pluginStore.profile.is_authed = isAuthed; pluginStore.profile.last_login = lastLogin;
        return { changes: 1 };
      },
    };
  }
  return null;
}

function prepareInMemoryVotingStmt(n: string): PluginDbStatement | null {
  if (n.startsWith("select count(*) as count from voting_elections")) {
    return { all: () => [], get: () => ({ count: pluginStore.votingElections.length }), run: () => ({ changes: 0 }) };
  }
  if (n.startsWith("select count(*) as count from voting_candidates")) {
    return { all: () => [], get: () => ({ count: pluginStore.votingCandidates.length }), run: () => ({ changes: 0 }) };
  }
  if (n.startsWith("select * from voting_elections where id")) {
    return { all: () => [], get: (id: string) => pluginStore.votingElections.find((r) => r.id === id), run: () => ({ changes: 0 }) };
  }
  if (n.startsWith("select * from voting_elections")) {
    return {
      all: () => [...pluginStore.votingElections].sort((a, b) => Number(b.created_at) - Number(a.created_at)),
      get: (id: string) => pluginStore.votingElections.find((r) => r.id === id),
      run: () => ({ changes: 0 }),
    };
  }
  if (n.startsWith("insert or replace into voting_elections") || n.startsWith("insert into voting_elections")) {
    return {
      all: () => [], get: () => undefined,
      run: (...args: any[]) => {
        const [id, title, description, status, createdBy, startDate, endDate, createdAt, updatedAt] = args;
        const next = { id, title, description, status, created_by: createdBy, start_date: startDate, end_date: endDate, created_at: createdAt, updated_at: updatedAt };
        const existing = pluginStore.votingElections.find((r) => r.id === id);
        if (existing) { Object.assign(existing, next); } else { pluginStore.votingElections.unshift(next); }
        return { changes: 1, lastInsertRowid: id };
      },
    };
  }
  if (n.startsWith("delete from voting_elections where id")) {
    return {
      all: () => [], get: () => undefined,
      run: (...args: any[]) => {
        const [id] = args;
        const before = pluginStore.votingElections.length;
        pluginStore.votingElections = pluginStore.votingElections.filter((r) => r.id !== id);
        return { changes: before - pluginStore.votingElections.length };
      },
    };
  }
  if (n.startsWith("select * from voting_candidates where election_id")) {
    return {
      all: (electionId: string) => [...pluginStore.votingCandidates].filter((r) => r.election_id === electionId).sort((a, b) => String(a.name).localeCompare(String(b.name))),
      get: () => undefined,
      run: () => ({ changes: 0 }),
    };
  }
  if (n.startsWith("select * from voting_candidates")) {
    return { all: () => [...pluginStore.votingCandidates], get: (id: string) => pluginStore.votingCandidates.find((r) => r.id === id), run: () => ({ changes: 0 }) };
  }
  if (n.startsWith("insert or replace into voting_candidates") || n.startsWith("insert into voting_candidates")) {
    return {
      all: () => [], get: () => undefined,
      run: (...args: any[]) => {
        const [id, electionId, name, description, imageUrl, createdAt] = args;
        const next = { id, election_id: electionId, name, description, image_url: imageUrl, created_at: createdAt };
        const existing = pluginStore.votingCandidates.find((r) => r.id === id);
        if (existing) { Object.assign(existing, next); } else { pluginStore.votingCandidates.push(next); }
        return { changes: 1, lastInsertRowid: id };
      },
    };
  }
  if (n.startsWith("delete from voting_candidates where election_id")) {
    return {
      all: () => [], get: () => undefined,
      run: (...args: any[]) => {
        const [electionId] = args;
        const before = pluginStore.votingCandidates.length;
        pluginStore.votingCandidates = pluginStore.votingCandidates.filter((r) => r.election_id !== electionId);
        return { changes: before - pluginStore.votingCandidates.length };
      },
    };
  }
  if (n.startsWith("delete from voting_candidates where id")) {
    return {
      all: () => [], get: () => undefined,
      run: (...args: any[]) => {
        const [id] = args;
        const before = pluginStore.votingCandidates.length;
        pluginStore.votingCandidates = pluginStore.votingCandidates.filter((r) => r.id !== id);
        return { changes: before - pluginStore.votingCandidates.length };
      },
    };
  }
  if (n.startsWith("select * from voting_votes")) {
    return {
      all: () => [...pluginStore.votingVotes].sort((a, b) => Number(a.created_at) - Number(b.created_at)),
      get: (id: string) => pluginStore.votingVotes.find((r) => r.id === id),
      run: () => ({ changes: 0 }),
    };
  }
  if (n.startsWith("insert or ignore into voting_votes") || n.startsWith("insert into voting_votes")) {
    return {
      all: () => [], get: () => undefined,
      run: (...args: any[]) => {
        const [id, electionId, candidateId, voterId, createdAt] = args;
        const existing = pluginStore.votingVotes.find((r) => r.election_id === electionId && r.voter_id === voterId);
        if (existing) return { changes: 0, lastInsertRowid: existing.id as string };
        pluginStore.votingVotes.push({ id, election_id: electionId, candidate_id: candidateId, voter_id: voterId, created_at: createdAt });
        return { changes: 1, lastInsertRowid: id };
      },
    };
  }
  if (n.startsWith("delete from voting_votes where election_id")) {
    return {
      all: () => [], get: () => undefined,
      run: (...args: any[]) => {
        const [electionId] = args;
        const before = pluginStore.votingVotes.length;
        pluginStore.votingVotes = pluginStore.votingVotes.filter((r) => r.election_id !== electionId);
        return { changes: before - pluginStore.votingVotes.length };
      },
    };
  }
  return null;
}

function prepareInMemoryDocumentsStmt(n: string): PluginDbStatement | null {
  if (n.startsWith("select * from documents")) {
    return {
      all: () => [...pluginStore.documents].sort((a, b) => Number(b.updated_at) - Number(a.updated_at)),
      get: (id: string) => pluginStore.documents.find((r) => r.id === id),
      run: () => ({ changes: 0 }),
    };
  }
  if (n.startsWith("insert into documents")) {
    return {
      all: () => [], get: () => undefined,
      run: (...args: any[]) => {
        const [id, name, kind, status, updatedAt, tags, meta] = args;
        pluginStore.documents.unshift({ id, name, kind, status, updated_at: updatedAt, tags, meta });
        return { changes: 1, lastInsertRowid: id };
      },
    };
  }
  if (n.startsWith("update documents set")) {
    return {
      all: () => [], get: () => undefined,
      run: (...args: any[]) => {
        const [name, kind, status, updatedAt, tags, meta, id] = args;
        const row = pluginStore.documents.find((item) => item.id === id);
        if (!row) return { changes: 0 };
        row.name = name; row.kind = kind; row.status = status; row.updated_at = updatedAt; row.tags = tags; row.meta = meta;
        return { changes: 1 };
      },
    };
  }
  return null;
}

function prepareInMemoryNotificationsStmt(n: string): PluginDbStatement | null {
  if (n.startsWith("select * from notifications")) {
    return {
      all: (userId?: string) => [...pluginStore.notifications]
        .filter((item) => !userId || item.user_id == null || item.user_id === userId)
        .sort((a, b) => Number(b.ts) - Number(a.ts)),
      get: (...args: any[]) => {
        const [id, userId] = args;
        return pluginStore.notifications.find((item) => {
          if (item.id !== id) {
            return false;
          }

          if (!userId) {
            return true;
          }

          return item.user_id == null || item.user_id === userId;
        });
      },
      run: () => ({ changes: 0 }),
    };
  }
  if (n.startsWith("insert or ignore into notifications") || n.startsWith("insert into notifications")) {
    return {
      all: () => [],
      get: () => undefined,
      run: (...args: any[]) => {
        const [id, title, body, kind, ts, read, userId, refType, refId] = args;
        const existing = pluginStore.notifications.find((item) => item.id === id);
        if (existing) {
          return { changes: 0, lastInsertRowid: id };
        }

        pluginStore.notifications.unshift({
          id,
          title,
          body,
          kind,
          ts,
          read,
          user_id: userId ?? null,
          ref_type: refType ?? null,
          ref_id: refId ?? null,
        });
        return { changes: 1, lastInsertRowid: id };
      },
    };
  }
  if (n.startsWith("update notifications set read = 1")) {
    return {
      all: () => [], get: () => undefined,
      run: (userId?: string) => {
        pluginStore.notifications = pluginStore.notifications.map((item) => {
          if (!userId || item.user_id == null || item.user_id === userId) {
            return { ...item, read: 1 };
          }

          return item;
        });
        return { changes: 1 };
      },
    };
  }
  if (n.startsWith("update notifications set read")) {
    return {
      all: () => [], get: () => undefined,
      run: (...args: any[]) => {
        const [read, id, userId] = args;
        const row = pluginStore.notifications.find((item) => item.id === id && (!userId || item.user_id == null || item.user_id === userId));
        if (!row) return { changes: 0 };
        row.read = read;
        return { changes: 1 };
      },
    };
  }
  return null;
}

function prepareInMemoryNotificationAuthorityStmt(n: string): PluginDbStatement | null {
  if (n.startsWith("select * from notification_preferences where user_id =")) {
    return {
      all: (userId: string) => pluginStore.notificationPreferences.filter((item) => item.user_id === userId),
      get: (userId: string) => pluginStore.notificationPreferences.find((item) => item.user_id === userId),
      run: () => ({ changes: 0 }),
    };
  }
  if (n.startsWith("insert into notification_preferences")) {
    return {
      all: () => [],
      get: () => undefined,
      run: (...args: any[]) => {
        const [
          userId,
          replyEnabled,
          mentionEnabled,
          pushEnabled,
          previewMode,
          quietHoursEnabled,
          quietHoursStart,
          quietHoursEnd,
          timezone,
          updatedAt,
        ] = args;
        const existing = pluginStore.notificationPreferences.find((item) => item.user_id === userId);
        if (existing) {
          existing.reply_enabled = replyEnabled;
          existing.mention_enabled = mentionEnabled;
          existing.push_enabled = pushEnabled;
          existing.preview_mode = previewMode;
          existing.quiet_hours_enabled = quietHoursEnabled;
          existing.quiet_hours_start = quietHoursStart;
          existing.quiet_hours_end = quietHoursEnd;
          existing.timezone = timezone;
          existing.updated_at = updatedAt;
          return { changes: 1, lastInsertRowid: userId };
        }

        pluginStore.notificationPreferences.unshift({
          user_id: userId,
          reply_enabled: replyEnabled,
          mention_enabled: mentionEnabled,
          push_enabled: pushEnabled,
          preview_mode: previewMode,
          quiet_hours_enabled: quietHoursEnabled,
          quiet_hours_start: quietHoursStart,
          quiet_hours_end: quietHoursEnd,
          timezone: timezone,
          updated_at: updatedAt,
        });
        return { changes: 1, lastInsertRowid: userId };
      },
    };
  }
  if (n.startsWith("select * from notification_room_mutes where user_id =")) {
    return {
      all: (userId: string) => [...pluginStore.notificationRoomMutes]
        .filter((item) => item.user_id === userId)
        .sort((left, right) => Number(right.updated_at) - Number(left.updated_at)),
      get: (userId: string, roomId?: string) => {
        if (!roomId) {
          return pluginStore.notificationRoomMutes.find((item) => item.user_id === userId);
        }

        return pluginStore.notificationRoomMutes.find((item) => item.user_id === userId && item.room_id === roomId);
      },
      run: () => ({ changes: 0 }),
    };
  }
  if (n.startsWith("insert into notification_room_mutes")) {
    return {
      all: () => [],
      get: () => undefined,
      run: (...args: any[]) => {
        const [userId, roomId, muteUntil, isIndefinite, updatedAt] = args;
        const existing = pluginStore.notificationRoomMutes.find((item) => item.user_id === userId && item.room_id === roomId);
        if (existing) {
          existing.mute_until = muteUntil;
          existing.is_indefinite = isIndefinite;
          existing.updated_at = updatedAt;
          return { changes: 1, lastInsertRowid: `${userId}:${roomId}` };
        }

        pluginStore.notificationRoomMutes.unshift({
          user_id: userId,
          room_id: roomId,
          mute_until: muteUntil,
          is_indefinite: isIndefinite,
          updated_at: updatedAt,
        });
        return { changes: 1, lastInsertRowid: `${userId}:${roomId}` };
      },
    };
  }
  if (n.startsWith("delete from notification_room_mutes where user_id =")) {
    return {
      all: () => [],
      get: () => undefined,
      run: (userId: string, roomId: string) => {
        const before = pluginStore.notificationRoomMutes.length;
        pluginStore.notificationRoomMutes = pluginStore.notificationRoomMutes.filter((item) => !(item.user_id === userId && item.room_id === roomId));
        return { changes: before === pluginStore.notificationRoomMutes.length ? 0 : 1 };
      },
    };
  }
  if (n.startsWith("select * from notification_push_devices where user_id =")) {
    return {
      all: (userId: string) => [...pluginStore.notificationPushDevices]
        .filter((item) => item.user_id === userId)
        .sort((left, right) => Number(left.created_at) - Number(right.created_at)),
      get: (...args: any[]) => {
        const [userId, secondArg] = args;
        if (secondArg === undefined) {
          return pluginStore.notificationPushDevices.find((item) => item.user_id === userId);
        }

        return pluginStore.notificationPushDevices.find((item) => item.user_id === userId && item.endpoint === secondArg);
      },
      run: () => ({ changes: 0 }),
    };
  }
  if (n.startsWith("insert into notification_push_devices")) {
    return {
      all: () => [],
      get: () => undefined,
      run: (...args: any[]) => {
        const [
          id,
          userId,
          provider,
          endpoint,
          label,
          lastDeliveryStatus,
          lastDeliveryError,
          lastDeliveredAt,
          retryCount,
          subscriptionJson,
          createdAt,
          updatedAt,
        ] = args;
        const existing = pluginStore.notificationPushDevices.find((item) => item.user_id === userId && item.endpoint === endpoint);
        if (existing) {
          existing.provider = provider;
          existing.label = label;
          existing.subscription_json = subscriptionJson;
          existing.updated_at = updatedAt;
          return { changes: 1, lastInsertRowid: existing.id as string };
        }

        pluginStore.notificationPushDevices.unshift({
          id,
          user_id: userId,
          provider,
          endpoint,
          label,
          last_delivery_status: lastDeliveryStatus,
          last_delivery_error: lastDeliveryError,
          last_delivered_at: lastDeliveredAt,
          retry_count: retryCount,
          subscription_json: subscriptionJson,
          created_at: createdAt,
          updated_at: updatedAt,
        });
        return { changes: 1, lastInsertRowid: id };
      },
    };
  }
  if (n.startsWith("update notification_push_devices set last_delivery_status =")) {
    return {
      all: () => [],
      get: () => undefined,
      run: (...args: any[]) => {
        const [lastDeliveryStatus, lastDeliveryError, lastDeliveredAt, retryCount, updatedAt, id, userId] = args;
        const row = pluginStore.notificationPushDevices.find((item) => item.id === id && item.user_id === userId);
        if (!row) {
          return { changes: 0 };
        }

        row.last_delivery_status = lastDeliveryStatus;
        row.last_delivery_error = lastDeliveryError;
        row.last_delivered_at = lastDeliveredAt;
        row.retry_count = retryCount;
        row.updated_at = updatedAt;
        return { changes: 1 };
      },
    };
  }
  if (n.startsWith("delete from notification_push_devices where id =")) {
    return {
      all: () => [],
      get: () => undefined,
      run: (id: string, userId: string) => {
        const before = pluginStore.notificationPushDevices.length;
        pluginStore.notificationPushDevices = pluginStore.notificationPushDevices.filter((item) => !(item.id === id && item.user_id === userId));
        return { changes: before === pluginStore.notificationPushDevices.length ? 0 : 1 };
      },
    };
  }
  return null;
}

function prepareInMemorySavedChatsStmt(n: string): PluginDbStatement | null {
  if (n.startsWith("select * from saved_chats")) {
    return {
      all: (userId: string) => [...pluginStore.saved].filter((r) => r.user_id === userId).sort((a, b) => Number(b.updated_at ?? b.ts) - Number(a.updated_at ?? a.ts)),
      get: (...args: any[]) => {
        if (args.length >= 2) {
          const [id, userId] = args;
          return pluginStore.saved.find((r) => r.id === id && r.user_id === userId);
        }
        const [id] = args;
        return pluginStore.saved.find((r) => r.id === id);
      },
      run: () => ({ changes: 0 }),
    };
  }
  if (n.startsWith("insert into saved_chats")) {
    return {
      all: () => [], get: () => undefined,
      run: (...args: any[]) => {
        const [id, userId, text, ts, status, updatedAt, closedAt, archivedAt, deletedForMeAt] = args;
        pluginStore.saved.unshift({ id, user_id: userId, text, ts, status, updated_at: updatedAt, closed_at: closedAt, archived_at: archivedAt, deleted_for_me_at: deletedForMeAt });
        return { changes: 1, lastInsertRowid: id };
      },
    };
  }
  if (n.startsWith("update saved_chats set")) {
    return {
      all: () => [], get: () => undefined,
      run: (...args: any[]) => {
        const [text, status, updatedAt, closedAt, archivedAt, deletedForMeAt, id, userId] = args;
        const row = pluginStore.saved.find((item) => item.id === id && item.user_id === userId);
        if (!row) return { changes: 0 };
        row.text = text; row.status = status; row.updated_at = updatedAt; row.closed_at = closedAt; row.archived_at = archivedAt; row.deleted_for_me_at = deletedForMeAt;
        return { changes: 1 };
      },
    };
  }
  if (n.startsWith("delete from saved_chats")) {
    return {
      all: () => [], get: () => undefined,
      run: (...args: any[]) => {
        const [id, userId] = args;
        const before = pluginStore.saved.length;
        pluginStore.saved = pluginStore.saved.filter((r) => r.id !== id || r.user_id !== userId);
        return { changes: before - pluginStore.saved.length };
      },
    };
  }
  return null;
}

function prepareInMemoryChatHistoryStmt(n: string): PluginDbStatement | null {
  if (n.startsWith("select * from chat_history")) {
    return {
      all: (limit: number) => [...pluginStore.history].sort((a, b) => Number(b.ts) - Number(a.ts)).slice(0, limit),
      get: () => undefined,
      run: () => ({ changes: 0 }),
    };
  }
  if (n.startsWith("insert or replace into chat_history")) {
    return {
      all: () => [], get: () => undefined,
      run: (...args: any[]) => {
        const [id, role, ts, text, citations, intents, attachments, meta] = args;
        const existing = pluginStore.history.find((r) => r.id === id);
        const next = { id, role, ts, text, citations, intents, attachments, meta };
        if (existing) { Object.assign(existing, next); } else { pluginStore.history.unshift(next); }
        return { changes: 1, lastInsertRowid: id };
      },
    };
  }
  return null;
}

function prepareInMemoryJobsStmt(n: string): PluginDbStatement | null {
  if (n.startsWith("insert into job_applications")) {
    return {
      all: () => [], get: () => undefined,
      run: (...args: any[]) => {
        const [id, jobId, name, phone, email, note, createdAt] = args;
        pluginStore.jobApplications.unshift({ id, job_id: jobId, name, phone, email, note, created_at: createdAt });
        return { changes: 1, lastInsertRowid: id };
      },
    };
  }
  if (n.startsWith("select id, job_id")) {
    return {
      all: () => [...pluginStore.jobApplications].sort((a, b) => Number(b.created_at) - Number(a.created_at)).slice(0, 5),
      get: () => undefined,
      run: () => ({ changes: 0 }),
    };
  }
  if (n.startsWith("select count(*) as count from job_applications")) {
    return { all: () => [], get: () => ({ count: pluginStore.jobApplications.length }), run: () => ({ changes: 0 }) };
  }
  return null;
}

function prepareInMemoryMarketplaceStmt(n: string): PluginDbStatement | null {
  if (n.startsWith("select * from marketplace_listings")) {
    return {
      all: () => [...pluginStore.marketplace].sort((a, b) => Number(b.created_at) - Number(a.created_at)),
      get: () => undefined,
      run: () => ({ changes: 0 }),
    };
  }
  if (n.startsWith("insert into marketplace_listings")) {
    return {
      all: () => [], get: () => undefined,
      run: (...args: any[]) => {
        const [id, title, price, currency, location, seller, contact, description, category, status, createdAt] = args;
        pluginStore.marketplace.unshift({ id, title, price, currency, location, seller, contact, description, category, status, created_at: createdAt });
        return { changes: 1, lastInsertRowid: id };
      },
    };
  }
  if (n.startsWith("select id from marketplace_listings")) {
    return { all: () => [], get: (id: string) => pluginStore.marketplace.find((r) => r.id === id), run: () => ({ changes: 0 }) };
  }
  if (n.startsWith("select id, title, location")) {
    return {
      all: () => [...pluginStore.marketplace].sort((a, b) => Number(b.created_at) - Number(a.created_at)).slice(0, 5),
      get: () => undefined,
      run: () => ({ changes: 0 }),
    };
  }
  if (n.startsWith("select count(*) as count from marketplace_listings")) {
    return { all: () => [], get: () => ({ count: pluginStore.marketplace.length }), run: () => ({ changes: 0 }) };
  }
  return null;
}

function createInMemoryPluginDb(): PluginDb {
  const prepare = (sql: string): PluginDbStatement => {
    const n = sql.replace(/\s+/g, " ").trim().toLowerCase();
    return (
      prepareInMemoryCasesStmt(n) ??
      prepareInMemoryNewsStmt(n) ??
      prepareInMemoryProfileStmt(n) ??
      prepareInMemoryVotingStmt(n) ??
      prepareInMemoryDocumentsStmt(n) ??
      prepareInMemoryNotificationAuthorityStmt(n) ??
      prepareInMemoryNotificationsStmt(n) ??
      prepareInMemorySavedChatsStmt(n) ??
      prepareInMemoryChatHistoryStmt(n) ??
      prepareInMemoryJobsStmt(n) ??
      prepareInMemoryMarketplaceStmt(n) ??
      { all: () => [], get: () => undefined, run: () => ({ changes: 0 }) }
    );
  };
  return { prepare };
}

function setupPluginDbSchema(db: any): void {
  db.exec(`CREATE TABLE IF NOT EXISTS chat_history (id TEXT PRIMARY KEY, role TEXT NOT NULL, ts INTEGER NOT NULL, text TEXT NOT NULL, citations TEXT, intents TEXT, attachments TEXT, meta TEXT)`);
  db.exec(`CREATE TABLE IF NOT EXISTS cases (id TEXT PRIMARY KEY, title TEXT NOT NULL, type TEXT NOT NULL, status TEXT NOT NULL, checklist TEXT NOT NULL, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL)`);
  db.exec(`CREATE TABLE IF NOT EXISTS profile (id TEXT PRIMARY KEY, name TEXT, phone TEXT, email TEXT, region TEXT, note TEXT, is_authed INTEGER NOT NULL, last_login INTEGER)`);
  db.exec(`CREATE TABLE IF NOT EXISTS voting_elections (id TEXT PRIMARY KEY, title TEXT NOT NULL, description TEXT, status TEXT NOT NULL, created_by TEXT NOT NULL, start_date TEXT, end_date TEXT, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL)`);
  db.exec(`CREATE TABLE IF NOT EXISTS voting_candidates (id TEXT PRIMARY KEY, election_id TEXT NOT NULL, name TEXT NOT NULL, description TEXT, image_url TEXT, created_at INTEGER NOT NULL)`);
  db.exec(`CREATE TABLE IF NOT EXISTS voting_votes (id TEXT PRIMARY KEY, election_id TEXT NOT NULL, candidate_id TEXT NOT NULL, voter_id TEXT NOT NULL, created_at INTEGER NOT NULL, UNIQUE(election_id, voter_id))`);
  db.exec(`CREATE TABLE IF NOT EXISTS documents (id TEXT PRIMARY KEY, name TEXT NOT NULL, kind TEXT NOT NULL, status TEXT NOT NULL, updated_at INTEGER NOT NULL, tags TEXT, meta TEXT)`);
  db.exec(`CREATE TABLE IF NOT EXISTS notifications (id TEXT PRIMARY KEY, title TEXT NOT NULL, body TEXT NOT NULL, kind TEXT NOT NULL, ts INTEGER NOT NULL, read INTEGER NOT NULL)`);
  db.exec(`CREATE TABLE IF NOT EXISTS notification_preferences (user_id TEXT PRIMARY KEY, reply_enabled INTEGER NOT NULL DEFAULT 1, mention_enabled INTEGER NOT NULL DEFAULT 1, push_enabled INTEGER NOT NULL DEFAULT 0, preview_mode TEXT NOT NULL DEFAULT 'safe', quiet_hours_enabled INTEGER NOT NULL DEFAULT 0, quiet_hours_start TEXT NOT NULL DEFAULT '22:00', quiet_hours_end TEXT NOT NULL DEFAULT '07:00', timezone TEXT NOT NULL DEFAULT 'Asia/Beirut', updated_at INTEGER NOT NULL)`);
  db.exec(`CREATE TABLE IF NOT EXISTS notification_room_mutes (user_id TEXT NOT NULL, room_id TEXT NOT NULL, mute_until INTEGER, is_indefinite INTEGER NOT NULL DEFAULT 0, updated_at INTEGER NOT NULL, PRIMARY KEY (user_id, room_id))`);
  db.exec(`CREATE TABLE IF NOT EXISTS notification_push_devices (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, provider TEXT NOT NULL, endpoint TEXT NOT NULL, label TEXT, last_delivery_status TEXT NOT NULL DEFAULT 'idle', last_delivery_error TEXT, last_delivered_at INTEGER, retry_count INTEGER NOT NULL DEFAULT 0, subscription_json TEXT, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL, UNIQUE(user_id, endpoint))`);
  db.exec(`CREATE TABLE IF NOT EXISTS saved_chats (id TEXT PRIMARY KEY, user_id TEXT, text TEXT NOT NULL, ts INTEGER NOT NULL, status TEXT NOT NULL DEFAULT 'active', updated_at INTEGER, closed_at INTEGER, archived_at INTEGER, deleted_for_me_at INTEGER)`);
  db.exec(`CREATE TABLE IF NOT EXISTS job_applications (id TEXT PRIMARY KEY, job_id TEXT NOT NULL, name TEXT NOT NULL, phone TEXT NOT NULL, email TEXT, note TEXT, created_at INTEGER NOT NULL)`);
  db.exec(`CREATE TABLE IF NOT EXISTS marketplace_listings (id TEXT PRIMARY KEY, title TEXT NOT NULL, price REAL NOT NULL, currency TEXT NOT NULL, location TEXT NOT NULL, seller TEXT NOT NULL, contact TEXT NOT NULL, description TEXT, category TEXT, status TEXT NOT NULL, created_at INTEGER NOT NULL)`);
  db.exec(`CREATE TABLE IF NOT EXISTS chat_sessions (id TEXT PRIMARY KEY, status TEXT NOT NULL, messages TEXT NOT NULL, note TEXT, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL)`);
  db.exec(`CREATE TABLE IF NOT EXISTS ticker_items (id TEXT PRIMARY KEY, type TEXT NOT NULL, title TEXT NOT NULL, body TEXT, link_type TEXT, link_id TEXT, priority INTEGER NOT NULL DEFAULT 50, starts_at INTEGER, ends_at INTEGER, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL, created_by TEXT)`);
  db.exec(`CREATE TABLE IF NOT EXISTS news_items (id TEXT PRIMARY KEY, title TEXT NOT NULL, body TEXT, category TEXT, image_url TEXT, source_url TEXT, is_published INTEGER NOT NULL DEFAULT 1, published_at INTEGER NOT NULL, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL, created_by TEXT, status TEXT NOT NULL DEFAULT 'PUBLISHED', archived_at INTEGER)`);
  db.exec(`CREATE TABLE IF NOT EXISTS fake_news_items (id TEXT PRIMARY KEY, title TEXT NOT NULL, summary TEXT, category TEXT, status TEXT, image_url TEXT, source_url TEXT NOT NULL, published_at INTEGER NOT NULL, verified_at INTEGER, source_name TEXT NOT NULL, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL)`);
  db.exec(`CREATE TABLE IF NOT EXISTS analytics_events (id TEXT PRIMARY KEY, user_id TEXT, event_type TEXT NOT NULL, intent TEXT, text_hash TEXT, event_text TEXT, created_at INTEGER NOT NULL)`);
}

function applyPluginDbMigrations(db: any): void {
  try { db.exec("ALTER TABLE notifications ADD COLUMN user_id TEXT"); } catch {}
  try { db.exec("ALTER TABLE notifications ADD COLUMN ref_type TEXT"); } catch {}
  try { db.exec("ALTER TABLE notifications ADD COLUMN ref_id TEXT"); } catch {}
  try { db.exec("ALTER TABLE saved_chats ADD COLUMN user_id TEXT"); } catch {}
  try { db.exec("ALTER TABLE saved_chats ADD COLUMN status TEXT NOT NULL DEFAULT 'active'"); } catch {}
  try { db.exec("ALTER TABLE saved_chats ADD COLUMN updated_at INTEGER"); } catch {}
  try { db.exec("ALTER TABLE saved_chats ADD COLUMN closed_at INTEGER"); } catch {}
  try { db.exec("ALTER TABLE saved_chats ADD COLUMN archived_at INTEGER"); } catch {}
  try { db.exec("ALTER TABLE saved_chats ADD COLUMN deleted_for_me_at INTEGER"); } catch {}
  try { db.exec("ALTER TABLE documents ADD COLUMN meta TEXT"); } catch {}
  try { db.exec("ALTER TABLE profile ADD COLUMN role TEXT NOT NULL DEFAULT 'public'"); } catch {}
  try { db.exec("ALTER TABLE notification_push_devices ADD COLUMN subscription_json TEXT"); } catch {}
  try { db.exec("ALTER TABLE news_items ADD COLUMN status TEXT NOT NULL DEFAULT 'PUBLISHED'"); } catch {}
  try { db.exec("ALTER TABLE news_items ADD COLUMN archived_at INTEGER"); } catch {}
  try { db.exec("UPDATE news_items SET status = CASE WHEN is_published = 1 THEN 'PUBLISHED' ELSE 'DRAFT' END WHERE status = 'PUBLISHED'"); } catch {}
}

function seedPluginDbDefaults(db: any): void {
  const profileCount = db.prepare("SELECT COUNT(*) as count FROM profile").get() as { count: number };
  if (profileCount.count === 0) {
    db.prepare("INSERT INTO profile (id, name, phone, email, region, note, is_authed, last_login) VALUES (?, ?, ?, ?, ?, ?, ?, ?)").run("default", "Veteran User", "", "", "", "", 0, null);
  }
  const docsCount = db.prepare("SELECT COUNT(*) as count FROM documents").get() as { count: number };
  if (docsCount.count === 0) {
    const insertDoc = db.prepare("INSERT INTO documents (id, name, kind, status, updated_at, tags) VALUES (?, ?, ?, ?, ?, ?)");
    for (const item of SEED_DOCUMENTS) {
      insertDoc.run(item.id, item.name, item.kind, item.status, item.updatedAt, JSON.stringify(item.tags || []));
    }
  }
  const notifCount = db.prepare("SELECT COUNT(*) as count FROM notifications").get() as { count: number };
  if (notifCount.count === 0) {
    const insertNotif = db.prepare("INSERT INTO notifications (id, title, body, kind, ts, read) VALUES (?, ?, ?, ?, ?, ?)");
    for (const item of SEED_NOTIFICATIONS) {
      insertNotif.run(item.id, item.title, item.body, item.kind, item.ts, item.read ? 1 : 0);
    }
  }
  const mktCount = db.prepare("SELECT COUNT(*) as count FROM marketplace_listings").get() as { count: number };
  if (mktCount.count === 0) {
    const insertMkt = db.prepare(`INSERT INTO marketplace_listings (id, title, price, currency, location, seller, contact, description, category, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
    for (const item of SEED_MARKETPLACE) {
      insertMkt.run(item.id, item.title, item.price, item.currency, item.location, item.seller, item.contact, item.description, item.category, item.status, item.createdAt);
    }
  }
}

export async function initPluginDb(
  dbPath: string,
  disablePluginDb: boolean,
  logger: { info: Function; warn: Function },
): Promise<PluginDb> {
  if (disablePluginDb) {
    logger.warn("Plugin DB disabled; using in-memory store.");
    resetInMemoryPluginStore();
    return createInMemoryPluginDb();
  }
  try {
    const BetterSqlite3 = (await import("better-sqlite3")).default;
    const dir = path.dirname(dbPath);
    if (dir && dir !== ".") fs.mkdirSync(dir, { recursive: true });
    const db = new BetterSqlite3(dbPath);
    db.pragma("journal_mode = WAL");
    db.pragma("busy_timeout = 5000");
    setupPluginDbSchema(db);
    applyPluginDbMigrations(db);
    seedPluginDbDefaults(db);
    logger.info({ dbPath }, "Plugin DB initialized with better-sqlite3 (persistent, WAL mode)");
    return {
      prepare: (sql: string) => {
        const stmt = db.prepare(sql);
        return {
          all: (...args: any[]) => stmt.all(...args),
          get: (...args: any[]) => stmt.get(...args),
          run: (...args: any[]) => {
            const info = stmt.run(...args);
            return { changes: info.changes, lastInsertRowid: info.lastInsertRowid };
          },
        };
      },
    } as PluginDb;
  } catch (err) {
    logger.warn({ err }, "Plugin DB (better-sqlite3) unavailable; falling back to in-memory store.");
    resetInMemoryPluginStore();
    return createInMemoryPluginDb();
  }
}
