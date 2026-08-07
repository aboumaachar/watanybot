/** @vitest-environment node */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchNotificationBadges } from './notification-badge-client';

vi.mock('../../lib/auth', () => ({
  isLoggedIn: vi.fn(),
}));

const { isLoggedIn } = await import('../../lib/auth');

describe('notification badge auth guards', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
  });

  it('does not fetch typed badges when logged out', async () => {
    vi.mocked(isLoggedIn).mockReturnValue(false);
    const fetchSpy = vi.spyOn(globalThis, 'fetch');

    const result = await fetchNotificationBadges('');

    expect(result).toEqual({});
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
