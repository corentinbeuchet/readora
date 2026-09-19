import { timeAgo } from '@app/core/utils/time-ago';

describe('timeAgo', () => {
  const now = Date.parse('2026-09-15T12:00:00Z');

  it('says how long ago, in the largest whole unit', () => {
    expect(timeAgo('2026-09-15T11:59:30Z', now)).toBe('just now');
    expect(timeAgo('2026-09-15T11:59:00Z', now)).toBe('1 minute ago');
    expect(timeAgo('2026-09-15T11:50:00Z', now)).toBe('10 minutes ago');
    expect(timeAgo('2026-09-15T10:00:00Z', now)).toBe('2 hours ago');
    expect(timeAgo('2026-09-12T12:00:00Z', now)).toBe('3 days ago');
    expect(timeAgo('2026-09-16T12:00:00Z', now)).toBe('just now');
  });
});
