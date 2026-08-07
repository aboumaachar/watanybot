import { useEffect, useMemo, useState } from "react";
import {
  Alert24Regular,
  ArrowCounterclockwise24Regular,
  Mail24Regular,
  Person24Regular,
  Send24Regular,
  ShieldCheckmark24Regular,
} from "../theme/watany-v4/legacyIconBridge";
import { UtilityActionIcon } from "../components/UtilityActionIcon";
import UtilityHeaderTitleRow from "../components/UtilityHeaderTitleRow";
import { useApp } from "../store/app";
import { useInternalMail } from "../lib/internal-mail";
// APEX_CSS_FREEZE_DISABLED_IMPORT import "../styles/messages.css";

function formatStamp(value?: string) {
  if (!value) return "";
  return new Intl.DateTimeFormat("ar-LB", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

export default function MessagesPage() {
  const { profile } = useApp();
  const { contacts, currentUser, markThreadRead, sendMail, suggestMentions, threads, unreadCount } = useInternalMail(profile);
  const [activeThreadId, setActiveThreadId] = useState<string | null>(threads[0]?.id ?? null);
  const [selectedRecipientId, setSelectedRecipientId] = useState<string | null>(threads[0]?.recipient.id ?? contacts[0]?.id ?? null);
  const [draft, setDraft] = useState("");
  const [status, setStatus] = useState("");

  useEffect(() => {
    if (!activeThreadId && threads[0]) {
      setActiveThreadId(threads[0].id);
      setSelectedRecipientId(threads[0].recipient.id);
    }
  }, [activeThreadId, threads]);

  const activeThread = useMemo(
    () => threads.find((thread) => thread.id === activeThreadId) ?? null,
    [activeThreadId, threads],
  );

  useEffect(() => {
    if (!activeThread) return;
    setSelectedRecipientId(activeThread.recipient.id);
    markThreadRead(activeThread.id);
  }, [activeThread, markThreadRead]);

  const mentionMatch = draft.match(/(?:^|\s)@([^\s@]*)$/);
  const mentionQuery = mentionMatch?.[1] ?? "";
  const mentionSuggestions = mentionMatch ? suggestMentions(mentionQuery) : [];

  function insertMention(username: string) {
    setDraft((current) => current.replace(/(?:^|\s)@([^\s@]*)$/, (segment) => segment.replace(/@[^\s@]*$/, `@${username} `)));
  }

  function handleSend() {
    const nextThreadId = sendMail({
      body: draft,
      recipientId: activeThread?.recipient.id ?? selectedRecipientId ?? undefined,
      subject: activeThread?.subject,
    });

    if (!nextThreadId) {
      setStatus("اختر مستلماً أو أضف @اسم_المستخدم أو @رقم_الهاتف داخل الرسالة.");
      return;
    }

    setDraft("");
    setStatus("تم إرسال الرسالة الداخلية.");
    setActiveThreadId(nextThreadId);
  }

  return (
    <div className="panel utility-page messages-page">
      <div className="utility-header">
        <UtilityHeaderTitleRow
          titleClassName="utility-title"
          title="الرسائل الداخلية"
          infoText="استخدم @الاسم أو @الرقم لتوجيه الرسالة مباشرة."
          infoLabel="حول البريد الداخلي"
        />
      </div>

      <div className="watany-approved-home-icons utility-action-grid utility-action-grid--compact">
        <div className="utility-action-card utility-action-card--static" style={{ "--utility-color": "#0f766e" } as React.CSSProperties}>
          <UtilityActionIcon icon={<Mail24Regular aria-hidden />} />
          <span className="utility-action-card__label">غير مقروءة</span>
          <span className="utility-action-card__desc">{`${unreadCount} رسالة تحتاج إلى مراجعة الآن.`}</span>
        </div>
        <div className="utility-action-card utility-action-card--static" style={{ "--utility-color": "#2563eb" } as React.CSSProperties}>
          <UtilityActionIcon icon={<Person24Regular aria-hidden />} />
          <span className="utility-action-card__label">جهات متاحة</span>
          <span className="utility-action-card__desc">{`${contacts.length} جهة يمكن مراسلتها مباشرة من داخل التطبيق.`}</span>
        </div>
        <div className="utility-action-card utility-action-card--static" style={{ "--utility-color": "#7c3aed" } as React.CSSProperties}>
          <UtilityActionIcon icon={<ShieldCheckmark24Regular aria-hidden />} />
          <span className="utility-action-card__label">الهوية الحالية</span>
          <span className="utility-action-card__desc">{`ترسل الرسائل باسم ${currentUser.label}.`}</span>
        </div>
      </div>

      <div className="messages-shell">
        <aside className="messages-sidebar">
          <div className="messages-panel-heading">
            <strong>المحادثات</strong>
            <button type="button" className="messages-refresh" onClick={() => setStatus("")}> <ArrowCounterclockwise24Regular aria-hidden /> تحديث الواجهة</button>
          </div>

          <div className="messages-recipient-pills" aria-label="ابدأ مراسلة جديدة">
            {contacts.map((contact) => (
              <button
                key={contact.id}
                type="button"
                className={`messages-recipient-pill ${selectedRecipientId === contact.id && !activeThread ? "is-active" : ""}`}
                onClick={() => {
                  setSelectedRecipientId(contact.id);
                  setActiveThreadId(threads.find((thread) => thread.recipient.id === contact.id)?.id ?? null);
                }}
              >
                @{contact.username}
              </button>
            ))}
          </div>

          <div className="messages-thread-list">
            {threads.map((thread) => (
              <button
                key={thread.id}
                type="button"
                className={`messages-thread-card ${thread.id === activeThreadId ? "is-active" : ""}`}
                onClick={() => {
                  setActiveThreadId(thread.id);
                  setStatus("");
                }}
              >
                <span className="messages-thread-card__top">
                  <strong>{thread.recipient.label}</strong>
                  <small>{formatStamp(thread.updatedAt)}</small>
                </span>
                <span className="messages-thread-card__subject">{thread.subject}</span>
                <span className="messages-thread-card__preview">{thread.lastMessage?.body || "ابدأ أول رسالة الآن."}</span>
                {thread.unreadCount > 0 ? <em className="messages-thread-card__badge">{thread.unreadCount}</em> : null}
              </button>
            ))}
          </div>
        </aside>

        <section className="messages-thread-panel">
          <div className="messages-panel-heading">
            <div>
              <strong>{activeThread?.recipient.label || contacts.find((contact) => contact.id === selectedRecipientId)?.label || "اختر مستلماً"}</strong>
              <p>{activeThread?.subject || "رسالة داخلية جديدة"}</p>
            </div>
            <span className="messages-thread-hint">اذكر المستلم بكتابة @الاسم أو @الهاتف</span>
          </div>

          <div className="messages-thread-window" aria-live="polite">
            {(activeThread?.messages || []).map((message) => {
              const mine = message.fromId === currentUser.id;
              return (
                <article key={message.id} className={`messages-bubble ${mine ? "messages-bubble--mine" : "messages-bubble--theirs"}`}>
                  <span className="messages-bubble__meta">
                    {mine ? "أنت" : activeThread?.recipient.label}
                    <small>{formatStamp(message.createdAt)}</small>
                  </span>
                  <p>{message.body}</p>
                </article>
              );
            })}
            {!activeThread?.messages.length ? (
              <div className="messages-empty-state">
                <Alert24Regular aria-hidden />
                <p>ابدأ أول رسالة داخلية الآن. إذا لم تختر جهة مسبقاً، ستُرسل الرسالة إلى الإدارة تلقائياً.</p>
              </div>
            ) : null}
          </div>

          {mentionSuggestions.length > 0 ? (
            <div className="messages-mention-list">
              {mentionSuggestions.map((contact) => (
                <button key={contact.id} type="button" data-feature-key={contact.id} onClick={() => insertMention(contact.username)}>
                  @{contact.username} <small>{contact.phone || contact.label}</small>
                </button>
              ))}
            </div>
          ) : null}

          <div className="messages-composer">
            <textarea
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder="اكتب الرسالة هنا. مثال: @admin أحتاج متابعة على طلب المعاش."
              rows={4}
            />
            <div className="messages-composer__actions">
              <button type="button" className="btn" onClick={handleSend}>
                <Send24Regular aria-hidden /> إرسال الرسالة
              </button>
            </div>
          </div>

          {status ? <div className="messages-status">{status}</div> : null}
        </section>
      </div>
    </div>
  );
}


