import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  fetchNotificationBadges,
  getBadgeCount,
  getBadgeItem,
} from './notification-badge-client';
import { isLoggedIn } from '../../lib/auth';
import type { NotificationBadgeItem, NotificationBadgeMap } from './notification-badge-types';

type NotificationBadgeContextValue = {
  badges: NotificationBadgeMap;
  refreshBadges: () => Promise<void>;
  getCount: (featureKey: string) => number;
  getItem: (featureKey: string) => NotificationBadgeItem | undefined;
};

const NotificationBadgeContext = createContext<NotificationBadgeContextValue>({
  badges: {},
  refreshBadges: async () => {},
  getCount: () => 0,
  getItem: () => undefined,
});

type NotificationBadgeProviderProps = Readonly<{
  children: ReactNode;
  apiBaseUrl?: string;
  enabled?: boolean;
  pollMs?: number;
}>;

export function NotificationBadgeProvider({
  children,
  apiBaseUrl = '',
  enabled = true,
  pollMs = 60000,
}: NotificationBadgeProviderProps) {
  const [badges, setBadges] = useState<NotificationBadgeMap>({});

  const refreshBadges = useCallback(async () => {
    if (!enabled || !isLoggedIn()) {
      setBadges({});
      return;
    }
    const next = await fetchNotificationBadges(apiBaseUrl);
    setBadges(next);
  }, [apiBaseUrl, enabled]);

  useEffect(() => {
    void refreshBadges();

    if (!enabled || !isLoggedIn() || pollMs <= 0) return undefined;

    const handle = globalThis.setInterval(() => {
      void refreshBadges();
    }, pollMs);

    return () => globalThis.clearInterval(handle);
  }, [enabled, pollMs, refreshBadges]);

  const value = useMemo<NotificationBadgeContextValue>(() => {
    return {
      badges,
      refreshBadges,
      getCount: (featureKey: string) => getBadgeCount(badges, featureKey),
      getItem: (featureKey: string) => getBadgeItem(badges, featureKey),
    };
  }, [badges, refreshBadges]);

  return (
    <NotificationBadgeContext.Provider value={value}>
      {children}
    </NotificationBadgeContext.Provider>
  );
}

export function useNotificationBadges() {
  return useContext(NotificationBadgeContext);
}
