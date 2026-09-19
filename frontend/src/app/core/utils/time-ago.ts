const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/**
 * "just now", "10 minutes ago", "2 hours ago", "3 days ago", or the date for anything older than a month, in `locale`
 * (the build's `LOCALE_ID`, see the `timeAgo` pipe): "il y a 10 minutes" in French.
 */
export function timeAgo(iso: string, now: number = Date.now(), locale = 'en'): string {
  const at = new Date(iso).getTime();
  const elapsed = Math.max(0, now - at);
  if (elapsed < MINUTE) return $localize`:@@time.justNow:just now`;
  const relative = new Intl.RelativeTimeFormat(locale, { numeric: 'always' });
  if (elapsed < HOUR) return relative.format(-Math.floor(elapsed / MINUTE), 'minute');
  if (elapsed < DAY) return relative.format(-Math.floor(elapsed / HOUR), 'hour');
  if (elapsed < 30 * DAY) return relative.format(-Math.floor(elapsed / DAY), 'day');
  return new Date(at).toLocaleDateString(locale);
}
