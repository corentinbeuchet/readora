import { Service, inject, signal } from '@angular/core';
import { BrowserStorage } from '@app/core/storage/browser-storage';

export const PREFERRED_TEAMS_KEY = 'readora.reading.teams';
/** Bounds what we keep in localStorage. */
const MAX_REMEMBERED_SERIES = 200;

/**
 * The team whose versions a reader wants for a series (US-12), kept in the browser so it also works for guests and
 * prerendered pages stay the same for everyone. It is written only when the reader picks a version on purpose (a
 * team link on the series page, the version switcher in the reader), never by "next chapter".
 */
@Service()
export class PreferredTeamStore {
  private readonly storage = inject(BrowserStorage);
  /** Team id per series (work id), most recent last. */
  private readonly _teams = signal<Record<string, string>>(sanitize(this.storage.read<unknown>(PREFERRED_TEAMS_KEY)));

  /** The team chosen for this series, or `null`. Reads a signal: usable inside `computed`. */
  teamFor(workId: string): string | null {
    return this._teams()[workId] ?? null;
  }

  remember(workId: string, teamId: string): void {
    this._teams.update((teams) => {
      const next = { ...teams };
      delete next[workId];
      next[workId] = teamId;
      const ids = Object.keys(next);
      for (const oldest of ids.slice(0, Math.max(0, ids.length - MAX_REMEMBERED_SERIES))) {
        delete next[oldest];
      }
      return next;
    });
    this.storage.write(PREFERRED_TEAMS_KEY, this._teams());
  }
}

/** Stored data may be old or edited by hand: keep only string ids. */
function sanitize(stored: unknown): Record<string, string> {
  if (!stored || typeof stored !== 'object') {
    return {};
  }
  return Object.fromEntries(Object.entries(stored).filter((entry): entry is [string, string] => typeof entry[1] === 'string'));
}
