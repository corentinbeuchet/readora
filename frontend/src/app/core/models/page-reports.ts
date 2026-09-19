export type PageReportReason = 'IMAGE_CORRUPTED' | 'MISSING_PAGE' | 'WRONG_ORDER' | 'LOW_QUALITY';

export const PAGE_REPORT_REASON_LABELS: Record<PageReportReason, string> = {
  IMAGE_CORRUPTED: $localize`:@@pageReport.reason.imageCorrupted:Image corrupted or not loading`,
  MISSING_PAGE: $localize`:@@pageReport.reason.missingPage:A page is missing`,
  WRONG_ORDER: $localize`:@@pageReport.reason.wrongOrder:Pages are in the wrong order`,
  LOW_QUALITY: $localize`:@@pageReport.reason.lowQuality:Low quality / unreadable`
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
  resolvedAt: string | null;
}
