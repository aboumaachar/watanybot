import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ReliableWebSocketClient, type ReliableWebSocketState } from "@watany/shared/reliable-websocket";
import { Mail24Regular, Person24Regular, Send24Regular, ShieldCheckmark24Regular } from "../theme/watany-v4/legacyIconBridge";
import UtilityHeaderTitleRow from "../components/UtilityHeaderTitleRow";
import { api } from "../lib/api";
import { getDefaultApiWebSocketUrl } from "../lib/api-base";
import { getAccessToken, profileFromToken } from "../lib/auth";
import { useApp } from "../store/app";
import type { CommunityDirectContact, CommunityDirectThread, CommunityGroupDetail, CommunityMessage, CommunityRealtimeEvent } from "../types/domain";

type DirectRealtimeEvent = CommunityRealtimeEvent<Record<string, unknown>>;

function formatStamp(value?: string) {
  if (!value) return "";
  return new Intl.DateTimeFormat("ar-LB", { dateStyle: "short", timeStyle: "short" }).format(new Date(value));
}

export function mergeDirectMessages(current: CommunityMessage[], incoming: CommunityMessage) {
  const existing = current.find((message) => message.id === incoming.id);
  const merged = existing
    ? { ...existing, ...incoming, receiptStatus: mergeReceipt(existing.receiptStatus, incoming.receiptStatus) }
    : incoming;
  const next = current.filter((message) => message.id !== incoming.id);
  return [...next, merged].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
}
function mergeReceipt(current: CommunityMessage["receiptStatus"], next: CommunityMessage["receiptStatus"]) {
  const rank = { sent: 0, delivered: 1, read: 2 } as const;
  if (!next) return current;
  return !current || rank[next] > rank[current] ? next : current;
}

export default function MessagesPage() {
  const { groupId } = useParams<{ groupId: string }>();
  const navigate = useNavigate();
  const { apiBaseUrl, profile } = useApp();
  const tokenProfile = profileFromToken();
  const currentUserId = profile.id || tokenProfile?.id || profile.email || profile.phone || profile.name || "current_user";
  const currentUserName = profile.email?.split("@")[0]?.trim() || profile.name || "أنت";
  const wsUrl = useMemo(() => getDefaultApiWebSocketUrl("/ws/community"), []);
  const wsRef = useRef<ReliableWebSocketClient | null>(null);
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [threads, setThreads] = useState<CommunityDirectThread[]>([]);
  const [contacts, setContacts] = useState<CommunityDirectContact[]>([]);
  const [thread, setThread] = useState<CommunityGroupDetail | null>(null);
  const [draft, setDraft] = useState("");
  const [contactQuery, setContactQuery] = useState("");
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [realtimeState, setRealtimeState] = useState<ReliableWebSocketState>("idle");
  const activeThread = useMemo(() => threads.find((item) => item.groupId === groupId) || null, [groupId, threads]);

  const refreshThreads = useCallback(async () => {
    const next = await api.getCommunityDirectThreads(apiBaseUrl);
    setThreads(next);
    return next;
  }, [apiBaseUrl]);

  const refreshContacts = useCallback(async (query = contactQuery) => {
    const next = await api.getCommunityDirectContacts(query, apiBaseUrl);
    setContacts(next);
  }, [apiBaseUrl, contactQuery]);

  const loadThread = useCallback(async (id: string) => {
    const detail = await api.getCommunityGroup(id, { limit: 50 }, apiBaseUrl);
    setThread(detail);
    const newest = detail.messages.at(-1);
    if (newest) {
      const read = await api.markCommunityGroupRead(id, apiBaseUrl, newest.id);
      setThread((current) => current?.group.id === id ? { ...current, readState: read } : current);
    }
    void refreshThreads();
  }, [apiBaseUrl, refreshThreads]);

  useEffect(() => {
    if (!profile.isAuthed && !tokenProfile?.id) { setLoading(false); return; }
    setLoading(true);
    Promise.all([refreshThreads(), refreshContacts("")])
      .catch((error) => setStatus(error instanceof Error ? error.message : "تعذر تحميل المحادثات."))
      .finally(() => setLoading(false));
  }, [profile.isAuthed, refreshContacts, refreshThreads, tokenProfile?.id]);
  useEffect(() => {
    if (!groupId) { setThread(null); setTypingUsers([]); return; }
    setStatus("");
    void loadThread(groupId).catch((error) => {
      setThread(null);
      setStatus(error instanceof Error ? error.message : "تعذر فتح المحادثة.");
    });
  }, [groupId, loadThread]);

  const handleRealtimeEvent = useCallback((event: DirectRealtimeEvent) => {
    if (!groupId || event.groupId !== groupId) return;
    const payload = event.payload || {};
    if (event.eventType === "community.connection.resync_required") { void loadThread(groupId); return; }
    if (event.eventType === "community.typing.started" || event.eventType === "community.typing.stopped") {
      const name = typeof payload.userName === "string" ? payload.userName : "";
      if (!name || name === currentUserName) return;
      setTypingUsers((current) => event.eventType === "community.typing.started"
        ? Array.from(new Set([...current, name])) : current.filter((item) => item !== name));
      return;
    }
    if (event.eventType === "community.message.created" || event.eventType === "community.message.updated" || event.eventType === "community.message.deleted") {
      const message = payload.message as CommunityMessage | undefined;
      if (!message) return;
      setThread((current) => current?.group.id === groupId ? { ...current, messages: mergeDirectMessages(current.messages, message) } : current);
      if (event.eventType === "community.message.created" && message.senderId !== currentUserId) {
        wsRef.current?.sendJSON({ type: "community.receipt.delivered", groupId, messageId: message.id });
        void api.markCommunityGroupRead(groupId, apiBaseUrl, message.id);
      }
      void refreshThreads();
      return;
    }
    if ((event.eventType === "community.receipt.delivered" || event.eventType === "community.receipt.read") && event.messageId) {
      if (event.actorId === currentUserId) return;
      const receiptStatus = event.eventType === "community.receipt.read" ? "read" : "delivered";
      setThread((current) => current?.group.id === groupId ? {
        ...current,
        messages: current.messages.map((message) => message.id === event.messageId
          ? { ...message, receiptStatus: mergeReceipt(message.receiptStatus, receiptStatus) }
          : message),
      } : current);
    }
  }, [apiBaseUrl, currentUserId, currentUserName, groupId, loadThread, refreshThreads]);

  useEffect(() => {
    wsRef.current?.disconnect(1000, "direct_thread_changed");
    wsRef.current = null;
    setRealtimeState("idle");
    if (!groupId || !wsUrl || !getAccessToken()) return;

    const socket = new ReliableWebSocketClient(() => {
      const token = getAccessToken();
      const url = new URL(wsUrl);
      if (token) url.searchParams.set("token", token);
      return url.toString();
    }, {
      shouldReconnect: (event) => ![4001, 4003, 4004].includes(event.code),
      onOpen: () => socket.sendJSON({ type: "community.subscribe", groupId }),
      onMessage: (event) => {
        if (typeof event.data !== "string") return;
        try {
          const payload = JSON.parse(event.data) as DirectRealtimeEvent;
          if (typeof payload.eventType === "string") handleRealtimeEvent(payload);
        } catch { /* ignore malformed realtime frames */ }
      },
      onClose: (event) => {
        if (event.code === 4003) setStatus("لم تعد لديك صلاحية الوصول إلى هذه المحادثة.");
      },
      onStateChange: setRealtimeState,
    });
    wsRef.current = socket;
    socket.connect();
    return () => {
      socket.disconnect(1000, "direct_thread_unmounted");
      if (wsRef.current === socket) wsRef.current = null;
    };
  }, [groupId, handleRealtimeEvent, wsUrl]);

  async function startConversation(contact: CommunityDirectContact) {
    setStatus("");
    try {
      const direct = await api.getOrCreateCommunityDirectThread(contact.id, apiBaseUrl);
      await refreshThreads();
      navigate(`/messages/${encodeURIComponent(direct.groupId)}`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "تعذر بدء المحادثة.");
    }
  }

  async function sendMessage() {
    const body = draft.trim();
    if (!groupId || !body || sending) return;
    setSending(true); setStatus("");
    try {
      const message = await api.sendCommunityMessage(groupId, { body, clientRequestId: crypto.randomUUID() }, apiBaseUrl);
      setThread((current) => current?.group.id === groupId ? { ...current, messages: mergeDirectMessages(current.messages, message) } : current);
      setDraft("");
      await api.setCommunityGroupTyping(groupId, { userName: currentUserName, isTyping: false }, apiBaseUrl);
      void refreshThreads();
    } catch (error) { setStatus(error instanceof Error ? error.message : "تعذر إرسال الرسالة."); }
    finally { setSending(false); }
  }
  function updateDraft(value: string) {
    setDraft(value);
    if (!groupId) return;
    void api.setCommunityGroupTyping(groupId, { userName: currentUserName, isTyping: Boolean(value.trim()) }, apiBaseUrl).catch(() => undefined);
    if (typingTimerRef.current) globalThis.clearTimeout(typingTimerRef.current);
    typingTimerRef.current = globalThis.setTimeout(() => {
      void api.setCommunityGroupTyping(groupId, { userName: currentUserName, isTyping: false }, apiBaseUrl).catch(() => undefined);
    }, 2500);
  }

  async function uploadAttachment(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!groupId || !file) return;
    setSending(true); setStatus("");
    try {
      const result = await api.uploadCommunityAttachment(groupId, {
        file,
        type: file.type.startsWith("audio/") ? "voice" : "attachment",
      }, apiBaseUrl);
      setThread((current) => current?.group.id === groupId ? { ...current, messages: mergeDirectMessages(current.messages, result.message) } : current);
      void refreshThreads();
    } catch (error) { setStatus(error instanceof Error ? error.message : "تعذر رفع المرفق."); }
    finally { setSending(false); }
  }

  async function openAttachment(url: string) {
    try {
      const asset = await api.fetchCommunityAttachmentAsset(url, apiBaseUrl);
      const objectUrl = URL.createObjectURL(asset.blob);
      globalThis.open(objectUrl, "_blank", "noopener,noreferrer");
      globalThis.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
    } catch { setStatus("تعذر فتح المرفق."); }
  }
  useEffect(() => () => {
    if (typingTimerRef.current) globalThis.clearTimeout(typingTimerRef.current);
  }, []);

  async function react(messageId: string, emoji: string) {
    if (!groupId) return;
    try {
      const result = await api.toggleCommunityMessageReaction(groupId, messageId, emoji, apiBaseUrl);
      setThread((current) => current?.group.id === groupId ? { ...current, messages: mergeDirectMessages(current.messages, result.message) } : current);
    } catch { setStatus("تعذر تحديث التفاعل."); }
  }

  if (!profile.isAuthed && !tokenProfile?.id) {
    return <div className="panel utility-page messages-page" dir="rtl">يرجى تسجيل الدخول لفتح المحادثات.</div>;
  }

  return (
    <div className="panel utility-page messages-page" data-direct-messages="true" dir="rtl">
      <div className="utility-header">
        <UtilityHeaderTitleRow
          titleClassName="utility-title"
          title="المحادثات"
          infoText="محادثات خاصة حقيقية بين مستخدمي موطني، محفوظة ومزامنة مباشرة."
          infoLabel="حول المحادثات الخاصة"
        />
      </div>

      <div className="watany-approved-home-icons utility-action-grid utility-action-grid--compact">
        <button type="button" className="utility-action-card" onClick={() => navigate("/messages")}><Mail24Regular /><span>محادثاتي</span></button>
        <button type="button" className="utility-action-card" onClick={() => document.querySelector<HTMLInputElement>('[data-direct-contact-search="true"]')?.focus()}><Person24Regular /><span>بدء محادثة</span></button>
        <button type="button" className="utility-action-card" onClick={() => { if (groupId) void loadThread(groupId); }}><ShieldCheckmark24Regular /><span>{realtimeState === "open" ? "متصل مباشر" : "إعادة المزامنة"}</span></button>
      </div>

      {status ? <div className="chat-error-banner">{status}</div> : null}
      {loading ? <div className="chat-empty-state">جاري تحميل المحادثات...</div> : null}

      <div className="messages-shell" style={{ display: "grid", gridTemplateColumns: "minmax(230px, 32%) 1fr", minHeight: "62vh" }}>
        <aside className="messages-sidebar" style={{ borderInlineEnd: "1px solid var(--border, #e5e7eb)", padding: 12 }}>
          <form onSubmit={(event) => { event.preventDefault(); void refreshContacts(contactQuery); }} style={{ display: "flex", gap: 6, marginBottom: 10 }}>
            <input
              data-direct-contact-search="true"
              value={contactQuery}
              onChange={(event) => setContactQuery(event.target.value)}
              placeholder="ابحث بالاسم أو الهاتف أو البريد"
              style={{ flex: 1, minWidth: 0 }}
            />
            <button type="submit">بحث</button>
          </form>
          <div className="messages-contact-results" data-direct-contacts="true">
            {contacts.slice(0, 8).map((contact) => (
              <button key={contact.id} type="button" className="messages-thread-row" onClick={() => void startConversation(contact)} style={{ width: "100%", textAlign: "right", marginBottom: 4 }}>
                <strong>{contact.name}</strong><br /><small>{contact.phone || contact.email}</small>
              </button>
            ))}
          </div>
          <hr style={{ margin: "12px 0" }} />
          <strong>المحادثات الأخيرة</strong>
          <div data-direct-thread-list="true">
            {threads.map((item) => (
              <button
                key={item.groupId}
                type="button"
                className={`messages-thread-row${item.groupId === groupId ? " is-active" : ""}`}
                onClick={() => navigate(`/messages/${encodeURIComponent(item.groupId)}`)}
                style={{ width: "100%", textAlign: "right", marginTop: 6 }}
              >
                <span><strong>{item.peer.name}</strong>{item.unreadCount > 0 ? ` (${item.unreadCount})` : ""}</span><br />
                <small>{item.lastMessagePreview || "ابدأ المحادثة"}</small><br />
                <small>{formatStamp(item.lastMessageAt)}</small>
              </button>
            ))}
            {!threads.length && !loading ? <div className="chat-empty-state">لا توجد محادثات بعد.</div> : null}
          </div>
        </aside>

        <section className="messages-thread" data-direct-thread="true" style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
          {!groupId ? (
            <div className="chat-empty-state" style={{ margin: "auto" }}>اختر مستخدماً أو محادثة لبدء المراسلة.</div>
          ) : (
            <>
              <header style={{ padding: 12, borderBottom: "1px solid var(--border, #e5e7eb)" }}>
                <strong>{activeThread?.peer.name || "محادثة خاصة"}</strong>
                <div><small>{activeThread?.peer.phone || activeThread?.peer.email || "محادثة مشفرة عبر حساب موطني"}</small></div>
                {typingUsers.length ? <small>{typingUsers.join("، ")} يكتب الآن...</small> : null}
              </header>
              <div className="messages-thread-body" data-direct-message-list="true" style={{ flex: 1, overflowY: "auto", padding: 12 }}>
                {(thread?.messages || []).map((message) => {
                  const mine = message.senderId === currentUserId;
                  const displayBody = message.deletedForEveryoneAt ? "تم حذف هذه الرسالة." : message.body;
                  return (
                    <div key={message.id} data-direct-message-id={message.id} style={{ display: "flex", justifyContent: mine ? "flex-start" : "flex-end", marginBottom: 8 }}>
                      <div style={{ maxWidth: "82%", padding: "8px 10px", borderRadius: 12, background: mine ? "var(--surface-2, #eef2ff)" : "var(--surface, #fff)", border: "1px solid var(--border, #e5e7eb)" }}>
                        {!mine ? <small><strong>{message.senderName}</strong></small> : null}
                        {displayBody ? <div>{displayBody}</div> : null}
                        {message.attachments?.map((attachment) => (
                          <button key={attachment.id} type="button" onClick={() => void openAttachment(attachment.url)} style={{ display: "block", marginTop: 6 }}>
                            {message.type === "voice" ? "🎤" : "📎"} {attachment.originalName || "مرفق"}
                          </button>
                        ))}
                        {!message.attachments?.length && message.attachmentUrl ? (
                          <button type="button" onClick={() => void openAttachment(message.attachmentUrl || "")} style={{ display: "block", marginTop: 6 }}>📎 فتح المرفق</button>
                        ) : null}
                        <div style={{ display: "flex", gap: 6, alignItems: "center", marginTop: 5 }}>
                          <small>{formatStamp(message.createdAt)}</small>
                          {mine ? <small>{message.receiptStatus === "read" ? "✓✓ مقروءة" : message.receiptStatus === "delivered" ? "✓✓ تم التسليم" : "✓ تم الإرسال"}</small> : null}
                          {!message.deletedForEveryoneAt ? <button type="button" aria-label="أعجبني" onClick={() => void react(message.id, "👍")}>👍</button> : null}
                        </div>
                        {message.reactions?.length ? <small>{message.reactions.map((item) => `${item.emoji} ${item.count}`).join("  ")}</small> : null}
                      </div>
                    </div>
                  );
                })}
                {groupId && thread && !thread.messages.length ? <div className="chat-empty-state">ابدأ أول رسالة في هذه المحادثة.</div> : null}
              </div>
              <div className="messages-composer" style={{ display: "flex", gap: 8, padding: 12, borderTop: "1px solid var(--border, #e5e7eb)" }}>
                <input
                  value={draft}
                  data-direct-message-input="true"
                  onChange={(event) => updateDraft(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); void sendMessage(); }
                  }}
                  placeholder="اكتب رسالة..."
                  disabled={!thread || sending}
                  style={{ flex: 1, minWidth: 0 }}
                />
                <input ref={fileRef} type="file" hidden onChange={(event) => void uploadAttachment(event)} />
                <button type="button" aria-label="إرفاق ملف" disabled={!thread || sending} onClick={() => fileRef.current?.click()}>📎</button>
                <button type="button" data-direct-send="true" disabled={!thread || sending || !draft.trim()} onClick={() => void sendMessage()}>
                  <Send24Regular />
                </button>
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
