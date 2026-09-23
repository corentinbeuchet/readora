import { WorkSummary } from '@app/core/models/catalog';
import { ChapterSummary } from '@app/core/models/chapter';
import { ScanlationRole } from '@app/core/models/scanlation';

export interface PublicProfile {
  username: string;
  displayName: string;
  avatarUrl: string | null;
  bio: string;
  joinedAt: string;
  chaptersRead: number;
  favouriteGenres: string[];
  completedSeries: WorkSummary[];
}

/** A series a team translates, with the number of chapters the team published in it. */
export interface TeamSeries {
  work: WorkSummary;
  chapterCount: number;
}

/** A reader found by the start of their username (`GET /users?q=`), to invite them to a team. */
export interface ReaderRef {
  username: string;
  displayName: string;
}

export interface TeamProfile {
  id: string;
  name: string;
  description: string | null;
  /** Every series the team works on, the one with the most chapters first. */
  series: TeamSeries[];
  members: { username: string; roles: ScanlationRole[] }[];
  /** The team's latest chapters across its series, newest first. */
  latestChapters: ChapterSummary[];
  followers: number;
  following: boolean;
}
