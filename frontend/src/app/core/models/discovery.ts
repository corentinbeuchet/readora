import { WorkSummary } from '@app/core/models/catalog';

export interface Release {
  work: WorkSummary;
  chapterId: string;
  chapterNumber: string;
  chapterTitle: string;
  publishedAt: string;
  /** Finished by the signed-in reader (always false for guests). */
  read: boolean;
}

export type RankingPeriod = 'TODAY' | 'WEEK' | 'MONTH' | 'ALL';

export interface RankedWork {
  rank: number;
  work: WorkSummary;
  /** Popularity score, or average rating for top rated. */
  score: number;
  /** Number of ratings (top rated only). */
  ratings: number;
}
