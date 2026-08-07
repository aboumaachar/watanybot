import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowClockwise24Regular,
  BookmarkMultiple24Regular,
} from "../theme/watany-v4/legacyIconBridge";
import { useNavigate } from 'react-router-dom';
import { MainHybridChatSurface } from '../components/chat/MainHybridChatSurface';
import { api } from '../lib/api';
import { useApp } from '../store/app';
import type { SavedChatItem } from '../types/domain';

// APEX_CSS_FREEZE_DISABLED_IMPORT import '../styles/saved-chats-page.css';

function formatDateTime(value?: number): string {
  if (typeof value !== 'number') {
    return 'غير محدد';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return new Intl.DateTimeFormat('ar-LB', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

function getTitle(item: SavedChatItem): string {
  const normalized = item.text.replace(/\s+/g, ' ').trim();
  if (!normalized) {
    return 'محادثة محفوظة';
  }

  if (normalized.length <= 84) {
    return normalized;
  }

  return `${normalized.slice(0, 84).trim()}...`;
}

function getStatusLabel(item: SavedChatItem): string {
  if (item.status === 'closed') {
    return 'مغلقة';
  }

  if (item.status === 'archived') {
    return 'مؤرشفة';
  }

  if (item.status === 'deleted_for_me') {
    return 'محذوفة';
  }

  return 'محفوظة';
}

export default function SavedChatsPage(): JSX.Element {
  const { apiBaseUrl, profile } = useApp();
  const navigate = useNavigate();
  const [items, setItems] = useState<SavedChatItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pendingItemId, setPendingItemId] = useState<string | null>(null);

  const visibleItems = useMemo(
    () => items.filter((item) => item.status !== 'deleted_for_me'),
    [items],
  );

  const total = useMemo(() => visibleItems.length, [visibleItems.length]);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      setItems(await api.getSavedChats(apiBaseUrl));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر تحميل المحادثات المحفوظة.');
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [apiBaseUrl]);

  useEffect(() => {
    void load();
  }, [load, profile.isAuthed]);

  function openSavedChat(item: SavedChatItem) {
    navigate('/chat', {
      state: {
        draft: item.text,
      },
    });
  }

  async function removeSavedChat(item: SavedChatItem) {
    setPendingItemId(item.id);
    setError(null);

    try {
      const updated = await api.updateSavedChat(item.id, { status: 'deleted_for_me' }, apiBaseUrl);
      setItems((current) => current.map((entry) => (entry.id === item.id ? updated : entry)));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر إزالة المحادثة المحفوظة.');
    } finally {
      setPendingItemId(null);
    }
  }

  return (
    <main className="saved-chats-page" dir="rtl" data-page="saved-chats">
      <MainHybridChatSurface context="pages/SavedChatsPage.tsx" />
      <section className="saved-chats-page__hero">
        <div className="saved-chats-page__hero-copy">
          <h1 className="saved-chats-page__title">المحادثات المحفوظة</h1>
          <p className="saved-chats-page__subtitle">
            راجع الأسئلة والإجابات التي حفظتها للرجوع إليها لاحقاً.
          </p>
        </div>

        <div className="saved-chats-page__actions">
          <button className="saved-chats-page__refresh" type="button" onClick={() => void load()}>
            <ArrowClockwise24Regular aria-hidden />
            <span>تحديث</span>
          </button>
        </div>
      </section>

      <section className="saved-chats-page__summary" aria-label="ملخص المحفوظات">
        <span className="saved-chats-page__summary-icon">
          <BookmarkMultiple24Regular aria-hidden />
        </span>
        <span className="saved-chats-page__summary-label">الإجمالي</span>
        <strong className="saved-chats-page__summary-value">{total}</strong>
      </section>

      {error ? <div className="saved-chats-page__error">{error}</div> : null}
      {loading ? <div className="saved-chats-page__state">جار تحميل المحفوظات...</div> : null}

      {!loading && visibleItems.length === 0 ? (
        <div className="saved-chats-page__state">لا توجد محادثات محفوظة حالياً.</div>
      ) : null}

      {!loading && visibleItems.length > 0 ? (
        <div className="saved-chats-page__list">
          {visibleItems.map((item) => (
            <article key={item.id} className="saved-chats-page__card">
              <div className="saved-chats-page__card-main">
                <div className="saved-chats-page__card-copy">
                  <h2 className="saved-chats-page__card-title">{getTitle(item)}</h2>
                  <p className="saved-chats-page__card-date">{formatDateTime(item.updatedAt || item.ts)}</p>
                </div>
                <span className="saved-chats-page__card-status">{getStatusLabel(item)}</span>
              </div>
              <div className="saved-chats-page__card-actions">
                <button
                  className="saved-chats-page__card-action saved-chats-page__card-action--primary"
                  type="button"
                  onClick={() => openSavedChat(item)}
                >
                  فتح المحادثة
                </button>
                <button
                  className="saved-chats-page__card-action saved-chats-page__card-action--ghost"
                  type="button"
                  onClick={() => void removeSavedChat(item)}
                  disabled={pendingItemId === item.id}
                >
                  {pendingItemId === item.id ? 'جارٍ الإزالة...' : 'إزالة من المحفوظات'}
                </button>
              </div>
            </article>
          ))}
        </div>
      ) : null}
    </main>
  );
}


