import { timeAgo } from '@app/core/utils/time-ago';

describe('timeAgo', () => {
  let now: number;
  let formatted: string;

  it('says how long ago, in the largest whole unit', () => {
    givenItIs('2026-09-15T12:00:00Z');

    whenIFormat('2026-09-15T11:59:30Z');
    thenItReads('just now');

    whenIFormat('2026-09-15T11:59:00Z');
    thenItReads('1 minute ago');

    whenIFormat('2026-09-15T11:50:00Z');
    thenItReads('10 minutes ago');

    whenIFormat('2026-09-15T10:00:00Z');
    thenItReads('2 hours ago');

    whenIFormat('2026-09-12T12:00:00Z');
    thenItReads('3 days ago');

    whenIFormat('2026-09-16T12:00:00Z');
    thenItReads('just now');
  });

  it('speaks the language of the build', () => {
    givenItIs('2026-09-15T12:00:00Z');

    whenIFormat('2026-09-15T11:50:00Z', 'fr');
    thenItReads('il y a 10 minutes');

    whenIFormat('2026-09-12T12:00:00Z', 'fr');
    thenItReads('il y a 3 jours');
  });

  function givenItIs(iso: string): void {
    now = Date.parse(iso);
  }

  function whenIFormat(iso: string, locale?: string): void {
    formatted = timeAgo(iso, now, locale);
  }

  function thenItReads(text: string): void {
    expect(formatted).toBe(text);
  }
});
