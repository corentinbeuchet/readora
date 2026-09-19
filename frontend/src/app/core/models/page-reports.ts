export type PageReportReason = 'IMAGE_CORRUPTED' | 'MISSING_PAGE' | 'WRONG_ORDER' | 'LOW_QUALITY';

export const PAGE_REPORT_REASON_LABELS: Record<PageReportReason, string> = {
  IMAGE_CORRUPTED: 'Image corrupted or not loading',
  MISSING_PAGE: 'A page is missing',
  WRONG_ORDER: 'Pages are in the wrong order',
  LOW_QUALITY: 'Low quality / unreadable'
};

export interface PageReport {
  id: string;
  chapterId: string;
  workId: string;
  chapterNumber: string;
  pageNumber: number;
  reason: PageReportReason;
  status: 'OPEN' | 'RESOLVED';
  createdAt: string;
  resolvedAt?: string | null;
}
