// Use happy-dom for DOM coverage in this repo; jsdom is currently not the stable path here.
/** @vitest-environment happy-dom */

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { NotificationBadgeProvider, useNotificationBadges } from './NotificationBadgeProvider';

vi.mock('../../lib/auth', () => ({
  isLoggedIn: vi.fn(),
}));

const { isLoggedIn } = await import('../../lib/auth');

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe('NotificationBadgeProvider logged-out behavior', () => {
  let container: HTMLDivElement | null = null;
  let root: Root | null = null;

  afterEach(async () => {
    if (root) {
      await act(async () => {
        root?.unmount();
      });
    }
    container?.remove();
    container = null;
    root = null;
    vi.restoreAllMocks();
    vi.clearAllMocks();
  });

  it('clears badges without polling when logged out', async () => {
    vi.mocked(isLoggedIn).mockReturnValue(false);
    const setIntervalSpy = vi.spyOn(globalThis, 'setInterval');
    const clearIntervalSpy = vi.spyOn(globalThis, 'clearInterval');

    const observed: Array<Record<string, unknown>> = [];

    function Probe() {
      const { badges, getCount } = useNotificationBadges();
      observed.push({
        badgeKeys: Object.keys(badges),
        worldCupCount: getCount('worldcup'),
      });
      return null;
    }

    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);

    await act(async () => {
      root?.render(
        <NotificationBadgeProvider enabled pollMs={5000}>
          <Probe />
        </NotificationBadgeProvider>,
      );
    });

    await act(async () => {
      await Promise.resolve();
    });

    expect(observed.at(-1)).toEqual({ badgeKeys: [], worldCupCount: 0 });
    expect(setIntervalSpy).not.toHaveBeenCalled();
    expect(clearIntervalSpy).not.toHaveBeenCalled();
  });
});
