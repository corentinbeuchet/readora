const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** "just now", "10 minutes ago", "2 hours ago", "3 days ago", or the date for anything older than a month. */
export function timeAgo(iso: string, now: number = Date.now()): string {
  const at = new Date(iso).getTime();
  const elapsed = Math.max(0, now - at);
  if (elapsed < MINUTE) return 'just now';
  if (elapsed < HOUR) return plural(Math.floor(elapsed / MINUTE), 'minute');
  if (elapsed < DAY) return plural(Math.floor(elapsed / HOUR), 'hour');
  if (elapsed < 30 * DAY) return plural(Math.floor(elapsed / DAY), 'day');
  return new Date(at).toLocaleDateString();
}

function plural(count: number, unit: string): string {
  return `${count} ${unit}${count === 1 ? '' : 's'} ago`;
}
