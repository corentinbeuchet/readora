import { WorkType } from '@app/core/models/catalog';

/** The team credited for a chapter: enough to name it and link to `/teams/:id`. */
export interface TeamRef {
  id: string;
  name: string;
}

/**
 * A chapter title that only repeats its number ("Chapter 8", or nothing): showing it next to "Chapter 8" says the same
 * thing twice, so lists leave it out.
 */
export function isDefaultChapterTitle(title: string | null | undefined, chapterNumber: string): boolean {
  const trimmed = (title ?? '').trim().toLowerCase();
  return trimmed === '' || trimmed === `chapter ${chapterNumber}`.toLowerCase();
}

/** A page as the client sends it once its image is uploaded (publishing a chapter, the pages of a task). */
export interface PagePayload {
  pageNumber: number;
  storageKey: string;
  cdnUrl?: string;
  width?: number;
  height?: number;
  /** What the page shows, for screen-reader users (US-07). */
  description?: string;
  /** The data-saver copy returned by the upload (US-07). */
  liteCdnUrl?: string;
}

export interface DirectPublishChapterPayload {
  /** The team the chapter is published for; the server checks that I may publish for it. */
  teamId: string;
  chapterNumber: string;
  title?: string;
  pages: PagePayload[];
}

export interface StorageUploadResult {
  storageKey: string;
  cdnUrl: string;
  /** Lighter JPEG copy of an uploaded image for the data saver; absent when none was made (US-07). */
  liteCdnUrl: string | null;
}

export interface PageAsset {
  pageNumber: number;
  storageKey: string;
  cdnUrl: string | null;
  width: number;
  height: number;
  /** Written by the uploader for screen readers; used as the image's alt text (US-07). */
  description: string | null;
  /** Lighter copy shown with "Data saver" on; absent for older pages (US-07). */
  liteCdnUrl: string | null;
}

export interface Chapter {
  id: string;
  workId: string;
  chapterNumber: string;
  title: string;
  status: 'DRAFT' | 'PENDING_REVIEW' | 'PUBLISHED' | 'ARCHIVED';
  pages: PageAsset[];
  /** Reader view only (`GET /chapters/{id}`): the series, for its title and default reading mode. */
  work: { id: string; title: string; type: WorkType } | null;
  /** Reader view only (`null` elsewhere): the team that translated this version of the chapter. */
  team: TeamRef | null;
  /** Reader view only (empty elsewhere): every team's version of this chapter number, this one included. */
  versions: ChapterVersion[];
  /** Reader view only: the chapter numbers before and after this one with their versions, `null` at either end. */
  previous: ChapterNeighbour | null;
  next: ChapterNeighbour | null;
  /** The version of `previous` / `next` to open by default: the same team's when it has one. */
  previousChapterId: string | null;
  nextChapterId: string | null;
}

/** One team's published version of a chapter number. */
export interface ChapterVersion {
  chapterId: string;
  team: TeamRef;
}

export interface ChapterNeighbour {
  chapterNumber: string;
  /** The first one published first. */
  versions: ChapterVersion[];
}

export interface ChapterSummary {
  id: string;
  workId: string;
  chapterNumber: string;
  title: string;
  status: Chapter['status'];
  pageCount: number;
  publishedAt: string | null;
  /** The team that translated this version of the chapter. */
  team: TeamRef;
}

/** A chapter number with every team's version of it, the first one published first (the order of the API). */
export interface ChapterGroup {
  chapterNumber: string;
  versions: ChapterSummary[];
}

/**
 * Groups the chapter list of a series by number. `GET /works/{id}/chapters` lists the versions of one number next
 * to each other, so consecutive equal numbers form a group and the reading order is kept.
 */
export function groupByNumber(chapters: readonly ChapterSummary[]): ChapterGroup[] {
  const groups: ChapterGroup[] = [];
  for (const chapter of chapters) {
    const last = groups.at(-1);
    if (last?.chapterNumber === chapter.chapterNumber) {
      last.versions.push(chapter);
    } else {
      groups.push({ chapterNumber: chapter.chapterNumber, versions: [chapter] });
    }
  }
  return groups;
}

/** The version to open: the preferred team's when it has one, otherwise the first one published. */
export function pickVersion<T extends { team: TeamRef }>(versions: readonly T[], preferredTeamId: string | null): T | undefined {
  return versions.find((version) => version.team.id === preferredTeamId) ?? versions[0];
}

/** A team with the number of chapters of the series it translated. */
export interface TeamShare {
  team: TeamRef;
  chapterCount: number;
}

/** The teams of a chapter list, the one with the most chapters first (then by name). */
export function teamsOf(chapters: readonly ChapterSummary[]): TeamShare[] {
  const shares = new Map<string, TeamShare>();
  for (const chapter of chapters) {
    const share = shares.get(chapter.team.id) ?? { team: chapter.team, chapterCount: 0 };
    shares.set(chapter.team.id, { ...share, chapterCount: share.chapterCount + 1 });
  }
  return [...shares.values()].sort((a, b) => b.chapterCount - a.chapterCount || a.team.name.localeCompare(b.team.name));
}

/** A team's first chapter waiting for a moderator before readers see it (US-11, `GET /moderation/chapters`). */
export interface WaitingChapter {
  chapterId: string;
  work: { id: string; title: string };
  team: TeamRef;
  chapterNumber: string;
  title: string;
  pages: PageAsset[];
  submittedAt: string;
}

/** What publishing did: readers see the chapter (`PUBLISHED`), or it waits for a moderator (a team's first, US-11). */
export interface PublishOutcome {
  chapterId: string;
  status: Chapter['status'];
}
