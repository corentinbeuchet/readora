import { WorkSummary } from '@app/core/models/catalog';
import { PagedResponse } from '@app/core/models/api';
import { ChapterSummary } from '@app/core/models/chapter';
import { ScanlationRole, SeriesRef } from '@app/core/models/scanlation';

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

/** A member of a team and their roles in it (`GET /teams/{id}/members`). */
export interface TeamMember {
  username: string;
  roles: ScanlationRole[];
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
  /** One page (`?page=`, 24 each) of the series the team works on, the ones with the most chapters first. */
  series: PagedResponse<TeamSeries>;
  members: TeamMember[];
  /** The team's latest chapters across its series, newest first. */
  latestChapters: ChapterSummary[];
  /** The series of `latestChapters`, which may be on another page of `series`. */
  latestSeries: SeriesRef[];
  followers: number;
  following: boolean;
}
