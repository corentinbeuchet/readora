import { TeamRef } from '@app/core/models/chapter';
import { WorkSummary } from '@app/core/models/catalog';

export interface Release {
  work: WorkSummary;
  /** The team that translated the chapter. */
  team: TeamRef;
  chapterId: string;
  chapterNumber: string;
  chapterTitle: string;
  publishedAt: string;
  /** Finished by the signed-in reader (always false for guests). */
  read: boolean;
}

export type RankingPeriod = 'TODAY' | 'WEEK' | 'MONTH' | 'ALL';

/** New chapters of one series, for one tile: how many, and the first one to read. */
export interface NewChaptersOfSeries {
  work: WorkSummary;
  count: number;
  /** The oldest of them: where the reader picks up. */
  first: Release;
}

/**
 * Groups releases (newest first, as the API sends them) by series, in the order of each series' newest release, so a
 * series with three new chapters is one tile marked "3 new" that opens the first of them.
 */
export function groupNewChapters(releases: readonly Release[]): NewChaptersOfSeries[] {
  const groups = new Map<string, NewChaptersOfSeries>();
  for (const release of releases) {
    const group = groups.get(release.work.id);
    if (group) {
      group.count++;
      group.first = release;
    } else {
      groups.set(release.work.id, { work: release.work, count: 1, first: release });
    }
  }
  return [...groups.values()];
}

export interface RankedWork {
  rank: number;
  work: WorkSummary;
  /** Popularity score, or average rating for top rated. */
  score: number;
  /** Number of ratings (top rated only). */
  ratings: number;
}
