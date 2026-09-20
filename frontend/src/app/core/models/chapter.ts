import { WorkType } from '@app/core/models/catalog';

export interface DirectPublishChapterPayload {
  chapterNumber: string;
  title?: string;
  pages: {
    pageNumber: number;
    storageKey: string;
    cdnUrl?: string;
    width?: number;
    height?: number;
    /** What the page shows, for screen-reader users (US-07). */
    description?: string;
    /** The data-saver copy returned by the upload (US-07). */
    liteCdnUrl?: string;
  }[];
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
  scanlationProjectId: string | null;
  /** Reader view only (`GET /chapters/{id}`): the series, for its title and default reading mode. */
  work: { id: string; title: string; type: WorkType } | null;
  /** Reader view only: the team credited for the chapter, `null` when it has none. */
  team: { id: string; name: string } | null;
  /** Reader view only: published neighbours, `null` at either end. */
  previousChapterId: string | null;
  nextChapterId: string | null;
}

export interface ChapterSummary {
  id: string;
  workId: string;
  chapterNumber: string;
  title: string;
  status: Chapter['status'];
  pageCount: number;
  publishedAt: string | null;
}
