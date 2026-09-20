// Library, reading history and bookmarks. Library and history are free for signed-in readers (LIBRARY_USE).

import { WorkSummary } from '@app/core/models/catalog';

export type BookmarkStatus = 'READING' | 'COMPLETED' | 'ON_HOLD' | 'DROPPED' | 'PLAN_TO_READ';

export const BOOKMARK_STATUS_LABELS: Record<BookmarkStatus, string> = {
  READING: $localize`:@@bookmarkStatus.reading:Reading`,
  COMPLETED: $localize`:@@bookmarkStatus.completed:Completed`,
  ON_HOLD: $localize`:@@bookmarkStatus.onHold:On hold`,
  DROPPED: $localize`:@@bookmarkStatus.dropped:Dropped`,
  PLAN_TO_READ: $localize`:@@bookmarkStatus.planToRead:Plan to read`
};

export type ReadingStatus = 'READING' | 'PLAN_TO_READ' | 'COMPLETED' | 'DROPPED';

export const READING_STATUS_LABELS: Record<ReadingStatus, string> = {
  READING: $localize`:@@readingStatus.reading:Reading`,
  PLAN_TO_READ: $localize`:@@readingStatus.planToRead:Plan to read`,
  COMPLETED: $localize`:@@readingStatus.completed:Completed`,
  DROPPED: $localize`:@@readingStatus.dropped:Dropped`
};

export interface LibraryEntry {
  workId: string;
  status: ReadingStatus;
  addedAt: string;
  updatedAt: string;
  newChapterNotifications: boolean;
}

export interface LibraryItem {
  work: WorkSummary;
  status: ReadingStatus;
  addedAt: string;
  updatedAt: string;
  /** Chapters published since the reader last read this series. */
  newChapters: number;
  /** Whether new chapters of this series are notified (US-10). */
  newChapterNotifications: boolean;
}

export interface ChapterRead {
  chapterId: string;
  workId: string;
  chapterNumber: string;
  readAt: string;
  finished: boolean;
}

export interface HistoryItem {
  work: WorkSummary;
  lastRead: ChapterRead;
}

/**
 * Progress follows the chapter number (US-12): a number is read once any team's version of it is finished.
 */
export interface WorkProgress {
  workId: string;
  /** The versions I finished (what history and "continue" point at). */
  finishedChapterIds: string[];
  /** The chapter numbers I read, in any version. */
  finishedChapterNumbers: string[];
  /** The number to read next; `null` when I am up to date. */
  nextChapterNumber: string | null;
  /** The version of that number to open: by the team I read last when it has one, else the first published. */
  nextChapterId: string | null;
}

export interface Bookmark {
  workId: string;
  lastReadChapterId: string | null;
  /** 1-based page number of the last page read (see `UpdateProgressRequest.pageIndex`). */
  lastReadPageIndex: number;
  status: BookmarkStatus;
  updatedAt: string;
}

export interface UpdateProgressRequest {
  chapterId: string;
  /** 1-based page number (the backend validates `@Min(1)`), despite the field name. */
  pageIndex: number;
}
