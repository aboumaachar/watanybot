import { useCallback, useEffect, useMemo, useState } from "react";
import type { UserProfile } from "@watany/types";

export type MailContactRole = "user" | "admin" | "support" | "moderator";

export type MailContact = {
  id: string;
  label: string;
  username: string;
  phone?: string;
  role: MailContactRole;
  accent: string;
};

export type InternalMailThread = {
  id: string;
  participantIds: [string, string];
  subject: string;
  updatedAt: string;
};

export type InternalMailMessage = {
  id: string;
  threadId: string;
  fromId: string;
  toId: string;
  body: string;
  createdAt: string;
  readBy: string[];
  mentions: string[];
};

type InternalMailState = {
  contacts: MailContact[];
  threads: InternalMailThread[];
  messages: InternalMailMessage[];
};

export type InternalMailThreadView = InternalMailThread & {
  recipient: MailContact;
  messages: InternalMailMessage[];
  unreadCount: number;
  lastMessage: InternalMailMessage | null;
};

const STORAGE_KEY_PREFIX = "watany_internal_mail_v2";
const LEGACY_STORAGE_KEY = "watany_internal_mail_v1";
const UPDATE_EVENT = "watany-internal-mail-updated";

const DEFAULT_CONTACTS: MailContact[] = [
  { id: "contact:admin", label: "إدارة موطني", username: "admin", phone: "+96170000001", role: "admin", accent: "#0f766e" },
  { id: "contact:support", label: "الدعم", username: "support", phone: "+96170000002", role: "support", accent: "#2563eb" },
  { id: "contact:moderator", label: "المشرف سامر", username: "samer", phone: "+96170000003", role: "moderator", accent: "#7c3aed" },
  { id: "contact:finance", label: "الوحدة المالية", username: "finance", phone: "+96170000004", role: "support", accent: "#b45309" },
];

function normalizePhone(value?: string) {
  return (value || "").replace(/\D/g, "");
}

function normalizeToken(value: string) {
  return value.trim().toLowerCase();
}

function deriveCurrentContact(profile: UserProfile): MailContact {
  const emailLocalPart = profile.email?.split("@")[0]?.trim();
  const phoneDigits = normalizePhone(profile.phone);
  const username = emailLocalPart || phoneDigits || normalizeToken(profile.name || "user").replace(/\s+/g, ".");
  const stableKey = profile.email || phoneDigits || profile.name || "guest";

  return {
    id: `contact:self:${stableKey}`,
    label: profile.name || "مستخدم موطني",
    username,
    phone: profile.phone,
    role: "user",
    accent: "#0f766e",
  };
}

function ensureUniqueContacts(contacts: MailContact[]) {
  const seen = new Map<string, MailContact>();
  contacts.forEach((contact) => {
    seen.set(contact.id, contact);
  });
  return Array.from(seen.values());
}

function buildThreadId(leftId: string, rightId: string) {
  return [leftId, rightId].sort().join("__");
}

function defaultSubject(recipient: MailContact) {
  return `مراسلة ${recipient.label}`;
}

function buildWelcomeThread(currentUser: MailContact): InternalMailState {
  const admin = DEFAULT_CONTACTS[0];
  const threadId = buildThreadId(currentUser.id, admin.id);
  const createdAt = new Date().toISOString();

  return {
    contacts: ensureUniqueContacts([currentUser, ...DEFAULT_CONTACTS]),
    threads: [{
      id: threadId,
      participantIds: [currentUser.id, admin.id],
      subject: "ترحيب من الإدارة",
      updatedAt: createdAt,
    }],
    messages: [{
      id: `mail_${Date.now()}`,
      threadId,
      fromId: admin.id,
      toId: currentUser.id,
      body: `مرحباً ${currentUser.label}. يمكنك مراسلة الإدارة أو أي مستخدم داخل موطني عبر كتابة @اسم_المستخدم أو @رقم_الهاتف داخل الرسالة.`,
      createdAt,
      readBy: [admin.id],
      mentions: [],
    }],
  };
}

function storageKeyForUser(currentUser: MailContact) {
  return `${STORAGE_KEY_PREFIX}:${encodeURIComponent(currentUser.id)}`;
}

function canUseLegacyStateForUser(currentUser: MailContact, state: Partial<InternalMailState>) {
  const threads = Array.isArray(state.threads) ? state.threads : [];
  return threads.some((thread) => Array.isArray(thread.participantIds) && thread.participantIds.includes(currentUser.id));
}

function readState(currentUser: MailContact): InternalMailState {
  try {
    const userStorageKey = storageKeyForUser(currentUser);
    let raw = globalThis.localStorage?.getItem(userStorageKey);
    if (!raw) {
      const legacyRaw = globalThis.localStorage?.getItem(LEGACY_STORAGE_KEY);
      if (legacyRaw) {
        try {
          const legacyParsed = JSON.parse(legacyRaw) as Partial<InternalMailState>;
          if (canUseLegacyStateForUser(currentUser, legacyParsed)) {
            globalThis.localStorage?.setItem(userStorageKey, legacyRaw);
            raw = legacyRaw;
          }
        } catch {
          // Ignore malformed legacy state.
        }
      }
    }
    if (!raw) return buildWelcomeThread(currentUser);

    const parsed = JSON.parse(raw) as Partial<InternalMailState>;
    const contacts = ensureUniqueContacts([currentUser, ...(parsed.contacts || []), ...DEFAULT_CONTACTS]);
    const threads = Array.isArray(parsed.threads) ? parsed.threads : [];
    const messages = Array.isArray(parsed.messages) ? parsed.messages : [];

    if (threads.length === 0 || messages.length === 0) {
      return buildWelcomeThread(currentUser);
    }

    return { contacts, threads, messages };
  } catch {
    return buildWelcomeThread(currentUser);
  }
}

function writeState(currentUser: MailContact, next: InternalMailState) {
  globalThis.localStorage?.setItem(storageKeyForUser(currentUser), JSON.stringify(next));
  globalThis.dispatchEvent(new Event(UPDATE_EVENT));
}

function resolveMentionIds(body: string, contacts: MailContact[]) {
  const matches = Array.from(body.matchAll(/(?:^|\s)@([^\s@]+)/g));
  if (matches.length === 0) return [] as string[];

  return matches
    .map((match) => normalizeToken(match[1] || ""))
    .map((token) => {
      const normalizedPhone = normalizePhone(token);
      return contacts.find((contact) => {
        const contactPhone = normalizePhone(contact.phone);
        return normalizeToken(contact.username) === token
          || normalizeToken(contact.label) === token
          || (normalizedPhone.length >= 4 && contactPhone.endsWith(normalizedPhone));
      })?.id;
    })
    .filter((value): value is string => Boolean(value));
}

function buildAutoReply(recipient: MailContact, body: string) {
  if (recipient.role === "admin") {
    return `تم استلام رسالتك من الإدارة. سنراجع: "${body.slice(0, 80)}${body.length > 80 ? "…" : ""}".`;
  }

  if (recipient.role === "support") {
    return "تم فتح متابعة داخلية لرسالتك، وسيصلك الرد من الفريق المختص عند تحديث الحالة.";
  }

  return `تم إرسال رسالتك إلى ${recipient.label}.`;
}

export function useInternalMail(profile: UserProfile) {
  const currentUser = useMemo(() => deriveCurrentContact(profile), [profile.email, profile.name, profile.phone]);
  const [state, setState] = useState<InternalMailState>(() => readState(currentUser));

  useEffect(() => {
    setState(readState(currentUser));
  }, [currentUser]);

  useEffect(() => {
    const refresh = () => setState(readState(currentUser));
    globalThis.addEventListener(UPDATE_EVENT, refresh);
    globalThis.addEventListener("storage", refresh);
    return () => {
      globalThis.removeEventListener(UPDATE_EVENT, refresh);
      globalThis.removeEventListener("storage", refresh);
    };
  }, [currentUser]);

  const contacts = useMemo(
    () => state.contacts.filter((contact) => contact.id !== currentUser.id),
    [currentUser.id, state.contacts],
  );

  const threads = useMemo<InternalMailThreadView[]>(() => {
    return state.threads
      .map((thread) => {
        const recipientId = thread.participantIds.find((id) => id !== currentUser.id) || thread.participantIds[0];
        const recipient = state.contacts.find((contact) => contact.id === recipientId) || contacts[0];
        const threadMessages = state.messages
          .filter((message) => message.threadId === thread.id)
          .sort((left, right) => new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime());
        const unreadCount = threadMessages.filter((message) => message.toId === currentUser.id && !message.readBy.includes(currentUser.id)).length;

        return {
          ...thread,
          recipient,
          messages: threadMessages,
          unreadCount,
          lastMessage: threadMessages.at(-1) ?? null,
        };
      })
      .filter((thread): thread is InternalMailThreadView => Boolean(thread.recipient))
      .sort((left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime());
  }, [contacts, currentUser.id, state.contacts, state.messages, state.threads]);

  const unreadCount = useMemo(
    () => threads.reduce((sum, thread) => sum + thread.unreadCount, 0),
    [threads],
  );

  const markThreadRead = useCallback((threadId: string) => {
    const next: InternalMailState = {
      ...state,
      messages: state.messages.map((message) => {
        if (message.threadId !== threadId || message.toId !== currentUser.id || message.readBy.includes(currentUser.id)) {
          return message;
        }
        return { ...message, readBy: [...message.readBy, currentUser.id] };
      }),
    };
    setState(next);
    writeState(currentUser, next);
  }, [currentUser.id, state]);

  const sendMail = useCallback((input: { body: string; recipientId?: string; subject?: string }) => {
    const body = input.body.trim();
    if (!body) return null;

    const baseState = readState(currentUser);
    const mentionIds = resolveMentionIds(body, baseState.contacts);
    const recipient = baseState.contacts.find((contact) => contact.id === input.recipientId)
      || baseState.contacts.find((contact) => contact.id === mentionIds[0])
      || baseState.contacts.find((contact) => contact.id === "contact:admin");

    if (!recipient || recipient.id === currentUser.id) {
      return null;
    }

    const threadId = buildThreadId(currentUser.id, recipient.id);
    const now = new Date().toISOString();
    const existingThread = baseState.threads.find((thread) => thread.id === threadId);
    const nextThread: InternalMailThread = existingThread || {
      id: threadId,
      participantIds: [currentUser.id, recipient.id],
      subject: input.subject?.trim() || defaultSubject(recipient),
      updatedAt: now,
    };

    const nextMessages: InternalMailMessage[] = [
      ...baseState.messages,
      {
        id: `mail_${Date.now()}`,
        threadId,
        fromId: currentUser.id,
        toId: recipient.id,
        body,
        createdAt: now,
        readBy: [currentUser.id],
        mentions: mentionIds,
      },
      {
        id: `mail_${Date.now()}_reply`,
        threadId,
        fromId: recipient.id,
        toId: currentUser.id,
        body: buildAutoReply(recipient, body),
        createdAt: new Date(Date.now() + 1_000).toISOString(),
        readBy: [recipient.id],
        mentions: [],
      },
    ];

    const next: InternalMailState = {
      contacts: baseState.contacts,
      threads: existingThread
        ? baseState.threads.map((thread) => thread.id === threadId ? { ...thread, updatedAt: now, subject: nextThread.subject } : thread)
        : [nextThread, ...baseState.threads],
      messages: nextMessages,
    };

    setState(next);
    writeState(currentUser, next);
    return threadId;
  }, [currentUser]);

  const suggestMentions = useCallback((query: string) => {
    const token = normalizeToken(query);
    const phoneToken = normalizePhone(query);
    return contacts.filter((contact) => {
      const matchesName = normalizeToken(contact.label).includes(token) || normalizeToken(contact.username).includes(token);
      const matchesPhone = phoneToken.length > 0 && normalizePhone(contact.phone).includes(phoneToken);
      return matchesName || matchesPhone;
    }).slice(0, 6);
  }, [contacts]);

  return {
    currentUser,
    contacts,
    threads,
    unreadCount,
    markThreadRead,
    sendMail,
    suggestMentions,
  };
}