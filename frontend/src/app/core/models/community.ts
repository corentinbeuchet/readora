import { WorkSummary } from '@app/core/models/catalog';
import { ChapterSummary } from '@app/core/models/chapter';

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

export interface TeamProfile {
  id: string;
  name: string;
  series: WorkSummary;
  members: { username: string; roles: string[] }[];
  latestChapters: ChapterSummary[];
  followers: number;
  following: boolean;
}
